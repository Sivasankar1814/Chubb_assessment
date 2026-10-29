import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth-service';
import { NotificationService } from '../notifications/notification-service';
import { toApiProblem } from './api-problem';
import { PUBLIC_REQUEST, SKIP_ERROR_NOTIFICATION } from './http-context';

/**
 * Handles the failures that are the same everywhere: an expired session, no connection, a server fault, a
 * refused action. Validation (400), not-found (404) and business-rule (409) errors belong to whoever made the
 * call, so they pass through untouched. The error is always rethrown.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notify = inject(NotificationService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401 && !req.context.get(PUBLIC_REQUEST)) {
          auth.handleUnauthorized();
        } else if (!req.context.get(SKIP_ERROR_NOTIFICATION) && isShownEverywhere(err.status)) {
          notify.error(toApiProblem(err).message);
        }
      }
      return throwError(() => err);
    }),
  );
};

function isShownEverywhere(status: number): boolean {
  return status === 0 || status === 403 || status >= 500;
}
