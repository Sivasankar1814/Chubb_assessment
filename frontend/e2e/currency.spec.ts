import { expect, Page, test } from '@playwright/test';
import { CLAIMANT, DemoUser, OFFICER, signIn } from './support';

// CLAIMANT is Aiko Tanaka, whose market is Japan. Wei Lim's is Singapore.
const WEI: DemoUser = { username: 'claimant2', password: 'claimant123', fullName: 'Wei Lim' };

const amountField = (page: Page) =>
  page.locator('mat-form-field').filter({ has: page.getByLabel(/Claim amount/) });

/** Picks the market (staff and new claimants choose it), and waits for the list to close before the next action. */
async function chooseMarket(page: Page, name: string) {
  await page.getByRole('combobox', { name: /Market/ }).click();
  await page.getByRole('option', { name }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

/** Fills everything but the amount, so a test can see what the amount alone does. */
async function fillRest(page: Page, description: string) {
  await page.getByRole('combobox', { name: /Claim type/ }).click();
  await page.getByRole('option', { name: 'Motor' }).click();
  await page.getByLabel(/Date of incident/).fill('01/09/2026');
  await page.getByLabel(/What happened/).fill(description);
}

test.describe('the claim currency follows the country', () => {
  test('a claimant in Japan files in yen, which has no decimals', async ({ page }) => {
    await signIn(page, CLAIMANT);
    await page.goto('/claims/new');

    const field = amountField(page);
    await expect(field).toContainText('¥');
    await expect(field).toContainText('JPY');
    await expect(field).toContainText('Japanese yen (JPY), whole numbers only');

    await page.getByLabel(/Claim amount/).fill('1250.5');
    await page.getByLabel(/Claim amount/).blur();
    await expect(field).toContainText('Use a whole number: JPY has no decimal places');

    await fillRest(page, 'Yen amount for the currency test');
    await page.getByLabel(/Claim amount/).fill('125000');
    await expect(field).not.toContainText('Use a whole number');
    await page.getByRole('button', { name: 'Submit claim' }).click();

    // The claim reads in yen on its page, and in the list.
    await expect(page).toHaveURL(/\/claims\/\d+$/);
    await expect(page.getByText('¥125,000 (JPY)')).toBeVisible();
    await page.goto('/claims');
    await expect(page.locator('table tbody tr').first()).toContainText('¥125,000');
  });

  test('a claimant in Singapore files in Singapore dollars, with cents', async ({ page }) => {
    await signIn(page, WEI);
    await page.goto('/claims/new');

    const field = amountField(page);
    await expect(field).toContainText('S$');
    await expect(field).toContainText('SGD');
    await expect(field).toContainText('Singapore dollar (SGD), up to 2 decimal places');

    await fillRest(page, 'Dollar amount for the currency test');
    await page.getByLabel(/Claim amount/).fill('1250.50');
    await expect(field).not.toContainText('decimal places.');
    await page.getByRole('button', { name: 'Submit claim' }).click();

    await expect(page).toHaveURL(/\/claims\/\d+$/);
    await expect(page.getByText('S$1,250.50 (SGD)')).toBeVisible();
  });

  test('an officer files in their own name, and the currency follows the market they choose', async ({
    page,
  }) => {
    await signIn(page, OFFICER);
    await page.goto('/claims/new');
    const field = amountField(page);

    // Their own name is already there, as a claimant's is, and there is no claimant dropdown...
    await expect(page.getByLabel('Claimant name')).toHaveValue(OFFICER.fullName);
    await expect(page.getByRole('combobox', { name: /Claimant/ })).toHaveCount(0);
    // ...and with no market on an officer's profile, Market is theirs to choose, and the currency follows it.
    await expect(field).toContainText('The currency follows the market');
    await expect(field).not.toContainText('JPY');

    await chooseMarket(page, 'Japan');
    await expect(field).toContainText('JPY');
    await expect(field).toContainText('¥');

    await chooseMarket(page, 'Singapore');
    await expect(field).toContainText('SGD');
    await expect(field).toContainText('S$');
    await expect(field).not.toContainText('JPY');
  });

  test('switching to a currency with cents accepts an amount that yen refused', async ({
    page,
  }) => {
    await signIn(page, OFFICER);
    await page.goto('/claims/new');
    await chooseMarket(page, 'Japan');
    await page.getByLabel(/Claim amount/).fill('99.5');
    await page.getByLabel(/Claim amount/).blur();
    await expect(amountField(page)).toContainText('Use a whole number');

    await chooseMarket(page, 'Singapore');

    await expect(amountField(page)).not.toContainText('Use a whole number');
  });
});
