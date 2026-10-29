import { expect, test } from '@playwright/test';
import { CLAIMANT, fileClaim, MANAGER, OFFICER, signIn, signOut } from './support';

test.describe('signing in and access', () => {
  test('a visitor is sent to login and returned to the page they wanted', async ({ page }) => {
    await page.goto('/claims');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fclaims/);

    await page.getByLabel('Username').fill(OFFICER.username);
    await page.getByLabel('Password', { exact: true }).fill(OFFICER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/claims$/);
    await expect(page.getByRole('heading', { name: 'Claims', exact: true })).toBeVisible();
  });

  test('a wrong password says so and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(OFFICER.username);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid username or password');
    await expect(page).toHaveURL(/\/login/);
  });

  test('signing out ends the session', async ({ page }) => {
    await signIn(page, OFFICER);
    await signOut(page, OFFICER);

    await page.goto('/claims');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a refresh keeps the user signed in', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.reload();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back, Maria');
  });

  test('a token the server rejects ends the session with an explanation, not a broken page', async ({
    page,
  }) => {
    await signIn(page, OFFICER);
    await page.evaluate(() => {
      const session = JSON.parse(sessionStorage.getItem('claims.session')!);
      session.token = 'not.a.valid.token';
      sessionStorage.setItem('claims.session', JSON.stringify(session));
    });

    await page.reload();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('status')).toContainText('session has ended');
    // And nothing from the old session is left behind.
    expect(await page.evaluate(() => sessionStorage.getItem('claims.session'))).toBeNull();
  });

  test('a claimant sees only their own claims and has no workload page', async ({ page }) => {
    await signIn(page, CLAIMANT);
    await expect(page.getByRole('link', { name: 'Workload' })).toHaveCount(0);
    // The test files its own claim, so it does not depend on the demo claims being there.
    const mine = await fileClaim(page, 'Seen in my own list');

    await page.goto('/claims');
    await expect(page.getByRole('heading', { name: 'My claims' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: mine.number })).toBeVisible();
    // The claimant column is hidden for claimants, and the backend only returns Aiko's claims.
    await expect(page.getByRole('combobox', { name: 'Claimant' })).toHaveCount(0);

    await page.goto('/workload');
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByRole('heading', { name: /don't have access/ })).toBeVisible();
  });

  test('staff see the workload page', async ({ page }) => {
    await signIn(page, MANAGER);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Workload' })
      .click();

    await expect(page.getByRole('heading', { name: 'Officer workload' })).toBeVisible();
    await expect(page.getByRole('meter').first()).toBeVisible();
    await expect(page.getByText('Priya Nair')).toBeVisible();
  });

  test('an unknown claim shows a not-found message, not a broken page', async ({ page }) => {
    await signIn(page, OFFICER);
    await page.goto('/claims/999999');

    await expect(page.getByRole('heading', { name: 'Claim not found' })).toBeVisible();
  });
});
