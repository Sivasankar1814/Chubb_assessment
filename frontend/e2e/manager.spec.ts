import { expect, type Playwright, test } from '@playwright/test';
import {
  CLAIMANT,
  DemoUser,
  expectStatus,
  fileClaim,
  MANAGER,
  OFFICER,
  runAction,
  signIn,
  signOut,
} from './support';

// Aiko Tanaka (CLAIMANT) is in Japan; Wei Lim is in Singapore. Priya Nair and Daniel Chen are the seeded officers.
const WEI: DemoUser = { username: 'claimant2', password: 'claimant123', fullName: 'Wei Lim' };

interface Filed {
  id: string;
  number: string;
}

/**
 * Whatever happened in a story, finish every claim it touched. A claim in progress with an officer counts against their
 * capacity, and a story that stopped halfway would leave them full for the next run.
 */
async function closeAll(playwright: Playwright, claims: (Filed | undefined)[]): Promise<void> {
  const api = await playwright.request.newContext({
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
  });
  try {
    const login = await api.post('/api/auth/login', {
      data: { username: MANAGER.username, password: MANAGER.password },
    });
    const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
    const nextStep: Record<string, string> = { UNDER_REVIEW: 'REJECTED', APPROVED: 'SETTLED' };
    for (const filed of claims.filter((claim): claim is Filed => claim !== undefined)) {
      for (let guard = 0; guard < 4; guard++) {
        const claim = await (await api.get(`/api/claims/${filed.id}`, { headers })).json();
        if (claim.status === 'CLOSED') {
          break;
        }
        await api.patch(`/api/claims/${filed.id}/status`, {
          headers,
          data: { status: nextStep[claim.status] ?? 'CLOSED', remarks: 'Test clean-up' },
        });
      }
    }
  } catch (err) {
    console.warn('Could not close the claims this story filed.', err);
  } finally {
    await api.dispose();
  }
}

