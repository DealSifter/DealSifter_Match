export const SQFT_PER_ACRE = 43_560;

export type CanonicalLotArea = Readonly<{
  lotSizeSqft: number | null;
  lotSizeAcres: number | null;
  sourceUnit: 'ACRES' | 'SQFT' | 'UNKNOWN';
}>;

function positive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function localizedNumber(value: string) {
  const cleaned = value.trim().replace(/\s+/g, '');
  if (!cleaned) return null;
  const comma = cleaned.lastIndexOf(',');
  const dot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (comma >= 0) {
    normalized = /^\d{1,3}(?:,\d{3})+$/.test(cleaned) ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  } else if (dot >= 0 && /^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }
  return positive(normalized);
}

export function parseCanonicalLotArea(value: unknown): CanonicalLotArea {
  if (typeof value === 'number') {
    const sqft = positive(value);
    return Object.freeze({ lotSizeSqft: sqft, lotSizeAcres: sqft ? sqft / SQFT_PER_ACRE : null, sourceUnit: sqft ? 'SQFT' : 'UNKNOWN' });
  }
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return Object.freeze({ lotSizeSqft: null, lotSizeAcres: null, sourceUnit: 'UNKNOWN' });
  const match = raw.match(/[-+]?\d[\d.,\s]*/);
  const number = match ? localizedNumber(match[0]) : null;
  if (!number) return Object.freeze({ lotSizeSqft: null, lotSizeAcres: null, sourceUnit: 'UNKNOWN' });
  const acres = /(?:ac(?:re|res)?|acre|acres)\b/i.test(raw);
  if (acres) {
    return Object.freeze({
      lotSizeSqft: Math.round(number * SQFT_PER_ACRE * 100) / 100,
      lotSizeAcres: Math.round(number * 1_000_000) / 1_000_000,
      sourceUnit: 'ACRES',
    });
  }
  return Object.freeze({
    lotSizeSqft: Math.round(number * 100) / 100,
    lotSizeAcres: Math.round((number / SQFT_PER_ACRE) * 1_000_000) / 1_000_000,
    sourceUnit: 'SQFT',
  });
}

export function calculateLandUnitMetrics(priceInput: unknown, lotInput: unknown) {
  const price = positive(priceInput);
  const lot = typeof lotInput === 'object' && lotInput !== null && 'lotSizeSqft' in lotInput
    ? lotInput as CanonicalLotArea : parseCanonicalLotArea(lotInput);
  const pricePerLotSqft = price && lot.lotSizeSqft
    ? Math.round((price / lot.lotSizeSqft) * 100) / 100 : null;
  const pricePerAcre = price && lot.lotSizeAcres
    ? Math.round((price / lot.lotSizeAcres) * 100) / 100 : null;
  return Object.freeze({ ...lot, pricePerLotSqft, pricePerAcre });
}
