import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs, openMaxxis } from '../../support/appActions.js';

test('moves and minimizes the desktop Maxxis panel without losing the conversation', async ({ page, mockBackend }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, mockBackend.users.investor);
  await openMaxxis(page);

  const panel = page.getByTestId('maxxis-panel');
  await expect(panel).not.toHaveAttribute('aria-modal');
  await expect(page.getByTestId('maxxis-messages')).toContainText('Hi, I am Maxxis Deal AI');
  await page.getByTestId('maxxis-input').fill('Draft that must survive minimization');

  const initialBox = await panel.boundingBox();
  const dragHandle = page.getByTestId('maxxis-drag-handle');
  const handleBox = await dragHandle.boundingBox();
  expect(initialBox).not.toBeNull();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(handleBox.x + 210, handleBox.y + 34);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 330, handleBox.y + 94, { steps: 8 });
  await page.mouse.up();

  const movedBox = await panel.boundingBox();
  expect(movedBox.x).toBeGreaterThan(initialBox.x + 80);
  expect(movedBox.y).toBeGreaterThan(initialBox.y + 35);
  expect(movedBox.x + movedBox.width).toBeLessThanOrEqual(1432);
  expect(movedBox.y + movedBox.height).toBeLessThanOrEqual(892);

  await page.getByTestId('maxxis-minimize-button').click();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId('maxxis-fab')).toBeVisible();
  await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('maxxis-messages')).toContainText('Hi, I am Maxxis Deal AI');
  await expect(page.getByTestId('maxxis-input')).toHaveValue('Draft that must survive minimization');

  const restoredBox = await panel.boundingBox();
  expect(Math.abs(restoredBox.x - movedBox.x)).toBeLessThan(2);
  expect(Math.abs(restoredBox.y - movedBox.y)).toBeLessThan(2);
});
