import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
process.env.E2E_SUPABASE_URL = 'https://cyeipfskwwisbbayyaca.supabase.co';
const { setupMockSupabase } = await import('../e2e/support/mockSupabase.js');
const output = process.env.MAP_QA_DIRECTORY||'qa/map-navigation-cleanup';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [device, width, height] of [['desktop',1280,900],['phone',390,844]]) {
    const context = await browser.newContext({ viewport:{width,height},isMobile:device==='phone',hasTouch:device==='phone' });
    await setupMockSupabase(context);
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push({message:error.message,stack:error.stack}));
    await page.route('**/functions/v1/public-parcel',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({status:'COVERAGE_AVAILABLE',freshness:'FRESH',expiresAt:new Date(Date.now()+300000).toISOString(),parcels:[{
      source:'explicit-qa-fixture-not-live-gis',parcelId:'MAIN',apn:'MAIN',retrievedAt:new Date().toISOString(),sourceAuthority:'Synthetic geometry',
      geometry:{type:'Polygon',coordinates:[[[-78.584,35.920],[-78.583,35.920],[-78.583,35.922],[-78.584,35.922],[-78.584,35.920]]]}
    }]})}));
    await page.route('**/__map_cleanup_qa', route => route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>'}));
    await page.goto('http://127.0.0.1:4180/__map_cleanup_qa');
    await page.evaluate(async () => {
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
      const React=(await import('/node_modules/.vite/deps/react.js')).default;
      const module=await import('/node_modules/.vite/deps/react-dom_client.js'); const root=(module.createRoot||module.default.createRoot)(document.getElementById('root'));
      const {MapView}=await import('/src/pages/MapView.jsx');
      const {default:ErrorBoundary}=await import('/src/components/ui/ErrorBoundary.jsx');
      const {default:L}=await import('/node_modules/.vite/deps/leaflet.js');
      const setView=L.Map.prototype.setView; L.Map.prototype.setView=function(...args){window.__cleanupMap=this;return setView.apply(this,args);};
      window.__cleanupReports=[]; window.__DS_REPORT_ERROR=(error,info)=>window.__cleanupReports.push({message:error.message,stack:error.stack,componentStack:info.componentStack});
      sessionStorage.setItem('ds_mapview_ui_state_v1',JSON.stringify({showPeople:false,showProperties:true,panelCollapsed:true,viewport:{center:[35.92113,-78.58355],zoom:15}}));
      const property={id:'cleanup-property',ownerId:'fixture-owner',address:'QA address',city:'Raleigh',state:'NC',zip:'27614',type:'SFR',price:674900,beds:4,baths:3,sqft:3017,lat:35.92113,lng:-78.58355,publishToShowcase:true,isActive:true,geocodeStatus:'resolved',geocodeSource:'explicit-qa-fixture',geocodedAt:'2026-10-13T00:00:00Z',ownerPreview:{name:'QA owner',type:'FSBO',loc:'NC'},images:[]};
      window.__renderCleanupModule=map=>root.render(React.createElement(ErrorBoundary,null,map?React.createElement(MapView,{showcaseProperties:[property],currentUserId:'fixture-viewer',userProfile:{},personalProfile:{},professionalProfile:{},unlocked:[],unlockedContactMap:new Map(),parcelFeatureEnabled:true,parcelQaGridEnabled:false,setPage:()=>{},onMaxxisContextChange:()=>{}}):React.createElement('div',{'data-testid':'next-module'},'Next module')));
      window.__renderCleanupModule(true);
    });
    await expect(page.locator('.leaflet-marker-icon.map-pin-wrapper').first()).toBeVisible({timeout:60000});
    for (const state of ['idle','selected-pin','in-flight-pin','fractional-zoom','active-lens','native-zoom']) {
      if(state!=='idle') {
        await page.evaluate(()=>window.__renderCleanupModule(true));
        await expect(page.locator('.leaflet-marker-icon.map-pin-wrapper').first()).toBeVisible({timeout:60000});
      }
      if(state==='selected-pin'||state==='in-flight-pin'||state==='active-lens') {
        await page.locator('.leaflet-marker-icon.map-pin-wrapper').first().click();
        await expect(page.locator('.ds-property-leaflet-popup')).toBeVisible();
        if(state==='selected-pin') await page.waitForTimeout(750);
        if(state==='active-lens') {
          await page.locator('.ds-property-pin-lens').click();
          await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(1,{timeout:30000});
        }
      }
      if(state==='fractional-zoom') {
        await page.locator('.leaflet-marker-icon.map-pin-wrapper').first().click();
        await expect(page.locator('.ds-property-leaflet-popup')).toBeVisible();
        await page.evaluate(()=>{window.__cleanupMap.stop();window.__cleanupMap.options.zoomSnap=0;window.__cleanupMap.setView([35.92113,-78.58355],15.5,{animate:false});});
      }
      if(state==='native-zoom') {
        // Observe and leave in the SAME native animation task; a later polling
        // round-trip can miss the short CSS animation under a loaded QA host.
        await page.evaluate(()=>new Promise((resolve,reject)=>{
          const map=window.__cleanupMap,timer=setTimeout(()=>reject(new Error('NATIVE_ZOOM_DID_NOT_START')),5000);
          map.once('zoomanim',()=>{clearTimeout(timer);window.__cleanupNativeZoomInFlight=map._animatingZoom===true;window.__renderCleanupModule(false);resolve();});
          map.setZoom(map.getZoom()+1,{animate:true});
        }));
        expect(await page.evaluate(()=>window.__cleanupNativeZoomInFlight)).toBe(true);
      }
      await page.evaluate(()=>window.__renderCleanupModule(false));
      // Covers the native CSS-zoom timer as well as immediate passive cleanup.
      await page.waitForTimeout(400);
      const diagnostics=await page.evaluate(()=>window.__cleanupReports);
      const passed=await page.getByTestId('next-module').isVisible();
      results.push({device,state,passed,diagnostics,errors:[...errors]});
      if(!passed) break;
    }
    await context.close();
  }
  await writeFile(`${output}/${process.argv.includes('--before')?'before':'after'}.json`,JSON.stringify({mode:'REAL_REACT_LEAFLET_UNMOUNT_MOCK_AUTH',productionAuthentication:false,results},null,2)+'\n');
  console.log(JSON.stringify(results));
  expect(results.every(result=>result.passed&&result.diagnostics.length===0&&result.errors.length===0)).toBe(true);
} finally { await browser.close(); }
