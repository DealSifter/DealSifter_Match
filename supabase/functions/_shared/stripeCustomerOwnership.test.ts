import { describe, expect, it, vi } from 'vitest';
import { requireOwnedStripeCustomer, StripeCustomerOwnershipError } from './stripeCustomerOwnership';

describe('Stripe customer ownership with synthetic transport', () => {
  it('permits the customer bound to the signed-in UID by Stripe metadata', async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: 'cus_qa_owned', metadata: { supabase_user_id: 'qa-a' } });
    await expect(requireOwnedStripeCustomer('cus_qa_owned', 'qa-a', retrieve)).resolves.toBe('cus_qa_owned');
    expect(retrieve).toHaveBeenCalledExactlyOnceWith('cus_qa_owned');
  });
  it.each([
    { id: 'cus_qa_other', metadata: { supabase_user_id: 'qa-b' } },
    { id: 'cus_qa_other', metadata: {} },
    { id: 'cus_qa_other' },
    { id: 'cus_qa_other', deleted: true },
    { id: 'cus_wrong_response', metadata: { supabase_user_id: 'qa-a' } },
  ])('rejects foreign, unproven, deleted or mismatched customer %#', async customer => {
    const portal = vi.fn();
    const send = async () => portal(await requireOwnedStripeCustomer('cus_qa_other', 'qa-a', async () => customer));
    await expect(send()).rejects.toBeInstanceOf(StripeCustomerOwnershipError);
    expect(portal).not.toHaveBeenCalled();
  });
  it('does not infer ownership from a matching email', async () => {
    await expect(requireOwnedStripeCustomer('cus_qa_other', 'qa-a', async () => ({
      id: 'cus_qa_other', email: 'same@qa.invalid', metadata: { supabase_user_id: 'qa-b' },
    }))).rejects.toBeInstanceOf(StripeCustomerOwnershipError);
  });
  it('fails closed on a failed Stripe read without creating a replacement', async () => {
    await expect(requireOwnedStripeCustomer('cus_qa_owned', 'qa-a', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
  });
});
