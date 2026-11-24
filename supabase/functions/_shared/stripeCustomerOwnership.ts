type Customer = { id: string; deleted?: boolean | void; metadata?: Record<string, string> | null };

export class StripeCustomerOwnershipError extends Error {
  constructor() {
    super('Stripe customer ownership could not be verified');
    this.name = 'StripeCustomerOwnershipError';
  }
}

/** The cached ID is a locator, never proof. Trust Stripe's server-written UID. */
export async function requireOwnedStripeCustomer(
  customerId: string,
  userId: string,
  retrieve: (id: string) => Promise<Customer>,
): Promise<string> {
  if (!customerId || !userId) throw new StripeCustomerOwnershipError();
  const customer = await retrieve(customerId);
  if (customer.deleted || customer.id !== customerId || customer.metadata?.supabase_user_id !== userId) {
    throw new StripeCustomerOwnershipError();
  }
  return customer.id;
}
