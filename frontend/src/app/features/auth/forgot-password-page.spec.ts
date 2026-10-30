import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ForgotPasswordPage } from './forgot-password-page';

describe('ForgotPasswordPage', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const element = () => fixture.nativeElement as HTMLElement;
  interface Internals {
    form: ForgotPasswordPage['form'];
  }
  const form = () => (fixture.componentInstance as unknown as Internals).form;

  async function submit() {
    await fixture.whenStable();
    element().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const fill = (overrides: Partial<ReturnType<typeof form>['value']> = {}) =>
    form().patchValue({
      username: ' officer1 ',
      email: 'priya@example.com',
      newPassword: 'brandnew1',
      confirmPassword: 'brandnew1',
      ...overrides,
    });

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ForgotPasswordPage);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('asks for the username, the email on the account and a new password twice', () => {
    expect(element().querySelector('h1')?.textContent).toContain('Reset your password');
    const labels = Array.from(element().querySelectorAll('mat-label')).map(
      (label) => label.textContent ?? '',
    );

    expect(labels).toEqual([
      'Username',
      'Email on your account',
      'New password',
      'Confirm new password',
    ]);
  });

  it('sends the trimmed username and email with the new password, then goes to sign-in', async () => {
    fill();

    await submit();

    const request = http.expectOne('/api/auth/reset-password');
    expect(request.request.body).toEqual({
      username: 'officer1',
      email: 'priya@example.com',
      newPassword: 'brandnew1',
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'password-reset' },
    });
    expect(sessionStorage.length).toBe(0); // no session: the person signs in with the new password
  });

  it('does not call the server while the new passwords differ', async () => {
    fill({ confirmPassword: 'brandnew2' });

    await submit();

    http.expectNone('/api/auth/reset-password');
    expect(element().textContent).toContain('The passwords do not match');
  });

  it('asks for every field, and for a valid email, before it calls the server', async () => {
    await submit();
    expect(element().textContent).toContain('Enter your username');
    expect(element().textContent).toContain('Enter the email address you registered with');
    expect(element().textContent).toContain('Choose a new password');

    fill({ email: 'not-an-email' });
    await submit();
    expect(element().textContent).toContain('Enter a valid email address');
    http.expectNone('/api/auth/reset-password');
  });

  it('shows the one message the server gives for any mismatch, and stays on the page', async () => {
    fill();
    await submit();

    http
      .expectOne('/api/auth/reset-password')
      .flush(
        { status: 409, message: 'Those details do not match an active account' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'Those details do not match an active account',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      false,
    );
  });
});
