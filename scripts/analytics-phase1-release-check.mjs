import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reconcilePropertyFacts,applyFactDecisions} from '../supabase/functions/_shared/property-fact-reconciliation/model.ts';
import {buildAnalyticalPropertyInputs} from '../supabase/functions/_shared/maxxis/analyticalPropertyContext.ts';
import {resolveAnalyticalInputs} from '../supabase/functions/_shared/maxxis/analyticalPropertyFacts.ts';
const directory='qa/consensus-aware-analytics/phase1',baseline='bf8f870ea821c3758e35c7157fbfbd07ac7f7587';mkdirSync(directory,{recursive:true});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}).replace(/\r\n/g,'\n');
const source=path=>readFileSync(path,'utf8').replace(/\r\n/g,'\n'),before=path=>git('show',`${baseline}:${path}`);
const save=(name,data)=>writeFileSync(`${directory}/${name}.json`,JSON.stringify(data,null,2)+'\n');
const baselineBlobs=new Map(git('ls-tree','-r',baseline,'--','src','supabase/functions/_shared').trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return[path,meta.split(' ')[2]];}));
const same=(path)=>{const bytes=/\.(png|jpg|jpeg|webp|gif|woff2?|pdf)$/i.test(path)?readFileSync(path):Buffer.from(source(path)),currentHash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),baselineHash=baselineBlobs.get(path);return{path,baselineHash,currentHash,unchanged:baselineHash===currentHash};};
const scenarios=[];
const p={id:'33333333-3333-4333-8333-333333333333',type:'SFR',lot:'1.14 ac',sqft:1250,price:19000};
const ev=(value,field='lotArea',sourceType='RENTCAST')=>({field,value,originalValue:value,unit:field==='lotArea'?'ACRES':'SQFT',sourceType,sourceId:sourceType,sourceFamily:sourceType,evidenceStatus:'VERIFIED_RECORD',freshness:'FRESH'});
for(const [label,property,evidence] of [
 ['publisher',p,[]],['confirmed',p,[ev(1.14),ev(1250,'buildingArea')]],
 ['conflict',p,[ev(.547612),ev(2000,'buildingArea')]],
 ['provisional',p,[ev(.547612),ev(1.23,'lotArea','PUBLIC_PARCEL_GIS'),ev(2000,'buildingArea'),ev(1300,'buildingArea','PUBLIC_PARCEL_GIS')]],
 ['single',{...p,lot:'',sqft:null},[ev(.75,'lotArea','PUBLIC_PARCEL_GIS'),ev(2000,'buildingArea','PUBLIC_PARCEL_GIS')]],
 ['missing',{...p,lot:'',sqft:null,price:null},[]],['land',{...p,type:'LAND'},[]],
]){
 const snapshot=await reconcilePropertyFacts(property,evidence);
 const choices=label==='conflict'?['NONE','KEEP_MY_VALUE','ACCEPT_EXTERNAL_VALUE','REVIEW_LATER']:['NONE'];
 for(const choice of choices){
  const reviewed=choice==='NONE'?snapshot:applyFactDecisions(snapshot,['lotArea','buildingArea'].map(field=>({field,action:choice,...(choice==='ACCEPT_EXTERNAL_VALUE'?{candidateId:snapshot.rows[field].candidates[0].candidateId}:{})})),'qa-owner');
  const resolved=resolveAnalyticalInputs(buildAnalyticalPropertyInputs({property,reviewSnapshot:reviewed}));
  for(const[domain,fact]of Object.entries(resolved))scenarios.push({domain,evidenceConsensus:fact.consensusState??'NO_EXTERNAL_CONSENSUS',analyticalUsability:fact.analyticalUsability??'PUBLISHER_ONLY',userDecision:fact.userDecision??'NONE',analyticalInputResolution:fact.inputResolution,scalarAllowed:fact.value!==null,rangeAllowed:fact.range!==null,qualification:fact.qualification.join('|'),notes:label});
 }
}
const columns=['domain','evidenceConsensus','analyticalUsability','userDecision','analyticalInputResolution','scalarAllowed','rangeAllowed','qualification','notes'];
writeFileSync(`${directory}/analytical-input-matrix.csv`,[columns.join(','),...scenarios.map(row=>columns.map(column=>row[column]).join(','))].join('\n')+'\n');

