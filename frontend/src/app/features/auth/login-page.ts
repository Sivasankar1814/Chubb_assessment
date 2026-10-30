import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth-service';
import { safeReturnUrl } from '../../core/auth/return-url';
import { toApiProblem } from '../../core/http/api-problem';
import { BrandMark } from '../../shared/components/brand-mark';

interface DemoAccount {
  username: string;
  password: string;
  label: string;
  icon: string;
}

declare const ngDevMode: unknown;

// Demo credentials from the README, offered only by the dev server. `ngDevMode` is false in a
// production build, which removes the list (and the passwords) from the bundle altogether.
const DEMO_ACCOUNTS: readonly DemoAccount[] = ngDevMode
  ? [
      { username: 'claimant1', password: 'claimant123', label: 'Claimant', icon: 'person' },
      { username: 'officer1', password: 'officer123', label: 'Officer', icon: 'badge' },
      {
        username: 'manager1',
        password: 'manager123',
        label: 'Manager',
        icon: 'supervisor_account',
      },
    ]
  : [];

const NOTICES: Record<string, string> = {
  expired: 'Your session has ended. Please sign in again.',
  unavailable: "We couldn't load your profile. Please sign in again.",
  registered: 'Your account is ready. Sign in with your new username and password.',
  'password-reset': 'Your password was changed. Sign in with the new one.',
};

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    BrandMark,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });
  protected readonly hidePassword = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly year = new Date().getFullYear();
  protected readonly notice = computed(
    () => NOTICES[this.route.snapshot.queryParamMap.get('reason') ?? ''] ?? null,
  );

  protected useDemo(account: DemoAccount): void {
    this.form.setValue({ username: account.username, password: account.password });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () =>
        void this.router.navigateByUrl(
          safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        ),
      error: (err: unknown) => {
        const problem = toApiProblem(err);
        this.error.set(problem.status === 401 ? 'Invalid username or password.' : problem.message);
        this.submitting.set(false);
      },
    });
  }
}
