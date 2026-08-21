import { describe, expect, it, vi } from 'vitest';
import { buildGlobalFeedState, fetchGlobalInventory } from './feedStateService';

describe('global feed privacy boundary', () => {
  it('uses only the sanitized inventory RPC and never falls back to base tables', async () => {
    const rpcError = { code: '42501', message: 'permission denied' };
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: rpcError }),
      from: vi.fn(() => {
        throw new Error('base table fallback must not run');
      }),
    };

    await expect(fetchGlobalInventory(client)).rejects.toMatchObject({
      code: '42501',
      cause: rpcError,
    });
    expect(client.rpc).toHaveBeenCalledWith('ds_get_global_feed_inventory');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('preserves cards built from a contact-free public profile payload', () => {
    const ownerId = '11111111-1111-4111-8111-111111111111';
    const propertyId = '22222222-2222-4222-8222-222222222222';
    const state = buildGlobalFeedState({
      properties: [{
        id: propertyId,
        owner_id: ownerId,
        type: 'SFR',
        address: null,
        city: 'Dallas',
        state: 'TX',
        zip: '75001',
        is_active: true,
        publish_to_showcase: true,
        primary_profile: 'professional',
        hide_street_address_on_card: true,
        lat: null,
        lng: null,
      }],
      users: [{ id: ownerId, full_name: 'Public Investor', account_type: 'professional' }],
      professionalProfiles: [{
        user_id: ownerId,
        category: 'Investor',
        profile_payload: {
          resolved: {
            professional: {
              scope: 'professional',
              name: 'Public Investor',
              loc: 'Dallas, TX',
              photo: 'https://example.com/public-avatar.jpg',
              categoryLabelFallback: 'Investor',
              pitch: 'Cash buyer',
              verified: true,
            },
          },
        },
      }],
      propertyImages: [],
      services: [],
      spotlights: [],
    }, '33333333-3333-4333-8333-333333333333', {}, 1);

    expect(state.showcaseProperties).toHaveLength(1);
    expect(state.showcaseProperties[0]).toMatchObject({
      id: propertyId,
      address: '',
      lat: null,
      lng: null,
      hideStreetAddressOnCard: true,
    });
    expect(state.showcaseProperties[0].ownerPreview).toMatchObject({ name: 'Public Investor' });
    expect(state.showcaseProperties[0].ownerPreview).not.toHaveProperty('email');
    expect(state.showcaseProperties[0].ownerPreview).not.toHaveProperty('primaryPhone');
    expect(state.showcaseProperties[0].ownerPreview).not.toHaveProperty('contactMethods');
  });
});
