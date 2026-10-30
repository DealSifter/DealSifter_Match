/** Shared boundary for private financial assumptions. Amounts have explicit cadence;
 * legacy form names are aliases, never additional financial facts. */
export const FINANCIAL_INPUT_FIELDS = Object.freeze({
  management: { key: 'managementPercent', unit: 'PERCENT', cadence: 'ANNUAL' },
  managementPercent: { key: 'managementPercent', unit: 'PERCENT', cadence: 'ANNUAL' },
  maintenance: { key: 'maintenanceAmount', unit: 'USD', cadence: 'ANNUAL' },
  maintenanceAmount: { key: 'maintenanceAmount', unit: 'USD', cadence: 'ANNUAL' },
  maintenancePercent: { key: 'maintenancePercent', unit: 'PERCENT', cadence: 'ANNUAL' },
  hoa: { key: 'HOA', unit: 'USD', cadence: 'MONTHLY' },
  HOA: { key: 'HOA', unit: 'USD', cadence: 'MONTHLY' },
  rent: { key: 'rent', unit: 'USD', cadence: 'MONTHLY' },
  expectedRent: { key: 'rent', unit: 'USD', cadence: 'MONTHLY' },
  propertyTax: { key: 'propertyTax', unit: 'USD', cadence: 'ANNUAL' },
  insurance: { key: 'insurance', unit: 'USD', cadence: 'ANNUAL' },
  vacancyRate: { key: 'vacancyRate', unit: 'PERCENT', cadence: 'ANNUAL' },
  otherOperatingExpenses: { key: 'otherOperatingExpenses', unit: 'USD', cadence: 'ANNUAL' },
} as const);

export type FinancialInputKey = keyof typeof FINANCIAL_INPUT_FIELDS;
export const isFinancialInputKey = (key: string): key is FinancialInputKey => Object.hasOwn(FINANCIAL_INPUT_FIELDS, key);

/** Every input gets a disposition. Nonfinancial/scenario fields are explicitly
 * rejected by this adapter; their owning scenario engine remains responsible. */
export function normalizeFinancialInputs(input: Record<string, unknown>) {
  const values: Record<string, number> = {};
  const dispositions: Record<string, { status: 'CONSUMED' | 'REJECTED'; key?: string; reason?: string }> = {};
  const sources: Record<string, string[]> = {};
  for (const [field, raw] of Object.entries(input)) {
    if (!isFinancialInputKey(field)) {
      dispositions[field] = { status: 'REJECTED', reason: 'NOT_AN_OPERATING_FINANCIAL_INPUT' }; continue;
    }
    const spec = FINANCIAL_INPUT_FIELDS[field];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > (spec.unit === 'PERCENT' ? 100 : 1_000_000_000)) {
      dispositions[field] = { status: 'REJECTED', reason: 'INVALID_FINANCIAL_VALUE' }; continue;
    }
    (sources[spec.key] ??= []).push(field);
    dispositions[field] = { status: 'CONSUMED', key: spec.key };
    if (Object.hasOwn(values, spec.key) && values[spec.key] !== raw) {
      for (const source of sources[spec.key]) dispositions[source] = { status: 'REJECTED', reason: 'CONFLICTING_FINANCIAL_ALIASES' };
    } else values[spec.key] = raw;
  }
  for (const [key, fields] of Object.entries(sources)) {
    if (fields.some(field => dispositions[field].status === 'REJECTED')) {
      delete values[key];
      fields.forEach(field => { dispositions[field] = { status: 'REJECTED', reason: 'CONFLICTING_FINANCIAL_ALIASES' }; });
    }
  }
  if (values.maintenanceAmount !== undefined && values.maintenancePercent !== undefined) {
    for (const key of ['maintenanceAmount', 'maintenancePercent']) {
      delete values[key];
      for (const field of sources[key] ?? []) dispositions[field] = { status: 'REJECTED', reason: 'MAINTENANCE_BASIS_REQUIRED' };
    }
  }
  return { values, dispositions };
}
