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
    await expect(page.getByTestId('maxxis-messages')).toContainText('Deal snapshot');
    await expect(page.getByTestId('maxxis-followup-deal_gaps')).toBeVisible();
    expect(maxxisChatRequests).toBe(1);

    await page.getByTestId('maxxis-followup-deal_gaps').click();
    await expect(page.getByTestId('maxxis-messages')).toContainText('What is missing');
    await expect(page.getByTestId('maxxis-messages')).toContainText('Workflow');
    expect(maxxisChatRequests).toBe(1);
  });
});
