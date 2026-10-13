import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { functions: { invoke: vi.fn() } } }));
import { supabase } from '../lib/supabaseClient';
import { geocodePropertyAddress, validatePortfolioProperty } from './geocodeAddressService';
const property = { address: '1524 Wood Spring Ct', city: 'Raleigh', state: 'NC', zip: '27614', publishToShowcase: true };
const geo = { lat: 35.9211, lng: -78.5835, geocodeStatus: 'resolved', geocodeSource: 'census', geocodedAt: '2026-10-13T01:00:00Z' };
describe('portfolio geocoding before publication', () => {
  it('turns success into active, without prematurely publishing new drafts', async () => {
    expect(await validatePortfolioProperty({ ...property, publishToShowcase: false }, async () => geo)).toMatchObject({ isActive: true, publishToShowcase: false });
  });
  it('keeps a no-match record editable as an inactive unpublished draft', async () => {
    expect(await validatePortfolioProperty(property, async () => ({ geocodeStatus: 'failed' }))).toMatchObject({ address: property.address, isActive: false, publishToShowcase: false });
  });
  it('fails closed on transport errors, retaining all property fields', async () => {
    expect(await validatePortfolioProperty(property, async () => { throw new Error('CORS'); })).toMatchObject({ ...property, publishToShowcase: false, isActive: false, geocodeStatus: 'pending', lat: null });
  });
  it('does not interpret null response coordinates as zero or VALID', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { status: 'success', lat: null, lng: null }, error: null });
    expect(await geocodePropertyAddress(property)).toMatchObject({ geocodeStatus: 'failed', lat: null, lng: null });
  });
});
