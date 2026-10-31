// Fictional display controls only. These results represent a completed offline
// financial scenario; they are never imported into the application or its engines.
import { r4Fixtures, R4_TIME } from './report-r4-fixtures.mjs';
export { R4_TIME };
export function r41Fixtures(photos = []) {
  return r4Fixtures(photos).map(fixture => {
    if (fixture.id !== 'rich') return fixture;
    const property = { ...fixture.input.property, noi: 18356, capRate: 18356 / 280000 * 100,
      fieldProvenance: { ...fixture.input.property.fieldProvenance,
        noi: { source: 'CALCULATED', status: 'CONFIRMED', retrievedAt: R4_TIME },
        capRate: { source: 'CALCULATED', status: 'CONFIRMED', retrievedAt: R4_TIME } } };
    return { ...fixture, input: { ...fixture.input, property } };
  });
}
