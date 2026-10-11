import { mergeVerifiedPropertyEvidenceIntoFacts } from '../../../supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts';

/** L1 shares the exact factual projection used by chat/L2/L3. */
export function mergePropertyReleaseEvidence(property, response) {
  if (response?.state !== 'unlocked') return Object.freeze({ ...(property || {}) });
  return mergeVerifiedPropertyEvidenceIntoFacts(property, response.intelligence || null);
}
