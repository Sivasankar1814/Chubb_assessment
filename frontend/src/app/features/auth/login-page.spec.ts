import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { fakeToken } from '../../testing/fake-token';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const element = () => fixture.nativeElement as HTMLElement;
  const type = (selector: string, value: string) => {
    const input = element().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    element().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('asks for both fields before it calls the server', async () => {
    await submit();

    expect(element().textContent).toContain('Enter your username');
    expect(element().textContent).toContain('Enter your password');
    http.expectNone('/api/auth/login');
  });

  it('shows a plain message for a wrong password and lets the user try again', async () => {
    type('input[formControlName="username"]', 'officer1');
    type('input[formControlName="password"]', 'wrong');
    await submit();

    http
      .expectOne('/api/auth/login')
      .flush(
        { status: 401, message: 'Invalid username or password' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid username or password.',
    );
    expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      false,
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('signs in and goes to the dashboard', async () => {
    type('input[formControlName="username"]', 'officer1');
    type('input[formControlName="password"]', 'officer123');
    await submit();

    const exp = Math.floor(Date.now() / 1000) + 3600;
    http.expectOne('/api/auth/login').flush({
      accessToken: fakeToken({ exp }),
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      username: 'officer1',
      roles: ['OFFICER'],
    });
    http
      .expectOne('/api/users/me')
      .flush({ id: 3, username: 'officer1', role: 'OFFICER', fullName: 'Priya Nair' });
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('can reveal and hide the password', async () => {
    const password = () =>
      element().querySelector<HTMLInputElement>('input[formControlName="password"]')!;
    const toggle = element().querySelector<HTMLButtonElement>(
      'button[aria-label="Show password"]',
    )!;

    expect(password().type).toBe('password');
    toggle.click();
    await fixture.whenStable();

    expect(password().type).toBe('text');
    expect(element().querySelector('button[aria-label="Hide password"]')).not.toBeNull();
  });
});
