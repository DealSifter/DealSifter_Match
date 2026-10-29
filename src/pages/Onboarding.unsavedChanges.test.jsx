// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Onboarding } from './Onboarding';
import { setLang } from '../i18n/translations';

function mount(accountType = 'fsbo_owner', overrides = {}) {
  const props = { accountType, setAccountType: vi.fn(), setPage: vi.fn(),
    authSession: { userId: '11111111-1111-4111-8111-111111111111' },
    personalProfile: { fullNameFsbo: 'Saved Seller', primaryPhoneFsbo: '+15555550101' },
    professionalProfile: { fullNameA: 'Saved Investor', fullNameB: 'Saved Business' },
    setPersonalProfile: vi.fn(), setProfessionalProfile: vi.fn(), setUserProfile: vi.fn(),
    propertyPortfolio: [], servicePortfolio: [], setPropertyPortfolio: vi.fn(), setServicePortfolio: vi.fn(), ...overrides };
  return { ...render(<Onboarding {...props} />), props };
}
beforeEach(() => {
  localStorage.clear(); setLang('pt');
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(cleanup);

describe('onboarding save reminders', () => {
  it.each(['property', 'service'])('highlights only changed fields in the %s editor', async kind => {
    const record = { id: '22222222-2222-4222-8222-222222222222', ownerId: '11111111-1111-4111-8111-111111111111',
      primaryProfile: 'fsbo', address: '123 Saved Street', title: 'Saved Service', category: 'General Contractor',
      city: 'Boston', state: 'MA', zip: '02108', price: 100000, markets: ['MA'], images: [], media: { images: [] }, source: 'portfolio' };
    const { container } = mount('fsbo_owner', kind === 'property' ? { propertyPortfolio: [record] } : { servicePortfolio: [record] });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    if (kind === 'property') fireEvent.click(container.querySelector(`[data-testid="property-edit-${record.id}"]`));
    else {
      fireEvent.click(screen.getByRole('button', { name: 'Servicos', exact: true }));
      fireEvent.click(within(container.querySelector('[data-guide="onboarding-records"]')).getByRole('button', { name: /Editar/ }));
    }
    const dialog = screen.getByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Salvar', exact: true });
    const input = within(dialog).getAllByRole('textbox')[0]; const initial = input.value;
    expect(save.classList.contains('is-dirty')).toBe(false);
    fireEvent.change(input, { target: { value: `${initial} changed` } });
    expect(save.classList.contains('is-dirty')).toBe(true);
    fireEvent.change(input, { target: { value: initial } });
    expect(save.classList.contains('is-dirty')).toBe(false);
  });
  it.each(['fsbo_owner', 'professional'])('highlights edits and stops when reverted for %s', async accountType => {
    const { container } = mount(accountType);
    const save = container.querySelector('[data-guide="onboarding-save-profile"]');
    const input = container.querySelector('[data-mobile-step="profileAName"]');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    const initial = input.value;
    await waitFor(() => expect(save.classList.contains('is-dirty')).toBe(false));
    fireEvent.change(input, { target: { value: `${initial} edited` } });
    await waitFor(() => expect(save.classList.contains('is-dirty')).toBe(true));
    fireEvent.change(input, { target: { value: initial } });
    await waitFor(() => expect(save.classList.contains('is-dirty')).toBe(false));
  });
  it('keeps the reminder after failed validation and clears it only after a successful save', async () => {
    const { container, props } = mount();
    const save = container.querySelector('[data-guide="onboarding-save-profile"]');
    const input = container.querySelector('[data-mobile-step="profileAName"]');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    await waitFor(() => expect(input.value).toBe('Saved Seller'));
    await waitFor(() => expect(save.classList.contains('is-dirty')).toBe(false));
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(save.classList.contains('is-dirty')).toBe(true));
    fireEvent.click(save); expect(props.setPersonalProfile).not.toHaveBeenCalled();
    expect(save.classList.contains('is-dirty')).toBe(true);
    fireEvent.change(input, { target: { value: 'Updated Seller' } });
    fireEvent.click(save);
    await waitFor(() => expect(props.setPersonalProfile).toHaveBeenCalled());
    await waitFor(() => expect(save.classList.contains('is-dirty')).toBe(false));
  });
});
