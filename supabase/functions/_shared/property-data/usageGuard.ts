import { PropertyDataError } from './types.ts';
import type { ProviderBudgetManager, ProviderBudgetReservation } from './providerBudget.ts';
import { annotateProviderAttempt, createProviderTrace, evidenceOutcome, type EvidenceOutcome, type ProviderTrace, type ProviderAttempt } from './providerTrace.ts';

export const DEFAULT_RENTCAST_MONTHLY_HARD_LIMIT = 45;
export type PropertyDataUsageOperation = 'property_lookup' | 'property_value_avm' | 'property_sold_search'
  | 'sale_listings' | 'rent_estimate' | 'rental_listings' | 'market_data';

export type UsageReservation = {
  id: string;
  provider: 'rentcast';
  operation: PropertyDataUsageOperation;
  createdAt: string;
};

export type UsageCompletion = {
  evidenceOutcome?: EvidenceOutcome | null;
  billableSuccess: boolean;
  httpStatus: number | null;
  errorCode: string | null;
};

export interface PropertyDataUsageGuard {
  reserve(input: { propertyId?: string | null; userId?: string | null; operation?: PropertyDataUsageOperation }): Promise<UsageReservation>;
  finalize(reservation: UsageReservation, completion: UsageCompletion): Promise<void>;
}

export function normalizeRentCastHardLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RENTCAST_MONTHLY_HARD_LIMIT;
  return Math.min(DEFAULT_RENTCAST_MONTHLY_HARD_LIMIT, Math.trunc(parsed));
}

type UsageRow = UsageReservation & UsageCompletion & { status: 'reserved' | 'succeeded' | 'failed' };

export class InMemoryPropertyDataUsageGuard implements PropertyDataUsageGuard {
  private readonly rows: UsageRow[];
  private readonly hardLimit: number;
  private readonly now: () => Date;

  constructor(options: { hardLimit?: number; now?: () => Date; rows?: UsageRow[] } = {}) {
    this.hardLimit = normalizeRentCastHardLimit(options.hardLimit);
    this.now = options.now || (() => new Date());
    this.rows = [...(options.rows || [])];
  }

  async reserve(input: { propertyId?: string | null; userId?: string | null; operation?: PropertyDataUsageOperation }) {
    const now = this.now();
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const nextMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const consumed = this.rows.filter((row) => {
      const created = Date.parse(row.createdAt);
      return row.provider === 'rentcast'
        && created >= monthStart
        && created < nextMonth
        && (row.status === 'reserved' || row.billableSuccess);
    }).length;
    if (consumed >= this.hardLimit) throw new PropertyDataError('MONTHLY_PROVIDER_LIMIT_REACHED');
    const reservation: UsageReservation = {
      id: crypto.randomUUID(),
      provider: 'rentcast',
      operation: input.operation || 'property_lookup',
      createdAt: now.toISOString(),
    };
    this.rows.push({ ...reservation, status: 'reserved', billableSuccess: false, httpStatus: null, errorCode: null });
    return reservation;
  }

  async finalize(reservation: UsageReservation, completion: UsageCompletion) {
    const row = this.rows.find((item) => item.id === reservation.id);
    if (!row) throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
    row.billableSuccess = Boolean(completion.billableSuccess);
    row.httpStatus = completion.httpStatus;
    row.errorCode = completion.errorCode;
    row.status = completion.billableSuccess ? 'succeeded' : 'failed';
  }

  snapshot() {
    return this.rows.map((row) => ({ ...row }));
  }
}

export type PropertyDataUsageRpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export class SupabasePropertyDataUsageGuard implements PropertyDataUsageGuard {
  private readonly client: PropertyDataUsageRpcClient;
  private readonly hardLimit: number;

  private readonly providerBudget: ProviderBudgetManager | null;
  private readonly budgetReservations = new Map<string, ProviderBudgetReservation>();

  constructor(client: PropertyDataUsageRpcClient, hardLimit: unknown = DEFAULT_RENTCAST_MONTHLY_HARD_LIMIT, providerBudget: ProviderBudgetManager | null = null,
    readonly trace: ProviderTrace = createProviderTrace({ origin: 'system' })) {
    this.client = client;
    this.hardLimit = normalizeRentCastHardLimit(hardLimit);
    this.providerBudget = providerBudget;
  }

  async reserve(input: { propertyId?: string | null; userId?: string | null; operation?: PropertyDataUsageOperation }) {
    const budgetReservation = this.providerBudget ? await this.providerBudget.reserve() : null;
    const attempt: ProviderAttempt = { usageId: null, budgetId: budgetReservation?.id || null, operation: input.operation || 'property_lookup' };
    this.trace.attempts.push(attempt);
    if (budgetReservation) {
      try { await annotateProviderAttempt(this.client, this.trace, attempt); }
      catch { await this.providerBudget?.finalize(budgetReservation, false).catch(() => undefined); throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR'); }
    }
    const { data, error } = await this.client.rpc('ds_reserve_external_provider_usage', {
      p_provider: 'rentcast',
      p_operation: input.operation || 'property_lookup',
      p_property_id: input.propertyId || null,
      p_user_id: input.userId || null,
      p_hard_limit: this.hardLimit,
    });
    if (error) {
      if (budgetReservation) await this.providerBudget?.finalize(budgetReservation, false).catch(() => undefined);
      if (`${error.code || ''} ${error.message || ''}`.includes('MONTHLY_PROVIDER_LIMIT_REACHED')) {
        throw new PropertyDataError('MONTHLY_PROVIDER_LIMIT_REACHED');
      }
      throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
    }
    const id = String(data || '').trim();
    if (!id) {
      if (budgetReservation) await this.providerBudget?.finalize(budgetReservation, false).catch(() => undefined);
      throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
    }
    if (budgetReservation) this.budgetReservations.set(id, budgetReservation);
    const reservation = { id, provider: 'rentcast', operation: input.operation || 'property_lookup', createdAt: new Date().toISOString() } as UsageReservation;
    attempt.usageId = id;
    try { await annotateProviderAttempt(this.client, this.trace, attempt); }
    catch {
      await this.finalize(reservation, { billableSuccess: false, httpStatus: null, errorCode: 'PROVIDER_ATTEMPT_TRACE_WRITE_FAILED' }).catch(() => undefined);
      throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
    }
    return reservation;
  }

  async finalize(reservation: UsageReservation, completion: UsageCompletion) {
    const { error } = await this.client.rpc('ds_finalize_external_provider_usage', {
      p_usage_id: reservation.id,
      p_billable_success: Boolean(completion.billableSuccess),
      p_http_status: completion.httpStatus,
      p_error_code: completion.errorCode,
    });
    const budgetReservation = this.budgetReservations.get(reservation.id);
    try {
      if (budgetReservation) {
        this.budgetReservations.delete(reservation.id);
        await this.providerBudget?.finalize(budgetReservation, !error && Boolean(completion.billableSuccess));
      }
    } finally {
      const attempt = this.trace.attempts.find(item => item.usageId === reservation.id);
      if (attempt) {
        attempt.httpStatus = completion.httpStatus; attempt.errorCode = completion.errorCode; attempt.evidenceOutcome = evidenceOutcome(completion);
        await annotateProviderAttempt(this.client, this.trace, attempt);
      }
    }
    if (error) throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
  }
}
