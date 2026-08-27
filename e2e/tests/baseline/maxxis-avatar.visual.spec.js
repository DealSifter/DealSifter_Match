import { test, expect } from '../../fixtures/baselineFixture.js';
import {
  installVisualStability,
  loginBaseline,
  visualMasks,
} from '../../support/baselineActions.js';

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

async function setAvatarSizeFromHeader(page, value) {
  await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
  await page.getByTestId('maxxis-preferences-button').click();
  await page.getByTestId('maxxis-avatar-size-slider-header').fill(String(value));
  await page.locator('.maxxis-actions').getByRole('button', { name: /close|fechar|cerrar/i }).click();
  await expect(page.getByTestId('maxxis-avatar-fab')).toHaveAttribute('data-avatar-size', Number(value).toFixed(2));
}

test('evolved Maxxis Deal AI avatar presentation at maximum size', async ({ page, mockBackend }, testInfo) => {
  await primeAvatar(page, 'IDLE');
  await loginBaseline(page, mockBackend.users.investor);
  await setAvatarSizeFromHeader(page, 2.5);
  await installVisualStability(page);
  await expect(page).toHaveScreenshot(`${testInfo.project.name}-maxxis-avatar-presentation-2-5x-light.png`, {
    animations: 'disabled',
    caret: 'hide',
    mask: visualMasks(page),
    maskColor: '#e4e5e6',
  });

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(page).toHaveScreenshot(`${testInfo.project.name}-maxxis-avatar-presentation-2-5x-dark.png`, {
    animations: 'disabled',
    caret: 'hide',
    mask: visualMasks(page),
    maskColor: '#e4e5e6',
  });
});
