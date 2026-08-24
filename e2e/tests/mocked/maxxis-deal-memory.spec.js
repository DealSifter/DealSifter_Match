import { test, expect } from '../../fixtures/baselineFixture.js';
import {
  loginBaseline,
  openMatches,
  selectBaselineProperty,
} from '../../support/baselineActions.js';
import { openMaxxis } from '../../support/appActions.js';

test.setTimeout(360_000);

async function send(page, text) {
  await page.getByTestId('maxxis-input').fill(text);
  const response = page.waitForResponse((item) => item.url().includes('/functions/v1/maxxis-chat'));
  await page.getByTestId('maxxis-send').click({ force: true });
  await response;
}

test('Maxxis recalls a deal in a later session, reports structured changes and forgets only after confirmation', async ({ page, mockBackend }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ds_feature_flag_overrides', JSON.stringify({ maxxis_deal_memory: true }));
    localStorage.setItem('lang', 'en');
  });
  await loginBaseline(page, mockBackend.users.investor);
  await expect(page.locator('.maxxis-shell')).toHaveAttribute('data-maxxis-deal-memory', 'enabled');

  await openMatches(page);
  await selectBaselineProperty(page);
  await openMaxxis(page);
  await send(page, 'How is this deal?');
  await expect(page.getByTestId('maxxis-messages')).toContainText('Deal snapshot');

  const checkpointState = await page.evaluate(({ userId }) => {
    const raw = localStorage.getItem(`ds_maxxis_deal_memory_v1:${userId}`);
    return {
      checkpoint: raw ? JSON.parse(raw) : null,
      memoryKeys: Object.keys(localStorage).filter((key) => key.includes('maxxis_deal_memory')),
      status: document.querySelector('.maxxis-shell')?.getAttribute('data-maxxis-deal-memory-status'),
    };
  }, { userId: mockBackend.users.investor.id });
  const firstCheckpoint = checkpointState.checkpoint;
  expect(firstCheckpoint?.version, JSON.stringify(checkpointState)).toBe(1);
  expect(Object.keys(firstCheckpoint?.memories || {})).toEqual([mockBackend.ids.property]);
  expect(JSON.stringify(firstCheckpoint)).not.toMatch(/email|phone|whatsapp|address|message_body|chat_history|gemini|user_prompt|quote_body/i);

  await page.keyboard.press('Escape');
  mockBackend.state.maxxisProviderReplied = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('matches-root')).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId('maxxis-panel')).toBeHidden();

  if (!(await page.getByTestId('matches-root').isVisible().catch(() => false))) await openMatches(page);
  await selectBaselineProperty(page);
  await openMaxxis(page);
  await send(page, 'Where were we?');

  const recall = page.getByTestId('maxxis-memory-recall');
  await expect(recall).toBeVisible();
  await expect(recall).toContainText('Provider Reply Detected');
  await expect(page.getByTestId('maxxis-memory-current-open')).toContainText('Inspection Completed');
  await expect(page.getByTestId('maxxis-memory-next-step')).toContainText('Review Provider Reply');
  await expect(page.getByTestId('maxxis-followup-memory_what_changed')).toBeVisible();
  await expect(page.getByTestId('maxxis-followup-memory_still_open')).toBeVisible();

  await page.getByTestId('maxxis-input').fill('Forget this deal memory');
  await page.getByTestId('maxxis-send').click({ force: true });
  await expect(page.getByTestId('maxxis-memory-forget-confirmation')).toBeVisible();
  const beforeConfirmation = await page.evaluate(({ userId }) => localStorage.getItem(`ds_maxxis_deal_memory_v1:${userId}`), { userId: mockBackend.users.investor.id });
  expect(beforeConfirmation).toBeTruthy();
  await page.getByTestId('maxxis-memory-forget-confirm').click();
  await expect(page.getByTestId('maxxis-messages')).toContainText(/snapshot.*removed/i);
  const remaining = await page.evaluate(({ userId }) => JSON.parse(localStorage.getItem(`ds_maxxis_deal_memory_v1:${userId}`) || '{}'), { userId: mockBackend.users.investor.id });
  expect(remaining.memories || {}).toEqual({});
});
