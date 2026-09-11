import { test, expect, E2E_IDS } from '../../fixtures/cardIntegrityFixture.js';
import { loginBaseline, openMatches, selectBaselineProperty } from '../../support/baselineActions.js';

async function mockPropertyIntelligence(page, payload, calls) {
  await page.route('**/functions/v1/property-intelligence', async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

test('locked Property Intelligence shows placeholders without protected data or Nugget debit', async ({ page, mockBackend }) => {
  const calls = [];
  await mockPropertyIntelligence(page, { success: true, state: 'locked', entitled: false, authRequired: false }, calls);
  await loginBaseline(page, mockBackend.users.investor);
  const balance = mockBackend.users.investor.nuggets;
  await openMatches(page);
  await selectBaselineProperty(page);

  const section = page.getByTestId('property-intelligence');
  await expect(section).toBeVisible();
  await expect(section.getByTestId('property-intelligence-locked')).toBeVisible();
  await expect(section).toContainText('Tax Assessment');
  await expect(section).not.toContainText(/\$[0-9]|Public property records via RentCast/);
  await section.getByRole('button', { name: 'Unlock Deal Intelligence' }).click();
  await expect(page.getByRole('dialog', { name: 'Deal Intelligence unlock' })).toContainText('No Nuggets have been charged');
  expect(mockBackend.users.investor.nuggets).toBe(balance);
  expect(calls).toEqual([{ propertyId: E2E_IDS.property }]);
});
test('unlocked Property Intelligence renders cached evidence, conflicts and unavailable fields', async ({ page, mockBackend }) => {
  const calls = [];
  await mockPropertyIntelligence(page, {
    success: true,
    state: 'unlocked',
    entitled: true,
    intelligence: {
      propertyId: E2E_IDS.property,
      cacheHit: true,
      fields: {
        propertyType: { value: 'Single Family', status: 'VERIFIED_RECORD' },
        bedrooms: { value: 3, status: 'VERIFIED_RECORD' },
        bathrooms: { value: 2, status: 'VERIFIED_RECORD' },
        livingAreaSqft: { value: 1218, status: 'VERIFIED_RECORD' },
        lotSizeSqft: { value: null, status: 'UNAVAILABLE' },
        yearBuilt: { value: 1986, status: 'VERIFIED_RECORD' },
        county: { value: 'Dallas', status: 'VERIFIED_RECORD' },
        assessedValue: { value: 225000, status: 'VERIFIED_RECORD' },
        assessmentYear: { value: 2025, status: 'VERIFIED_RECORD' },
        annualPropertyTax: { value: 4200, status: 'VERIFIED_RECORD' },
        propertyTaxYear: { value: 2025, status: 'VERIFIED_RECORD' },
        latestSalePrice: { value: 210000, status: 'VERIFIED_RECORD' },
        latestSaleDate: { value: '2024-01-15', status: 'VERIFIED_RECORD' },
        ownerOccupied: { value: false, status: 'VERIFIED_RECORD' },
        ownershipRecordPresent: { value: true, status: 'VERIFIED_RECORD' },
      },
      conflicts: [{ field: 'livingAreaSqft', dealSifterValue: 1450, publicRecordValue: 1218, severity: 'WARNING' }],
      missingFields: ['characteristics.lotSizeSqft'],
      source: { label: 'Public property records via RentCast', updatedAt: '2026-09-10T00:00:00.000Z' },
    },
  }, calls);
  await loginBaseline(page, mockBackend.users.investor);
  await openMatches(page);
  await selectBaselineProperty(page);

  const section = page.getByTestId('property-intelligence');
  await expect(section.getByTestId('property-intelligence-unlocked')).toBeVisible();
  await expect(section).toContainText('1,218 sqft');
  await expect(section).toContainText('Unavailable');
  await expect(section).toContainText('Records differ');
  await expect(section).toContainText('DealSifter: 1450');
  await expect(section).toContainText('Public Record: 1218');
  await expect(section).toContainText('Public property records via RentCast');
  expect(calls).toEqual([{ propertyId: E2E_IDS.property }]);
});
