import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth-service';
import { NotificationService } from '../../core/notifications/notification-service';
import { Market, Role } from '../../models/enums';
import { User } from '../../models/user';
import { ClaimCreatePage } from './claim-create-page';

const person = (
  id: number,
  role: Role,
  fullName: string,
  market?: Market,
  policyNumber?: string,
): User => ({
  id,
  username: `${role.toLowerCase()}${id}`,
  role,
  fullName,
  email: `${role.toLowerCase()}${id}@example.com`,
  active: true,
  market,
  policyNumber,
  createdAt: '2026-10-28T12:00:00',
});

const AIKO = person(1, 'CLAIMANT', 'Aiko Tanaka', 'JP', 'POL-JP-0001');
const NINA = person(10, 'CLAIMANT', 'Nina Park');
const PRIYA = person(18, 'OFFICER', 'Priya Nair');
const MARIA = person(19, 'MANAGER', 'Maria Santos');

describe('ClaimCreatePage', () => {
  let fixture: ComponentFixture<ClaimCreatePage>;
  let http: HttpTestingController;
  const success = vi.fn();

  const element = () => fixture.nativeElement as HTMLElement;
  // The form is protected API of the page; the tests drive it the way the template does.
  interface Internals {
    form: ClaimCreatePage['form'];
  }
  const form = () => (fixture.componentInstance as unknown as Internals).form;
  const labels = () =>
    Array.from(element().querySelectorAll('mat-form-field mat-label')).map((label) =>
      label.textContent?.trim(),
    );
  const title = () => element().querySelector('h1')?.textContent?.trim();
  const policyBox = () =>
    element().querySelector<HTMLInputElement>('input[formControlName="policyNumber"]')!;

  /** Opens the page as `me`, whatever their role: the page does not ask who is signed in, only their profile. */
  async function open(me: User) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNativeDateAdapter(),
        {
          provide: AuthService,
          useValue: { user: signal(me), isAuthenticated: signal(true) },
        },
        { provide: NotificationService, useValue: { success } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ClaimCreatePage);
    await fixture.whenStable();
  }

  async function submit() {
    await fixture.whenStable();
    element().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const fillIncident = (claimAmount = 1500) =>
    form().patchValue({
      claimType: 'MOTOR',
      incidentDate: new Date(2026, 9, 1),
      claimAmount,
      description: 'Rear-ended at the lights',
    });

  beforeEach(() => success.mockReset());

  afterEach(() => http.verify());

  describe('for a claimant with no market on their profile', () => {
    it('is a dropdown they must fill in', async () => {
      await open(NINA);

      expect(form().controls.market.enabled).toBe(true);
      expect(form().controls.market.value).toBeNull();
      expect(element().textContent).toContain('Choose the market this claim is filed in');

      fillIncident();
      await submit();

      expect(element().textContent).toContain('Choose the market for this claim');
      http.expectNone('/api/claims');
    });

    it('files the claim in the market they chose', async () => {
      await open(NINA);
      fillIncident();
      form().controls.market.setValue('SG');

      await submit();

      const request = http.expectOne('/api/claims');
      expect(request.request.body).toMatchObject({ claimantName: 'Nina Park', market: 'SG' });
      request.flush({ id: 5, claimNumber: 'CLM-2026-000005' });
    });

    it('takes the amount in the chosen market currency: yen has no decimals, dollars do', async () => {
      await open(NINA);

      form().patchValue({ market: 'SG', claimAmount: 10.5 });
      expect(form().controls.claimAmount.hasError('amountDecimals')).toBe(false);

      form().controls.market.setValue('JP');
      expect(form().controls.claimAmount.hasError('amountDecimals')).toBe(true);
    });
  });

  describe('the policy number', () => {
    it("is the claimant's own, at once and read-only, when their profile has one", async () => {
      await open(AIKO);

      expect(policyBox().value).toBe('POL-JP-0001');
      expect(policyBox().disabled).toBe(true);
      expect(element().textContent).toContain('Filled in for you');
    });

    it('waits for the market when the profile has none, then fills itself in and follows a change', async () => {
      await open(NINA);
      expect(policyBox().value).toBe('');
      expect(element().textContent).toContain('Fills in when you choose the market');

      form().controls.market.setValue('SG');
      await fixture.whenStable();
      expect(policyBox().value).toBe('POL-SG-0010');
      expect(element().textContent).toContain('Filled in for you');

      form().controls.market.setValue('JP');
      await fixture.whenStable();
      expect(policyBox().value).toBe('POL-JP-0010');
    });

    it('is never typed, never sent, and does not make the form look edited', async () => {
      await open(NINA);
      form().controls.market.setValue('SG');
      fillIncident();
      await submit();

      const request = http.expectOne('/api/claims');
      expect(request.request.body).not.toHaveProperty('policyNumber');
      request.flush({ id: 5, claimNumber: 'CLM-2026-000005', policyNumber: 'POL-SG-0010' });
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('is not something the user can change: the field is read-only', async () => {
      await open(NINA);

      expect(form().controls.policyNumber.disabled).toBe(true);
      expect(policyBox().disabled).toBe(true);
    });
  });

  describe('for a claimant who has a market on their profile', () => {
    it('is locked to it, as before', async () => {
      await open(AIKO);

      expect(form().controls.market.disabled).toBe(true);
      expect(form().controls.market.value).toBe('JP');
      expect(element().textContent).toContain('Taken from your profile');
    });

    it('files the claim in that market', async () => {
      await open(AIKO);
      fillIncident();

      await submit();

      const request = http.expectOne('/api/claims');
      expect(request.request.body).toMatchObject({ market: 'JP' });
      request.flush({ id: 6, claimNumber: 'CLM-2026-000006' });
    });
  });

  describe.each([
    ['an officer', PRIYA],
    ['a manager', MARIA],
  ])('for %s', (_role, me) => {
    it('shows their own name straight away, in a read-only box with no claimant dropdown', async () => {
      await open(me);

      const box = element().querySelector<HTMLInputElement>(
        'input[formControlName="claimantName"]',
      );
      expect(box).not.toBeNull();
      expect(box!.value).toBe(me.fullName);
      expect(form().controls.claimantName.disabled).toBe(true);
      expect(element().querySelector('mat-select[formControlName="claimantId"]')).toBeNull();
      expect(element().textContent).toContain('Taken from your profile');
    });

    it('has no market on their profile, so Market is a dropdown to fill in', async () => {
      await open(me);

      expect(form().controls.market.enabled).toBe(true);
      expect(element().textContent).toContain('Choose the market this claim is filed in');

      fillIncident();
      await submit();

      expect(element().textContent).toContain('Choose the market for this claim');
      http.expectNone('/api/claims');
    });

    it('gets a policy number made from their own user id once the market is chosen', async () => {
      await open(me);
      expect(policyBox().value).toBe('');

      form().controls.market.setValue('SG');
      await fixture.whenStable();

      expect(policyBox().value).toBe(`POL-SG-00${me.id}`);
    });

    it('files the claim in their own name, in the market they chose, naming no claimant', async () => {
      await open(me);
      form().controls.market.setValue('SG');
      fillIncident();

      await submit();

      const request = http.expectOne('/api/claims');
      expect(request.request.body).toMatchObject({ claimantName: me.fullName, market: 'SG' });
      expect(request.request.body).not.toHaveProperty('claimantId');
      request.flush({ id: 9, claimNumber: 'CLM-2026-000009' });
    });
  });

  describe('the page every role sees', () => {
    it('has the same title and the same fields, in the same order, for a claimant, an officer and a manager', async () => {
      const seen: { title?: string; labels: (string | undefined)[] }[] = [];
      for (const me of [AIKO, PRIYA, MARIA]) {
        await open(me);
        seen.push({ title: title(), labels: labels() });
        fixture.destroy();
        TestBed.resetTestingModule();
      }

      expect(seen[0].title).toBe('File a claim');
      expect(seen[0].labels).toEqual([
        'Claimant name',
        'Market',
        'Policy number',
        'Claim type',
        'Date of incident',
        'Claim amount',
        'What happened?',
      ]);
      expect(seen[1]).toEqual(seen[0]);
      expect(seen[2]).toEqual(seen[0]);
    });
  });
});
