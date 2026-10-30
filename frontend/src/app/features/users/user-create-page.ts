import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { HasUnsavedChanges } from '../../core/auth/unsaved-changes-guard';
import { applyFieldErrors, toApiProblem } from '../../core/http/api-problem';
import { NotificationService } from '../../core/notifications/notification-service';
import { Role, ROLES } from '../../models/enums';
import { CreateUserRequest } from '../../models/user';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { notBlank } from '../../shared/validators/claim-validators';
import { PHONE_PATTERN } from '../../shared/validators/user-validators';
import { UserDirectory } from './user-directory';
import { UsersApi } from './users-api';

@Component({
  selector: 'app-user-create-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    EnumLabel,
  ],
  templateUrl: './user-create-page.html',
  styleUrl: './user-create-page.scss',
})
export class UserCreatePage implements HasUnsavedChanges {
  readonly discardSubject = 'user';

  private readonly api = inject(UsersApi);
  private readonly directory = inject(UserDirectory);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  /** Officers and managers may register any role; the server decides, and a refusal shows as the form error. */
  protected readonly roles: readonly Role[] = ROLES;

  // No role asks for anything more: a claim's market is chosen when it is filed, and an officer's capacity is the
  // server's default. The controls follow the order of the page: person, role, sign-in.
  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    phone: ['', [Validators.pattern(PHONE_PATTERN)]],
    role: ['CLAIMANT' as Role],
    username: ['', [Validators.required, notBlank, Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    active: [true],
  });

  protected readonly hidePassword = signal(true);
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly formDetails = signal<string[]>([]);
  private submitted = false;

  hasUnsavedChanges(): boolean {
    return !this.submitted && this.form.dirty;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: CreateUserRequest = {
      username: value.username.trim(),
      password: value.password,
      role: value.role,
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      phone: value.phone.trim() || undefined,
      active: value.active,
    };

    this.formError.set(null);
    this.formDetails.set([]);
    this.submitting.set(true);
    this.api.create(request).subscribe({
      next: (user) => {
        this.submitted = true;
        this.directory.refresh();
        this.notify.success(`${user.fullName} can now sign in as ${user.username}.`);
        void this.router.navigate(['/users']);
      },
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
