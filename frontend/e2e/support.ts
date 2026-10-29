import { expect, Page } from '@playwright/test';

export interface DemoUser {
  username: string;
  password: string;
  fullName: string;
}

// Seeded by the backend's DemoDataSeeder (see CLAUDE.md at the repository root).
export const CLAIMANT: DemoUser = {
  username: 'claimant1',
  password: 'claimant123',
  fullName: 'Aiko Tanaka',
};
export const OFFICER: DemoUser = {
  username: 'officer1',
  password: 'officer123',
  fullName: 'Priya Nair',
};
export const MANAGER: DemoUser = {
  username: 'manager1',
  password: 'manager123',
  fullName: 'Maria Santos',
};

export async function signIn(page: Page, user: DemoUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function signOut(page: Page, user: DemoUser): Promise<void> {
  await page.getByRole('button', { name: new RegExp(user.fullName) }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Files a claim as the signed-in claimant and returns its id and number. */
export async function fileClaim(
  page: Page,
  description: string,
): Promise<{ id: string; number: string }> {
  await page.goto('/claims/new');
  // A claimant whose profile has a market (the seeded ones) finds it locked; anyone else chooses where to file.
  const market = page.getByRole('combobox', { name: /Market/ });
  if (await market.isEnabled()) {
    await market.click();
    await page.getByRole('option', { name: 'Singapore' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
  }
  await page.getByRole('combobox', { name: /Claim type/ }).click();
  await page.getByRole('option', { name: 'Motor' }).click();
  await page.getByLabel(/Date of incident/).fill('01/09/2026');
  // A whole number is valid in every market's currency: yen and rupiah have no decimals.
  await page.getByLabel(/Claim amount/).fill('125000');
  await page.getByLabel(/What happened/).fill(description);
  await page.getByRole('button', { name: 'Submit claim' }).click();

  await expect(page).toHaveURL(/\/claims\/\d+$/);
  const id = /\/claims\/(\d+)$/.exec(page.url())![1];
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^CLM-\d{4}-\d{6}$/);
  return { id, number: (await heading.textContent())!.trim() };
}

/** Opens the dialog for an action button, then confirms with the same label inside the dialog. */
export async function runAction(
  page: Page,
  label: string,
  remarks?: { label: string; text: string },
): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: label })).toBeVisible();
  if (remarks) {
    await dialog.getByLabel(remarks.label).fill(remarks.text);
  }
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).toBeHidden();
}

export async function expectStatus(page: Page, label: string): Promise<void> {
  // The header chip is the first status chip on the page.
  await expect(page.locator('app-status-chip').first()).toContainText(label);
}
