import { expect, Page, test } from '@playwright/test';
import { CLAIMANT, DemoUser, MANAGER, OFFICER, signIn, signOut } from './support';

// A new name every run, so the tests can be repeated without restarting the backend. Everything they create
// starts with "e2e-" and is deleted again at the end (the claims they file are closed: a claim cannot be deleted).
const stamp = Date.now().toString(36);
const NEW_CLAIMANT: DemoUser = {
  username: `e2e-claimant-${stamp}`,
  password: 'e2e-secret-1',
  fullName: `Eve Tester ${stamp}`,
};
const API = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const filedClaimIds: string[] = [];

test.afterAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API });
  try {
    const login = await api.post('/api/auth/login', {
      data: { username: MANAGER.username, password: MANAGER.password },
    });
    const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
    for (const id of filedClaimIds) {
      await api.patch(`/api/claims/${id}/status`, {
        headers,
        data: { status: 'CLOSED', remarks: 'Test clean-up' },
      });
    }
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
const marketField = (page: Page) => page.getByRole('combobox', { name: /Market/ });
const policyField = (page: Page) => page.getByRole('combobox', { name: /Policy number/ });
const roleField = (page: Page) => page.getByRole('combobox', { name: /Role/ });

/** Fills the person and sign-in sections, which every role shares. */
async function fillPerson(page: Page, user: DemoUser, email = `${user.username}@example.com`) {
  await page.getByLabel('Full name').fill(user.fullName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
}

async function chooseMarket(page: Page, name: string) {
  await marketField(page).click();
  await page.getByRole('option', { name }).click();
  // Wait for the list to finish closing: clicking the field again while it still animates away would shut it
  // instead of opening it.
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

test.describe('registering users', () => {
  test('a manager registers a claimant from the New user menu, with no market or policy number to fill in', async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await sidebar(page).getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();

    await sidebar(page).getByRole('link', { name: 'New user' }).click();
    await expect(page).toHaveURL(/\/users\/new$/);
    await expect(page.getByRole('heading', { name: 'New user' })).toBeVisible();

    // The market belongs to a claim, not to a person.
    await expect(marketField(page)).toHaveCount(0);
    await expect(policyField(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Claimant details' })).toHaveCount(0);

    await fillPerson(page, NEW_CLAIMANT);
    await page.getByRole('button', { name: 'Create user' }).click();

    // Back on the list, with the new person at the top.
    await expect(page).toHaveURL(/\/users$/);
    const row = page.getByRole('listitem').filter({ hasText: NEW_CLAIMANT.username });
    await expect(row).toContainText(NEW_CLAIMANT.fullName);
    await expect(row).toContainText('Claimant');
    await expect(row).toContainText('Market chosen per claim');
    await expect(row).toContainText('Active');

    await signOut(page, MANAGER);
    await signIn(page, NEW_CLAIMANT);
    await page.goto('/profile');
    await expect(page.getByText(NEW_CLAIMANT.fullName).first()).toBeVisible();
    await expect(page.getByRole('term').filter({ hasText: 'Market' })).toHaveCount(0);
  });

  test('a claimant with no market chooses it when filing a claim, and the currency follows', async ({
    page,
    playwright,
  }) => {
    const filer: DemoUser = {
      username: `e2e-filer-${stamp}`,
      password: 'e2e-secret-5',
      fullName: `Fay Filer ${stamp}`,
    };
    // Registered through the API: the screen for that is covered above.
    const api = await playwright.request.newContext({ baseURL: API });
    const login = await api.post('/api/auth/login', {
      data: { username: MANAGER.username, password: MANAGER.password },
    });
    const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
    const created = await api.post('/api/users', {
      headers,
      data: {
        username: filer.username,
        password: filer.password,
        role: 'CLAIMANT',
        fullName: filer.fullName,
        email: `${filer.username}@example.com`,
      },
    });
    expect(created.status()).toBe(201);
    await api.dispose();

    await signIn(page, filer);
    await page.goto('/claims/new');

    // Nothing on the profile to take it from, so it is a dropdown to fill in.
    await expect(marketField(page)).toBeEnabled();
    await expect(page.getByText('Choose the market this claim is filed in')).toBeVisible();
    // The policy number is never typed: read-only, empty until the market is chosen, then filled in and following it.
    const policy = page.getByLabel('Policy number');
    await expect(policy).toBeDisabled();
    await expect(policy).toHaveValue('');
    await chooseMarket(page, 'Singapore');
    await expect(page.getByText('Singapore dollar (SGD)')).toBeVisible();
    await expect(policy).toHaveValue(/^POL-SG-\d{4}$/);
    await chooseMarket(page, 'Japan');
    await expect(page.getByText('Japanese yen (JPY)')).toBeVisible();
    await expect(policy).toHaveValue(/^POL-JP-\d{4}$/);
    await chooseMarket(page, 'Singapore');
    const policyNumber = await policy.inputValue();

    await page.getByRole('combobox', { name: /Claim type/ }).click();
    await page.getByRole('option', { name: 'Motor' }).click();
    await page.getByLabel(/Date of incident/).fill('01/09/2026');
    await page.getByLabel(/Claim amount/).fill('1250.50');
    await page.getByLabel(/What happened/).fill(`Market chosen on the claim (${stamp})`);
    await page.getByRole('button', { name: 'Submit claim' }).click();

    await expect(page).toHaveURL(/\/claims\/\d+$/);
    filedClaimIds.push(/\/claims\/(\d+)$/.exec(page.url())![1]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^CLM-\d{4}-\d{6}$/);
    await expect(page.getByText('Singapore').first()).toBeVisible();
    await expect(page.getByText(/S\$\s?1,250\.50/).first()).toBeVisible();
    // The server stored the number the form showed.
    await expect(page.getByText(policyNumber, { exact: true })).toBeVisible();
  });

  test('a claimant whose profile has a market still files in that market only', async ({
    page,
  }) => {
    await signIn(page, CLAIMANT);
    await page.goto('/claims/new');

    // Aiko Tanaka's profile says Japan: shown, but not selectable.
    await expect(marketField(page)).toBeDisabled();
    await expect(marketField(page)).toContainText('Japan');
    await expect(page.getByText('Taken from your profile').first()).toBeVisible();
  });

  test('a taken username is refused on its own field', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto('/users/new');

    await page.getByLabel('Full name').fill('Someone Else');
    await page.getByLabel('Email').fill('someone@example.com');
    await page.getByLabel('Username').fill(CLAIMANT.username);
    await page.getByLabel('Password', { exact: true }).fill('another-secret');
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page.getByText('That username is already taken.')).toBeVisible();
    await expect(page).toHaveURL(/\/users\/new$/);
  });

  test('a manager can register an officer, with no officer details to fill in', async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await page.goto('/users/new');

    await roleField(page).click();
    await expect(page.getByRole('option')).toHaveText(['Claimant', 'Officer', 'Manager']);
    await page.getByRole('option', { name: 'Officer' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    // Choosing Officer brings in no section of its own: no specialization, no capacity, no market.
    await expect(page.getByRole('heading', { name: 'Officer details' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Specialization/ })).toHaveCount(0);
    await expect(page.getByLabel('Claim capacity')).toHaveCount(0);
    await expect(marketField(page)).toHaveCount(0);

    const username = `e2e-officer-${stamp}`;
    await page.getByLabel('Full name').fill(`Olive Officer ${stamp}`);
    await page.getByLabel('Email').fill(`${username}@example.com`);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill('e2e-secret-2');
    await page.getByRole('button', { name: 'Create user' }).click();

    // The server's default capacity applies, so the officer is usable straight away.
    await expect(page).toHaveURL(/\/users$/);
    const row = page.getByRole('listitem').filter({ hasText: username });
    await expect(row).toContainText('Officer');
    await expect(row).toContainText('capacity 5');
  });

  test('an officer registers a claimant from the New user menu', async ({ page }) => {
    const byOfficer: DemoUser = {
      username: `e2e-by-officer-${stamp}`,
      password: 'e2e-secret-4',
      fullName: `Ollie Officer-Made ${stamp}`,
    };
    await signIn(page, OFFICER);

    // The menu has the entry, and it opens the creation screen.
    await sidebar(page).getByRole('link', { name: 'New user' }).click();
    await expect(page).toHaveURL(/\/users\/new$/);
    await expect(sidebar(page).getByRole('link', { name: 'New user' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(
      sidebar(page).getByRole('link', { name: 'Users', exact: true }),
    ).not.toHaveAttribute('aria-current', 'page');

    // Person details come first, with the Role dropdown below them.
    const personTop = (await page.getByRole('heading', { name: 'Person details' }).boundingBox())!
      .y;
    const roleTop = (await roleField(page).boundingBox())!.y;
    expect(personTop).toBeLessThan(roleTop);

    // The Role dropdown offers every role to an officer, with Claimant already selected.
    await expect(roleField(page)).toBeVisible();
    await expect(roleField(page)).toContainText('Claimant');
    await roleField(page).click();
    await expect(page.getByRole('option')).toHaveText(['Claimant', 'Officer', 'Manager']);
    await page.getByRole('option', { name: 'Claimant' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);

    // No Market and no Policy number: the market is chosen when a claim is filed.
    await expect(marketField(page)).toHaveCount(0);
    await expect(policyField(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Claimant details' })).toHaveCount(0);

    await fillPerson(page, byOfficer);
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page).toHaveURL(/\/users$/);
    const row = page.getByRole('listitem').filter({ hasText: byOfficer.username });
    await expect(row).toContainText(byOfficer.fullName);
    await expect(row).toContainText('Claimant');
    await expect(row).toContainText('Market chosen per claim');
  });

  test('an officer can register an officer too, with the same form and the same default capacity', async ({
    page,
  }) => {
    await signIn(page, OFFICER);
    await page.goto('/users/new');

    await roleField(page).click();
    await page.getByRole('option', { name: 'Officer' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Officer details' })).toHaveCount(0);

    const username = `e2e-officer-by-officer-${stamp}`;
    await page.getByLabel('Full name').fill(`Orla Officer-Made ${stamp}`);
    await page.getByLabel('Email').fill(`${username}@example.com`);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill('e2e-secret-6');
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page).toHaveURL(/\/users$/);
    const row = page.getByRole('listitem').filter({ hasText: username });
    await expect(row).toContainText('Officer');
    await expect(row).toContainText('capacity 5');
  });

  test('an officer can register a manager, who can then sign in', async ({ page }) => {
    const boss: DemoUser = {
      username: `e2e-boss-${stamp}`,
      password: 'e2e-secret-7',
      fullName: `Bea Boss ${stamp}`,
    };
    await signIn(page, OFFICER);
    await page.goto('/users/new');

    await fillPerson(page, boss);
    await roleField(page).click();
    await page.getByRole('option', { name: 'Manager' }).click();
    // A manager has no profile fields of their own.
    await expect(page.getByRole('heading', { name: 'Officer details' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Create user' }).click();

    await expect(page).toHaveURL(/\/users$/);
    const row = page.getByRole('listitem').filter({ hasText: boss.username });
    await expect(row).toContainText(boss.fullName);
    await expect(row).toContainText('Manager');

    await signOut(page, OFFICER);
    await signIn(page, boss);
    await expect(page.getByRole('button', { name: new RegExp(boss.fullName) })).toBeVisible();
  });

  test('a half-filled form asks before it is thrown away', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto('/users/new');
    await page.getByLabel('Full name').fill('Not saved');

    await page.getByRole('link', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).toContainText('Discard this user?');
  });

  test('a claimant has no Users or New user menu entries, and no page for them', async ({
    page,
  }) => {
    await signIn(page, CLAIMANT);

    await expect(sidebar(page).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await expect(sidebar(page).getByRole('link', { name: 'New user' })).toHaveCount(0);
    await page.goto('/users/new');
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
