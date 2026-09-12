import { describe, expect, it, vi } from 'vitest';
import { runCachedRecordedSoldCompSelectionValidation } from './recordedSoldManualValidation.ts';

describe('cached recorded sold comp validation', () => {
  it('stops on cache miss without any provider acquisition path', async () => {
    const getCachedSoldEvidence = vi.fn().mockResolvedValue(null);
    await expect(runCachedRecordedSoldCompSelectionValidation({
      service: { getCachedSoldEvidence } as never,
      propertyId: 'e86dd292-429d-4b51-9b02-bc60a3e9068f',
    })).rejects.toThrow('CACHE_REUSE_BLOCKED');
    expect(getCachedSoldEvidence).toHaveBeenCalledTimes(1);
  });
});
