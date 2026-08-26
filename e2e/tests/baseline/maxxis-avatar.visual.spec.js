import { test, expect } from '../../fixtures/baselineFixture.js';
import { loginBaseline } from '../../support/baselineActions.js';

async function primeAvatar(page, state = 'IDLE') {
  await page.addInitScript((avatarState) => {
    window.localStorage.setItem('ds_e2e_maxxis_avatar_state', avatarState);
    window.localStorage.setItem('ds_e2e_maxxis_avatar_intensity', 'SUBTLE');
  }, state);
}

async function setAvatar(page, state) {
  await page.evaluate((avatarState) => {
    window.localStorage.setItem('ds_e2e_maxxis_avatar_state', avatarState);
    window.dispatchEvent(new Event('ds:e2e:maxxis-avatar'));
  }, state);
  const avatar = page.getByTestId('maxxis-avatar-fab');
  await expect(avatar).toHaveAttribute('data-avatar-state', state);
  await expect(avatar).toHaveAttribute('data-transitioning', 'false', { timeout: 2_000 });
  return avatar;
}

test('desktop official Maxxis Deal AI avatar states', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-baseline');
  await primeAvatar(page);
  await loginBaseline(page, mockBackend.users.investor);

  for (const state of ['IDLE', 'OBSERVING', 'PROCESSING', 'NOTICED', 'WAITING', 'SUCCESS']) {
    const avatar = await setAvatar(page, state);
    await expect(avatar).toHaveScreenshot(`desktop-maxxis-avatar-${state.toLowerCase()}.png`, {
      animations: 'disabled',
      caret: 'hide',
    });
  }
});

test('mobile official Maxxis Deal AI avatar states stay inside the current hit target', async ({ page, mockBackend }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-baseline');
  await primeAvatar(page);
  await loginBaseline(page, mockBackend.users.investor);

  for (const state of ['IDLE', 'PROCESSING', 'SUCCESS']) {
    const avatar = await setAvatar(page, state);
    const box = await avatar.boundingBox();
    expect(box?.width).toBe(47);
    expect(box?.height).toBe(47);
    await expect(avatar).toHaveScreenshot(`mobile-maxxis-avatar-${state.toLowerCase()}.png`, {
      animations: 'disabled',
      caret: 'hide',
    });
  }
});

