import { describe, expect, it, vi } from 'vitest';
import { getProfileZipLocation, lookupProfileZip } from './profileZipLocation';
import { buildScopedProfilePayload, extractScopedProfileLegacy, resolveScopedProfile } from '../lib/profileScopeResolver';
import { buildGlobalFeedState } from './feedStateService';
import { buildMapInventory } from './mapInventoryService';

const zipLocation = { zip: '02108', state: 'MA', city: 'Boston', lat: 42.3576, lng: -71.0639, source: 'zippopotamus' };
const response = (zip = '02108') => ({ ok: true, status: 200, json: async () => ({ 'post code': zip, 'country abbreviation': 'US', places: [{ 'place name': 'Boston', 'state abbreviation': 'MA', latitude: '42.3576', longitude: '-71.0639' }] }) });

describe('profile ZIP Code location', () => {
  it('preserves leading zeroes, resolves ZIP coordinates and deduplicates lookups', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response());
    const [first, second] = await Promise.all([lookupProfileZip('02108', fetchImpl), lookupProfileZip('02108', fetchImpl)]);
    expect(first).toEqual(zipLocation);
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.zippopotam.us/us/02108');
    expect(await lookupProfileZip('02108', fetchImpl)).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid, nonexistent and mismatched ZIP responses without fallback coordinates', async () => {
    const fetchImpl = vi.fn();
    await expect(lookupProfileZip('2108', fetchImpl)).rejects.toThrow('INVALID_ZIP');
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(lookupProfileZip('00000', vi.fn().mockResolvedValue({ status: 404 }))).rejects.toThrow('ZIP_NOT_FOUND');
    await expect(lookupProfileZip('02109', vi.fn().mockResolvedValue(response('90210')))).rejects.toThrow('ZIP_NOT_FOUND');
    expect(getProfileZipLocation({ ...zipLocation, lat: null })).toBeNull();
    expect(getProfileZipLocation({ ...zipLocation, source: 'state-center' })).toBeNull();
  });

  it('allows retry after a failed lookup', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response('02110'));
    await expect(lookupProfileZip('02110', fetchImpl)).rejects.toThrow('offline');
    expect(await lookupProfileZip('02110', fetchImpl)).toMatchObject({ zip: '02110' });
  });

  it('keeps all three scoped ZIP locations separate through profile serialization', () => {
    const businessZip = { ...zipLocation, zip: '02109' };
    const fsboZip = { ...zipLocation, zip: '02110' };
    const payload = buildScopedProfilePayload({
      accountType: 'professional',
      professionalProfile: { fullNameA: 'Personal Owner', fullNameB: 'Business Owner', zipLocationA: zipLocation, zipLocationB: businessZip },
      personalProfile: { fullNameFsbo: 'FSBO Owner', zipLocationFsbo: fsboZip },
    });
    expect(payload.resolved.personal.zipLocation).toEqual(zipLocation);
    expect(payload.resolved.professional.zipLocation).toEqual(businessZip);
    expect(payload.resolved.fsbo.zipLocation).toEqual(fsboZip);
    const hydrated = extractScopedProfileLegacy(JSON.parse(JSON.stringify(payload)));
    expect(hydrated.professionalProfileFromPayload.zipLocationA).toEqual(zipLocation);
    expect(hydrated.professionalProfileFromPayload.zipLocationB).toEqual(businessZip);
    expect(hydrated.fsboProfileFromPayload.zipLocationFsbo).toEqual(fsboZip);
    expect(resolveScopedProfile('fsbo', { personalProfile: hydrated.fsboProfileFromPayload }).zipLocation).toEqual(fsboZip);
  });

  it('carries a remote public profile ZIP through global inventory into its map pin', () => {
    const owner = '11111111-1111-4111-8111-111111111111';
    const state = buildGlobalFeedState({
      services: [{ id: 'service-1', owner_id: owner, title: 'Photography', category: 'svc_photo', primary_profile: 'professional', publish_to_connections: true }],
      professionalProfiles: [{ user_id: owner, profile_payload: { resolved: { professional: { name: 'Business Owner', scope: 'professional', loc: 'MA', zipLocation } } } }],
    }, 'viewer');
    const services = state.connectionServices;
    expect(services[0].ownerPreview.zipLocation).toEqual(zipLocation);
    const inventory = buildMapInventory({
      servicePortfolio: services,
      stateCenters: { MA: { lat: 42, lng: -72 } },
      getRecordProfileScope: (item) => item.primaryProfile,
      getStateCodeFromMarket: () => 'MA',
      getPortfolioPartsForOwner: () => ({ properties: [], services }),
    }, 'viewer');
    expect(inventory.allPins).toHaveLength(1);
    expect(inventory.allPins[0]).toMatchObject({ itemType: 'person', lat: zipLocation.lat, lng: zipLocation.lng });
    expect(inventory.allPins[0].sourceCard.zipCode).toBe('02108');
    const missingZip = buildMapInventory({ servicePortfolio: [{ ...services[0], ownerPreview: { ...services[0].ownerPreview, zipLocation: null } }], stateCenters: { MA: { lat: 42, lng: -72 } }, getRecordProfileScope: () => 'professional', getStateCodeFromMarket: () => 'MA' }, 'viewer');
    expect(missingZip.allPins).toHaveLength(0);
  });

  it('moves the current profile pin after changing ZIP even when a portfolio preview is stale', () => {
    const services = [{ id: 's1', ownerId: 'owner', primaryProfile: 'professional', publishToConnections: true,
      ownerPreview: { name: 'Old Name', loc: 'CA', zipLocation: { ...zipLocation, zip: '90210', state: 'CA', lat: 34.1, lng: -118.4 } } }];
    const inventory = buildMapInventory({
      servicePortfolio: services,
      professionalProfile: { fullNameB: 'Current Owner', locB: 'CA', zipLocationB: zipLocation },
      resolveScopedProfile,
      getRecordProfileScope: (item) => item.primaryProfile,
      getStateCodeFromMarket: (value) => value,
      getPortfolioPartsForOwner: () => ({ properties: [], services }),
    }, 'owner');
    expect(inventory.allPins).toHaveLength(1);
    expect(inventory.allPins[0]).toMatchObject({ lat: zipLocation.lat, lng: zipLocation.lng, state: 'MA', isOwnCard: true });
  });
});
