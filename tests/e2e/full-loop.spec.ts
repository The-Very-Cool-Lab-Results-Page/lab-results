import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

/**
 * The full web-page flow against synthetic mock data: provider creates and walks
 * a report, the patient clears the last-name + date-of-birth gate and reads the
 * results. Also covers the held-for-critical state and the gate rejection.
 */

interface EmailCounts {
  shareLink: number;
  question: number;
}

/** One result card, scoped by its test name so absence assertions can't pass vacuously. */
function resultCard(page: Page, name: string): Locator {
  return page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

/**
 * Messages queued through the offline email seam, read from the E2E-only hook
 * route. Asserting a delta proves the send reached the seam rather than that a
 * screen merely advanced. The route exposes counts only.
 *
 * The counter is process-global, so these deltas assume the serial execution
 * this suite pins (workers: 1); running the file in parallel would race them.
 */
async function getEmailCounts(request: APIRequestContext): Promise<EmailCounts> {
  const response = await request.get('/api/test-hooks/emails');
  expect(response.ok()).toBe(true);
  return (await response.json()) as EmailCounts;
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/provider/sign-in');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
}

test('provider creates a report, walks it, and the patient reads it', async ({ page, request }) => {
  const before = await getEmailCounts(request);
  await signIn(page);

  await page.getByRole('link', { name: 'New report' }).first().click();
  await page.getByLabel('Patient name').fill('Jordan Pat');
  await page.getByLabel('Patient email').fill('jordan.pat@example.test');
  await page.getByLabel('Patient date of birth').fill('1990-04-15');
  await page.getByRole('button', { name: 'Create report' }).click();

  await page.getByRole('button', { name: 'Read the results' }).click();
  await page.getByRole('button', { name: 'Confirm results' }).click();
  await page.getByRole('button', { name: /Approve for the patient/ }).click();
  await page.getByRole('button', { name: 'Send to patient' }).click();

  const link = page.getByRole('link', { name: /^\/r\// });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  if (href === null) throw new Error('no patient link after send');

  // The send went through the email seam, not just through the screen (FR-11).
  await expect(async () => {
    const after = await getEmailCounts(request);
    expect(after.shareLink).toBe(before.shareLink + 1);
  }).toPass();

  await page.goto(href);
  await page.getByLabel('Last name').fill('Pat');
  await page.getByLabel('Month').fill('4');
  await page.getByLabel('Day').fill('15');
  await page.getByLabel('Year').fill('1990');
  await page.getByRole('button', { name: 'View my results' }).click();

  await expect(page.getByRole('heading', { name: /here are your results/ })).toBeVisible();
  await expect(page.getByText(/not medical advice/)).toBeVisible();

  // Both safety states, produced by the real pipeline on this report's own rows
  // rather than by a pre-classified seed: Lipase is outside the dictionary
  // (FR-04) and Iron 1900 is past its plausibility ceiling (FR-08).
  const lipaseCard = resultCard(page, 'Lipase');
  await expect(lipaseCard).toBeVisible();
  await expect(
    lipaseCard.getByText(/We do not have a plain-language explanation for this test yet/),
  ).toBeVisible();

  const ironCard = resultCard(page, 'Iron');
  await expect(ironCard).toBeVisible();
  await expect(ironCard.getByText(/looks unusual and will be double-checked/)).toBeVisible();
  await expect(ironCard.getByText('Please double-check')).toBeVisible();

  // "Never explained as real" is the half of FR-08 that a copy assertion misses:
  // buildResultsView attaches `meaning` to any row with a matched analyte, and
  // Iron DOES match, so only the drafting layer's per-row exclusion keeps this
  // card prose-free. Pin the rendered outcome, not just the warning: no drafted
  // explanation (the suite is pinned to the offline drafter), and no range
  // marker — an implausible value is never placed on a scale.
  await expect(ironCard.getByText(/offline draft/)).toHaveCount(0);
  await expect(ironCard.getByText(/Typical range/)).toHaveCount(0);
});

test('a file that is not a PDF is refused inline and the report stays at the read step', async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole('link', { name: 'New report' }).first().click();
  await page.getByLabel('Patient name').fill('Casey Sample');
  await page.getByLabel('Patient email').fill('casey.sample@example.test');
  await page.getByLabel('Patient date of birth').fill('1986-08-20');
  await page.getByRole('button', { name: 'Create report' }).click();

  await page.getByLabel(/Report PDF/).setInputFiles({
    name: 'lab-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a pdf'),
  });
  await page.getByRole('button', { name: 'Read the results' }).click();

  // Refused at the boundary: an inline message, not the generic error boundary,
  // and nothing was transcribed — the same step is still on screen to retry.
  await expect(page.getByText(/Choose a PDF under 15 MB/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Read the results' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm results' })).toHaveCount(0);
});

