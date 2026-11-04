/** Final output scanner, shared with the network-free PDF worker. */
export function validateRenderedReportText(text: string): { valid: boolean; errors: string[] } {
  const patterns = [/\[object Object\]/, /\b(?:undefined|NaN|Infinity)\b/, /\{\s*"(?:translation|translatedText|[a-zA-Z]+)"\s*:/,
    /\b(?:MISSING[ _][A-Z_ ]+|PROVIDER_ESTIMATE|MATERIAL_CONFLICT|OUTLIER_DETECTED|READY_MIXED|REVIEW_REQUIRED|ARV_UNAVAILABLE|NOT_APPLICABLE)\b/,
    /\b(?:annualPropertyTax|propertyTaxYear|assessorID|effectiveSource|evidenceHash|sourceType|sourceFamily|canonicalPropertyFacts|analyticalUsability)\b/,
    /\b[A-Z]{2,}_[A-Z][A-Z_]+\b/, /Informações preservadas|Preserved information|Información preservada/];
  const errors = patterns.flatMap((pattern, index) => pattern.test(text) ? [`PROHIBITED_OUTPUT_${index}`] : []);
  return { valid: !errors.length, errors };
}
