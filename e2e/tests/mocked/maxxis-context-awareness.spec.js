import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';
import { openMatches } from '../../support/baselineActions.js';

async function askMaxxis(page, text) {
  if (!(await page.getByTestId('maxxis-panel').isVisible().catch(() => false))) {
    await openMaxxis(page);
  }
  await page.getByTestId('maxxis-input').fill(text);
  await page.getByTestId('maxxis-send').click({ force: true });
}

test.describe('Maxxis context awareness', () => {
  test('tracks surface, focused property and sanitized context without visual UX changes', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);

    await openMaxxis(page);
    await askMaxxis(page, 'What am I seeing?');
    await expect(page.getByTestId('maxxis-messages')).toContainText('You are on dashboard');

    const explicitRequestPromise = page.waitForRequest((request) => (
      request.method() === 'POST'
      && request.url().includes('/functions/v1/maxxis-chat')
    ));
    await askMaxxis(page, `Show property details for ${E2E_IDS.property}`);
    await explicitRequestPromise;
    await expect(page.getByTestId('maxxis-messages')).toContainText('Property Details');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('maxxis-panel')).toBeHidden();

    await openMatches(page);
    await askMaxxis(page, 'What am I seeing?');
    await expect(page.getByTestId('maxxis-messages')).toContainText('You are on matches');
    await expect(page.getByTestId('maxxis-messages')).toContainText('current focus is property');

    const requestPromise = page.waitForRequest((request) => (
      request.method() === 'POST'
      && request.url().includes('/functions/v1/maxxis-chat')
    ));
    await askMaxxis(page, 'Give me details about this deal');
    const request = await requestPromise;
    const body = request.postDataJSON();

    expect(body.context.propertyId).toBe(E2E_IDS.property);
    expect(body.context.maxxisContext).toMatchObject({
      contextVersion: 1,
      surface: { name: 'matches' },
      entity: { type: 'PROPERTY', id: E2E_IDS.property },
      property: { id: E2E_IDS.property },
    });
    expect(JSON.stringify(body.context.maxxisContext)).not.toMatch(/email|phone|whatsapp|chat body/i);
  });
});
