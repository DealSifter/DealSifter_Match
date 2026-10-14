import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { setupMockSupabase } from '../e2e/support/mockSupabase.js';
import { loginAs } from '../e2e/support/appActions.js';
const directory='qa/navigation-reliability'; await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true}); const results=[];
const rootFor={dashboard:'[data-testid="dashboard-root"]',matches:'[data-testid="matches-root"]',mapview:'.leaflet-container',pricing:'[data-testid="pricing-plan-free"]'};
async function navigate(page,module) {
  const desktop=page.getByTestId(`nav-${module}`); const mobile=page.getByTestId(`mobile-nav-${module}`);
  const back=page.getByRole('button',{name:'Back to app'});
  if(!await desktop.isVisible()&&!await mobile.isVisible()&&module!=='pricing'&&await back.isVisible()) await back.click();
  if(await desktop.isVisible()) await desktop.click();
  else if(await mobile.isVisible()) await mobile.click();
  else if(module==='pricing') {
    await page.getByTestId('nav-app-menu').click();
    await page.getByRole('button',{name:/^(Pricing|Plans|Planos|Planes)$/i}).click();
  } else throw new Error(`NAVIGATION_CONTROL_NOT_FOUND:${module}`);
  await expect(page.locator(rootFor[module]).first()).toBeVisible({timeout:60000});
}
try {
  for(const [device,width,height] of [['desktop',1280,900],['phone',390,844]]) {
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4180',viewport:{width,height},isMobile:device==='phone',hasTouch:device==='phone'});
    const backend=await setupMockSupabase(context);
    await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith('https://cyeipfskwwisbbayyaca.supabase.co')?route.fallback():route.abort());
    await context.route('**/*sentry.io/**',route=>route.abort());
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await loginAs(page,backend.users.investor);
    const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});
    if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
    await page.evaluate(()=>{window.__navigationFeed=document.querySelector('[data-testid="dashboard-root"]');});
    await navigate(page,'matches');
    await page.evaluate(()=>{window.__navigationMatches=document.querySelector('[data-testid="matches-root"]');});
    const timings=[];
    for(const module of ['mapview','dashboard','pricing','matches','mapview','dashboard','matches','pricing','dashboard']) {
      const start=Date.now(); await navigate(page,module); timings.push({module,milliseconds:Date.now()-start});
      expect(await page.evaluate(()=>window.__navigationFeed.isConnected&&window.__navigationMatches.isConnected)).toBe(true);
      if(module==='dashboard')expect(await page.evaluate(()=>document.querySelector('[data-testid="dashboard-root"]')===window.__navigationFeed)).toBe(true);
      if(module==='matches')expect(await page.evaluate(()=>document.querySelector('[data-testid="matches-root"]')===window.__navigationMatches)).toBe(true);
      expect(await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))).toBeNull();
    }
    expect(errors).toEqual([]);await page.screenshot({path:`${directory}/${device}-navigation.png`});
    results.push({device,width,height,navigations:10,feedAndMatchesDomIdentityPreserved:true,errors,timings});
    await context.close();console.log(`${device}: PASS`);
  }
  await writeFile(`${directory}/runtime-validation.json`,JSON.stringify({mode:'LOCAL_FULL_APP_WITH_MOCK_AUTH_AND_BACKEND',productionUserSession:false,paidProviderCalls:0,results},null,2)+'\n');
}finally{await browser.close();}
