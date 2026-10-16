import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs}=await import('../e2e/support/appActions.js');
const baseURL=process.env.NAV_QA_BASE_URL||'http://127.0.0.1:4182',directory='qa/publisher-zoning-match/navigation';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{for(const[device,width,height,timeout]of [['desktop',1280,900,false],['mobile',390,844,true]]){
 const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile'});
 const backend=await setupMockSupabase(context,{baseline:true});
 await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());
 await context.route('**/*sentry.io/**',route=>route.abort());
 let finishPage,finishAssistant,requests=0;const pendingPage=new Promise(resolve=>{finishPage=resolve;}),pendingAssistant=new Promise(resolve=>{finishAssistant=resolve;});
 await context.route('**/assets/MaxxisAssistant-*.js',async route=>{if(!timeout)await pendingAssistant;await route.continue();});
 await context.route('**/assets/Pricing-*.js',async route=>{requests++;await pendingPage;await route.continue();});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await loginAs(page,backend.users.investor);const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
  if(device==='mobile'){await page.getByTestId('nav-app-menu').click();await page.getByRole('button',{name:/^(Pricing|Plans)$/}).click();}else await page.getByTestId('nav-pricing').click();
  const loader=page.locator('[data-testid="module-loading"]:visible');await expect(loader).toBeVisible();
  await expect(loader).toHaveCount(1);await expect(loader.getByRole('img',{name:'DealSifter'})).toBeVisible();
  expect(await loader.locator('img').evaluate(el=>getComputedStyle(el).animationName)).toBe('ds-loader-spin');
  expect(await page.getByRole('status').filter({hasText:'Loading this module…'}).count()).toBe(1);
  if(timeout){await expect(page.getByRole('heading',{name:'Unable to load this module'})).toBeVisible({timeout:45000});await expect(loader).toHaveCount(0);await expect(page.getByTestId('nav-app-menu')).toBeEnabled();await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(loader).toBeVisible();}
  finishPage();finishAssistant();await expect(page.getByTestId('pricing-plan-free')).toBeVisible({timeout:60000});await expect(loader).toHaveCount(0);expect(requests).toBe(1);
  expect(errors.filter(message=>!message.includes('MODULE_LOAD_TIMEOUT'))).toEqual([]);
  results.push({device,timeoutInjected:timeout,oneAnimatedPageLoader:true,auxiliaryDoesNotCompete:true,scopedTimeoutRecovery:timeout,chunkNetworkRequests:requests,unexpectedErrors:[]});
 }catch(error){await writeFile(`${directory}/loading-failure.json`,JSON.stringify({device,message:error.message,requests,errors,body:await page.locator('body').innerText()},null,2));throw error;}
 finally{finishPage();finishAssistant();await context.close();}
}
await writeFile(`${directory}/loading-${baseURL.startsWith('https:')?'production':'local'}.json`,JSON.stringify({pass:true,baseURL,productionUserSession:false,realBackendWrites:0,mode:'REAL_FRONTEND_SYNTHETIC_AUTH_CONTROLLED_CHUNK_DELAY',results},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
