import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const directory='qa/portfolio-card-labels';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
  for(const [device,width,height] of [['desktop',1280,1000],['phone',390,844]])for(const language of ['pt','en','es']){
    const theme=language==='en'?'dark':'light';
    const context=await browser.newContext({viewport:{width,height},isMobile:device==='phone',hasTouch:device==='phone'});
    await context.route('**/*.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
    await context.route('**/__portfolio_card_qa',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root" style="max-width:720px;margin:16px auto;padding:0 12px"></div>'}));
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4180/__portfolio_card_qa');
    await page.evaluate(async({language,theme})=>{
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      localStorage.setItem('lang',language);await import('/src/index.css');
      document.documentElement.dataset.theme=theme;
      const React=(await import('/node_modules/.vite/deps/react.js')).default;
      const module=await import('/node_modules/.vite/deps/react-dom_client.js');
      const {PortfolioDetail}=await import('/src/components/matches/MatchesPortfolio.jsx');
      const {setLang}=await import('/src/i18n/translations.js');setLang(language);
      const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="180"><rect width="720" height="180" fill="#86b8b3"/><path d="M200 80L360 15L520 80V180H200Z" fill="#cba87b"/></svg>');
      const item={id:'qa-portfolio-property',type:'SFR',objective:'Sell',price:90000,capRate:null,rehab:35000,beds:3,baths:2,sqft:1760,zip:'72204',lot:5000,address:'QA portfolio property',images:[image]};
      (module.createRoot||module.default.createRoot)(document.getElementById('root')).render(React.createElement(PortfolioDetail,{item,owner:{name:'QA owner'},onBack:()=>{}}));
    },{language,theme});
    const facts=page.locator('.portfolio-property-facts');await expect(facts).toBeVisible({timeout:60000});
    const fields=['price','capRate','rehab','type','strategy','beds','baths','buildingArea','zip','lot'];
    for(const field of fields){
      const fact=facts.locator(`[data-fact="${field}"]`);await expect(fact).toHaveCount(1);
      expect((await fact.locator('.portfolio-property-label').innerText()).trim().length).toBeGreaterThan(0);
    }
    await expect(facts.getByText('$35K',{exact:true})).toHaveCount(1);
    await expect(facts.locator('[data-fact="buildingArea"]')).toContainText('sqft');
    await expect(facts.locator('[data-fact="lot"]')).toContainText('sqft');
    await expect(facts.locator('[data-fact="zip"]')).toContainText('72204');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const overflow=await facts.locator('.portfolio-property-label,.portfolio-property-detail-value').evaluateAll(elements=>elements.filter(element=>element.scrollWidth>element.clientWidth+1).map(element=>element.textContent));
    expect(overflow).toEqual([]);expect(errors).toEqual([]);
    await page.screenshot({path:`${directory}/${device}-${language}-${theme}.png`,fullPage:true});
    results.push({device,language,theme,fields:fields.length,duplicateFacts:0,blankLabels:0,horizontalOverflow:false,errors});
    await context.close();
  }
  await writeFile(`${directory}/visual-validation.json`,JSON.stringify({mode:'REAL_PORTFOLIO_DETAIL_COMPONENT_WITH_SYNTHETIC_DATA',realBackendWrites:0,results},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
