import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

async function askMaxxis(page, text) {
  if (!(await page.getByTestId('maxxis-panel').isVisible().catch(() => false))) {
    await openMaxxis(page);
  }
  await page.getByTestId('maxxis-input').fill(text);
  await page.getByTestId('maxxis-send').click({ force: true });
}

test.describe('Maxxis interactive deal intelligence', () => {
  test('turns loaded deal data into snapshot, follow-ups and local gap explanation', async ({ page, mockBackend }) => {
    await loginAs(page, mockBackend.users.investor);
    await openMaxxis(page);

    let maxxisChatRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/functions/v1/maxxis-chat')) {
        maxxisChatRequests += 1;
      }
    });

    await askMaxxis(page, 'How is this deal?');
    await expect(page.getByTestId('maxxis-composed-analysis')).toContainText('Here is the current deal review.');
    await expect(page.getByTestId('maxxis-smart-action-VIEW_DEAL_GAPS')).toBeVisible();
    expect(maxxisChatRequests).toBe(1);

    await page.getByTestId('maxxis-smart-action-VIEW_DEAL_GAPS').click();
    await expect(page.getByTestId('maxxis-composed-analysis').last()).toContainText('important details are still missing');
    await expect(page.getByTestId('maxxis-composed-analysis').last().locator('.maxxis-composed-facts li')).toHaveCount(3);
    expect(maxxisChatRequests).toBe(1);
  });
});