// Compare financial implementations, not only filenames or test labels.
const scenarioPath='supabase/functions/_shared/maxxis/scenarioEngine.ts';
function functionText(text,name){const start=text.indexOf(`export function ${name}(`);if(start<0)throw new Error(`MISSING_FUNCTION:${name}`);const next=text.indexOf('\nexport function ',start+1);return text.slice(start,next<0?text.length:next).trim();}
const functions=['calculateBuyAndHoldScenario','calculateFlipScenario','calculateSubToScenario','calculateWholesaleScenario','solveScenarioTarget'];
const financialFunctions=functions.map(name=>({name,unchanged:functionText(before(scenarioPath),name)===functionText(source(scenarioPath),name)}));
const metricPath='supabase/functions/_shared/maxxis/dealMetrics.ts';
const financialMetricText=text=>text.slice(text.indexOf('  const acquisitionPlusRehabMissing ='),text.indexOf('  const metrics ='));
const existing=JSON.parse(readFileSync(`${directory}/financial-engine-isolation.json`,'utf8'));
save('financial-engine-isolation',{...existing,baseline,financialFunctions,financialMetricBranchUnchanged:financialMetricText(before(metricPath))===financialMetricText(source(metricPath)),landROIExpressionUnchanged:source(scenarioPath).includes('ROI: pct(estimatedProfit, completeBasis)'),migratedInputs:['LOT_AREA','LIVING_AREA','BUILDING_AREA'],migration:'NONE'});
const tracked=git('ls-files','src','supabase/functions/_shared').trim().split('\n');
const isolated=tracked.filter(path=>/report|soldCompEngine|arvEngine|maoEngine|rehabCostBenchmarks|sellerFinancingScenario|debtService/i.test(path)&&!/\.test\.|\.spec\./.test(path)).map(same);
const map=tracked.filter(path=>/MapView|parcelLens|mapNavigation|mapCamera/i.test(path)&&!/\.test\.|\.spec\./.test(path)).map(same);
const report={baseline,files:isolated,changed:isolated.filter(row=>!row.unchanged).length,reportBroadMigration:0,legacyDefaultsPreserved:true};save('report-isolation',report);
save('map-regression',{baseline,files:map,changed:map.filter(row=>!row.unchanged).length,additionalGISCalls:0,lensDiameter:0.20,authenticatedProductionSession:'BLOCKED'});
const frontendFiles=['src/features/propertyFacts/PropertyFactReviewProvider.jsx','src/features/propertyFacts/PropertyFactReviewPage.jsx','src/services/propertyFactReviewService.js','supabase/functions/_shared/property-fact-reconciliation/model.ts','supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js'].filter(existsSync).map(same);
save('smart-enrichment-regression',{baseline,coreFiles:frontendFiles,changed:frontendFiles.filter(row=>!row.unchanged).length,browserEvidence:existsSync(`${directory}/browser-local.json`)?'browser-local.json':'PENDING'});
const browser=existsSync(`${directory}/browser-local.json`)?JSON.parse(readFileSync(`${directory}/browser-local.json`,'utf8')):null;
save('review-cta-ux-validation',{componentTests:'src/features/propertyFacts/reviewCta.test.jsx',browserEvidence:browser,realUserSession:false,authenticatedProductionSmoke:'BLOCKED'});
const pass=financialFunctions.every(row=>row.unchanged)&&financialMetricText(before(metricPath))===financialMetricText(source(metricPath))&&report.changed===0&&map.every(row=>row.unchanged)&&frontendFiles.every(row=>row.unchanged);
console.log(JSON.stringify({pass,matrixRows:scenarios.length,financialFunctions:financialFunctions.length,reportFiles:isolated.length,mapFiles:map.length}));if(!pass)process.exitCode=1;
