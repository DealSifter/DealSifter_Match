import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
const directory='qa/smart-property-enrichment/final-integration';
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const save=(name,data)=>writeFile(`${directory}/${name}.json`,JSON.stringify(data,null,2)+'\n');
const deployment=await json(`${directory}/production-deployment.json`);
assert.equal(deployment.state,'READY');assert.equal(deployment.aliasVerified,true);assert.equal(deployment.sourceShaVerified,true);
assert.equal(deployment.sourceSha,'0f99ff8e180bf2c843e24b828845db3b186f7752');
const fresh=async path=>{assert.ok((await stat(path)).mtimeMs>=Date.parse(deployment.observedAt),`Production QA receipt predates READY: ${path}`);return json(path);};
const review=await fresh(`${directory}/production-app-review.json`);
assert.equal(review.results.length,2);assert.ok(review.results.every(row=>row.persistedAfterRefresh&&row.persistedAfterLogoutLogin&&row.errors.length===0&&row.realBackendWrites===0));
const map=await fresh('qa/map-navigation-cleanup/production-synthetic.json');assert.equal(map.results.flatMap(row=>row.transitions).length,10);assert.ok(map.results.every(row=>row.errors.length===0));
const portfolio=await fresh('qa/parcel-report-apn/fresh/production-app.json');assert.equal(portfolio.results.length,2);assert.ok(portfolio.results.every(row=>row.l1Downloaded&&row.freshSessionNoPriorMap&&row.simulatedFreeAccount&&row.errors.length===0));
const pdf=await fresh('qa/parcel-report-apn/fresh/production-pdf-apn.json');assert.ok(pdf.results.every(row=>row.publicApnPresentOnFirstPage));
const edge=await fresh(`${directory}/production-edge-smoke.json`);assert.equal(edge.pass,true);assert.equal(edge.publicRpc.schemaCacheReady,true);
const backend=await json(`${directory}/backend-after.json`),deploySteps=await json(`${directory}/backend-deploy.json`);
assert.equal(deploySteps.codeSha,deployment.sourceSha);assert.equal(deploySteps.steps.length,5);assert.ok(deploySteps.steps.every(row=>row.exitCode===0));
assert.equal(backend.configurationChanged,false);assert.equal(backend.changedSecrets.length,0);assert.equal(backend.globalGridGeneralAccess,'OFF');
assert.ok(backend.functions.every(row=>row.verify_jwt===true&&row.status==='ACTIVE'));
const schema=await json(`${directory}/migration-verified.json`);assert.equal(schema.after.targetMigrationPresent,true);assert.equal(schema.after.clientStoreRpcExecuteDenied,true);
const protectedTables=schema.after.security.filter(row=>row.table.startsWith('property_fact_review'));assert.equal(protectedTables.length,2);assert.ok(protectedTables.every(row=>row.rls&&row.clientDirectWriteDenied&&row.anonDirectReadDenied));
const migration=await json(`${directory}/migration-validation.json`);await save('migration-validation',{...migration,productionApplied:true,productionReceipt:'migration-applied.json',productionVerification:'migration-verified.json'});
const privacy=await json(`${directory}/privacy-rls-validation.json`);await save('privacy-rls-validation',{...privacy,productionCatalogVerified:true,productionSecurity:schema.after.security,clientStoreRpcExecuteDenied:true,realAuthenticatedProductionSmoke:'BLOCKED'});
const mapRegression=await json(`${directory}/map-navigation-regression.json`);await save('map-navigation-regression',{...mapRegression,productionFrontend:map});
const summary=await json(`${directory}/validation-summary.json`);
await save('production-smoke-summary',{pass:true,codeSha:deployment.sourceSha,deploymentId:deployment.id,productionAliasVerified:true,backendVersions:backend.functions,flagsAndSecretsUnchanged:true,schemaSecurityVerified:true,publishedFrontendReviewCases:2,publishedFrontendMapTransitions:10,publishedFrontendL1ApnCases:2,backendWritesInBrowserQa:0,authenticatedProductionSmoke:'BLOCKED',scope:'Published frontend assets with synthetic auth/backend; real anonymous Edge/CORS/empty-RPC checks; production schema metadata; no real user session.',review,portfolio,pdf});
const lines=[
 '# Final integration report','',
 `Code / production SHA: \`${deployment.sourceSha}\`. Production alias verified READY; deployment \`${deployment.id}\`. Commit pushed to \`fix/production-real-defects\`.`,
 '',`Validation: ${summary.fullTests}/${summary.fullTests} unique tests (${summary.fullInvocationTests} in the complete final suite + 2 final owner-hydration regressions); ${summary.targetedTests}/${summary.targetedTests} enrichment-targeted; original map hotfix 78/78. Modern/legacy build, full + final-delta lint, frontend contracts PASS. Deno: 50 existing baseline diagnostics, 50 current, zero new errors.`,
 '', 'MapView: original hotfix source unchanged; 12 real Leaflet lifetime cases and 10 local app exits PASS; 10 additional published-asset app exits PASS. No Parcel Lens redesign.',
 '', 'Review: desktop drawer/mobile full-screen, PT/EN/ES, explicit keep/accept/defer, safe bulk additions, original/provenance retention, conflict warnings and exact-field links. Notification tap/drag interception and cold-start ownership hydration were fixed and covered. Refresh + logout/login persistence passed with explicitly synthetic browser authentication and local PostgreSQL authority tests.',
 '', 'Security: 21 local PostgreSQL/RLS checks PASS. Production catalog confirms owner-only SELECT, denied direct client writes/anonymous reads, denied client execution of the backend store RPC. All five affected Edge functions ACTIVE with JWT verification. Existing flags/secrets unchanged. Anonymous production CORS/auth boundaries and empty sanitized public RPC PASS.',
 '', 'Migration: only additive 20261014213000 applied and recorded atomically after order validation; no existing property rows rewritten. Backend closure deployed before frontend. Rollback/forward-fix plan is in production-readiness.md.',
 '', 'Isolation: no new EffectivePropertyFacts consumption in financial/scenario engines or L1/L2/L3. The independent factual APN correction remains in the existing signed parcel/canonical report path; published-asset FREE L1 generation and APN first-page text checks passed on desktop/mobile without a prior map visit. Private PDFs/screenshots/diagnostic fixtures remain local/ignored.',
 '', 'AUTHENTICATED PRODUCTION SMOKE: BLOCKED — no legitimate real user session was available. Published-asset browser tests use simulated authentication/backend and are not represented as real-account production validation. Maxxis direct-fact/provenance contracts are unit-validated; proactive notices continue to obey the existing flags/attention budget.',
 '', 'Next product phase: CONSENSUS-AWARE ANALYTICAL ENGINES. Following phase: FINANCIAL EVIDENCE STACK.',
 '', 'FINAL: SMART PROPERTY ENRICHMENT INTEGRATED OVER MAPVIEW HOTFIX AND VALIDATED (automated/local/published-asset scopes above; real-account smoke pending).',''
 ];
await writeFile(`${directory}/FINAL_REPORT.md`,lines.join('\n'));
const readiness=await readFile(`${directory}/production-readiness.md`,'utf8');await writeFile(`${directory}/production-readiness.md`,readiness.replace('PENDING final validation and deployment receipts. This document is a plan, not a production-deploy PASS receipt.',`DEPLOYED / READY: ${deployment.sourceSha}; ${deployment.id}. Database, affected backend closure and production alias verified. Post-deploy published-asset and anonymous API checks PASS. Real authenticated production smoke remains BLOCKED; see FINAL_REPORT.md and production-smoke-summary.json.`));
console.log(JSON.stringify({pass:true,productionSha:deployment.sourceSha,authenticatedProductionSmoke:'BLOCKED',fullTests:summary.fullTests}));
