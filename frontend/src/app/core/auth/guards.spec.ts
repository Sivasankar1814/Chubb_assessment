import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable } from 'rxjs';
import { Role } from '../../models/enums';
import { authGuard } from './auth-guard';
import { guestGuard } from './guest-guard';
import { roleGuard } from './role-guard';

function setup(role: Role | null) {
  sessionStorage.clear();
  if (role) {
    sessionStorage.setItem(
      'claims.session',
      JSON.stringify({
        token: 't',
        username: 'u',
        roles: [role],
        expiresAt: Date.now() + 3_600_000,
      }),
    );
  }
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return { router: TestBed.inject(Router), http: TestBed.inject(HttpTestingController) };
}

const route = (data: Record<string, unknown> = {}) =>
  ({ data }) as unknown as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;
const run = <T>(fn: () => T) => TestBed.runInInjectionContext(fn);

describe('roleGuard', () => {
  it('lets a listed role through', () => {
    setup('MANAGER');

    expect(run(() => roleGuard(route({ roles: ['OFFICER', 'MANAGER'] }), state('/workload')))).toBe(
      true,
    );
  });

  it('sends everyone else to the forbidden page', () => {
    const { router } = setup('CLAIMANT');

    const result = run(() =>
      roleGuard(route({ roles: ['OFFICER', 'MANAGER'] }), state('/workload')),
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('allows a route that lists no roles', () => {
    setup('CLAIMANT');

    expect(run(() => roleGuard(route(), state('/profile')))).toBe(true);
  });
});

describe('guestGuard', () => {
  it('lets a visitor see the login page', () => {
    setup(null);

    expect(run(() => guestGuard(route(), state('/login')))).toBe(true);
  });

  it('sends a signed-in user to the dashboard', () => {
    const { router } = setup('OFFICER');

    const result = run(() => guestGuard(route(), state('/login')));

    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });
});

describe('authGuard', () => {
  it('sends a visitor to login, remembering where they were going', () => {
    const { router } = setup(null);

    const result = run(() => authGuard(route(), state('/claims/7')));

    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fclaims%2F7');
  });

  it('loads the profile after a refresh before letting the user in', () => {
    const { http } = setup('OFFICER');
    let allowed: unknown;

    (run(() => authGuard(route(), state('/claims'))) as Observable<unknown>).subscribe(
      (r) => (allowed = r),
    );
    http.expectOne('/api/users/me').flush({ id: 3, role: 'OFFICER', fullName: 'Priya Nair' });

    expect(allowed).toBe(true);
  });

  it('drops the session, instead of looping, when the profile cannot be loaded', () => {
    const { http, router } = setup('OFFICER');
    let result: unknown;

    (run(() => authGuard(route(), state('/claims'))) as Observable<unknown>).subscribe(
      (r) => (result = r),
    );
    http.expectOne('/api/users/me').flush({}, { status: 500, statusText: 'Server Error' });

    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fclaims&reason=unavailable',
    );
    expect(sessionStorage.getItem('claims.session')).toBeNull();
  });
});