// One story, told in order: claims are filed, then the manager works through them. Each step needs the one before.
test.describe.configure({ mode: 'serial' });
test.describe('a manager runs the claims', () => {
  let approved: Filed;
  let rejected: Filed;
  let reassigned: Filed;

  test.afterAll(({ playwright }) => closeAll(playwright, [approved, rejected, reassigned]));

  test('claimants in two markets file three claims', async ({ page }) => {
    const stamp = Date.now().toString(36);
    await signIn(page, CLAIMANT);
    approved = await fileClaim(page, `Manager story, to approve (${stamp})`);
    await signOut(page, CLAIMANT);

    await signIn(page, WEI);
    rejected = await fileClaim(page, `Manager story, to reject (${stamp})`);
    reassigned = await fileClaim(page, `Manager story, to reassign (${stamp})`);
  });

  test('the manager sees every claim in the system, whoever filed it', async ({ page }) => {
    await signIn(page, MANAGER);

    // The dashboard counts them and lists the ones that still need an officer.
    await expect(page.getByRole('region', { name: 'Needs an officer' })).toContainText(
      approved.number,
    );

    await page.goto('/claims');
    await expect(page.getByRole('heading', { name: 'Claims', exact: true })).toBeVisible();
    const row = (filed: Filed) => page.getByRole('row').filter({ hasText: filed.number });
    await expect(row(approved)).toContainText('Aiko Tanaka');
    await expect(row(rejected)).toContainText('Wei Lim');
    await expect(row(reassigned)).toContainText('Wei Lim');
    await expect(row(approved)).toContainText('Unassigned');
  });

  test('the manager assigns claims to officers straight from the list', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto('/claims');

    const assign = async (filed: Filed, officer: string) => {
      await page
        .getByRole('button', { name: `Assign officer for ${filed.number}`, exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Assign claim' })).toBeVisible();
      await dialog.getByRole('radio', { name: new RegExp(officer) }).click();
      await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
      await expect(dialog).toBeHidden();

      const row = page.getByRole('row').filter({ hasText: filed.number });
      await expect(row).toContainText(officer);
      await expect(row).toContainText('Assigned');
    };

    await assign(approved, 'Priya Nair');
    await assign(rejected, 'Priya Nair');
    await assign(reassigned, 'Daniel Chen');

    // Once handed out, the button offers a change of officer rather than a first assignment.
    await expect(
      page.getByRole('button', { name: `Reassign officer for ${approved.number}` }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Assign officer for ${approved.number}`, exact: true }),
    ).toHaveCount(0);
  });

  test('the manager reviews, approves, settles and closes a claim', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${approved.id}`);
    await expectStatus(page, 'Assigned');

    await runAction(page, 'Start review');
    await expectStatus(page, 'Under review');
    await runAction(page, 'Approve');
    await expectStatus(page, 'Approved');
    await runAction(page, 'Mark as settled');
    await expectStatus(page, 'Settled');
    await runAction(page, 'Close claim');
    await expectStatus(page, 'Closed');

    // The history says who did it: the manager, not the officer the claim was assigned to.
    await expect(page.getByRole('region', { name: 'History' })).toContainText('manager1');
    await expect(page.getByText('This claim is closed.')).toBeVisible();
  });

  test('the manager rejects a claim, and has to say why', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${rejected.id}`);
    await runAction(page, 'Start review');

    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(dialog.getByText('This is required')).toBeVisible();

    await dialog.getByLabel('Reason for rejection').fill('Outside the policy period.');
    await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expectStatus(page, 'Rejected');
    await expect(page.getByRole('region', { name: 'History' })).toContainText(
      'Outside the policy period.',
    );
  });

  test('the manager reassigns a claim to another officer, even while it is under review', async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${reassigned.id}`);
    await expect(page.getByRole('region', { name: 'Handled by' })).toContainText('Daniel Chen');
    await runAction(page, 'Start review');
    await expectStatus(page, 'Under review');

    await page.getByRole('button', { name: 'Reassign', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Reassign claim' })).toBeVisible();
    await dialog.getByRole('radio', { name: /Priya Nair/ }).click();
    await dialog.getByRole('button', { name: 'Reassign', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('region', { name: 'Handled by' })).toContainText('Priya Nair');
    await expectStatus(page, 'Under review');
    await expect(page.getByRole('region', { name: 'History' })).toContainText(
      'Reassigned to another officer',
    );
  });
});

// The same manager, but this time nobody is assigned: the manager reviews and decides the claims themselves.
test.describe('a manager processes claims directly, with no officer', () => {
  let walked: Filed;
  let rejectedDirectly: Filed;
  let handedOver: Filed;

  test.afterAll(({ playwright }) => closeAll(playwright, [walked, rejectedDirectly, handedOver]));

  test('a claimant files three claims', async ({ page }) => {
    const stamp = Date.now().toString(36);
    await signIn(page, WEI);
    walked = await fileClaim(page, `Direct story, the whole workflow (${stamp})`);
    rejectedDirectly = await fileClaim(page, `Direct story, to reject (${stamp})`);
    handedOver = await fileClaim(page, `Direct story, to hand over (${stamp})`);
  });

  test('the manager starts the review of an open claim without assigning anyone', async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${walked.id}`);
    await expectStatus(page, 'Open');

    // Assigning an officer is still on offer, but it is a choice now, not a step in the way.
    await expect(page.getByRole('button', { name: 'Assign officer', exact: true })).toBeVisible();
    await runAction(page, 'Start review');

    await expectStatus(page, 'Under review');
    await expect(page.getByRole('region', { name: 'Handled by' })).toContainText(
      'A manager (no officer assigned)',
    );
  });

  test('the manager asks for information, the claimant replies, and the manager finishes the claim', async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${walked.id}`);
    await runAction(page, 'Request information', {
      label: 'What does the claimant need to provide?',
      text: 'Please send the repair estimate.',
    });
    await expectStatus(page, 'On hold');
    await signOut(page, MANAGER);

    await signIn(page, WEI);
    await page.goto(`/claims/${walked.id}`);
    await expect(page.getByText('We need information from you')).toBeVisible();
    await runAction(page, 'Provide information', {
      label: 'Your reply',
      text: 'The estimate is attached.',
    });
    await expectStatus(page, 'Under review');
    await signOut(page, WEI);

    await signIn(page, MANAGER);
    await page.goto(`/claims/${walked.id}`);
    await runAction(page, 'Approve');
    await expectStatus(page, 'Approved');
    await runAction(page, 'Mark as settled');
    await expectStatus(page, 'Settled');
    await runAction(page, 'Close claim');
    await expectStatus(page, 'Closed');

    // From start to finish no officer was involved, and the history shows only the manager and the claimant.
    await expect(page.getByRole('region', { name: 'Handled by' })).toContainText(
      'A manager (no officer assigned)',
    );
    const history = page.getByRole('region', { name: 'History' });
    await expect(history).toContainText('manager1');
    await expect(history).toContainText('claimant2');
    await expect(history).not.toContainText('officer1');
  });

  test('the manager rejects a claim directly, and has to say why', async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${rejectedDirectly.id}`);
    await runAction(page, 'Start review');

    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(dialog.getByText('This is required')).toBeVisible();
    await dialog.getByLabel('Reason for rejection').fill('Not covered by this policy.');
    await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expectStatus(page, 'Rejected');
    await expect(page.getByRole('region', { name: 'History' })).toContainText(
      'Not covered by this policy.',
    );
  });

  test('an officer cannot take over a claim a manager is handling, unless the manager hands it over', async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await page.goto(`/claims/${handedOver.id}`);
    await runAction(page, 'Start review');
    await signOut(page, MANAGER);

    // An officer can see the claim but has nothing to do on it.
    await signIn(page, OFFICER);
    await page.goto(`/claims/${handedOver.id}`);
    await expect(page.getByText('A manager is handling this claim directly.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    await signOut(page, OFFICER);

    // The manager hands it to Priya in the middle of the review, and from then on it is hers to decide.
    await signIn(page, MANAGER);
    await page.goto(`/claims/${handedOver.id}`);
    await page.getByRole('button', { name: 'Assign officer', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Priya Nair/ }).click();
    await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('region', { name: 'Handled by' })).toContainText('Priya Nair');
    await expectStatus(page, 'Under review');
    await signOut(page, MANAGER);

    await signIn(page, OFFICER);
    await page.goto(`/claims/${handedOver.id}`);
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  });
});
