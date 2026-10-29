import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth-service';

/**
 * Lets a signed-in user through once their profile is loaded (a refresh keeps the token but not the profile).
 * If the profile cannot be loaded the session is dropped, so the login page never bounces back here.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toLogin = (reason?: 'unavailable') =>
    router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url, reason } });

  if (!auth.isAuthenticated()) {
    return toLogin();
  }
  return auth.ensureProfile().pipe(
    map(() => true),
    catchError(() => {
      auth.endSession();
      return of(toLogin('unavailable'));
    }),
  );
};
