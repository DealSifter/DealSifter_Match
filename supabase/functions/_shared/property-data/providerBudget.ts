import { PropertyDataError } from './types.ts';

export type ProviderBudgetBucket = 'chat' | 'report';
export type ProviderBudgetPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export type ProviderBudgetConfig = {
  total: number;
  chatPercent: number;
};

export type ProviderBudgetReservation = {
  id: string;
  bucket: ProviderBudgetBucket;
};

export interface ProviderBudgetManager {
  reserve(): Promise<ProviderBudgetReservation>;
  finalize(reservation: ProviderBudgetReservation, billableSuccess: boolean): Promise<void>;
}

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
};

export function readProviderBudgetConfig(
  plan: ProviderBudgetPlan,
  getEnv: (name: string) => string | undefined,
): ProviderBudgetConfig {
  if (plan === 'FREE') return { total: 0, chatPercent: 0 };
  const prefix = plan === 'PRO' ? 'MAXXIS_PRO' : 'MAXXIS_ENTERPRISE';
  return {
    total: boundedInt(getEnv(`${prefix}_PROVIDER_BUDGET`), plan === 'PRO' ? 10 : 20, 1, 45),
    chatPercent: boundedInt(getEnv(`${prefix}_CHAT_PERCENT`), plan === 'PRO' ? 20 : 50, 0, 100),
  };
}

export function providerBudgetLimits(config: ProviderBudgetConfig) {
  const chat = Math.floor(config.total * config.chatPercent / 100);
  return { chat, report: Math.max(0, config.total - chat) };
}

export class InMemoryProviderBudgetManager implements ProviderBudgetManager {
  private consumed = { chat: 0, report: 0 };
  private readonly pending = new Map<string, ProviderBudgetBucket>();

  constructor(
    private readonly bucket: ProviderBudgetBucket,
    private readonly config: ProviderBudgetConfig,
  ) {}

  async reserve() {
    const limits = providerBudgetLimits(this.config);
    if (this.consumed[this.bucket] + [...this.pending.values()].filter((value) => value === this.bucket).length >= limits[this.bucket]) {
      throw new PropertyDataError('PLAN_PROVIDER_BUDGET_EXHAUSTED');
    }
    const reservation = { id: crypto.randomUUID(), bucket: this.bucket };
    this.pending.set(reservation.id, this.bucket);
    return reservation;
  }

  async finalize(reservation: ProviderBudgetReservation, billableSuccess: boolean) {
    const bucket = this.pending.get(reservation.id);
    if (!bucket) throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
    this.pending.delete(reservation.id);
    if (billableSuccess) this.consumed[bucket] += 1;
  }

  snapshot() { return { ...this.consumed, pending: this.pending.size }; }
}

type ProviderBudgetRpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export class SupabaseProviderBudgetManager implements ProviderBudgetManager {
  constructor(
    private readonly client: ProviderBudgetRpcClient,
    private readonly input: {
      userId: string;
      propertyId: string;
      plan: ProviderBudgetPlan;
      bucket: ProviderBudgetBucket;
      config: ProviderBudgetConfig;
    },
  ) {}

  async reserve() {
    if (this.input.plan === 'FREE') throw new PropertyDataError('PLAN_PROVIDER_BUDGET_EXHAUSTED');
    const { data, error } = await this.client.rpc('ds_reserve_maxxis_provider_budget', {
      p_user_id: this.input.userId,
      p_property_id: this.input.propertyId,
      p_plan: this.input.plan,
      p_bucket: this.input.bucket,
      p_total_budget: this.input.config.total,
      p_chat_percent: this.input.config.chatPercent,
    });
    if (error) {
      const detail = `${error.code || ''} ${error.message || ''}`;
      if (detail.includes('PLAN_PROVIDER_BUDGET_EXHAUSTED')) throw new PropertyDataError('PLAN_PROVIDER_BUDGET_EXHAUSTED');
      throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
    }
    const id = String(data || '').trim();
    if (!id) throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
    return { id, bucket: this.input.bucket };
  }

  async finalize(reservation: ProviderBudgetReservation, billableSuccess: boolean) {
    const { error } = await this.client.rpc('ds_finalize_maxxis_provider_budget', {
      p_reservation_id: reservation.id,
      p_billable_success: Boolean(billableSuccess),
    });
    if (error) throw new PropertyDataError('PROVIDER_UPSTREAM_ERROR');
  }
}
