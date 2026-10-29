import { HttpClient, HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { isRole, Role } from '../../models/enums';
import { LoginRequest, TokenResponse } from '../../models/auth';
import { User } from '../../models/user';
import { API_BASE_URL } from '../config/api-base-url';
import { PUBLIC_REQUEST, SKIP_ERROR_NOTIFICATION } from '../http/http-context';
import { NotificationService } from '../notifications/notification-service';
import { decodeJwtPayload } from './jwt';
import { StoredSession, TokenStorage } from './token-storage';

export type LogoutReason = 'expired' | 'unavailable';

const WARN_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
/** setTimeout stores its delay in 32 bits, so longer waits are chained. */
const MAX_TIMER_MS = 2_000_000_000;

/**
 * Holds the login session. The token is only decoded to time the session out: whether a request is allowed is
 * always the server's decision, and the roles kept here only decide what the UI shows.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(TokenStorage);
  private readonly notify = inject(NotificationService);
  private readonly apiBase = inject(API_BASE_URL);

  private readonly sessionState = signal<StoredSession | null>(null);
  private readonly profile = signal<User | null>(null);
  private cancelTimers: (() => void)[] = [];

  readonly user = this.profile.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionState() !== null);
  readonly token = computed(() => this.sessionState()?.token ?? null);
  readonly roles = computed<readonly Role[]>(() => this.sessionState()?.roles ?? []);
  readonly role = computed<Role | null>(() => this.roles()[0] ?? null);
  readonly isStaff = computed(() => this.hasRole('OFFICER', 'MANAGER'));

  constructor() {
    this.restore();
  }

  hasRole(...allowed: Role[]): boolean {
    const mine = this.roles();
    return allowed.some((role) => mine.includes(role));
  }

  login(credentials: LoginRequest): Observable<User> {
    const context = new HttpContext().set(PUBLIC_REQUEST, true).set(SKIP_ERROR_NOTIFICATION, true);
    return this.http
      .post<TokenResponse>(`${this.apiBase}/auth/login`, credentials, { context })
      .pipe(
        tap((response) => this.startSession(response)),
        switchMap(() => this.loadProfile()),
        catchError((err: unknown) => {
          this.endSession();
          return throwError(() => err);
        }),
      );
  }

  /** The token carries no user id, so every session starts by reading the profile. */
  loadProfile(): Observable<User> {
    return this.http
      .get<User>(`${this.apiBase}/users/me`)
      .pipe(tap((user) => this.profile.set(user)));
  }

  ensureProfile(): Observable<User> {
    const cached = this.profile();
    return cached ? of(cached) : this.loadProfile();
  }

  logout(options: { reason?: LogoutReason; returnUrl?: string } = {}): void {
    this.endSession();
    void this.router.navigate(['/login'], {
      queryParams: { reason: options.reason, returnUrl: options.returnUrl },
    });
  }

  /** Called by the error interceptor on a 401 from a protected call: the token has expired or been rejected. */
  handleUnauthorized(): void {
    if (this.sessionState()) {
      this.logout({ reason: 'expired', returnUrl: this.router.url });
    }
  }

  /** Clears the session without navigating (used when a guard is about to redirect anyway). */
  endSession(): void {
    this.clearTimers();
    this.storage.clear();
    this.sessionState.set(null);
    this.profile.set(null);
  }

  private startSession(response: TokenResponse): void {
    const payload = decodeJwtPayload(response.accessToken);
    const expiresAt = payload?.exp
      ? payload.exp * 1000
      : Date.now() + response.expiresInSeconds * 1000;
    const session: StoredSession = {
      token: response.accessToken,
      username: response.username,
      roles: response.roles.filter(isRole),
      expiresAt,
    };
    this.storage.write(session);
    this.sessionState.set(session);
    this.scheduleTimers(expiresAt);
  }

  private restore(): void {
    const stored = this.storage.read();
    if (!stored) {
      return;
    }
    if (stored.expiresAt <= Date.now()) {
      this.storage.clear();
      return;
    }
    this.sessionState.set(stored);
    this.scheduleTimers(stored.expiresAt);
  }

  private scheduleTimers(expiresAt: number): void {
    this.clearTimers();
    this.cancelTimers.push(
      this.arm(expiresAt, () => this.logout({ reason: 'expired', returnUrl: this.router.url })),
    );
    if (expiresAt - Date.now() > WARN_BEFORE_EXPIRY_MS) {
      this.cancelTimers.push(
        this.arm(expiresAt - WARN_BEFORE_EXPIRY_MS, () =>
          this.notify.warn(
            'Your session ends in 5 minutes. Finish what you are doing, then sign in again.',
          ),
        ),
      );
    }
  }

  /** Runs `action` at epoch-ms `at`, re-arming when the wait is longer than a timer can hold. */
  private arm(at: number, action: () => void): () => void {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const wait = (): void => {
      handle = setTimeout(
        () => (at - Date.now() > 0 ? wait() : action()),
        Math.min(Math.max(0, at - Date.now()), MAX_TIMER_MS),
      );
    };
    wait();
    return () => clearTimeout(handle);
  }

  private clearTimers(): void {
    this.cancelTimers.forEach((cancel) => cancel());
    this.cancelTimers = [];
  }
}
