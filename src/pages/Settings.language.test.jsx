// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Settings } from './Settings';
import { setLang, translations } from '../i18n/translations';
import { ToastContainer } from '../components/ui/Toast';
vi.mock('../lib/supabaseClient', () => ({ supabase: null, isSupabaseConfigured: false, supabaseAnonKey: '', getSupabaseFunctionUrl: vi.fn() }));
beforeEach(() => { localStorage.clear(); window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
afterEach(cleanup);
function mount(tab, props = {}) {
  return render(<Settings initialTab={tab} systemAccount={{ fullName: 'Owner Name', email: 'owner@example.test', phone: '2025550123' }} setSystemAccount={vi.fn()} setPage={vi.fn()} authSession={{ email: 'owner@example.test', emailVerified: true }} onDeleteAccount={vi.fn()} onRevokeConsent={vi.fn()} {...props} />);
}
describe('settings language coverage', () => {
  it.each([['en-US', 'en'], ['pt-BR', 'pt'], ['es-ES', 'es']])('translates preferences, privacy and confirmation in %s', async (locale, base) => {
    setLang(locale); mount('preferences'); const t = translations[base].settings;
    expect(screen.getAllByText(t.preferencesTitle).length).toBeGreaterThan(0);
    expect(screen.getByText(t.prefMapStyle)).toBeTruthy();
    expect(screen.getByRole('option', { name: t.prefMapSatellite })).toBeTruthy();
    // Settings applies initialTab on the next task; let initialization settle
    // before simulating a user's tab change.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    fireEvent.click(screen.getByRole('button', { name: t.tabPrivacy }));
    await waitFor(() => expect(screen.getAllByText(t.privacyTitle).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: t.deleteAccount }));
    expect(screen.getByText(t.privacyDeleteConfirm)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm })).toBeTruthy();
  });
  it('updates the text of an already-open privacy confirmation after a language change', async () => {
    setLang('en-US'); mount('privacy');
    fireEvent.click(screen.getByRole('button', { name: translations.en.settings.deleteAccount }));
    await act(async () => setLang('pt-BR'));
    await waitFor(() => expect(screen.getByText(translations.pt.settings.privacyDeleteConfirm)).toBeTruthy());
    expect(screen.queryByText(translations.en.settings.privacyDeleteConfirm)).toBeNull();
  });
  it('translates an existing system toast when language changes and preserves its count', async () => {
    setLang('en-US');
    render(<ToastContainer toasts={[{ id: 'one', type: 'warning', title: 'Unlock price updated', message: 'The current secure price is 21 nuggets. Please confirm again.', duration: 60000 }]} onDismiss={vi.fn()} />);
    expect(screen.getByText('Unlock price updated')).toBeTruthy();
    await act(async () => setLang('es-ES'));
    await waitFor(() => expect(screen.getByText('Coste del desbloqueo actualizado')).toBeTruthy());
    expect(screen.getByText('El coste seguro actual es de 21 nuggets. Confirma de nuevo.')).toBeTruthy();
  });
});
