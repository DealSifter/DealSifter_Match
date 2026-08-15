import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../migrations/20260811000001_maxxis_provider_contact_unlock.sql', import.meta.url), 'utf8');
const unlockMigration = readFileSync(new URL('../../../migrations/20260729000001_profile_scoped_unlock_entitlements.sql', import.meta.url), 'utf8');
const providerSource = readFileSync(new URL('./providerContactUnlock.ts', import.meta.url), 'utf8');
const confirmIndexSource = readFileSync(new URL('../../maxxis-provider-unlock-confirm/index.ts', import.meta.url), 'utf8');
const searchServicesSource = readFileSync(new URL('./searchServices.ts', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
const assistantSource = [
  readFileSync(new URL('../../../../src/components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../../src/components/maxxis/MaxxisCapabilities.jsx', import.meta.url), 'utf8'),
].join('\n');
const serviceSource = readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../../../config.toml', import.meta.url), 'utf8');

describe('Phase 3I Provider Contact Unlock', () => {
  it('prepares locked provider unlock with an intent and does not consume Nuggets yet', () => {
    const prepareOnly = providerSource.split('async function confirmProviderUnlock')[0];
    expect(providerSource).toContain("p_metadata: { source: 'maxxis_provider_contact_unlock', serviceId }");
    expect(providerSource).toContain("p_mode: 'normal'");
    expect(providerSource).toContain("actionType: 'unlock_provider_contact'");
    expect(prepareOnly).not.toContain('ds_purchase_contact_unlock');
  });

  it('confirms provider unlock only through the explicit confirm endpoint', () => {
    expect(confirmIndexSource).toContain("handleProviderContactUnlockRequest(req, 'confirm')");
    expect(providerSource).toContain('confirmProviderUnlock');
    expect(providerSource).toContain('ds_purchase_contact_unlock');
    expect(assistantSource).toContain('handleConfirmProviderUnlock');
    expect(assistantSource).toContain('onClick={() => onConfirmProviderUnlock?.(pending)}');
  });

  it('cancels provider unlock without consuming Nuggets', () => {
    expect(migration).toContain('create or replace function public.ds_cancel_unlock_intent');
    expect(migration).toContain("set status = 'expired'");
    expect(migration).toContain("'unlock_intent_cancelled'");
    expect(migration).toContain('value_nuggets');
    expect(migration).toContain('0,');
    expect(providerSource).toContain('ds_cancel_unlock_intent');
  });

  it('returns already_unlocked without charging again', () => {
    expect(providerSource).toContain("before.status === 'already_unlocked'");
    expect(providerSource).toContain("status: 'already_unlocked'");
    expect(unlockMigration).toContain('if v_unlock_id is not null then');
    expect(unlockMigration).toContain('return query select v_unlock_id, p_seller_id, v_profile_scope, 0, v_remaining');
  });

  it('blocks insufficient balance before unlock execution', () => {
    expect(migration).toContain("v_nuggets < public.ds_profile_portfolio_cost");
    expect(migration).toContain("'insufficient_balance'");
    expect(providerSource).toContain("access.status !== 'locked'");
    expect(providerSource).toContain("access.status === 'insufficient_balance' ? 402 : 409");
  });

  it('uses existing idempotency for double click or retry', () => {
    expect(unlockMigration).toContain("pg_advisory_xact_lock(hashtext(\n    'profile-unlock:'");
    expect(unlockMigration).toContain('where u.buyer_id = v_buyer_id');
    expect(unlockMigration).toContain('and u.seller_id = p_seller_id');
    expect(providerSource).toContain("before.status === 'already_unlocked'");
  });

  it('uses existing transaction locks for two simultaneous tabs', () => {
    expect(unlockMigration).toContain("for update");
    expect(unlockMigration).toContain("from public.users u where u.id = v_buyer_id for update");
    expect(unlockMigration).toContain("profile-unlock:' || v_buyer_id::text || ':' || p_seller_id::text || ':' || v_profile_scope");
  });

  it('rejects service or provider outside the authorized published service context', () => {
    expect(providerSource).toContain("eq('id', serviceId)");
    expect(providerSource).toContain("eq('publish_to_connections', true)");
    expect(providerSource).toContain('if (!target) return json');
    expect(providerSource).not.toContain('ownerId: body.ownerId');
  });

  it('does not include contact fields in service search or serviceMatches before unlock', () => {
    expect(searchServicesSource).toContain('contactAccess');
    expect(searchServicesSource).not.toMatch(/email|phone|whatsapp/);
    expect(typesSource).toContain('contactAccess?: ProviderContactAccess');
    expect(typesSource).not.toContain('phonePrimary');
  });

  it('returns contact only after entitlement is confirmed or already exists', () => {
    expect(providerSource).toContain('fetchUnlockedContact');
    expect(providerSource).toContain('ds_get_unlocked_contact_cards');
    expect(providerSource).toMatch(/status: 'already_unlocked'[\s\S]*contact/);
    expect(providerSource).toMatch(/status: Number\(row\?\.total_cost[\s\S]*contact/);
  });

  it('keeps Gemini out of provider unlock execution', () => {
    expect(chatSource).toContain('You may explain exact contactAccess status and cost');
    expect(chatSource).toContain('must never create an unlock intent, confirm an unlock, execute an RPC, consume Nuggets, reveal contact fields');
    expect(chatSource).not.toContain('maxxis-provider-unlock-confirm');
  });

  it('keeps Service Fit independent from provider unlock cost', () => {
    expect(migration).toContain('public.ds_profile_portfolio_cost');
    expect(migration).not.toMatch(/fit|ServiceFit|service_fit/i);
    expect(serviceSource).toContain('prepareMaxxisProviderContactUnlock');
    expect(configSource).toContain('[functions.maxxis-provider-unlock-prepare]');
  });
});
