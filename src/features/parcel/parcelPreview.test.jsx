import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ParcelBoundaryToggle from '../../components/map/ParcelBoundaryToggle';
import { parcelLabels, parcelPanelRows, parcelFieldProvenance } from './parcelPresentation';
import { restoreParcelPreference, parcelPreferenceEnabled } from './parcelPreference';
import { trackParcelEvent } from './parcelTelemetry';
vi.mock('../../lib/adminEventTracking', () => ({ trackAppEvent: vi.fn(async () => true) }));

describe('controlled production parcel preview', () => {
  it.each([['pt', 'Limites de lotes'], ['en', 'Parcel boundaries'], ['es', 'Límites de parcelas']])('uses the exact localized label and existing chip/icon design: %s', (language, label) => {
    const html = renderToStaticMarkup(<ParcelBoundaryToggle eligible enabled={false} language={language} onToggle={() => {}} />);
    expect(html).toContain(`aria-label="${label}"`); expect(html).toContain('aria-pressed="false"'); expect(html).toContain('OFF');
    expect(html).toContain('map-chip'); expect(html).toContain('<svg'); expect(html).toContain('type="button"');
  });
  it('does not expose the filter control to ineligible users', () => {
    expect(renderToStaticMarkup(<ParcelBoundaryToggle eligible={false} enabled language="pt" />)).toBe('');
  });
  it('communicates ON with accessible pressed state rather than color alone', () => {
    const html = renderToStaticMarkup(<ParcelBoundaryToggle eligible enabled language="en" />);
    expect(html).toContain('aria-pressed="true"'); expect(html).toContain('map-chip-active'); expect(html).toContain('ON');
  });
  it('defaults OFF for an eligible user without an explicit saved choice', () => {
    expect(parcelPreferenceEnabled(restoreParcelPreference({}, 'validator'), 'validator', true)).toBe(false);
  });
  it('restores a same-user preference when server eligibility arrives asynchronously', () => {
    const preference = restoreParcelPreference({ parcelPreferenceOwner: 'validator', publicParcelBoundariesEnabled: true }, 'validator');
    expect(parcelPreferenceEnabled(preference, 'validator', false)).toBe(false);
    expect(parcelPreferenceEnabled(preference, 'validator', true)).toBe(true);
  });
  it.each([false, undefined, 'true'])('ignores stored ON without explicit server eligibility: %s', eligible => {
    expect(parcelPreferenceEnabled({ owner: 'validator', enabled: true }, 'validator', eligible)).toBe(false);
  });
  it('does not transfer ON across a logout/account switch', () => {
    const state = { parcelPreferenceOwner: 'validator', publicParcelBoundariesEnabled: true };
    expect(restoreParcelPreference(state, 'other').enabled).toBe(false);
    expect(parcelPreferenceEnabled({ owner: 'validator', enabled: true }, 'other', true)).toBe(false);
    expect(parcelPreferenceEnabled({ owner: '', enabled: true }, '', true)).toBe(false);
  });
  it('does not interpret string preferences as enabled', () => {
    expect(restoreParcelPreference({ parcelPreferenceOwner: 'validator', publicParcelBoundariesEnabled: 'true' }, 'validator').enabled).toBe(false);
  });
  it.each(['pt', 'en', 'es'])('hides unknown fields without converting null to zero: %s', language => {
    expect(parcelPanelRows({ apn: '0001', acres: null, lotSqft: null, propertyTax: null, ownerName: null, assessedValue: null }, language)).toEqual([['APN', '0001']]);
  });
  it.each(['pt', 'en', 'es'])('preserves explicit zero tax/assessment: %s', language => {
    const t = parcelLabels(language); const rows = parcelPanelRows({ assessedValue: 0, propertyTax: 0 }, language);
    expect(rows.map(row => row[0])).toEqual([t.assessed, t.tax]); expect(rows.every(row => row[1].includes('0'))).toBe(true);
    expect(t.assessed.toLowerCase()).not.toContain('market');
  });
  it('displays both backend units without independently reconciling them', () => {
    const rows = parcelPanelRows({ acres: 1.23, lotSqft: 53579, geometryCalculatedAcres: 1.2, geometryCalculatedSqft: 52272 }, 'pt');
    expect(rows[0][1]).toBe('1,23 ac · 53.579 sqft'); expect(rows[1][1]).toBe('1,2 ac · 52.272 sqft');
  });
  it('can display supplied sqft when acreage is unavailable', () => {
    expect(parcelPanelRows({ lotSqft: 2000 }, 'en')[0][1]).toBe('2,000 sqft');
  });
  it('does not truncate legal description, subdivision or owner information', () => {
    const text = 'Full legal description\n' + 'LONG-PARCEL-TEXT '.repeat(50);
    const parcel = { legalDescription: text, subdivision: 'Subdivision name', ownerName: 'Public owner' }; const before = JSON.stringify(parcel);
    expect(parcelPanelRows(parcel, 'pt')).toContainEqual([parcelLabels('pt').legal, text]); expect(JSON.stringify(parcel)).toBe(before);
  });
  it('exposes only supplied field provenance, including a zero-valued reported field', () => {
    const parcel = { apn: 'A', ownerName: null, propertyTax: 0, provenance: { apn: { sourceField: 'APN' }, ownerName: { sourceField: 'OWNER' }, propertyTax: { sourceField: 'TAX' } } };
    expect(parcelFieldProvenance(parcel, 'en')).toEqual([['APN', 'APN'], [parcelLabels('en').tax, 'TAX']]);
  });
  it.each(['pt', 'en', 'es'])('localizes conflicts, outages, no coverage and non-survey disclaimer: %s', language => {
    const t = parcelLabels(language);
    for (const key of ['conflict', 'stale', 'NO_ACTIVE_PUBLIC_SOURCE', 'disclaimer', 'relation']) {
      expect(t[key]).not.toMatch(/NO_ACTIVE_PUBLIC_SOURCE|STALE_USABLE|MATERIAL_CONFLICT|LICENSE_REVIEW_REQUIRED/);
    }
    expect(t.conflict).not.toBe(''); expect(t.disclaimer).not.toBe('');
  });
  it('reuses existing telemetry without forwarding personal/location/provider payload', async () => {
    const transport = vi.fn(async () => true);
    await trackParcelEvent('viewport', { zoom: 17, parcelCount: 10, email: 'private@example.test', apn: 'SECRET', userId: 'identity', address: 'private', coordinates: [0, 0], sourceUrl: 'https://example.test' }, transport);
    expect(transport).toHaveBeenCalledWith('public_parcel_viewport', { entityType: 'map_layer', metadata: { zoom: 17, parcelCount: 10 } });
  });
  it('does not introduce a global error when telemetry is unavailable', async () => {
    await expect(trackParcelEvent('click', {}, () => { throw new Error('offline'); })).resolves.toBe(false);
    await expect(trackParcelEvent('click', {}, async () => { throw new Error('offline'); })).resolves.toBe(false);
    const transport = vi.fn(); await trackParcelEvent('unknown', {}, transport); expect(transport).not.toHaveBeenCalled();
  });
});
