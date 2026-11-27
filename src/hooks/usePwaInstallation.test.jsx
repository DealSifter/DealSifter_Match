// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://dealsifter.com/"}
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { usePwaInstallation } from './usePwaInstallation';
import { canOfferInstallation, installationInstructions, installationTarget, requestAppInstallation } from '../lib/pwaInstallation';

const uuid = '12345678-1234-4123-8123-123456789abc';
const fakeWindow = (href, userAgent = 'Chrome Android') => ({ location: { href, assign: vi.fn() }, navigator: { userAgent }, matchMedia: () => ({ matches: false }) });
let root, host;
afterEach(() => { if (root) act(() => root.unmount()); root = null; host?.remove(); vi.restoreAllMocks(); });

describe('canonical PWA installation', () => {
  it('opens the modern native installer immediately without a deferred event', async () => {
    const win = fakeWindow('https://dealsifter.com/'), notify = vi.fn();
    win.navigator.install = vi.fn(function () { expect(this).toBe(win.navigator); return Promise.resolve(); });
    const pending = requestAppInstallation(win, null, notify, 'pt');
    expect(win.navigator.install).toHaveBeenCalledOnce();
    expect(await pending).toBe('accepted');
    expect(notify).not.toHaveBeenCalled();
  });
  it('does not open native installation from Preview or an alias', async () => {
    for (const href of ['https://dealsiftermatch-preview.vercel.app/', 'https://www.dealsifter.com/']) {
      const win = fakeWindow(href); win.navigator.install = vi.fn();
      await requestAppInstallation(win, null, vi.fn(), 'en');
      expect(win.navigator.install).not.toHaveBeenCalled();
    }
  });
  it('respects native cancellation without another prompt or manual message', async () => {
    const win = fakeWindow('https://dealsifter.com/'), notify = vi.fn(), legacy = { prompt: vi.fn() };
    win.navigator.install = vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError'));
    expect(await requestAppInstallation(win, legacy, notify, 'en')).toBe('dismissed');
    expect(notify).not.toHaveBeenCalled(); expect(legacy.prompt).not.toHaveBeenCalled();
  });
  it('redirects only the two public aliases and drops authentication material', () => {
    for (const alias of ['www.dealsifter.com', 'dealsiftermatch.vercel.app']) {
      const result = installationTarget(`https://${alias}/?propertyId=${uuid}&code=secret&token=secret&redirect_to=https://evil.invalid#access_token=secret`);
      expect(result).toEqual({ kind: 'redirect', url: `https://dealsifter.com/?propertyId=${uuid}` });
    }
    expect(installationTarget('https://dealsifter.com/')).toEqual({ kind: 'canonical' });
  });
  it('never offers installation on Preview, localhost or a lookalike host', async () => {
    for (const href of ['https://dealsiftermatch-preview.vercel.app/', 'http://localhost:5173/', 'https://dealsifter.com.evil.invalid/']) {
      const win = fakeWindow(href), prompt = { prompt: vi.fn() }, notify = vi.fn();
      expect(canOfferInstallation(win)).toBe(false);
      expect(await requestAppInstallation(win, prompt, notify, 'en')).toBe('unavailable');
      expect(prompt.prompt).not.toHaveBeenCalled();
      expect(win.location.assign).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledOnce();
    }
  });
  it('moves to the canonical origin before invoking any alias install prompt', async () => {
    const win = fakeWindow('https://www.dealsifter.com/privacy?lang=pt#recovery'), prompt = { prompt: vi.fn() };
    expect(await requestAppInstallation(win, prompt, vi.fn(), 'pt')).toBe('redirected');
    expect(win.location.assign).toHaveBeenCalledWith('https://dealsifter.com/privacy?lang=pt');
    expect(prompt.prompt).not.toHaveBeenCalled();
  });
  it('uses the native prompt on the canonical origin and respects dismissal', async () => {
    const notify = vi.fn(), prompt = { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'dismissed' }) };
    expect(await requestAppInstallation(fakeWindow('https://dealsifter.com/'), prompt, notify, 'en')).toBe('dismissed');
    expect(prompt.prompt).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();
  });
  it('falls back to manual instructions if the prompt is unavailable or fails', async () => {
    const win = fakeWindow('https://dealsifter.com/'), notify = vi.fn();
    expect(await requestAppInstallation(win, null, notify, 'pt')).toBe('manual');
    expect(notify.mock.calls[0][0].message).toContain('Instalar aplicativo');
    expect(await requestAppInstallation(win, { prompt: () => Promise.reject(new Error('used')) }, notify, 'pt')).toBe('manual');
  });
  it('uses device and selected language instructions without promising automatic installation', () => {
    expect(installationInstructions({ userAgent: 'iPhone Safari' }, 'pt').message).toContain('Compartilhar');
    expect(installationInstructions({ userAgent: 'iPhone CriOS' }, 'en').message).toContain('Open dealsifter.com in Safari');
    expect(installationInstructions({ userAgent: 'Macintosh Safari', maxTouchPoints: 5 }, 'es').message).toContain('Compartir');
    expect(installationInstructions({ userAgent: 'Macintosh Safari', maxTouchPoints: 0 }, 'pt').message).toContain('Dock');
    expect(installationInstructions({ userAgent: 'Chrome Windows' }, 'es').message).toContain('si está disponible');
  });
  it('does not offer another installation while running standalone', async () => {
    const win = fakeWindow('https://dealsifter.com/'); win.navigator.standalone = true;
    const prompt = { prompt: vi.fn() };
    expect(canOfferInstallation(win)).toBe(false);
    expect(await requestAppInstallation(win, prompt, vi.fn(), 'en')).toBe('installed');
    expect(prompt.prompt).not.toHaveBeenCalled();
  });
  it('keeps the existing implicit canonical identity and root launch/scope', () => {
    const manifest = JSON.parse(readFileSync('public/site.webmanifest', 'utf8'));
    expect(new URL(manifest.id, 'https://dealsifter.com/site.webmanifest').href).toBe('https://dealsifter.com/');
    expect(manifest.start_url).toBe('/'); expect(manifest.scope).toBe('/');
    expect(manifest.name).toBe('DealSifter'); expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(2);
  });
});