test('what the verify screen previews is what confirming stamps (FR-05)', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: 'New report' }).first().click();
  await page.getByLabel('Patient name').fill('Alex Mirror');
  await page.getByLabel('Patient email').fill('alex.mirror@example.test');
  await page.getByLabel('Patient date of birth').fill('1982-12-01');
  await page.getByRole('button', { name: 'Create report' }).click();
  await page.getByRole('button', { name: 'Read the results' }).click();

  // Retype HDL's lower bound the way the report prints it. The preview runs in
  // the browser and the stamp runs on the server, so this is the one assertion
  // that catches the two reading the same cell differently — a provider
  // approving a preview that is not what gets stored is the gate failing open.
  const hdl = page.locator('tbody tr').nth(2);
  await expect(hdl.getByRole('textbox', { name: 'Test name' })).toHaveValue('HDL Cholesterol');
  await hdl.getByRole('textbox', { name: 'Reference low' }).fill('> 40');

  // "Will show as" — the browser's reading of the cell the provider just typed.
  const previewed = (await hdl.locator('td').nth(5).innerText()).trim();
  expect(previewed).toBe('In range');

  await page.getByRole('button', { name: 'Confirm results' }).click();

  // The server's reading of the same cell. HDL appearing here at all already
  // proves it was stored with a usable range — a row the server read as
  // rangeless is dropped before drafting — and the pill pins the exact verdict.
  const stamped = page.locator('div:has(> #text-hdl-cholesterol)');
  await expect(stamped).toContainText(previewed);
});

test('a report left with no results never affirms that every result is typical', async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole('link', { name: 'New report' }).first().click();
  await page.getByLabel('Patient name').fill('Robin Empty');
  await page.getByLabel('Patient email').fill('robin.empty@example.test');
  await page.getByLabel('Patient date of birth').fill('1975-03-04');
  await page.getByRole('button', { name: 'Create report' }).click();
  await page.getByRole('button', { name: 'Read the results' }).click();

  // The provider removes every transcribed row — nothing is left to explain.
  const removeButtons = page.getByRole('button', { name: /^Remove / });
  for (let remaining = await removeButtons.count(); remaining > 0; remaining -= 1) {
    await removeButtons.first().click();
  }
  await page.getByRole('button', { name: 'Confirm results' }).click();
  await page.getByRole('button', { name: /Approve for the patient/ }).click();
  await page.getByRole('button', { name: 'Send to patient' }).click();

  const href = await page.getByRole('link', { name: /^\/r\// }).getAttribute('href');
  if (href === null) throw new Error('no patient link after send');
  await page.goto(href);
  await page.getByLabel('Last name').fill('Empty');
  await page.getByLabel('Month').fill('3');
  await page.getByLabel('Day').fill('4');
  await page.getByLabel('Year').fill('1975');
  await page.getByRole('button', { name: 'View my results' }).click();

  // "Nothing outside the range" is vacuously true with no results; saying so
  // would reassure a patient about a report that explains nothing.
  await expect(page.getByRole('heading', { name: /here are your results/ })).toBeVisible();
  await expect(page.getByText('Every result in the typical range')).toHaveCount(0);
  await expect(page.getByText(/not medical advice/)).toBeVisible();
});

test('a critical result holds the report, is not sent, and its contact is logged', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: /David Chen/ }).click();
  await expect(
    page.getByRole('heading', { name: /Held: contact the patient directly/ }),
  ).toBeVisible();
  await expect(page.getByText('Potassium 6.8 mmol/L')).toBeVisible();
  // Held report: nothing is sent (no patient link) and its status says held.
  await expect(page.getByRole('link', { name: /^\/r\// })).toHaveCount(0);
  await expect(page.getByText(/Held: critical result/)).toBeVisible();
  await expect(page.getByText(/still to contact/)).toBeVisible();

  // Record the direct contact and confirm it is documented on the page.
  await page
    .getByPlaceholder(/Who you reached/)
    .fill('Reached David by phone; advised same-day visit.');
  await page.getByRole('button', { name: 'Record contact' }).click();
  await expect(page.getByText('Contacted')).toBeVisible();
  await expect(page.getByText(/advised same-day visit/)).toBeVisible();
  await expect(page.getByText(/Every critical result has a logged contact/)).toBeVisible();
});

test('the patient gate rejects wrong info and accepts the right last name and DOB', async ({
  page,
}) => {
  await page.goto('/r/demo-alvarez-token');
  await expect(page.getByRole('heading', { name: /shared your lab results/ })).toBeVisible();

  await page.getByLabel('Last name').fill('Wrong');
  await page.getByLabel('Month').fill('3');
  await page.getByLabel('Day').fill('12');
  await page.getByLabel('Year').fill('1984');
  await page.getByRole('button', { name: 'View my results' }).click();
  await expect(page.getByText(/did not match/)).toBeVisible();

  await page.getByLabel('Last name').fill('Alvarez');
  await page.getByLabel('Month').fill('3');
  await page.getByLabel('Day').fill('12');
  await page.getByLabel('Year').fill('1984');
  await page.getByRole('button', { name: 'View my results' }).click();
  await expect(page.getByRole('heading', { name: /here are your results/ })).toBeVisible();
  await expect(page.getByText(/not medical advice/)).toBeVisible();
});

test('after three misses the gate offers the clinic instead of repeating itself', async ({
  page,
}) => {
  await page.goto('/r/demo-park-token');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.getByLabel('Last name').fill('Wrong');
    await page.getByLabel('Month').fill('1');
    await page.getByLabel('Day').fill('1');
    await page.getByLabel('Year').fill('1970');
    await page.getByRole('button', { name: 'View my results' }).click();
    await expect(page.getByText(/did not match/)).toBeVisible();
  }

  await expect(page.getByText(/Still not matching\?/)).toBeVisible();

  // Help copy only — the gate still opens for the right answer, never locks out.
  await page.getByLabel('Last name').fill('Park');
  await page.getByLabel('Month').fill('2');
  await page.getByLabel('Day').fill('28');
  await page.getByLabel('Year').fill('1995');
  await page.getByRole('button', { name: 'View my results' }).click();
  await expect(page.getByRole('heading', { name: /here are your results/ })).toBeVisible();
});

