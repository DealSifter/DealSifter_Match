import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: mocks.rpc } }));
import { createUnlockIntent, getActiveBuyerProfileScope } from './unlockService';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each(['personal', 'professional', 'fsbo'])('captures the active %s buyer scope without changing seller scope', async scope => {
  vi.stubGlobal('localStorage', { getItem: key => key === 'publishingProfileKey' ? scope : 'professional' });
  mocks.rpc.mockResolvedValue({ data: [{ intent_token: 'f1010000-0000-4000-8000-000000000099', seller_id: 'f1010000-0000-4000-8000-000000000002', profile_scope: 'professional', total_cost: 21 }], error: null });
  await createUnlockIntent({ contactId: 'f1010000-0000-4000-8000-000000000002', profileScope: 'professional', mode: 'total', metadata: { source: 'synthetic', buyerProfileScope: 'untrusted-override' } });
  expect(mocks.rpc).toHaveBeenCalledWith('ds_create_unlock_intent', expect.objectContaining({
    p_profile_scope: 'professional', p_metadata: { source: 'synthetic', buyerProfileScope: scope },
  }));
});
it('uses the existing FSBO account default when no explicit profile key was saved', () => {
  vi.stubGlobal('localStorage', { getItem: key => key === 'accountType' ? 'fsbo_owner' : null });
  expect(getActiveBuyerProfileScope()).toBe('fsbo');
});