describe('hamburger installation hook', () => {
  it('opens only one modern native request while the browser is awaiting consent', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let finish;
    const install = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    Object.defineProperty(window.navigator, 'install', { configurable: true, value: install });
    const toast = vi.fn();
    function Harness() { const pwa = usePwaInstallation(toast, 'en'); return pwa.showInstallAppButton ? <button onClick={pwa.handleInstallApp}>Install</button> : <span>Hidden</span>; }
    try {
      host = document.createElement('div'); document.body.append(host); root = createRoot(host);
      await act(async () => root.render(<Harness />));
      await act(async () => { host.querySelector('button').click(); host.querySelector('button').click(); });
      expect(install).toHaveBeenCalledOnce(); expect(toast).not.toHaveBeenCalled();
      await act(async () => finish());
      expect(host.querySelector('button')).toBeNull();
    } finally { delete window.navigator.install; }
  });
  it('offers manual fallback before a native prompt and handles appinstalled', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const toast = vi.fn();
    function Harness() { const pwa = usePwaInstallation(toast, 'en'); return pwa.showInstallAppButton ? <button onClick={pwa.handleInstallApp}>Install</button> : <span>Hidden</span>; }
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(<Harness />));
    expect(host.querySelector('button')).not.toBeNull();
    await act(async () => host.querySelector('button').click());
    expect(toast).toHaveBeenCalledOnce();
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = vi.fn().mockResolvedValue(undefined); event.userChoice = Promise.resolve({ outcome: 'accepted' });
    await act(async () => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    await act(async () => host.querySelector('button').click());
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(host.querySelector('button')).toBeNull();
    await act(async () => window.dispatchEvent(new Event('appinstalled')));
    expect(host.textContent).toBe('Hidden');
  });
});
