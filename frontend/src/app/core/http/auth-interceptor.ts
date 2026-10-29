import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth-service';
import { API_BASE_URL } from '../config/api-base-url';
import { PUBLIC_REQUEST } from './http-context';

/** Adds the bearer token to calls to our own API, and to nothing else. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  const apiBase = inject(API_BASE_URL);
  const isApiCall = req.url === apiBase || req.url.startsWith(`${apiBase}/`);

  if (!token || !isApiCall || req.context.get(PUBLIC_REQUEST) || req.headers.has('Authorization')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
