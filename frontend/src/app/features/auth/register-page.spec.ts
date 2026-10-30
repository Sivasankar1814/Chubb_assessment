import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Role } from '../../models/enums';
import { RegisterPage } from './register-page';

const CREATED = {
  id: 20,
  username: 'nora',
  role: 'CLAIMANT',
  fullName: 'Nora Lim',
  email: 'nora@example.com',
  active: true,
  createdAt: '2026-10-30T09:00:00',
};

describe('RegisterPage', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const element = () => fixture.nativeElement as HTMLElement;
  // The form is protected API of the page; the tests drive it the way the template does.
  interface Internals {
    form: RegisterPage['form'];
    roles: readonly Role[];
  }
  const page = () => fixture.componentInstance as unknown as Internals;
  const form = () => page().form;

  async function submit() {
    await fixture.whenStable();
    element().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const fill = (overrides: Partial<ReturnType<typeof form>['value']> = {}) =>
    form().patchValue({
      fullName: ' Nora Lim ',
      email: 'nora@example.com',
      username: 'nora',
      password: 'secret123',
      confirmPassword: 'secret123',
      ...overrides,
    });

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterPage);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('is titled Create new user and has the same three sections as the staff form', () => {
    expect(element().querySelector('h1')?.textContent).toContain('Create new user');
    const sections = Array.from(element().querySelectorAll('form h2')).map(
      (heading) => heading.textContent ?? '',
    );

    expect(sections).toHaveLength(3);
    expect(sections[0]).toContain('Person details');
    expect(sections[1]).toContain('Role');
    expect(sections[2]).toContain('Sign-in');
  });

  it('offers all three roles, and has no Active switch, Market or Policy number', () => {
    expect(page().roles).toEqual(['CLAIMANT', 'OFFICER', 'MANAGER']);
    expect(form().controls.role.value).toBe('CLAIMANT');
    expect(element().querySelector('mat-slide-toggle')).toBeNull();
    expect(element().textContent).not.toContain('Market');
    expect(element().textContent).not.toContain('Policy number');
  });

  it('sends exactly the sign-up fields and goes to the sign-in screen with a notice', async () => {
    fill({ role: 'OFFICER', phone: '+65 9123 4567 ' });

    await submit();

    const request = http.expectOne('/api/auth/register');
    expect(request.request.body).toEqual({
      username: 'nora',
      password: 'secret123',
      role: 'OFFICER',
      fullName: 'Nora Lim',
      email: 'nora@example.com',
      phone: '+65 9123 4567',
    });
    // the confirmation is a screen check only, and nothing staff-only is sent
    expect(Object.keys(request.request.body as object)).not.toContain('confirmPassword');
    expect(Object.keys(request.request.body as object)).not.toContain('active');
    request.flush(CREATED, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'registered' } });
  });

  it('starts no session: the person signs in next', async () => {
    fill();
    await submit();
    http.expectOne('/api/auth/register').flush(CREATED, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(sessionStorage.length).toBe(0);
    http.expectNone('/api/users/me');
  });

  it('does not call the server while the passwords differ, and says so on the field', async () => {
    fill({ confirmPassword: 'secret124' });

    await submit();

    http.expectNone('/api/auth/register');
    expect(element().textContent).toContain('The passwords do not match');
  });

  it('notices when the password is changed after it was confirmed', async () => {
    fill();
    expect(form().controls.confirmPassword.errors).toBeNull();

    form().controls.password.setValue('another123');

    expect(form().controls.confirmPassword.errors).toEqual({ mismatch: true });
  });

  it('asks for the required fields before it calls the server', async () => {
    await submit();

    http.expectNone('/api/auth/register');
    expect(element().textContent).toContain('Enter your full name');
    expect(element().textContent).toContain('Enter an email address');
    expect(element().textContent).toContain('Choose a username');
    expect(element().textContent).toContain('Choose a password');
  });

  it('puts a taken username on its own field and stays on the page', async () => {
    fill();
    await submit();

    http
      .expectOne('/api/auth/register')
      .flush(
        { status: 409, message: "User with username 'nora' already exists" },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(form().controls.username.getError('server')).toBe('That username is already taken.');
    expect(element().querySelector('[role="alert"]')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows any other refusal as the form error, with the fields the server named', async () => {
    fill();
    await submit();

    http.expectOne('/api/auth/register').flush(
      {
        status: 400,
        message: 'Validation failed',
        details: ['email: must be a well-formed email address'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'Some of the information is not valid.',
    );
    expect(form().controls.email.getError('server')).toBe('must be a well-formed email address');
    expect(navigate).not.toHaveBeenCalled();
  });
});
