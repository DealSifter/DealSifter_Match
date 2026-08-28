import { test, expect, E2E_IDS } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

async function askMaxxis(page, text) {
  if (!(await page.getByTestId('maxxis-panel').isVisible().catch(() => false))) {
    await openMaxxis(page);
  }
  await page.getByTestId('maxxis-input').fill(text);
  await page.getByTestId('maxxis-send').click({ force: true });
}

test.describe('Maxxis Deal AI context awareness', () => {
  test('tracks sanitized live surface context without visual UX changes', async ({ page, mockBackend }) => {
    test.setTimeout(360_000);
    await loginAs(page, mockBackend.users.investor);

    await openMaxxis(page);
    const explicitRequestPromise = page.waitForRequest((request) => (
      request.method() === 'POST'
      && request.url().includes('/functions/v1/maxxis-chat')
      && String(request.postDataJSON()?.message || '').includes(E2E_IDS.property)
      && Boolean(request.postDataJSON()?.context?.maxxisContext)
    ));
    await askMaxxis(page, `Show property details for ${E2E_IDS.property}`);
    const request = await explicitRequestPromise;
    const body = request.postDataJSON();

    expect(body.context.maxxisContext).toMatchObject({
      contextVersion: 2,
      surface: { name: 'dashboard' },
      view: {
        activeCardIndex: 0,
        filters: { view: 'connections' },
      },
    });
    expect(Number(body.context.maxxisContext.economy?.nuggetBalance)).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(body.context.maxxisContext)).not.toMatch(/email|phone|whatsapp|chat body/i);
  });
});
