import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const directory='qa/portfolio-rooms-layout';
await mkdir(directory,{recursive:true});
const fixturePath=`${directory}/l1-property-fixture.json`;
// Real incident facts, when explicitly selected, stay in a git-ignored file.
// The reproducible checked-in test defaults exclusively to synthetic data.
const property=process.argv.includes('--private-fixture')?JSON.parse(await readFile(fixturePath,'utf8')):{
 id:'7a209c33-a652-4444-8888-123456789abc',type:'SFR',address:'100 Synthetic Example St',city:'Example City',state:'AR',zip:'00000',
 price:90000,beds:3,baths:2,sqft:1760,lot:5000,notes:Array.from({length:30},(_,index)=>`Recorded owner note ${index+1}: verify the published property information before proceeding.`).join(' '),
};
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const [device,width,height] of [['desktop',1280,1000],['phone',390,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:device==='phone',hasTouch:device==='phone',acceptDownloads:true});
  await context.route('**/*.supabase.co/**',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'MOCK_NO_HIGHER_TIER_PRIVILEGE'})}));
  await context.route('**/*sentry.io/**',route=>route.abort());
  await context.route('**/__l1_release_qa',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>'}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4180/__l1_release_qa');
  const rendered=await page.evaluate(async property=>{
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
    localStorage.setItem('lang','en');await import('/src/index.css');
    const React=(await import('/node_modules/.vite/deps/react.js')).default;
    const module=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {PortfolioDetail}=await import('/src/components/matches/MatchesPortfolio.jsx');
    const {setLang}=await import('/src/i18n/translations.js');setLang('en');
    const {buildMaxxisReportSchema}=await import('/src/domain/maxxis/maxxisReportSchema.js');
    const {resolveReportExportEntitlement}=await import('/src/features/maxxis/export/reportExportEntitlement.js');
    const {renderMaxxisReportPdf}=await import('/src/features/maxxis/export/maxxisReportPdf.js');
    const access=Object.fromEntries(['PROPERTY_RELEASE','MAXXIS_ANALYSIS','DEAL_INTELLIGENCE'].map(reportType=>[reportType,resolveReportExportEntitlement({plan:'free',entitlements:[],reportType,channel:'PDF'}).allowed]));
    const result=await renderMaxxisReportPdf({schema:buildMaxxisReportSchema({reportType:'PROPERTY_RELEASE',property}),exportEntitlement:resolveReportExportEntitlement({plan:'free',reportType:'PROPERTY_RELEASE',channel:'PDF'}),language:'en'});
    (module.createRoot||module.default.createRoot)(document.getElementById('root')).render(React.createElement(PortfolioDetail,{item:property,owner:{name:'QA owner'},intelligencePlan:'free',reportEntitlements:[],onBack:()=>{}}));
    return {state:result.state,pageCount:result.document?.pageCount,continuations:result.document?.layoutAudit?.continuations?.length,access};
  },property);
  expect(rendered.access).toEqual({PROPERTY_RELEASE:true,MAXXIS_ANALYSIS:false,DEAL_INTELLIGENCE:false});
  await expect(page.locator('[data-guide="matches-property-detail"]')).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:'Export',exact:true}).click();
  await expect(page.getByTestId('report-experience-selector')).toBeVisible();
  console.log(JSON.stringify({device,renderer:rendered}));
  await page.getByRole('button',{name:/Download to device \(PDF\)/i}).click();
  if(process.argv.includes('--expect-rejection')){
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect.poll(()=>errors.includes('PROPERTY_RELEASE_RENDER_FAILED'),{timeout:60000}).toBe(true);
    results.push({device,...rendered,reproducedError:errors});
  }else{
    const downloadPromise=page.waitForEvent('download',{timeout:60000});
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    const download=await downloadPromise;
    const path=`${directory}/l1-${device}.pdf`;await download.saveAs(path);
    const binary=await readFile(path);expect(binary.subarray(0,5).toString()).toBe('%PDF-');
    expect(errors).toEqual([]);await expect(page.locator('[data-testid="report-experience-selector"]')).toHaveCount(0);
    // A real browser download failure must be explained, remain retryable,
    // and never escape as an unhandled event-handler rejection.
    await page.getByRole('button',{name:'Export',exact:true}).click();
    await page.getByRole('button',{name:/Download to device \(PDF\)/i}).click();
    await page.evaluate(()=>{window.__qaCreateObjectURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('SYNTHETIC_DOWNLOAD_FAILURE');};});
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('The report could not be prepared');
    await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();
    await page.evaluate(()=>{URL.createObjectURL=window.__qaCreateObjectURL;delete window.__qaCreateObjectURL;});
    const retry=page.waitForEvent('download',{timeout:60000});
    await page.getByRole('button',{name:'Continue',exact:true}).click();await retry;
    await expect(page.getByTestId('report-experience-selector')).toHaveCount(0);
    expect(errors).toEqual([]);
    results.push({device,...rendered,downloaded:true,bytes:binary.length,handledFailure:true,retryDownloaded:true,errors});
  }
  await context.close();
 }
 await writeFile(`${directory}/l1-${process.argv.includes('--expect-rejection')?'reproduction':'validation'}.json`,JSON.stringify({mode:'REAL_COMPONENT_REAL_PDF_PUBLIC_PROPERTY_FACTS_MOCK_BACKEND_FREE_ACCOUNT',realUserSession:false,realBackendWrites:0,results},null,2)+'\n');
 console.log(JSON.stringify(results));
}finally{await browser.close();}
