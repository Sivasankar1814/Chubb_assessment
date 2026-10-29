import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotificationService } from '../../core/notifications/notification-service';
import { Role } from '../../models/enums';
import { UserCreatePage } from './user-create-page';
import { UserDirectory } from './user-directory';

const CREATED = {
  id: 20,
  username: 'claimant7',
  role: 'CLAIMANT',
  fullName: 'Nora Lim',
  email: 'nora@example.com',
  active: true,
  createdAt: '2026-10-28T12:00:00',
};

describe('UserCreatePage', () => {
  let fixture: ComponentFixture<UserCreatePage>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  const success = vi.fn();
  const refresh = vi.fn();

  const element = () => fixture.nativeElement as HTMLElement;
  // The form and the role list are protected API of the page; the tests drive them the way the template does.
  interface Internals {
    form: UserCreatePage['form'];
    roles: readonly Role[];
  }
  const page = () => fixture.componentInstance as unknown as Internals;
  const form = () => page().form;
  // A heading's text starts with its icon's ligature ("work Officer details"), so match on what it contains.
  const headings = () =>
    Array.from(element().querySelectorAll('h2')).map((heading) => heading.textContent ?? '');
  const hasHeading = (text: string) => headings().some((heading) => heading.includes(text));
  const headingIndex = (text: string) => headings().findIndex((heading) => heading.includes(text));

  async function open() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationService, useValue: { success } },
        { provide: UserDirectory, useValue: { refresh } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(UserCreatePage);
    await fixture.whenStable();
  }

  async function submit() {
    await fixture.whenStable();
    element().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const fillPerson = () =>
    form().patchValue({
      fullName: ' Nora Lim ',
      email: 'nora@example.com',
      username: 'claimant7',
      password: 'secret123',
    });

  beforeEach(() => {
    success.mockReset();
    refresh.mockReset();
  });

  afterEach(() => http.verify());

  describe('the layout', () => {
    it('puts the person details first, with the Role dropdown directly below them', async () => {
      await open();

      expect(hasHeading('Person details')).toBe(true); // the helper does find headings
      expect(headingIndex('Person details')).toBe(0);
      expect(headingIndex('Role')).toBe(1);
      expect(headingIndex('Sign-in')).toBe(2);
    });

    it('has no Market or Policy number field and no Claimant details section', async () => {
      await open();

      expect(hasHeading('Claimant details')).toBe(false);
      expect(element().querySelector('mat-select[formControlName="market"]')).toBeNull();
      expect(element().querySelector('mat-select[formControlName="policyNumber"]')).toBeNull();
      expect(element().textContent).not.toContain('Market');
    });
  });

  describe('the Role dropdown', () => {
    it('lists Claimant, Officer and Manager', async () => {
      await open();

      expect(element().querySelector('mat-select[formControlName="role"]')).not.toBeNull();
      expect(page().roles).toEqual(['CLAIMANT', 'OFFICER', 'MANAGER']);
      expect(form().controls.role.value).toBe('CLAIMANT');
    });

    it('adds no section of its own for any role, the Officer included', async () => {
      await open();

      for (const role of ['CLAIMANT', 'OFFICER', 'MANAGER'] as const) {
        form().controls.role.setValue(role);
        await fixture.whenStable();

        expect(hasHeading('Officer details')).toBe(false);
        expect(element().querySelector('mat-select[formControlName="specialization"]')).toBeNull();
        expect(element().querySelector('input[formControlName="maxCapacity"]')).toBeNull();
        // The form is the same three sections whatever the role (the side note has a heading of its own).
        expect(element().querySelectorAll('form h2')).toHaveLength(3);
      }
      expect(hasHeading('Person details')).toBe(true);
      expect(hasHeading('Sign-in')).toBe(true);
    });
  });

  it('registers a claimant without sending a market or a policy number', async () => {
    await open();
    fillPerson();

    await submit();

    const request = http.expectOne('/api/users');
    expect(request.request.body).toEqual({
      username: 'claimant7',
      password: 'secret123',
      role: 'CLAIMANT',
      fullName: 'Nora Lim',
      email: 'nora@example.com',
      phone: undefined,
      active: true,
    });
    request.flush(CREATED);
  });

  it('asks for what is missing before it calls the server', async () => {
    await open();

    await submit();

    expect(element().textContent).toContain('Enter their full name');
    expect(element().textContent).toContain('Choose a username');
    http.expectNone('/api/users');
  });

  it('registers an officer like anyone else: the same request, with no specialization or capacity', async () => {
    await open();
    fillPerson();
    form().controls.role.setValue('OFFICER');

    await submit();

    const request = http.expectOne('/api/users');
    expect(request.request.body).toEqual({
      username: 'claimant7',
      password: 'secret123',
      role: 'OFFICER',
      fullName: 'Nora Lim',
      email: 'nora@example.com',
      phone: undefined,
      active: true,
    });
    request.flush({ ...CREATED, role: 'OFFICER' });
  });

  it('registers a manager with no extra details', async () => {
    await open();
    fillPerson();
    form().controls.role.setValue('MANAGER');

    await submit();

    const request = http.expectOne('/api/users');
    expect(request.request.body).toMatchObject({ role: 'MANAGER' });
    expect(request.request.body).not.toHaveProperty('market');
    expect(request.request.body).not.toHaveProperty('specialization');
    request.flush({ ...CREATED, role: 'MANAGER' });
  });

  it('shows what the server says when it refuses the role, and stays on the form', async () => {
    await open();
    fillPerson();
    form().controls.role.setValue('MANAGER');
    await submit();

    http
      .expectOne('/api/users')
      .flush(
        { status: 403, message: 'Not allowed to create this user' },
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'Not allowed to create this user',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('puts a taken username on its own field and stays on the form', async () => {
    await open();
    fillPerson();
    await submit();

    http
      .expectOne('/api/users')
      .flush(
        { status: 409, message: "User with username 'claimant7' already exists" },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(element().textContent).toContain('That username is already taken.');
    expect(element().querySelector('[role="alert"]')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      false,
    );
  });

  it('refreshes the user directory, says who can sign in, and goes to the list', async () => {
    await open();
    fillPerson();
    await submit();

    http.expectOne('/api/users').flush(CREATED);
    await fixture.whenStable();

    expect(refresh).toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('Nora Lim can now sign in as claimant7.');
    expect(navigate).toHaveBeenCalledWith(['/users']);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });
});
