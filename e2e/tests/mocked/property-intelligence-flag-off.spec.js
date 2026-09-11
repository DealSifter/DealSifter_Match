import { test, expect } from '../../fixtures/cardIntegrityFixture.js';
import { loginBaseline, openMatches, selectBaselineProperty } from '../../support/baselineActions.js';

test('disabled frontend flag does not mount Property Intelligence or call its endpoint', async ({ page, mockBackend }) => {
  const calls = [];
  await page.route('**/functions/v1/property-intelligence', async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Property Intelligence should not be called while disabled' }),
    });
  });

  await loginBaseline(page, mockBackend.users.investor);
  await openMatches(page);
  await selectBaselineProperty(page);

  await expect(page.getByTestId('property-intelligence')).toHaveCount(0);
  await expect(page.getByTestId('property-intelligence-locked')).toHaveCount(0);
  await expect(page.getByTestId('property-intelligence-unlocked')).toHaveCount(0);
  expect(calls).toEqual([]);
});
