import { logOperationalEvent } from '../observability.ts';

export type PropertyDataLogEvent = {
  operation?: 'property_lookup' | 'property_evidence';
  success: boolean;
  durationMs: number;
  cacheHit?: boolean;
  httpStatus?: number | null;
  errorCode?: string | null;
  quotaState?: 'reserved' | 'blocked' | 'completed';
};

export type PropertyDataLogger = (event: PropertyDataLogEvent) => unknown;

export const logPropertyDataEvent: PropertyDataLogger = (event) => logOperationalEvent({
  functionName: 'property-data-provider',
  operation: event.operation || 'property_lookup',
  success: event.success,
  durationMs: event.durationMs,
  errorCode: event.errorCode || undefined,
  provider: 'rentcast',
  status: event.httpStatus ?? undefined,
  metrics: {
    cache_hit: Boolean(event.cacheHit),
    billable_success: event.httpStatus === 200,
    quota_state: event.quotaState,
  },
});
