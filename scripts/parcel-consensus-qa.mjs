import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
const directory='qa/parcel-evidence-consensus';
const walk=root=>readdirSync(root,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(`${root}/${item.name}`):[`${root}/${item.name}`]);
const files=walk('supabase/functions').filter(path=>/\.ts$/.test(path)&&!path.includes('.test.'));
const changed=[resolve('supabase/functions/_shared/public-parcel/geometry.ts'),resolve('supabase/functions/_shared/public-parcel/areaPolicy.ts')];
function dependencies(path,seen=new Set()){
 const absolute=resolve(path);if(seen.has(absolute)||!existsSync(absolute))return seen;seen.add(absolute);
 const text=readFileSync(absolute,'utf8');
 for(const match of text.matchAll(/(?:from\s*|import\s*\()['"](\.[^'"]+)['"]/g))dependencies(resolve(dirname(absolute),match[1]),seen);
 return seen;
}
const affected=files.filter(path=>/^supabase\/functions\/[^/]+\/index\.ts$/.test(path)&&changed.some(file=>dependencies(path).has(file)));
if(JSON.stringify(affected)!==JSON.stringify(['supabase/functions/public-parcel/index.ts']))throw new Error('UNEXPECTED_BACKEND_DEPENDENCY_CLOSURE');
const frontend=walk('src').filter(path=>/\.(js|jsx|ts|tsx)$/.test(path)&&!path.includes('.test.'));
const frontendImports=frontend.filter(path=>/public-parcel\/geometry\.ts/.test(readFileSync(path,'utf8')));
writeFileSync(`${directory}/dependency-closure.json`,JSON.stringify({affectedEdgeFunctions:['public-parcel'],frontendAffected:true,
 frontendDirectGeometryConsumers:frontendImports,unchangedEdgeFunctions:['feature-flags','maxxis-chat'],
 engineRuntimeConsumers:0,newEndpoints:0,migration:'NONE',changedRuntimeFiles:changed.map(path=>relative(process.cwd(),path).replace(/\\/g,'/'))},null,2)+'\n');
const summary={};
for(const name of ['targeted-tests','full-tests']){
 const result=JSON.parse(readFileSync(`${directory}/${name}.json`,'utf8'));
 if(!result.success||result.numFailedTests||result.numFailedTestSuites)throw new Error(`${name.toUpperCase()}_NOT_PASS`);
 const baseline=JSON.parse(readFileSync('qa/public-parcel-intelligence/general-availability/full-tests.json','utf8'));
 if(name==='full-tests'&&result.testResults.length!==baseline.testResults.length+1)throw new Error('FULL_SUITE_FILE_COVERAGE_INCOMPLETE');
 if(!result.testResults.some(file=>file.name.replace(/\\/g,'/').endsWith('/src/components/map/PropertyPinPopup.test.jsx')))throw new Error('PIN_POPUP_WORKER_NOT_COMPLETED');
 const engine=result.testResults.find(file=>file.name.replace(/\\/g,'/').endsWith('/parcel-evidence-consensus/engine.test.ts'));
 if(engine?.assertionResults.length!==50||engine.assertionResults.some(test=>test.status!=='passed'))throw new Error('FINAL_ENGINE_ASSERTIONS_INCOMPLETE');
 summary[name]={total:result.numTotalTests,passed:result.numPassedTests,files:result.testResults.length};
}
console.log(JSON.stringify({dependencyClosure:'PASS',tests:summary},null,2));
