/** Trusted, request-scoped audit metadata. Never contains identities, addresses or provider payloads. */
export type ProviderOrigin = 'user' | 'test' | 'validation' | 'system';
export type EvidenceOutcome = 'ACCEPTED' | 'IDENTITY_REJECTED' | 'NOT_FOUND' | 'EMPTY';
export type ProviderAttempt = { usageId: string | null; budgetId: string | null; operation: string; httpStatus?: number | null; errorCode?: string | null; evidenceOutcome?: EvidenceOutcome | null };
export type ProviderTrace = { requestId: string; reportId: string | null; origin: ProviderOrigin; attempts: ProviderAttempt[] };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function createProviderTrace(options: { requestId?: string; reportId?: string | null; report?: boolean; origin: ProviderOrigin }): ProviderTrace {
  if (!['user', 'test', 'validation', 'system'].includes(options.origin)) throw Error('INVALID_TRUSTED_PROVIDER_ORIGIN');
  return { requestId: uuid(options.requestId) ? options.requestId : crypto.randomUUID(), reportId: uuid(options.reportId) ? options.reportId : options.report ? crypto.randomUUID() : null, origin: options.origin, attempts: [] };
}
export function evidenceOutcome(completion: { httpStatus: number | null; errorCode: string | null; evidenceOutcome?: EvidenceOutcome | null }): EvidenceOutcome | null {
  if (completion.evidenceOutcome) return completion.evidenceOutcome;
  if (completion.httpStatus === 404) return 'NOT_FOUND';
  if (completion.httpStatus === 200 && /ADDRESS_MISMATCH|IDENTITY/.test(completion.errorCode || '')) return 'IDENTITY_REJECTED';
  if (completion.httpStatus === 200 && /PROPERTY_NOT_FOUND|NO_RESULT|EMPTY/.test(completion.errorCode || '')) return 'EMPTY';
  return completion.httpStatus === 200 && !completion.errorCode ? 'ACCEPTED' : null;
}
type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export async function annotateProviderAttempt(client: RpcClient, trace: ProviderTrace, attempt: ProviderAttempt) {
  const { error } = await client.rpc('ds_annotate_provider_attempt', { p_usage_id: attempt.usageId, p_budget_usage_id: attempt.budgetId,
    p_request_id: trace.requestId, p_report_id: trace.reportId, p_origin: trace.origin, p_evidence_outcome: attempt.evidenceOutcome || null });
  if (error) throw Error('PROVIDER_ATTEMPT_TRACE_WRITE_FAILED');
}
