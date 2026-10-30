import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth-service';
import { applyFieldErrors, toApiProblem } from '../../core/http/api-problem';
import { ResetPasswordRequest } from '../../models/auth';
import { AuthFrame } from '../../shared/components/auth-frame';
import { notBlank } from '../../shared/validators/claim-validators';
import { sameAs } from '../../shared/validators/user-validators';

/**
 * Sets a new password without signing in. The proof is the username plus the email the account was registered with:
 * nothing is mailed, and an email is not a secret, which is a known weakness the user chose (see CLAUDE.md). The
 * server gives one message for an unknown user, an inactive account and a wrong email, and this page shows it as is.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    AuthFrame,
  ],
  templateUrl: './forgot-password-page.html',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required, notBlank]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    newPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required, sameAs('newPassword')]],
  });

  protected readonly hidePassword = signal(true);
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly formDetails = signal<string[]>([]);

  constructor() {
    // The confirmation is only judged when it changes, so tell it when the password moves under it.
    this.form.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: ResetPasswordRequest = {
      username: value.username.trim(),
      email: value.email.trim(),
      newPassword: value.newPassword,
    };

    this.formError.set(null);
    this.formDetails.set([]);
    this.submitting.set(true);
    this.auth.resetPassword(request).subscribe({
      next: () =>
        void this.router.navigate(['/login'], { queryParams: { reason: 'password-reset' } }),
      error: (err: unknown) => {
        const problem = toApiProblem(err);
        const unmatched = applyFieldErrors({ ...this.form.controls }, problem);
        this.formError.set(problem.message);
        this.formDetails.set(unmatched);
        this.submitting.set(false);
      },
    });
  }
}
