import { describe, expect, it, vi } from 'vitest';
import {
  isInsufficientSpotlightBalanceError,
  purchaseCardSpotlights,
  SPOTLIGHT_NUGGET_COST,
} from './spotlightService';

describe('Spotlight server-authoritative purchase', () => {
  it('submits the selected cards directly to the atomic server debit and returns its confirmed balance', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { spotlight_id: 'spot-1', card_kind: 'property', card_id: 'property-1', remaining_nuggets: 61 },
        { spotlight_id: 'spot-2', card_kind: 'property', card_id: 'property-2', remaining_nuggets: 61 },
      ],
      error: null,
    });

    const result = await purchaseCardSpotlights({
      supabaseClient: { rpc },
      userId: 'user-1',
      items: [
        { cardKind: 'property', cardId: 'property-1', title: 'First property' },
        { cardKind: 'property', cardId: 'property-2', title: 'Second property' },
      ],
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('ds_purchase_card_spotlights', {
      p_items: [
        expect.objectContaining({ cardKind: 'property', cardId: 'property-1', ownerId: 'user-1' }),
        expect.objectContaining({ cardKind: 'property', cardId: 'property-2', ownerId: 'user-1' }),
      ],
    });
    expect(result.remainingNuggets).toBe(61);
    expect(result.totalCost).toBe(2 * SPOTLIGHT_NUGGET_COST);
  });

  it('recognizes the database insufficient-balance response for balance resynchronization', () => {
    expect(isInsufficientSpotlightBalanceError({ code: '22003', message: 'not enough nuggets' })).toBe(true);
    expect(isInsufficientSpotlightBalanceError({ code: '42501', message: 'property is not eligible' })).toBe(false);
  });
});
