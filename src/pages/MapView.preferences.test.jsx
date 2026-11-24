// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MapView } from './MapView';
import { clearUserScopedCache } from '../lib/localStoragePolicy';

vi.mock('../hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('../services/mapInventoryService', () => ({ buildMapInventory: () => ({
  clusterablePins: [],
  spotlightCards: [],
  myPins: [{ lat: 25.76, lng: -80.19, cardId: 'own', itemType: 'property', isOwnCard: true, sourceCard: { id: 'own', address: 'QA property', lat: 25.76, lng: -80.19 } }],
}) }));

const prefs = { map: { initialZoom: 3, defaultStyle: 'satellite_streets', clusterBehavior: 'pins_city', defaultFilters: { showPeople: false, showProperties: true } } };
const mount = () => render(<MapView currentUserId="qa" userPreferences={prefs} userProfile={{}} setPage={() => {}} />);

describe('map master preferences on mobile', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(cleanup);
  it('keeps configured zoom/style/filters despite own pins and mobile initialization', async () => {
    mount();
    await waitFor(() => {
      const state = JSON.parse(sessionStorage.getItem('ds_mapview_ui_state_v1'));
      expect(state?.mapStyle).toBe('satellite_streets');
      expect(state?.showPeople).toBe(false);
      expect(state?.showProperties).toBe(true);
      expect(state?.viewport?.zoom).toBe(3);
    });
  });
  it('retains session choices on reopen and restores master defaults after logout', async () => {
    const first = mount();
    await waitFor(() => expect(sessionStorage.getItem('ds_mapview_ui_state_v1')).toBeTruthy());
    first.unmount();
    const saved = JSON.parse(sessionStorage.getItem('ds_mapview_ui_state_v1'));
    sessionStorage.setItem('ds_mapview_ui_state_v1', JSON.stringify({ ...saved, mapStyle: 'topo', showPeople: true, viewport: { center: [25.76, -80.19], zoom: 9 } }));
    const second = mount();
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('ds_mapview_ui_state_v1')).mapStyle).toBe('topo'));
    clearUserScopedCache('qa');
    second.unmount();
    expect(sessionStorage.getItem('ds_mapview_ui_state_v1')).toBeNull();
    mount();
    await waitFor(() => {
      const state = JSON.parse(sessionStorage.getItem('ds_mapview_ui_state_v1'));
      expect(state?.mapStyle).toBe('satellite_streets');
      expect(state?.showPeople).toBe(false);
      expect(state?.viewport?.zoom).toBe(3);
    });
  });
});
