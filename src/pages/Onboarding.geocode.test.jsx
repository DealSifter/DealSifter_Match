// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Onboarding } from './Onboarding';
import { setLang } from '../i18n/translations';

const draft = { id: '22222222-2222-4222-8222-222222222222', ownerId: '11111111-1111-4111-8111-111111111111',
  address: '1524 Wood Spring Ct', city: 'Raleigh', state: 'NC', zip: '27614', price: 250000,
  primaryProfile: 'fsbo', markets: ['NC'], source: 'portfolio', publishToShowcase: false, isActive: false, geocodeStatus: 'failed', images: [] };
function mount(property, validate = vi.fn()) {
  const setPropertyPortfolio = vi.fn();
  const result = render(<Onboarding setPage={vi.fn()} authSession={{ userId: draft.ownerId }}
    accountType="fsbo_owner" setAccountType={vi.fn()} setUserProfile={vi.fn()}
    personalProfile={{ fullNameFsbo: 'Test Owner', locFsbo: 'NC' }} setPersonalProfile={vi.fn()}
    professionalProfile={{}} setProfessionalProfile={vi.fn()} servicePortfolio={[]} setServicePortfolio={vi.fn()}
    propertyPortfolio={[property]} setPropertyPortfolio={setPropertyPortfolio} onValidatePortfolioProperties={validate} />);
  return { ...result, setPropertyPortfolio };
}
beforeEach(() => {
  localStorage.clear(); setLang('pt');
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(cleanup);
describe('portfolio geocoding correction UX', () => {
  it('keeps a draft visible, with a complete orange explanation and blinking edit action', () => {
    const { container } = mount(draft);
    expect(screen.getByText(/Rascunho — endereço sem correspondência válida/)).toBeTruthy();
    const edit = container.querySelector('.geocode-edit-required');
    expect(edit).toBeTruthy();
    expect(edit.style.color).toBe('var(--geocode-attention)');
    expect(edit.getAttribute('aria-label')).toContain('Confira e edite');
  });
  it('validates an edited draft before committing it to local state', async () => {
    const validate = vi.fn().mockResolvedValue([{ ...draft, geocodeStatus: 'failed' }]);
    const { container, setPropertyPortfolio } = mount(draft, validate);
    fireEvent.click(container.querySelector('.geocode-edit-required'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar', exact: true }));
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(setPropertyPortfolio).toHaveBeenCalled());
    expect(validate.mock.calls[0][0][0]).toMatchObject({ id: draft.id, publishToShowcase: false });
    expect(screen.getByRole('alert').textContent).toContain('Confira e edite');
  });
  it('removes the correction warning once validated, without automatically publishing', () => {
    const { container } = mount({ ...draft, isActive: true, lat: 35.9211, lng: -78.5835,
      geocodeStatus: 'resolved', geocodeSource: 'census', geocodedAt: '2026-10-13T01:00:00Z' });
    expect(container.querySelector('.geocode-edit-required')).toBeNull();
    expect(screen.getByText('Validado — apto à publicação')).toBeTruthy();
  });
});
