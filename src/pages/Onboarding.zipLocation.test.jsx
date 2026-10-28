// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Onboarding } from './Onboarding';
import { setLang } from '../i18n/translations';
import { lookupProfileZip } from '../services/profileZipLocation';

vi.mock('../services/profileZipLocation', async (original) => ({ ...await original(), lookupProfileZip: vi.fn() }));
const zip = { zip: '02108', city: 'Boston', state: 'MA', lat: 42.3576, lng: -71.0639, source: 'zippopotamus' };
function mount() {
  const setPersonalProfile = vi.fn();
  const props = { setPage: vi.fn(), authSession: { userId: '11111111-1111-4111-8111-111111111111' },
    accountType: 'fsbo_owner', setAccountType: vi.fn(), setUserProfile: vi.fn(),
    personalProfile: { fullNameFsbo: 'Test Owner', locFsbo: 'AK', primaryPhoneFsbo: '+15555550101' }, setPersonalProfile,
    professionalProfile: {}, setProfessionalProfile: vi.fn(), servicePortfolio: [], setServicePortfolio: vi.fn(),
    propertyPortfolio: [], setPropertyPortfolio: vi.fn() };
  return { ...render(<Onboarding {...props} />), setPersonalProfile };
}
beforeEach(() => {
  localStorage.clear(); setLang('pt'); vi.clearAllMocks();
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(cleanup);

describe('profile ZIP Code onboarding', () => {
  it('replaces the state selector, derives MA from a leading-zero ZIP and saves its centroid', async () => {
    vi.mocked(lookupProfileZip).mockResolvedValue(zip);
    const { container, setPersonalProfile } = mount();
    const input = screen.getByLabelText('ZIP CODE');
    expect(input.tagName).toBe('INPUT');
    expect(screen.queryByText('Localizacao (Estado)')).toBeNull();
    // Wait for initial profile and draft hydration before editing.
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.change(input, { target: { value: '02108' } });
    await waitFor(() => expect(screen.getByText(/Boston, MA/)).toBeTruthy(), { timeout: 3000 });
    expect(input.value).toBe('02108');
    fireEvent.click(container.querySelector('.onb-save-profiles'));
    await waitFor(() => expect(setPersonalProfile).toHaveBeenCalled());
    expect(setPersonalProfile.mock.calls.at(-1)[0]).toMatchObject({ locFsbo: 'MA', zipLocationFsbo: zip });
  });

  it('does not save a ZIP that could not be resolved and offers a retry', async () => {
    vi.mocked(lookupProfileZip).mockRejectedValue(new Error('offline'));
    const { container, setPersonalProfile } = mount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.change(screen.getByLabelText('ZIP CODE'), { target: { value: '02108' } });
    await waitFor(() => expect(screen.getByText(/Não foi possível consultar o ZIP Code/)).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
    fireEvent.click(container.querySelector('.onb-save-profiles'));
    expect(setPersonalProfile).not.toHaveBeenCalled();
    expect(screen.getByText(/Aguarde a validação ou corrija o ZIP Code/)).toBeTruthy();
  });
});
