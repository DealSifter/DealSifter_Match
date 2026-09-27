import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

const PROPERTY_ID = '11111111-2222-4333-8444-555555555555';

async function installGapResponse(page) {
  let requests = 0;
  let saves = 0;
  await page.route('**/functions/v1/maxxis-analysis-inputs', async (route) => {
    saves += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { status: 'saved' } }) });
  });
  await page.route('**/functions/v1/maxxis-chat', async (route) => {
    requests += 1;
    const gated = requests === 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(gated ? {
        success: true,
        type: 'deal_insight',
        message: 'More evidence is required.',
        data: {
          state: 'ANALYSIS_READY',
          propertyId: PROPERTY_ID,
          property: { id: PROPERTY_ID, address: '9537 Dalegrove Dr', rehab: null },
          evidenceCompletenessGate: {
            status: 'USER_INPUT_REQUIRED',
            question: 'Confirm the target condition and rehabilitation budget.',
            missingUserInputs: ['target_condition', 'rehab_budget'],
            assumptions: { targetCondition: 'AS_IS' },
            benchmarkOptions: [{ scope: 'AS_IS', low: 10000, mid: 15000, high: 20000 }, { scope: 'FULL_RENOVATION', low: 200000, mid: 250000, high: 300000 }],
          },
        },
      } : {
        success: true,
        type: 'text',
        message: 'The supplied evidence was accepted and the analysis can continue.',
        data: { propertyId: PROPERTY_ID },
      }),
    });
  });
  return { requests: () => requests, saves: () => saves };
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`resolves the Maxxis analysis gap without blocked controls or overflow — ${viewport.name}`, async ({ page, mockBackend }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const calls = await installGapResponse(page);
    await loginAs(page, mockBackend.users.investor);
    await openMaxxis(page);
    await page.getByTestId('maxxis-input').fill('Generate Maxxis analysis report for 9537 Dalegrove Dr');
    await page.getByTestId('maxxis-send').click();

    const gap = page.getByTestId('maxxis-analysis-gap-resolution');
    await expect(gap).toBeVisible();
    await expect(gap.getByLabel('Rehab amount')).toHaveCount(0);
    await gap.getByLabel('Target condition').selectOption('FULL_RENOVATION');
    await gap.getByRole('button', { name: 'Use 2026 state reference' }).click();
    await expect(gap).toContainText('$250,000');
    const continueButton = gap.getByRole('button', { name: 'Continue analysis' });
    await continueButton.dblclick({ delay: 20 });
    await expect(page.getByTestId('maxxis-analysis-gap-resolved')).toBeVisible();
    await expect(page.getByTestId('maxxis-analysis-gap-resolved')).toContainText('Full renovation');
    await expect.poll(calls.saves).toBe(1);
    await expect.poll(calls.requests).toBe(2);

    const panel = await page.getByTestId('maxxis-panel').boundingBox();
    expect(panel?.x).toBeGreaterThanOrEqual(0);
    expect(panel?.x + panel?.width).toBeLessThanOrEqual(viewport.width + 1);
    await page.getByTestId('maxxis-analysis-gap-resolved').getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByTestId('maxxis-analysis-gap-resolution')).toBeVisible();
  });
}
