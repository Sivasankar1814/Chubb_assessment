import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../../models/enums';
import { AuthService } from './auth-service';

/**
 * Keeps the UI honest: a route lists its roles in `data.roles`. This is navigation only; the server enforces
 * the same rules on every call.
 */
export const roleGuard: CanActivateFn = (route) => {
  const allowed = route.data['roles'] as Role[] | undefined;
  if (!allowed?.length || inject(AuthService).hasRole(...allowed)) {
    return true;
  }
  return inject(Router).createUrlTree(['/forbidden']);
};
