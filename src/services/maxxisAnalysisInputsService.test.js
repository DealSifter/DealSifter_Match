import { describe, expect, it, vi } from 'vitest';
import { declineMaxxisAnalysisInputs, saveMaxxisAnalysisInputs } from './maxxisAnalysisInputsService';

const propertyId = 'f38e9347-49ec-413e-a554-230c4059bb2b';

describe('maxxisAnalysisInputsService', () => {
  it('persists explicit user inputs', async () => {
    const invoke = vi.fn(async (body) => ({ data: { success: true, data: body }, error: null }));
    const result = await saveMaxxisAnalysisInputs(propertyId, { rehabBudget: 50000, targetCondition: 'STANDARD_RENOVATION' }, invoke);
    expect(result).toMatchObject({ action: 'UPSERT', rehabBudget: 50000, targetCondition: 'STANDARD_RENOVATION' });
  });

  it('persists a decline to prevent repeated questions', async () => {
    const invoke = vi.fn(async (body) => ({ data: { success: true, data: body }, error: null }));
    expect(await declineMaxxisAnalysisInputs(propertyId, ['rehab_budget'], invoke)).toMatchObject({ action: 'DECLINE' });
  });
});
