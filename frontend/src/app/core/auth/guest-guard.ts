import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';

/** Signed-in users have no business on the login page. */
export const guestGuard: CanActivateFn = () => {
  if (inject(AuthService).isAuthenticated()) {
    return inject(Router).createUrlTree(['/dashboard']);
  }
  return true;
};
