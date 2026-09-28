import { describe, expect, it } from 'vitest';
import { resolvePropertyEvidenceAccess } from './propertyEvidenceAccess.ts';

describe('property evidence access', () => {
  it('authorizes Enterprise cache reads without permitting a live provider call in cache-only mode', () => {
    expect(resolvePropertyEvidenceAccess({
      plan: 'ENTERPRISE', maxxisAnalysisOnly: false, cacheOnly: true,
    })).toEqual({ cacheAuthorized: true, allowProviderFallback: false });
  });

  it('keeps Level 2 cache-only while allowing its paid evidence cache', () => {
    expect(resolvePropertyEvidenceAccess({
      plan: 'PRO', maxxisAnalysisOnly: true, cacheOnly: false,
    })).toEqual({ cacheAuthorized: true, allowProviderFallback: false });
  });

  it('does not authorize cache or provider acquisition for the free plan', () => {
    expect(resolvePropertyEvidenceAccess({
      plan: 'FREE', maxxisAnalysisOnly: false, cacheOnly: false,
    })).toEqual({ cacheAuthorized: false, allowProviderFallback: false });
  });
});