async function openPatient(
  page: Page,
  token: string,
  last: string,
  m: string,
  d: string,
  y: string,
) {
  await page.goto(`/r/${token}`);
  await page.getByLabel('Last name').fill(last);
  await page.getByLabel('Month').fill(m);
  await page.getByLabel('Day').fill(d);
  await page.getByLabel('Year').fill(y);
  await page.getByRole('button', { name: 'View my results' }).click();
  await expect(page.getByRole('heading', { name: /here are your results/ })).toBeVisible();
  // Every patient view carries the education-only disclaimer (FR-12, DoD #4).
  await expect(page.getByText(/not medical advice/)).toBeVisible();
}

test('an all-in-range report shows the every-result-typical affirmation', async ({ page }) => {
  await openPatient(page, 'demo-nguyen-token', 'Nguyen', '9', '14', '1979');
  await expect(page.getByText(/Every result in the typical range/)).toBeVisible();
});

test('an implausible value is flagged to double-check, never explained as real', async ({
  page,
}) => {
  await openPatient(page, 'demo-park-token', 'Park', '2', '28', '1995');
  await expect(page.getByText('Please double-check').first()).toBeVisible();
  await expect(page.getByText(/looks unusual and will be double-checked/)).toBeVisible();
});

test('a patient can ask a question about the results (FR-13)', async ({ page, request }) => {
  const before = await getEmailCounts(request);

  // An all-in-range report: no result-card copy to collide with the ask flow.
  await openPatient(page, 'demo-nguyen-token', 'Nguyen', '9', '14', '1979');

  await page.getByRole('link', { name: /Message Dr\. Anderson/ }).click();
  await expect(page.getByText(/not medical advice/)).toBeVisible();

  await page.getByPlaceholder(/Write your question here/).fill('Should I re-test in six months?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('heading', { name: 'Your question was sent' })).toBeVisible();

  await expect(async () => {
    const after = await getEmailCounts(request);
    expect(after.question).toBe(before.question + 1);
  }).toPass();
});
