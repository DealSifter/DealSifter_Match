const COPY = Object.freeze({
  analysis_depends_on_submitted_data: 'The analysis depends partly on submitted property information that should be independently verified.',
  property_data_not_independently_verified: 'Some property information comes from submitted records and should still be independently verified.',
  arv_not_structured: 'A defensible ARV cannot be calculated with the evidence currently available.',
  ARV_EVALUATION_NOT_LOADED: 'A defensible ARV cannot be calculated with the evidence currently available.',
  roi_not_calculated: 'ROI cannot yet be calculated because one or more required investment inputs are unavailable.',
  cap_rate_not_independently_verified: 'The reported capitalization rate has not yet been independently validated.',
  MISSING_REHAB: 'Rehabilitation scope and cost have not yet been confirmed.',
  MISSING_REHAB_INFORMATION: 'Rehabilitation scope and cost have not yet been confirmed.',
  rehab_not_provided: 'Rehabilitation scope and cost have not yet been confirmed.',
  property_condition_unknown: 'The current property condition has not yet been verified.',
  INSUFFICIENT_COMPS: 'There are not enough condition-compatible recorded sales to support a defensible ARV.',
  VALUATION_DISPERSION_WARNING: 'The available comparable values vary materially, which limits valuation confidence.',
});

export function explainMaxxisEvidenceState(value) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (COPY[raw]) return COPY[raw];
  if (!/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(raw)) return raw;
  const readable = raw.replaceAll('_', ' ').toLowerCase();
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}.`;
}

export function explainMaxxisEvidenceList(values, limit = 12) {
  return [...new Set((Array.isArray(values) ? values : []).map(explainMaxxisEvidenceState).filter(Boolean))].slice(0, limit);
}
