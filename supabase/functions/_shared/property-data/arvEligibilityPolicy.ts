/** Count thresholds shared by the deterministic engine and report projection. */
export const ARV_ELIGIBILITY_POLICY = Object.freeze({ minimumPreliminarySales: 2, minimumPrimarySales: 3 });
export function arvEvidenceTier(count: number): 'PRIMARY' | 'PRELIMINARY' | 'UNAVAILABLE' {
  return count >= ARV_ELIGIBILITY_POLICY.minimumPrimarySales ? 'PRIMARY'
    : count >= ARV_ELIGIBILITY_POLICY.minimumPreliminarySales ? 'PRELIMINARY' : 'UNAVAILABLE';
}
