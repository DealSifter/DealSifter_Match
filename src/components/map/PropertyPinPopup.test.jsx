// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropertyPinPopup } from './PropertyPinPopup';
import { resolvePropertyUnlockState } from '../../lib/unlockAccessState';

afterEach(cleanup);
const property = { id: 'property-1', price: 231000, city: 'Winter Garden', state: 'FL', zip: '34787', beds: 3, baths: 2, sqft: 1500, image: '/house.jpg' };
const subjectState = { parcel: { geometry: { type:'Polygon',coordinates:[[[-71,42],[-70.999,42],[-70.999,42.001],[-71,42]]] } } };
describe('Property pin card', () => {
  it.each(['property', 'contact', 'reciprocal'])('shows a line check and OK for canonical %s access acquired elsewhere', scope => {
    const match = vi.fn();
    const linkedProperty = { ...property, ownerId: 'seller', primaryProfile: 'fsbo' };
    const grants = new Map([['seller:fsbo', { ownerId: 'seller', primaryProfile: 'fsbo', unlockScope: scope, unlockedPropertyIds: [property.id] }]]);
    render(<PropertyPinPopup property={linkedProperty} label="A" unlocked={resolvePropertyUnlockState(linkedProperty, grants)} onMatch={match} />);
    const button = screen.getByRole('button', { name: 'OK' });
    expect(button.classList.contains('is-unlocked')).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.querySelector('svg').getAttribute('fill')).toBe('none');
    expect(button.querySelector('[style*="mask"]')).toBeNull();
    fireEvent.click(button); expect(match).not.toHaveBeenCalled();
  });
  it('updates immediately when Matches grants access and keeps other properties locked', () => {
    const linkedProperty = { ...property, ownerId: 'seller', primaryProfile: 'fsbo' };
    const grants = new Map([['seller:fsbo', { ownerId:'seller', primaryProfile:'fsbo', unlockScope:'property', unlockedPropertyIds:['different-property'] }]]);
    const { rerender } = render(<PropertyPinPopup property={linkedProperty} label="A" selected unlocked={resolvePropertyUnlockState(linkedProperty, grants)} onMatch={vi.fn()} />);
    expect(screen.getByRole('button', { name:'Match' }).disabled).toBe(false);
    expect(screen.queryByRole('button', { name:'OK' })).toBeNull();
    grants.get('seller:fsbo').unlockedPropertyIds.push(property.id);
    rerender(<PropertyPinPopup property={linkedProperty} label="A" unlocked={resolvePropertyUnlockState(linkedProperty, grants)} onMatch={vi.fn()} />);
    expect(screen.getByRole('button', { name:'OK' })).toBeTruthy();
  });
  it('shows and opens the linked profile even without a validated profile ZIP', () => {
    const owner = { name: 'Linked Seller', photo: '/seller.jpg', primaryProfile: 'fsbo' };
    const onOpenOwner = vi.fn(); const onOpen = vi.fn(); const onMatch = vi.fn();
    render(<PropertyPinPopup property={{ ...property, ownerPreview: owner }} label="A" language="pt"
      onOpenOwner={onOpenOwner} onOpen={onOpen} onMatch={onMatch} />);
    expect(screen.getByRole('img', { name: 'Linked Seller' }).getAttribute('src')).toBe('/seller.jpg');
    expect(screen.getByText('Linked Seller')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver perfil: Linked Seller' }));
    expect(onOpenOwner).toHaveBeenCalledWith(owner);
    expect(onOpen).not.toHaveBeenCalled(); expect(onMatch).not.toHaveBeenCalled();
  });
  it('keeps the profile name and an initial when the avatar fails, including the parcel page', () => {
    const { rerender } = render(<PropertyPinPopup property={{ ...property, ownerPreview: { name: 'Seller', photo: '/bad.jpg' } }} label="A" />);
    fireEvent.error(screen.getByRole('img', { name: 'Seller' }));
    expect(screen.getByText('S')).toBeTruthy(); expect(screen.getByText('Seller')).toBeTruthy();
    rerender(<PropertyPinPopup property={{ ...property, ownerPreview: { name: 'Seller' } }} label="A" parcelEligible
      parcelState={{ ...subjectState, lens: {}, page: 'parcel' }} />);
    expect(screen.getByText('Seller')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Open in feed/ })).toBeNull();
  });
  it('does not invent a profile when no identity is linked', () => {
    render(<PropertyPinPopup property={property} label="A" />);
    expect(screen.queryByRole('button', { name: /View profile/ })).toBeNull();
  });
  it('offers tabs only after activation and has no third close button', () => {
    const parcel = { geometry: { type: 'Polygon', coordinates: [] }, sourceAuthority: 'Public source', retrievedAt: '2026-10-13', sourceUrl: 'https://example.com' };
    const onParcelActivate = vi.fn(); const onParcelPage = vi.fn();
    const { rerender } = render(<PropertyPinPopup property={property} label="A" parcelEligible parcelState={{ parcel, page: 'property' }} onParcelActivate={onParcelActivate} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View parcel boundaries and public data' }));
    expect(onParcelActivate).toHaveBeenCalledWith(property);
    rerender(<PropertyPinPopup property={property} label="A" parcelEligible parcelState={{ parcel, lens: {}, page: 'parcel' }} onParcelPage={onParcelPage} />);
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close parcel lens' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Property', exact: true }));
    expect(onParcelPage).toHaveBeenCalledWith('property');
  });
  it('opens the feed only from the photo, not Match', async () => {
    const onOpen = vi.fn(); const onMatch = vi.fn().mockResolvedValue(true);
    render(<PropertyPinPopup property={property} label="108 Avenue A" onOpen={onOpen} onMatch={onMatch} language="pt" />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir no feed/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Match' }));
    await waitFor(() => expect(onMatch).toHaveBeenCalledWith(property));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Ver no Feed/i)).toBeNull();
  });
  it('reflects the canonical selected state rather than a separate local favorite', () => {
    const { rerender } = render(<PropertyPinPopup property={property} label="A" onMatch={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Match' }).getAttribute('aria-pressed')).toBe('false');
    rerender(<PropertyPinPopup property={property} label="A" selected onMatch={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Match' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Match' }).className).toContain('is-selected');
  });
  it('does not show fake ARV, match percentage or zero metrics', () => {
    render(<PropertyPinPopup property={{ price: null }} label="A" />);
    expect(screen.queryByText(/ARV/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getAllByText(/—/).length).toBe(4);
  });
  it('prevents matching own properties', () => {
    const match = vi.fn();
    render(<PropertyPinPopup property={property} label="A" own onMatch={match} />);
    fireEvent.click(screen.getByRole('button', { name: 'Match' }));
    expect(match).not.toHaveBeenCalled();
  });
  it.each([false, true])('keeps the magnifier for verified geometry independently of unlocked=%s', async unlocked => {
    const onParcelActivate = vi.fn().mockResolvedValue('ACTIVE');
    render(<PropertyPinPopup property={{ ...property, isUnlocked: unlocked }} selected={unlocked} label="A" parcelEligible parcelState={subjectState} onParcelActivate={onParcelActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'View parcel boundaries and public data' }));
    await waitFor(() => expect(onParcelActivate).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'View parcel boundaries and public data' }).disabled).toBe(false));
  });
  it('shows loading and a translated failure without removing the button; permits retry', async () => {
    let finish;
    const onParcelActivate = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue('ACTIVE');
    render(<PropertyPinPopup property={{ ...property, isUnlocked: true }} label="A" parcelEligible parcelState={subjectState} language="pt" onParcelActivate={onParcelActivate} />);
    const button = screen.getByRole('button', { name: 'Ver limites e dados da parcela' });
    fireEvent.click(button);
    expect(button.disabled).toBe(true); expect(screen.getByRole('status').textContent).toBe('Consultando GIS público…');
    finish('SOURCE_TEMPORARILY_UNAVAILABLE');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Fonte GIS temporariamente indisponível.'));
    expect(button.disabled).toBe(false); fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(onParcelActivate).toHaveBeenCalledTimes(2);
  });
  it.each(['hideStreetAddressOnCard', 'hide_street_address_on_card'])('never exposes the lens for address privacy, including unlocked/stale geometry: %s', key => {
    render(<PropertyPinPopup property={{ ...property, isUnlocked: true, [key]: 'true' }} label="A" parcelEligible
      parcelState={{ parcel: { geometry: {} }, lens: {}, page: 'parcel' }} />);
    expect(screen.queryByRole('button', { name: 'View parcel boundaries and public data' })).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
  it('does not expose a stale parcel when the feature gate is off', () => {
    render(<PropertyPinPopup property={property} label="A" parcelEligible={false} parcelState={{ parcel: { geometry: {} } }} />);
    expect(screen.queryByRole('button', { name: 'View parcel boundaries and public data' })).toBeNull();
  });
  it('explains an unavailable access check and retries permissions without querying GIS',()=>{
    const retry=vi.fn();const activate=vi.fn();
    render(<PropertyPinPopup property={property} label="A" language="pt" parcelAccessStatus="unavailable" onRetryParcelAccess={retry} onParcelActivate={activate} />);
    expect(screen.getByRole('status').textContent).toContain('Não foi possível confirmar o acesso');
    fireEvent.click(screen.getByRole('button',{name:'Verificar novamente'}));expect(retry).toHaveBeenCalledOnce();expect(activate).not.toHaveBeenCalled();
  });
  it('keeps a disabled kill switch silent, not mistaken for paid status or source coverage',()=>{
    render(<PropertyPinPopup property={{...property,isUnlocked:true}} label="A" language="pt" parcelAccessStatus="denied" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button',{name:'Verificar novamente'})).toBeNull();
  });
  it('has no magnifier or no-coverage error before valid subject geometry exists',()=>{
    render(<PropertyPinPopup property={property} label="A" parcelEligible parcelAccessStatus="available" />);
    expect(screen.queryByRole('button',{name:'View parcel boundaries and public data'})).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
