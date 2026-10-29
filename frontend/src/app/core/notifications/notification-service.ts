import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 4000 });
  }

  info(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 6000 });
  }

  warn(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 10000 });
  }

  /** Errors stay up longer and are announced assertively to screen readers. */
  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 8000,
      panelClass: 'snack-error',
      politeness: 'assertive',
    });
  }
}
