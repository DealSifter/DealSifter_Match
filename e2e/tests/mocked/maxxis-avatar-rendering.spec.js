import { test, expect } from '../../fixtures/appFixture.js';
import { loginAs } from '../../support/appActions.js';

async function primeAvatar(page, state = 'IDLE', intensity = 'SUBTLE') {
  await page.addInitScript(({ avatarState, avatarIntensity }) => {
    window.localStorage.setItem('ds_e2e_maxxis_avatar_state', avatarState);
    window.localStorage.setItem('ds_e2e_maxxis_avatar_intensity', avatarIntensity);
  }, { avatarState: state, avatarIntensity: intensity });
}

async function setAvatar(page, state, intensity = 'SUBTLE') {
  await page.evaluate(({ avatarState, avatarIntensity }) => {
    window.localStorage.setItem('ds_e2e_maxxis_avatar_state', avatarState);
    window.localStorage.setItem('ds_e2e_maxxis_avatar_intensity', avatarIntensity);
    window.dispatchEvent(new Event('ds:e2e:maxxis-avatar'));
  }, { avatarState: state, avatarIntensity: intensity });
}

test.describe('Maxxis Deal AI avatar rendering layer', () => {
  test('maps all states, finishes crossfades, and keeps motion deterministic', async ({ page, mockBackend }) => {
    test.setTimeout(300_000);
    await primeAvatar(page);
    await loginAs(page, mockBackend.users.investor);
    const avatar = page.getByTestId('maxxis-avatar-fab');
    const functionRequests = [];
    page.on('request', (request) => {
      if (request.url().includes('/functions/v1/')) functionRequests.push(request.url());
    });

    const states = [
      ['IDLE', 'avatar-idle', 'idle-loop', 'maxxisAvatarIdle'],
      ['OBSERVING', 'avatar-observing', 'observing-loop', 'maxxisAvatarObserving'],
      ['PROCESSING', 'avatar-processing', 'processing-loop', 'maxxisAvatarProcessing'],
      ['NOTICED', 'avatar-noticed', 'noticed-once', 'maxxisAvatarNoticed'],
      ['WAITING', 'avatar-waiting', 'waiting-loop', 'maxxisAvatarWaiting'],
      ['SUCCESS', 'avatar-success', 'success-once', 'maxxisAvatarSuccess'],
    ];

    for (const [state, asset, token, animationName] of states) {
      await setAvatar(page, state);
      await expect(avatar).toHaveAttribute('data-avatar-state', state);
      await expect(avatar).toHaveAttribute('data-avatar-asset', asset);
      await expect(avatar).toHaveAttribute('data-animation-token', token);
      await expect(avatar).toHaveAttribute('data-avatar-renderer', 'png-css');
      await expect(avatar.locator('.maxxis-avatar-motion')).toHaveCSS('animation-name', animationName);
      if (state !== 'IDLE') {
        await expect(avatar).toHaveAttribute('data-transitioning', 'false', { timeout: 2_000 });
        await expect(avatar.locator('.maxxis-avatar-layer--active')).toHaveCSS('animation-duration', '0.16s');
      }
    }

    expect(functionRequests).toEqual([]);
  });

  test('supports OFF, NORMAL, and reduced motion without changing avatar state', async ({ page, mockBackend }) => {
    test.setTimeout(300_000);
    await primeAvatar(page, 'PROCESSING', 'OFF');
    await loginAs(page, mockBackend.users.investor);
    const avatar = page.getByTestId('maxxis-avatar-fab');
    const motion = avatar.locator('.maxxis-avatar-motion');

    await expect(avatar).toHaveAttribute('data-avatar-state', 'PROCESSING');
    await expect(avatar).toHaveAttribute('data-animation-intensity', 'OFF');
    await expect(avatar).toHaveAttribute('data-animation-token', 'none');
    await expect(motion).toHaveCSS('animation-name', 'none');

    await setAvatar(page, 'SUCCESS', 'NORMAL');
    await expect(avatar).toHaveAttribute('data-avatar-state', 'SUCCESS');
    await expect(avatar).toHaveAttribute('data-animation-intensity', 'NORMAL');
    await expect(avatar).toHaveAttribute('data-animation-token', 'success-once');
    const normalScale = await motion.evaluate((element) => getComputedStyle(element).getPropertyValue('--maxxis-success-scale').trim());
    expect(Number(normalScale)).toBeGreaterThan(1.08);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(avatar).toHaveAttribute('data-avatar-state', 'SUCCESS');
    await expect(avatar).toHaveAttribute('data-reduced-motion', 'true');
    await expect(avatar).toHaveAttribute('data-animation-token', 'none');
    await expect(motion).toHaveCSS('animation-name', 'none');
  });
});
