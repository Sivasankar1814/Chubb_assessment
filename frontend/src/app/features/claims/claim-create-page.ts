import { Component, computed, effect, inject, Signal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { AuthService } from '../../core/auth/auth-service';
import { HasUnsavedChanges } from '../../core/auth/unsaved-changes-guard';
import { applyFieldErrors, toApiProblem } from '../../core/http/api-problem';
import { NotificationService } from '../../core/notifications/notification-service';
import { CreateClaimRequest } from '../../models/claim';
import { currencyOf } from '../../models/currency';
import { CLAIM_TYPES, ClaimType, Market, MARKETS } from '../../models/enums';
import { User } from '../../models/user';
import { today, toIsoDate } from '../../shared/dates';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { MarketName } from '../../shared/pipes/market-name-pipe';
import { policyNumberFor } from '../../shared/policy-number';
import { amountPrecision, notBlank, notInFuture } from '../../shared/validators/claim-validators';
import { ClaimsApi } from './claims-api';

const MAX_DESCRIPTION = 1000;

@Component({
  selector: 'app-claim-create-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    EnumLabel,
    MarketName,
  ],
  templateUrl: './claim-create-page.html',
})
export class ClaimCreatePage implements HasUnsavedChanges {
  private readonly api = inject(ClaimsApi);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly types = CLAIM_TYPES;
  protected readonly markets = MARKETS;
  protected readonly maxDate = today();
  protected readonly maxDescription = MAX_DESCRIPTION;

  // Everyone files in their own name, claimants, officers and managers alike: the name is the signed-in user's.
  protected readonly form = inject(NonNullableFormBuilder).group({
    claimantName: [{ value: '', disabled: true }],
    // Locked to the profile's market when there is one (a claimant's); otherwise chosen here (see useProfile).
    market: [{ value: null as Market | null, disabled: true }, [Validators.required]],
    // Shown, never typed and never sent: the server decides the policy number (see policyNumber below).
    policyNumber: [{ value: '', disabled: true }],
    claimType: [null as ClaimType | null, [Validators.required]],
    incidentDate: [null as Date | null, [Validators.required, notInFuture]],
    claimAmount: [
      null as number | null,
      // The decimals allowed follow the currency, which follows the market: yen and rupiah have none.
      [Validators.required, Validators.min(0.01), amountPrecision(13, () => this.decimals())],
    ],
    description: ['', [Validators.required, notBlank, Validators.maxLength(MAX_DESCRIPTION)]],
  });

  /** The claim is in the currency of its market, which follows the form's market, chosen or from the profile. */
  protected readonly market = toSignal(
    this.form.controls.market.valueChanges.pipe(startWith(this.form.controls.market.value)),
    { requireSync: true },
  );
  /** Where the market comes from: a profile that has one locks it; otherwise (staff, new claimants) it is chosen here. */
  protected readonly marketSource = signal<'profile' | 'choice'>('choice');
  protected readonly marketHint = computed(() =>
    this.marketSource() === 'choice'
      ? 'Choose the market this claim is filed in'
      : 'Taken from your profile',
  );
  /** Whose claim it is: the signed-in user, whatever their role. */
  private readonly profile = signal<User | undefined>(undefined);
  /**
   * A preview of the policy number the server will give this claim (see `policyNumberFor`): the profile's own, else one
   * made from the market and the user id, which is why it waits for the market when the profile has none.
   */
  protected readonly policyNumber = computed(() => policyNumberFor(this.profile(), this.market()));
  protected readonly policyHint = computed(() =>
    this.policyNumber() ? 'Filled in for you' : 'Fills in when you choose the market',
  );
  protected readonly currency = computed(() => currencyOf(this.market()));
  // Typed outright: the form's validator reads this, and this reads the form, which TypeScript cannot infer in a circle.
  private readonly decimals: Signal<number> = computed(() => this.currency()?.decimals ?? 2);

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly formDetails = signal<string[]>([]);
  private submitted = false;

  constructor() {
    const controls = this.form.controls;
    // A new market can make an amount that was fine (cents) wrong (yen), or the other way round.
    controls.market.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => controls.claimAmount.updateValueAndValidity());
    this.useProfile(this.auth.user() ?? undefined);
    // Keeps the read-only box in step. Setting it is not the user changing the form, so it does not make it dirty.
    effect(() => {
      const number = this.policyNumber();
      untracked(() => controls.policyNumber.setValue(number));
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.submitted && this.form.dirty;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    // No claimantId: the backend files the claim for whoever is signed in.
    const request: CreateClaimRequest = {
      claimantName: value.claimantName,
      market: value.market as Market,
      claimType: value.claimType as ClaimType,
      description: value.description.trim(),
      claimAmount: Number(value.claimAmount),
      incidentDate: toIsoDate(value.incidentDate as Date),
    };

    this.formError.set(null);
    this.formDetails.set([]);
    this.submitting.set(true);
    this.api.create(request).subscribe({
      next: (claim) => {
        this.submitted = true;
        this.notify.success(`Claim ${claim.claimNumber} submitted.`);
        void this.router.navigate(['/claims', claim.id]);
      },
      error: (err: unknown) => {
        const problem = toApiProblem(err);
        const controls = this.form.controls;
        const unmatched = applyFieldErrors(
          {
            claimantName: controls.claimantName,
            market: controls.market,
            claimType: controls.claimType,
            description: controls.description,
            claimAmount: controls.claimAmount,
            incidentDate: controls.incidentDate,
          },
          problem,
        );
        this.formError.set(problem.message);
        this.formDetails.set(unmatched);
        this.submitting.set(false);
      },
    });
  }

  private useProfile(profile: User | undefined): void {
    const { claimantName, market } = this.form.controls;
    this.profile.set(profile);
    claimantName.setValue(profile?.fullName ?? '');
    // The backend only lets a claimant with a market on the profile file in it, so that one is locked. Anyone else
    // (officers and managers have none, nor do new claimants) chooses where the claim is filed.
    if (profile?.market) {
      this.marketSource.set('profile');
      market.setValue(profile.market);
      market.disable();
      return;
    }
    this.marketSource.set('choice');
    market.enable();
  }
}
