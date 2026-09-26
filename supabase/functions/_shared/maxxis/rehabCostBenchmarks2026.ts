export const REHAB_BENCHMARK_METADATA_2026 = Object.freeze({
  version: '2026.1', currency: 'USD', unit: 'USD_PER_SQFT', geography: 'US_STATE',
  sourceType: 'USER_CURATED_REFERENCE', sourceYear: 2026, sourceCitationStatus: 'UNSOURCED',
  confidence: 'LOW', usage: 'SECONDARY_HEURISTIC_ONLY',
});

export type BenchmarkScope = 'LIGHT_REHAB' | 'STANDARD_RENOVATION' | 'FULL_RENOVATION' | 'NEW_CONSTRUCTION';
export type BenchmarkBand = Readonly<{ average: number; low: number; high: number }>;

export const NATIONAL_REHAB_BENCHMARK_2026: Readonly<Record<BenchmarkScope, BenchmarkBand>> = Object.freeze({
  LIGHT_REHAB: Object.freeze({ average: 33.93, low: 25, high: 60 }),
  STANDARD_RENOVATION: Object.freeze({ average: 65.27, low: 48, high: 116 }),
  FULL_RENOVATION: Object.freeze({ average: 117.57, low: 88, high: 208 }),
  NEW_CONSTRUCTION: Object.freeze({ average: 185.40, low: 138, high: 328 }),
});

const rows: Record<string, number[][]> = {
  Alabama:[[26.5,20,33],[51,41,61],[92.5,74,111],[145.5,119,172]], Alaska:[[50.5,39,62],[97,78,116],[174.5,140,209],[275.5,225,326]],
  Arizona:[[33.5,26,41],[63.5,51,76],[115,92,138],[181,148,214]], Arkansas:[[26,20,32],[50,40,60],[90,72,108],[142,116,168]],
  California:[[52,40,64],[100,80,120],[180,144,216],[284,232,336]], Colorado:[[37.5,29,46],[71.5,57,86],[129,103,155],[204,167,241]],
  Connecticut:[[44,34,54],[84.5,68,101],[152,122,182],[240,196,284]], Delaware:[[34,26,42],[65.5,52,79],[118,94,142],[186,152,220]],
  Florida:[[32.5,25,40],[62.5,50,75],[112.5,90,135],[177.5,145,210]], Georgia:[[30,23,37],[57.5,46,69],[103.5,83,124],[163,133,193]],
  Hawaii:[[60,46,74],[115.5,92,139],[208,166,250],[328,268,388]], Idaho:[[30,23,37],[57.5,46,69],[103.5,83,124],[163,133,193]],
  Illinois:[[36,28,44],[68.5,55,82],[123.5,99,148],[195.5,160,231]], Indiana:[[26.5,20,33],[51,41,61],[92.5,74,111],[145.5,119,172]],
  Iowa:[[26.5,20,33],[51,41,61],[92.5,74,111],[145.5,119,172]], Kansas:[[26.5,20,33],[51,41,61],[92.5,74,111],[145.5,119,172]],
  Kentucky:[[26.5,20,33],[51,41,61],[92.5,74,111],[145.5,119,172]], Louisiana:[[28.5,22,35],[55,44,66],[99,79,119],[156.5,128,185]],
  Maine:[[34,26,42],[65.5,52,79],[118,94,142],[186,152,220]], Maryland:[[39,30,48],[75,60,90],[135,108,162],[213,174,252]],
  Massachusetts:[[47,36,58],[90.5,72,109],[163,130,196],[257,210,304]], Michigan:[[30,23,37],[57.5,46,69],[103.5,83,124],[163,133,193]],
  Minnesota:[[34,26,42],[65.5,52,79],[118,94,142],[186,152,220]], Mississippi:[[25,19,31],[48.5,39,58],[87.5,70,105],[138.5,113,164]],
  Missouri:[[28.5,22,35],[55,44,66],[99,79,119],[156.5,128,185]], Montana:[[31.5,24,39],[61.5,49,74],[110,88,132],[174,142,206]],
  Nebraska:[[28.5,22,35],[55,44,66],[99,79,119],[156.5,128,185]], Nevada:[[36,28,44],[68.5,55,82],[123.5,99,148],[195.5,160,231]],
  'New Hampshire':[[36.5,28,45],[70,56,84],[126,101,151],[198.5,162,235]], 'New Jersey':[[43,33,53],[82.5,66,99],[148.5,119,178],[234,191,277]],
  'New Mexico':[[29,22,36],[56.5,45,68],[101.5,81,122],[159.5,130,189]], 'New York':[[49,38,60],[93.5,75,112],[168.5,135,202],[266.5,218,315]],
  'North Carolina':[[30,23,37],[57.5,46,69],[103.5,83,124],[163,133,193]], 'North Dakota':[[30,23,37],[57.5,46,69],[103.5,83,124],[163,133,193]],
  Ohio:[[28.5,22,35],[55,44,66],[99,79,119],[156.5,128,185]], Oklahoma:[[26,20,32],[50,40,60],[90,72,108],[142,116,168]],
  Oregon:[[40.5,31,50],[78,62,94],[140.5,112,169],[221.5,181,262]], Pennsylvania:[[34,26,42],[65.5,52,79],[118,94,142],[186,152,220]],
  'Rhode Island':[[39.5,30,49],[76.5,61,92],[137.5,110,165],[216.5,177,256]], 'South Carolina':[[29,22,36],[56.5,45,68],[101.5,81,122],[159.5,130,189]],
  'South Dakota':[[27.5,21,34],[53,42,64],[95.5,76,115],[150.5,123,178]], Tennessee:[[29,22,36],[56.5,45,68],[101.5,81,122],[159.5,130,189]],
  Texas:[[31.5,24,39],[61.5,49,74],[110,88,132],[174,142,206]], Utah:[[33.5,26,41],[63.5,51,76],[115,92,138],[181,148,214]],
  Vermont:[[36.5,28,45],[70,56,84],[126,101,151],[198.5,162,235]], Virginia:[[34,26,42],[65.5,52,79],[118,94,142],[186,152,220]],
  Washington:[[42,32,52],[81.5,65,98],[146.5,117,176],[230.5,188,273]], 'West Virginia':[[26,20,32],[50,40,60],[90,72,108],[142,116,168]],
  Wisconsin:[[31,24,38],[59.5,48,71],[107,86,128],[169,138,200]], Wyoming:[[30,23,37],[57.5,46,69],[103.5,83,124],[163,133,193]],
};

