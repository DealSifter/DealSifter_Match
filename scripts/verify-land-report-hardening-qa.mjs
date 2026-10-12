import { readFile, writeFile } from 'node:fs/promises';
const root = 'qa/land-report-hardening/';
const read = async name => {
  const bytes = await readFile(root + name);
  return (bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le') : bytes.toString('utf8')).replace(/^\uFEFF/, '');
};
const json = async name => JSON.parse(await read(name));
const [lot, state, semantics, languages, text] = await Promise.all([
  json('lot-dimension-resolution.json'), json('land-scenario-state.json'), json('land-gap-semantics.json'), json('localization.json'), read('gable-report.txt'),
]);
const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
assert(lot.conversionConsistent && lot.chat.lotSizeSqft === lot.report.lotSizeSqft && lot.chat.lotSizeAcres === lot.report.lotSizeAcres, 'LOT_PARITY_FAILED');
assert(state.assumptions.proposedUnitCount === 1 && state.assumptions.proposedPropertyType === 'SFR' && state.assumptions.zoning === 'R2', 'EXPLICIT_ASSUMPTIONS_FAILED');
assert(semantics.missingPropertyTypeGaps === 0 && !semantics.decision.decisionGaps.some(gap => gap.field === 'propertyType'), 'KNOWN_LAND_TYPE_GAP_FAILED');
assert(Object.values(languages).every(item => item.pageCount === 6 && !item.allContinuations.length), 'FIXED_PAGE_COUNT_FAILED');
const falseZeroMatches = [...text.matchAll(/(?:Base de custo atual|Rehab(?:\s*\/\s*sqft)?|Cap rate)\s*:?\s*(?:US)?\$?\s*0(?:[,.]00)?(?:%|\s|$)/gi)].map(match => match[0]);
assert(!falseZeroMatches.length, 'FALSE_LAND_ZERO_FAILED');
assert(!/Resolver propertyType|recent sales market estimate|development feasibility|market context/i.test(text), 'LAND_INTERNAL_TOKEN_LEAK');
assert(!/Você imagina cada casa|How many sqft per house|¿Cuántos sqft por casa/.test(text), 'STATIC_REPORT_QUESTION_FAILED');
const pageAudits = {};
for (const page of [2, 3]) {
  const audit = await json(`page${page}-layout-audit.json`);
  assert(!audit.collisions.length && !audit.overflow.length && !audit.continuations.length, `PAGE_${page}_GEOMETRY_FAILED`);
  assert(audit.lines.every(line => line.fontSize >= 9 && line.bottomY <= 803), `PAGE_${page}_FONT_OR_FOOTER_FAILED`);
  pageAudits[page] = { lines: audit.lines.length, collisions: 0, overflow: 0, minimumFontSize: Math.min(...audit.lines.map(line => line.fontSize)) };
}
const errors = source => {
  const result = [];
  for (const block of source.split(/(?=TS\d+ \[ERROR\]:)/).slice(1)) {
    const code = block.match(/^TS\d+/)?.[0];
    const file = block.replace(/\s/g, '').match(/file:\/\/\/.*?(supabase\/functions\/.*?):\d+:\d+/)?.[1];
    const field = block.match(/Property '([^']+)' does not exist/)?.[1] || '';
    result.push(`${code}:${file}:${field}`);
  }
  return result.sort();
};
const baseline = errors(await read('deno-baseline.log')); const current = errors(await read('deno-edge.log'));
const remaining = [...baseline]; const added = current.filter(error => { const i = remaining.indexOf(error); if (i < 0) return true; remaining.splice(i, 1); return false; });
await writeFile(root + 'deno-comparison.json', JSON.stringify({ baseline, current, newErrors: added, removedErrors: remaining }, null, 2) + '\n');
const baselineCount = Number((await read('deno-baseline.log')).match(/Found (\d+) errors/)?.[1]);
const currentCount = Number((await read('deno-edge.log')).match(/Found (\d+) errors/)?.[1]);
assert(baselineCount === 51 && currentCount === 51 && baseline.length === current.length && !added.length, 'NEW_DENO_ERROR_FAILED');
const verification = { status: 'PASS', sourceControl: lot.propertyId, conversionConsistent: true, lotParity: true,
  askingPerAcre: lot.report.pricePerAcre, falseZeroMatches, pageAudits, fixedPageCount: 6, localization: languages,
  deno: { comparison: 'same four entrypoints, baseline source archive; multiset of diagnostic code/source file/property name (PowerShell repeats its first native error)', baselineErrors: baselineCount, currentErrors: currentCount, diagnosticEntries: current.length, newErrors: added },
  automatedRentcastCalls: 0, geminiArithmeticCalls: 0, migration: 'NONE', authenticatedProductionValidation: 'NOT_AVAILABLE' };
await writeFile(root + 'verification.json', JSON.stringify(verification, null, 2) + '\n');
const falseZero = await json('false-zero-regression.json');
await writeFile(root + 'false-zero-regression.json', JSON.stringify({ ...falseZero, pdfTextChecked: true, matches: falseZeroMatches }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', pageCount: 6, pageAudits, newDenoErrors: added.length }));
