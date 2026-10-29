import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, inject, Injectable, Injector } from '@angular/core';
import { NotificationService } from './notification-service';

const THROTTLE_MS = 5000;

/** Last resort for errors nobody handled. HTTP failures are already reported by the error interceptor. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);
  private lastShownAt = 0;

  handleError(error: unknown): void {
    console.error(error);
    if (error instanceof HttpErrorResponse) {
      return;
    }
    const now = Date.now();
    if (now - this.lastShownAt < THROTTLE_MS) {
      return;
    }
    this.lastShownAt = now;
    this.injector
      .get(NotificationService)
      .error('Something unexpected happened. If it keeps happening, reload the page.');
  }
}
