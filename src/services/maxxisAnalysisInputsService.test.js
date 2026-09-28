import { describe, expect, it, vi } from 'vitest';
import { declineMaxxisAnalysisInputs, saveMaxxisAnalysisInputs } from './maxxisAnalysisInputsService';

const propertyId = 'f38e9347-49ec-413e-a554-230c4059bb2b';

describe('maxxisAnalysisInputsService', () => {
  it('persists explicit user inputs', async () => {
    const invoke = vi.fn(async (body) => ({ data: { success: true, data: body }, error: null }));
    const result = await saveMaxxisAnalysisInputs(propertyId, { rehabBudget: 50000, targetCondition: 'STANDARD_RENOVATION' }, invoke);
    expect(result).toMatchObject({ action: 'UPSERT', rehabBudget: 50000, targetCondition: 'STANDARD_RENOVATION' });
  });

  it('preserves benchmark provenance selected by the user', async () => {
    const invoke = vi.fn(async (body) => ({ data: { success: true, data: body }, error: null }));
    const result = await saveMaxxisAnalysisInputs(propertyId, {
      rehabBudget: 302400,
      rehabSource: 'USER_CURATED_REHAB_BENCHMARK_2026',
    }, invoke);
    expect(result).toMatchObject({
      action: 'UPSERT', rehabBudget: 302400, rehabSource: 'USER_CURATED_REHAB_BENCHMARK_2026',
    });
  });

  it('persists a decline to prevent repeated questions', async () => {
    const invoke = vi.fn(async (body) => ({ data: { success: true, data: body }, error: null }));
    expect(await declineMaxxisAnalysisInputs(propertyId, ['rehab_budget'], invoke)).toMatchObject({ action: 'DECLINE' });
  });

  it('sends the authorized capability and snapshot metadata with the gap update', async () => {
    const invoke = vi.fn(async (body) => ({ data: { success: true, data: body }, error: null }));
    const result = await saveMaxxisAnalysisInputs(propertyId, { targetCondition: 'AS_IS' }, invoke, {
      capability: 'DEAL_INTELLIGENCE', pendingGaps: ['target_condition'], snapshotRevision: 'revision-1',
    });
    expect(result).toMatchObject({
      capability: 'DEAL_INTELLIGENCE', pendingGaps: ['target_condition'], snapshotRevision: 'revision-1',
    });
  });

  it('preserves the stable backend error code for diagnostics', async () => {
    const response = new Response(JSON.stringify({ error: 'GAP_RESOLUTION_ACCESS_DENIED', requestId: 'request-1' }));
    const invoke = vi.fn(async () => ({ data: null, error: { context: response } }));
    await expect(saveMaxxisAnalysisInputs(propertyId, { targetCondition: 'AS_IS' }, invoke))
      .rejects.toMatchObject({ message: 'GAP_RESOLUTION_ACCESS_DENIED', requestId: 'request-1' });
  });
});
