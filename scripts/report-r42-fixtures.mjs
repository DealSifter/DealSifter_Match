import {r41Fixtures,R4_TIME} from './report-r41-fixtures.mjs';
export {R4_TIME};
// Fictional subject/comparables within the already stored OSM base extent.
export function r42Fixtures(photos=[]) {
  return r41Fixtures(photos).map(fixture=>({...fixture,input:{...fixture.input,property:{...fixture.input.property,latitude:27.95,longitude:-82.45},dealIntelligence:{...fixture.input.dealIntelligence,comparableEvidence:{...fixture.input.dealIntelligence.comparableEvidence,used:(fixture.input.dealIntelligence.comparableEvidence?.used||[]).map((comp,index)=>({...comp,latitude:27.95+.001*(index+1),longitude:-82.45+.001*(index+1)}))}}}}));
}
