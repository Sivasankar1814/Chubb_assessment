import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { fakeToken } from '../../testing/fake-token';
import { NotificationService } from '../notifications/notification-service';
import { AuthService } from './auth-service';

const SESSION_KEY = 'claims.session';
const OFFICER = {
  id: 3,
  username: 'officer1',
  role: 'OFFICER',
  fullName: 'Priya Nair',
  email: 'priya@example.com',
  active: true,
  createdAt: '2026-01-01T00:00:00',
};

function tokenResponse(expiresInSeconds = 7200, roles = ['OFFICER']) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    accessToken: fakeToken({ sub: 'officer1', exp, roles }),
    tokenType: 'Bearer',
    expiresInSeconds,
    username: 'officer1',
    roles,
  };
}

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    navigate,
    notify: TestBed.inject(NotificationService),
  };
}

describe('AuthService', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
  });

  it('logs in, keeps the token and roles, and loads the profile', () => {
    const { auth, http } = setup();
    let signedInAs: string | undefined;

    auth
      .login({ username: 'officer1', password: 'officer123' })
      .subscribe((user) => (signedInAs = user.fullName));
    http.expectOne('/api/auth/login').flush(tokenResponse());
    http.expectOne('/api/users/me').flush(OFFICER);

    expect(signedInAs).toBe('Priya Nair');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('OFFICER');
    expect(auth.isStaff()).toBe(true);
    expect(auth.hasRole('MANAGER')).toBe(false);
    expect(auth.user()?.id).toBe(3);
    expect(sessionStorage.getItem(SESSION_KEY)).toContain('officer1');
  });

  it('does not log in on bad credentials and passes the error to the caller', () => {
    const { auth, http } = setup();
    let status: number | undefined;

    auth.login({ username: 'officer1', password: 'wrong' }).subscribe({
      error: (err: { status: number }) => (status = err.status),
    });
    http
      .expectOne('/api/auth/login')
      .flush(
        { status: 401, message: 'Invalid username or password' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('drops the session when the profile cannot be loaded', () => {
    const { auth, http } = setup();

    auth
      .login({ username: 'officer1', password: 'officer123' })
      .subscribe({ error: () => undefined });
    http.expectOne('/api/auth/login').flush(tokenResponse());
    http.expectOne('/api/users/me').flush({}, { status: 500, statusText: 'Server Error' });

    expect(auth.isAuthenticated()).toBe(false);
  });

  it('ignores role names it does not know', () => {
    const { auth, http } = setup();

    auth.login({ username: 'officer1', password: 'x' }).subscribe();
    http.expectOne('/api/auth/login').flush(tokenResponse(7200, ['OFFICER', 'SUPERUSER']));
    http.expectOne('/api/users/me').flush(OFFICER);

    expect(auth.roles()).toEqual(['OFFICER']);
  });

  it('restores a session that has not expired after a page refresh', () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: 't',
        username: 'officer1',
        roles: ['OFFICER'],
        expiresAt: Date.now() + 60_000,
      }),
    );

    const { auth } = setup();

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('t');
  });

  it('discards a stored session that has expired', () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: 't',
        username: 'officer1',
        roles: ['OFFICER'],
        expiresAt: Date.now() - 1,
      }),
    );

    const { auth } = setup();

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('ignores a stored session that is not the right shape', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: 1, roles: 'OFFICER' }));

    expect(setup().auth.isAuthenticated()).toBe(false);
  });

  it('signs out: clears everything and goes to the login page', () => {
    const { auth, http, navigate } = setup();
    auth.login({ username: 'officer1', password: 'x' }).subscribe();
    http.expectOne('/api/auth/login').flush(tokenResponse());
    http.expectOne('/api/users/me').flush(OFFICER);

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: undefined, returnUrl: undefined },
    });
  });

  it('signs out by itself when the token expires, after warning five minutes before', () => {
    vi.useFakeTimers();
    const { auth, http, navigate, notify } = setup();
    const warn = vi.spyOn(notify, 'warn').mockImplementation(() => undefined);
    auth.login({ username: 'officer1', password: 'x' }).subscribe();
    http.expectOne('/api/auth/login').flush(tokenResponse(600));
    http.expectOne('/api/users/me').flush(OFFICER);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({ queryParams: expect.objectContaining({ reason: 'expired' }) }),
    );
  });

  it('treats a 401 from a protected call as an expired session, once signed in', () => {
    const { auth, http, navigate } = setup();

    auth.handleUnauthorized();
    expect(navigate).not.toHaveBeenCalled();

    auth.login({ username: 'officer1', password: 'x' }).subscribe();
    http.expectOne('/api/auth/login').flush(tokenResponse());
    http.expectOne('/api/users/me').flush(OFFICER);
    auth.handleUnauthorized();

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