const codes = 'AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'
  .split('|').map((entry) => [entry.slice(0, 2), entry.slice(3)] as const);
const stateAliases = new Map(codes.flatMap(([code, name]) => [[code, name], [name.toUpperCase(), name]]));
const scopes: BenchmarkScope[] = ['LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION', 'NEW_CONSTRUCTION'];
const band = (value: number[]): BenchmarkBand => Object.freeze({ average: value[0], low: value[1], high: value[2] });

export const REHAB_COST_BENCHMARKS_2026 = Object.freeze(Object.fromEntries(Object.entries(rows).map(([state, values]) => [state,
  Object.freeze(Object.fromEntries(scopes.map((scope, index) => [scope, band(values[index])])))
]))) as Readonly<Record<string, Readonly<Record<BenchmarkScope, BenchmarkBand>>>>;

export function benchmarkScopeForCondition(value: unknown): BenchmarkScope | null {
  const condition = String(value || '').trim().toUpperCase();
  return scopes.includes(condition as BenchmarkScope) ? condition as BenchmarkScope : null;
}

export function estimateRehabBenchmark2026(input: { state?: unknown; livingAreaSqft?: unknown; condition?: unknown }) {
  const stateName = stateAliases.get(String(input.state || '').trim().toUpperCase());
  const scope = benchmarkScopeForCondition(input.condition);
  const sqft = Number(input.livingAreaSqft);
  if (!stateName || !scope || !Number.isFinite(sqft) || sqft <= 0) return null;
  const reference = REHAB_COST_BENCHMARKS_2026[stateName]?.[scope];
  if (!reference) return null;
  const money = (rate: number) => Math.round(rate * sqft * 100) / 100;
  return Object.freeze({
    scope, state: stateName, livingAreaSqft: sqft, rate: reference,
    low: money(reference.low), mid: money(reference.average), high: money(reference.high),
    provenance: 'ESTIMATED', source: 'USER_CURATED_REHAB_BENCHMARK_2026', confidence: 'LOW',
    usage: 'REFERENCE_ONLY', providerCalls: 0,
  });
}

export function sanityCheckRehabAgainstBenchmark2026(rehab: unknown, estimate: ReturnType<typeof estimateRehabBenchmark2026>) {
  const value = Number(rehab);
  if (!estimate || !Number.isFinite(value) || value < 0) return null;
  return Object.freeze({
    actualRehabPerSqft: Math.round((value / estimate.livingAreaSqft) * 100) / 100,
    classification: value < estimate.low ? 'BELOW_REFERENCE_RANGE'
      : value > estimate.high ? 'ABOVE_REFERENCE_RANGE' : 'WITHIN_REFERENCE_RANGE',
  });
}
