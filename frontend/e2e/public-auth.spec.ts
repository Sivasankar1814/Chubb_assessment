import { expect, Page, test } from '@playwright/test';
import { CLAIMANT, DemoUser, MANAGER, signIn } from './support';

// What someone can do from the sign-in screen with no account or no password. A new name every run; everything created
// starts with "e2e-" and is deleted again at the end, like the other specs.
const stamp = Date.now().toString(36);
const API = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const person = (kind: string): DemoUser => ({
  username: `e2e-${kind}-${stamp}`,
  password: 'e2e-secret-1',
  fullName: `Pat ${kind} ${stamp}`,
});
const emailOf = (user: DemoUser) => `${user.username}@example.com`;

test.afterAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API });
  try {
    const login = await api.post('/api/auth/login', {
      data: { username: MANAGER.username, password: MANAGER.password },
    });
    const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
    const users: { id: number; username: string }[] = await (
      await api.get('/api/users', { headers })
    ).json();
    for (const user of users.filter((u) => u.username.startsWith('e2e-'))) {
      await api.delete(`/api/users/${user.id}`, { headers });
    }
  } catch (err) {
    console.warn('Could not remove the e2e users; restart user-service to clear them.', err);
  } finally {
    await api.dispose();
  }
});

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const roleField = (page: Page) => page.getByRole('combobox', { name: /Role/ });

/** The sign-up form: the person, the role and the sign-in, with the password confirmed. */
async function fillRegistration(page: Page, user: DemoUser, confirm = user.password) {
  await page.getByLabel('Full name').fill(user.fullName);
  await page.getByLabel('Email').fill(emailOf(user));
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByLabel('Confirm password').fill(confirm);
}

async function chooseRole(page: Page, name: string) {
  await roleField(page).click();
  await page.getByRole('option', { name }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

test.describe('the sign-in screen', () => {
  test('links to creating a user and to resetting a password', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reset your password' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Back to sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole('link', { name: 'Create new user' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Create new user' })).toBeVisible();
  });

  test('keeps a signed-in person off both pages', async ({ page }) => {
    await signIn(page, CLAIMANT);

    await page.goto('/register');
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/forgot-password');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe('creating a user without signing in', () => {
  test('a claimant registers, is sent back to sign in with a notice, and signs in', async ({
    page,
  }) => {
    const user = person('claimant');
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create new user' }).click();

    await fillRegistration(page, user);
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText('Your account is ready. Sign in with your new username and password.'),
    ).toBeVisible();

    await signIn(page, user);
    await expect(page.getByRole('button', { name: new RegExp(user.fullName) })).toBeVisible();
    await expect(sidebar(page).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  });

  test('anyone can register as a manager, and gets the manager screens (accepted, see CLAUDE.md)', async ({
    page,
  }) => {
    const user = person('manager');
    await page.goto('/register');

    await fillRegistration(page, user);
    await chooseRole(page, 'Manager');
    await page.getByRole('button', { name: 'Create user' }).click();
    await expect(page).toHaveURL(/\/login/);

    await signIn(page, user);
    await expect(sidebar(page).getByRole('link', { name: 'Users', exact: true })).toBeVisible();
    await expect(sidebar(page).getByRole('link', { name: 'Workload' })).toBeVisible();
  });

  test('a username that is taken is shown on its own field', async ({ page }) => {
    await page.goto('/register');

    await fillRegistration(page, { ...person('taken'), username: CLAIMANT.username });
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page.getByText('That username is already taken.')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('passwords that differ never reach the server', async ({ page }) => {
    const user = person('mismatch');
    let called = false;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/auth/register')) called = true;
    });
    await page.goto('/register');

    await fillRegistration(page, user, 'something-else-1');
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page.getByText('The passwords do not match')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    expect(called).toBe(false);
  });
});

test.describe('resetting a password without signing in', () => {
  test('the wrong email is refused, the right one sets the new password, and only that works', async ({
    page,
  }) => {
    const user = person('reset');
    const created = await page.request.post('/api/auth/register', {
      data: {
        username: user.username,
        password: user.password,
        role: 'CLAIMANT',
        fullName: user.fullName,
        email: emailOf(user),
      },
    });
    expect(created.status()).toBe(201);
    const newPassword = 'e2e-brand-new-2';

    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Username').fill(user.username);
    await page.getByLabel('Email on your account').fill('someone.else@example.com');
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Those details do not match an active account',
    );
    await expect(page).toHaveURL(/\/forgot-password$/);

    await page.getByLabel('Email on your account').fill(emailOf(user));
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText('Your password was changed. Sign in with the new one.'),
    ).toBeVisible();

    // the old password no longer works
    await page.getByLabel('Username').fill(user.username);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Invalid username or password.');

    // the new one does
    await signIn(page, { ...user, password: newPassword });
  });
});
