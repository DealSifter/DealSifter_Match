import { describe, it, expect, vi } from 'vitest';
import { confirmParsedAnalysisInputs, persistConfirmedAnalysisInputs } from './confirmParsedAnalysisInputs';

describe('G5 explicit confirmation before persisting parsed answers', () => {
  it.each([false, undefined, null, 'yes'])('never treats %s as authorization', answer => {
    expect(confirmParsedAnalysisInputs({ rehabBudget: 25000 }, 'pt', () => answer)).toBe(false);
  });
  it('echoes the understood amount and condition before accepting', () => {
    const confirm = vi.fn(() => true);
    expect(confirmParsedAnalysisInputs({ rehabBudget: 25000, targetCondition: 'AS_IS' }, 'pt', confirm)).toBe(true);
    expect(confirm.mock.calls[0][0]).toContain('25000');
    expect(confirm.mock.calls[0][0]).toContain('Condição-alvo');
    expect(confirm.mock.calls[0][0]).toContain('USD');
  });
  it('fails closed when confirmation is unavailable or input is empty', () => {
    expect(confirmParsedAnalysisInputs({ rehabBudget: 5 }, 'en', null)).toBe(false);
    expect(confirmParsedAnalysisInputs({}, 'en', () => true)).toBe(false);
  });
  it('does not write on cancellation, and writes only after explicit confirmation', async () => {
    const persist = vi.fn();
    expect(await persistConfirmedAnalysisInputs({ rehabBudget: 25000 }, 'en', persist, () => false)).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    const confirm = vi.fn(echo => { expect(persist).not.toHaveBeenCalled(); expect(echo).toContain('25000'); return true; });
    expect(await persistConfirmedAnalysisInputs({ rehabBudget: 25000 }, 'en', persist, confirm)).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });
  it('does not report a successful save when persistence fails', async () => {
    await expect(persistConfirmedAnalysisInputs({ targetCondition: 'AS_IS' }, 'en', async () => { throw Error('WRITE_FAILED'); }, () => true)).rejects.toThrow('WRITE_FAILED');
  });
});
