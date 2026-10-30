import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth-service';
import { applyFieldErrors, toApiProblem } from '../../core/http/api-problem';
import { Role, ROLES } from '../../models/enums';
import { RegisterRequest } from '../../models/auth';
import { AuthFrame } from '../../shared/components/auth-frame';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { notBlank } from '../../shared/validators/claim-validators';
import { PHONE_PATTERN, sameAs } from '../../shared/validators/user-validators';

/**
 * Sign-up from the sign-in screen: the same person, role and sign-in fields as the staff New user page, without its
 * Active switch. Every role is offered, as asked for; the server decides and a refusal shows as the form error.
 * Nobody is signed in afterwards: the person goes back to the sign-in screen with a notice.
 */
@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    AuthFrame,
    EnumLabel,
  ],
  templateUrl: './register-page.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly roles: readonly Role[] = ROLES;

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    phone: ['', [Validators.pattern(PHONE_PATTERN)]],
    role: ['CLAIMANT' as Role],
    username: ['', [Validators.required, notBlank, Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required, sameAs('password')]],
  });

  protected readonly hidePassword = signal(true);
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly formDetails = signal<string[]>([]);

  constructor() {
    // The confirmation is only judged when it changes, so tell it when the password moves under it.
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: RegisterRequest = {
      username: value.username.trim(),
      password: value.password,
      role: value.role,
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      phone: value.phone.trim() || undefined,
    };

    this.formError.set(null);
    this.formDetails.set([]);
    this.submitting.set(true);
    this.auth.register(request).subscribe({
      next: () => void this.router.navigate(['/login'], { queryParams: { reason: 'registered' } }),
      error: (err: unknown) => {
        const problem = toApiProblem(err);
        const controls = this.form.controls;
        if (problem.status === 409 && /username/i.test(problem.message)) {
          // A taken username belongs on its own field.
          controls.username.setErrors({ server: 'That username is already taken.' });
          controls.username.markAsTouched();
          this.submitting.set(false);
          return;
        }
        const unmatched = applyFieldErrors({ ...controls }, problem);
        this.formError.set(problem.message);
        this.formDetails.set(unmatched);
        this.submitting.set(false);
      },
    });
  }
}
