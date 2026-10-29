import { expect, test } from '@playwright/test';
import {
  CLAIMANT,
  expectStatus,
  fileClaim,
  MANAGER,
  OFFICER,
  runAction,
  signIn,
  signOut,
} from './support';

// One claim travels through the whole workflow, with each role doing its part.
test.describe.serial('claim lifecycle across roles', () => {
  let id: string;
  let number: string;

  test('a claimant files a claim for themselves', async ({ page }) => {
    await signIn(page, CLAIMANT);
    ({ id, number } = await fileClaim(
      page,
      'Rear bumper damaged in a car park, e2e lifecycle claim',
    ));

    await expectStatus(page, 'Open');
    await expect(page.getByText('Aiko Tanaka').first()).toBeVisible();
    await expect(page.getByText('Japan').first()).toBeVisible();
    await expect(
      page.locator('app-history-timeline li').filter({ hasText: 'Claim submitted' }),
    ).toHaveCount(1);
    // The claimant has nothing to do yet.
    await expect(page.getByText('Nothing is needed from you right now.')).toBeVisible();
  });

  test('a manager assigns it to an officer, seeing their workload', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${id}`);

    await page.getByRole('button', { name: 'Assign officer' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Assign claim' })).toBeVisible();
    await expect(dialog.getByRole('meter').first()).toBeVisible();
    await dialog.getByRole('radio', { name: /Priya Nair/ }).check();
    await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expectStatus(page, 'Assigned');
    await expect(page.getByRole('region', { name: 'Handled by' })).toContainText('Priya Nair');
    await expect(page.getByRole('button', { name: 'Reassign' })).toBeVisible();
  });

  test('the officer reviews it and asks the claimant for information', async ({ page }) => {
    await signIn(page, OFFICER);
    await page.goto(`/claims/${id}`);

    await runAction(page, 'Start review');
    await expectStatus(page, 'Under review');

    // A reason is mandatory when asking for information.
    await page.getByRole('button', { name: 'Request information', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Request information', exact: true }).click();
    await expect(dialog.getByText('This is required')).toBeVisible();
    await dialog
      .getByLabel('What does the claimant need to provide?')
      .fill('Please upload the repair estimate.');
    await dialog.getByRole('button', { name: 'Request information', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expectStatus(page, 'On hold');
    await expect(page.getByText('Waiting for the claimant')).toBeVisible();
    // While it is on hold, staff can only close it.
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Close claim' })).toBeVisible();
  });

  test('the claimant sees the request and replies, which resumes the review', async ({ page }) => {
    await signIn(page, CLAIMANT);
    await page.goto(`/claims/${id}`);

    await expect(page.getByText('We need information from you')).toBeVisible();
    await expect(page.getByText('Please upload the repair estimate.').first()).toBeVisible();
    await runAction(page, 'Provide information', {
      label: 'Your reply',
      text: 'Estimate attached to the policy portal, total 1,250.50.',
    });

    await expectStatus(page, 'Under review');
    await expect(page.getByText('Latest reply from the claimant')).toBeVisible();
    await expect(page.getByText('We need information from you')).toHaveCount(0);
  });

  test('the officer approves, settles and closes it, and the history tells the story', async ({
    page,
  }) => {
    await signIn(page, OFFICER);
    await page.goto(`/claims/${id}`);

    await runAction(page, 'Approve');
    await expectStatus(page, 'Approved');
    await runAction(page, 'Mark as settled');
    await expectStatus(page, 'Settled');
    await runAction(page, 'Close claim');
    await expectStatus(page, 'Closed');
    await expect(page.getByText('This claim is closed.')).toBeVisible();

    const history = page.locator('app-history-timeline li');
    for (const title of [
      'Claim submitted',
      'Assigned to an officer',
      'Information requested',
      'Information provided',
    ]) {
      await expect(history.filter({ hasText: title })).toHaveCount(1);
    }
    // created, assigned, review started, requested, provided, approved, settled, closed
    await expect(history).toHaveCount(8);
    await signOut(page, OFFICER);
  });

  test('the claim now shows in the staff list when searched by number', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto('/claims');
    await page.getByLabel('Search').fill(number);

    await expect(page).toHaveURL(new RegExp(`q=${number}`));
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.locator('table tbody tr')).toContainText('Closed');
  });
});

test.describe('filing a claim', () => {
  test('an officer files in their own name: the name is already there, with no claimant dropdown', async ({
    page,
    playwright,
  }) => {
    await signIn(page, OFFICER);
    await page.goto('/claims/new');

    // The same page as a claimant's, with the signed-in user's own name filled in.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('File a claim');
    await expect(page.getByLabel('Claimant name')).toHaveValue(OFFICER.fullName);
    await expect(page.getByRole('combobox', { name: /Claimant/ })).toHaveCount(0);
    // An officer has no market on their profile, so it is theirs to choose.
    await expect(page.getByRole('combobox', { name: 'Market' })).toBeEnabled();
    // The policy number is filled in for them, never typed.
    await expect(page.getByLabel('Policy number')).toBeDisabled();

    const { id } = await fileClaim(page, `Filed by an officer in their own name (${Date.now()})`);
    try {
      const claimant = page
        .locator('div')
        .filter({ has: page.locator('dt', { hasText: /^Claimant$/ }) })
        .locator('dd')
        .first();
      await expect(claimant).toHaveText(OFFICER.fullName);
      // The server gave the claim a policy number from the officer's own user id (POL-<market>-<id>).
      // The value right beside its label (a wider block would hand back the first row, the claimant's name).
      const policy = page
        .locator('dt', { hasText: /^Policy number$/ })
        .locator('xpath=following-sibling::dd[1]');
      await expect(policy).toHaveText(/^POL-SG-\d{4}$/);
    } finally {
      // A claim cannot be deleted: close it, so it does not sit in the queue.
      const api = await playwright.request.newContext({
        baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
      });
      const login = await api.post('/api/auth/login', {
        data: { username: MANAGER.username, password: MANAGER.password },
      });
      await api.patch(`/api/claims/${id}/status`, {
        headers: { Authorization: `Bearer ${(await login.json()).accessToken}` },
        data: { status: 'CLOSED', remarks: 'Test clean-up' },
      });
      await api.dispose();
    }
  });

  test('a future incident date is refused before anything is sent', async ({ page }) => {
    await signIn(page, CLAIMANT);
    await page.goto('/claims/new');

    await page.getByLabel(/Date of incident/).fill('01/01/2090');
    await page.getByLabel(/Claim amount/).fill('10');
    await page.getByRole('button', { name: 'Submit claim' }).click();

    await expect(page.getByText('The incident cannot be in the future')).toBeVisible();
    await expect(page).toHaveURL(/\/claims\/new$/);
  });

  test('leaving a half-filled claim asks first', async ({ page }) => {
    await signIn(page, CLAIMANT);
    await page.goto('/claims/new');
    await page.getByLabel(/What happened/).fill('Something');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByRole('dialog')).toContainText('Discard this claim?');
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/claims\/new$/);
  });
});
