// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropertyPinPopup } from './PropertyPinPopup';

afterEach(cleanup);
const property = { id: 'property-1', price: 231000, city: 'Winter Garden', state: 'FL', zip: '34787', beds: 3, baths: 2, sqft: 1500, image: '/house.jpg' };
describe('Property pin card', () => {
  it('offers tabs only after activation and has no third close button', () => {
    const parcel = { geometry: { type: 'Polygon', coordinates: [] }, sourceAuthority: 'Public source', retrievedAt: '2026-10-13', sourceUrl: 'https://example.com' };
    const onParcelActivate = vi.fn(); const onParcelPage = vi.fn();
    const { rerender } = render(<PropertyPinPopup property={property} label="A" parcelState={{ parcel, page: 'property' }} onParcelActivate={onParcelActivate} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View parcel boundaries and public data' }));
    expect(onParcelActivate).toHaveBeenCalledOnce();
    rerender(<PropertyPinPopup property={property} label="A" parcelState={{ parcel, lens: {}, page: 'parcel' }} onParcelPage={onParcelPage} />);
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
});
