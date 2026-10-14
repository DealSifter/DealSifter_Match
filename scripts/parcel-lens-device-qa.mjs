import { mkdir, writeFile } from 'node:fs/promises';
import { argv } from 'node:process';
import { chromium, expect } from '@playwright/test';
if(argv.includes('--ga')||argv.includes('--consensus'))process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');

const unlockedFixture = argv.includes('--unlocked');
const output = argv.includes('--consensus') ? 'qa/parcel-evidence-consensus/device' : argv.includes('--ga') ? 'qa/public-parcel-intelligence/general-availability/device' : unlockedFixture ? 'qa/parcel-lens-unlocked' : 'qa/parcel-lens-device'; await mkdir(`${output}/screenshots`, { recursive: true });
const point = { lat:35.921133041392, lng:-78.583547577238 };
function parcel(id, dx = 0, dy = 0) {
  const lng = point.lng + dx; const lat = point.lat + dy; const size = .00008;
  return { source:'explicit-qa-fixture-not-live-gis', parcelId:id, apn:id, ownerName:'QA public record',
    legalDescription:'Long public legal description retained in full. '.repeat(20), sourceAuthority:'Synthetic geometry for deterministic interaction tests',
    retrievedAt:new Date().toISOString(), sourceUrl:'https://example.com/qa',
    geometry:{type:'Polygon',coordinates:[[[lng-size,lat-size],[lng+size,lat-size],[lng+size,lat+size],[lng-size,lat+size],[lng-size,lat-size]]] } };
}
const main = parcel('MAIN');
const neighbors = Array.from({length:110},(_,index) => parcel(`NEIGHBOR-${index}`,((index%11)-5)*.00016,(Math.floor(index/11)-5)*.00016));
const cases = [['desktop',1280,900,false,'pt','light',18],['desktop-wide',1920,1080,false,'en','dark',11],
  ['phone',390,844,true,'pt','dark',18],['phone-small',360,740,true,'es','light',13],['tablet',768,1024,true,'es','dark',18]];
const scope=argv.find(value=>value.startsWith('--case='))?.slice(7);
if(scope&&!cases.some(([device])=>device===scope))throw new Error('UNKNOWN_QA_CASE');
const browser = await chromium.launch({headless:true}); const results=[];
try {
  for (const [device,width,height,touch,language,theme,initialZoom] of cases.filter(([device])=>!scope||device===scope)) {
    const context = await browser.newContext({viewport:{width,height},isMobile:device.startsWith('phone'),hasTouch:touch});
    await setupMockSupabase(context); const page = await context.newPage(); const queries=[]; const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/functions/v1/public-parcel',route=>{
      const body=route.request().postDataJSON(); queries.push(body);
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'COVERAGE_AVAILABLE',freshness:'FRESH',
        parcels:body.operation==='query-point'?[main]:[main,...neighbors],exceededLimit:false,expiresAt:new Date(Date.now()+300000).toISOString()})});
    });
    await page.route('**/__parcel_device_qa',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>'}));
    await page.goto('http://127.0.0.1:4180/__parcel_device_qa');
    await page.evaluate(async ({point,language,theme,initialZoom,phone,unlockedFixture})=>{
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/index.css'); await import('/node_modules/leaflet/dist/leaflet.css');
      const React=(await import('/node_modules/.vite/deps/react.js')).default;
      const reactDom=await import('/node_modules/.vite/deps/react-dom_client.js'); const createRoot=reactDom.createRoot || reactDom.default.createRoot;
      const L=(await import('/node_modules/.vite/deps/leaflet.js')).default;
      window.__camera=[];
      for(const method of ['flyTo','flyToBounds','panBy']) { const original=L.Map.prototype[method];
        L.Map.prototype[method]=function(...args){window.__map=this;window.__camera.push({method,zoom:method==='flyTo'?args[1]:null,target:args[0],at:performance.now()});return original.apply(this,args);}; }
      const originalSet=L.Map.prototype.setView; L.Map.prototype.setView=function(...args){window.__map=this;return originalSet.apply(this,args);};
      // Seed before imports: Vite HMR may expose both stamped/plain module URLs.
      localStorage.setItem('lang',language);
      const {MapView}=await import('/src/pages/MapView.jsx'); const {setLang}=await import('/src/i18n/translations.js'); setLang(language);
      document.documentElement.dataset.theme=theme;
      document.documentElement.style.setProperty('--ds-mobile-bottom-nav-visible-height',phone?'88px':'0px');
      sessionStorage.setItem('ds_mapview_ui_state_v1',JSON.stringify({showPeople:false,showProperties:true,panelCollapsed:phone,panelTab:'cards',
        viewport:{center:[point.lat,point.lng],zoom:initialZoom}}));
      sessionStorage.setItem('mapViewport',JSON.stringify({center:[point.lat,point.lng],zoom:initialZoom}));
      const property={id:'device-property',ownerId:'fixture-owner',primaryProfile:'fsbo',address:'1524 Wood Spring Ct',city:'Raleigh',state:'NC',zip:'27614',
        type:'SFR',price:674900,beds:4,baths:3,sqft:3017,lat:point.lat,lng:point.lng,publishToShowcase:true,isActive:true,
        geocodeStatus:'resolved',geocodeSource:'explicit-qa-fixture',geocodedAt:'2026-10-13T00:00:00Z',
        ownerPreview:{name:'QA owner',type:'FSBO',loc:'NC'},images:['data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320"><rect width="600" height="320" fill="#81bfb3"/><path d="M100 160L300 40L500 160V300H100Z" fill="#e0bb83"/></svg>')],isSpotlight:true};
      const {resolvePropertyUnlockState}=await import('/src/lib/unlockAccessState.js');
      const grants=unlockedFixture?new Map([['fixture-owner',{ownerId:'fixture-owner',primaryProfile:'fsbo',unlockScope:'asset',unlockedPropertyIds:['device-property']}]]):new Map();
      if(resolvePropertyUnlockState(property,grants)!==unlockedFixture)throw new Error('QA_UNLOCK_FIXTURE_MUST_USE_CANONICAL_ASSET_ENTITLEMENT');
      window.__navigation=[];
      createRoot(document.getElementById('root')).render(React.createElement(MapView,{showcaseProperties:[property],currentUserId:'fixture-viewer',userProfile:{},
        unlocked:[],personalProfile:{},professionalProfile:{},nuggets:20,parcelFeatureEnabled:true,parcelQaGridEnabled:false,
        unlockedContactMap:grants,setModal:()=>{},openUnlock:()=>{},setPage:value=>window.__navigation.push(value),onMaxxisContextChange:()=>{}}));
      const avatar=document.createElement('div');avatar.id='qa-avatar';avatar.textContent='AI';avatar.style.cssText=`position:fixed;bottom:${phone?100:20}px;right:12px;width:74px;height:80px;border-radius:40px;background:#00cbd4;display:grid;place-items:center;z-index:14000`;document.body.append(avatar);
      if(phone){const footer=document.createElement('div');footer.id='qa-footer';footer.style.cssText='position:fixed;bottom:0;left:0;right:0;height:88px;background:#ddd;z-index:14000';footer.textContent='Mobile navigation fixture';document.body.append(footer);}
    },{point,language,theme,initialZoom,phone:device.startsWith('phone'),unlockedFixture});
    const pin=page.locator('.leaflet-marker-icon.map-pin-wrapper').first(); await expect(pin).toBeVisible({timeout:60000});
    if(device==='tablet') await page.getByRole('complementary').getByRole('button',{name:language==='es'?'Cerrar panel':'Close panel',exact:true}).click();
    await page.waitForTimeout(600); await page.evaluate(()=>window.__camera=[]);
    await page.evaluate(()=>{window.__initialTiles=window.__map.getPane('tilePane').firstElementChild;});
    await pin.click(); await expect(page.getByTestId('map-zoom-level')).toHaveText('Z15',{timeout:20000});
    await expect(page.locator('.ds-property-pin-lens')).toBeVisible(); await expect(page.locator('.ds-property-pin-parcel-nav')).toHaveCount(0);
    await page.waitForTimeout(700);
    const initial=await page.locator('.ds-property-leaflet-popup').boundingBox();
    const firstMoves=await page.evaluate(()=>window.__camera);
    console.log(JSON.stringify({device,initial,firstMoves}));
    expect(firstMoves.filter(move=>move.method==='flyTo')).toHaveLength(1);
    // Leaflet keyboard-focus bookkeeping may emit panBy(0,0); it does not move the camera.
    expect(firstMoves.some(move=>move.method==='flyToBounds'||move.method==='panBy'&&(move.target.x!==0||move.target.y!==0))).toBe(false);
    await page.screenshot({path:`${output}/screenshots/${device}-initial.png`});
    await page.locator('.ds-property-pin-lens').click(); const target=device.startsWith('phone')?17:16;
    await expect(page.getByTestId('map-zoom-level')).toHaveText(`Z${target}`,{timeout:20000});
    await expect(page.locator('.ds-property-pin-parcel-nav')).toBeVisible(); await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(1);
    await page.waitForTimeout(800); const active=await page.locator('.ds-property-leaflet-popup:not(.ds-parcel-popup)').boundingBox();
    for(const key of ['width','height','x','y']) expect(Math.abs(active[key]-initial[key]),`${device}: stable ${key}`).toBeLessThan(2);
    expect(active.x).toBeGreaterThanOrEqual(0);expect(active.x+active.width).toBeLessThanOrEqual(width);
    const pill=await page.locator('.ds-parcel-lens-status').boundingBox();const map=await page.locator('.leaflet-container').boundingBox();
    expect(pill.y-map.y).toBeLessThan(20);expect(pill.y+pill.height).toBeLessThanOrEqual(active.y);
    const avatar=await page.locator('#qa-avatar').boundingBox();expect(active.y+active.height).toBeLessThan(avatar.y+5);
    if(device.startsWith('phone')) {
      const circle=await page.locator('.ds-parcel-lens-circle').boundingBox();const footer=await page.locator('#qa-footer').boundingBox();
      expect(circle.y+circle.height).toBeLessThanOrEqual(footer.y+2);
    }
    if(device.startsWith('phone'))expect(Math.abs(pill.x+pill.width/2-(map.x+map.width/2))).toBeLessThan(2);
    else {const zoom=await page.locator('.leaflet-control-zoom').boundingBox();expect(pill.x+pill.width).toBeLessThan(zoom.x);}
    const tabs=page.locator('.ds-property-pin-parcel-nav button');expect(await tabs.count()).toBe(2);
    await tabs.first().click();await tabs.last().click();await tabs.first().click();await tabs.last().click();
    const before=await page.locator('.ds-property-leaflet-popup:not(.ds-parcel-popup)').boundingBox();await page.waitForTimeout(1500);
    const after=await page.locator('.ds-property-leaflet-popup:not(.ds-parcel-popup)').boundingBox();
    expect(Math.abs(after.x-before.x)+Math.abs(after.y-before.y)).toBeLessThan(1);
    expect(await page.evaluate(()=>window.__camera.filter(move=>move.method==='flyTo').length)).toBe(2);
    expect(await page.evaluate(()=>window.__initialTiles===window.__map.getPane('tilePane').firstElementChild)).toBe(true);
    expect(queries).toHaveLength(2);expect(queries.map(query=>query.operation)).toEqual(['query-point','query-lens']);
    expect(await page.evaluate(()=>window.__navigation)).toEqual([]);expect(errors).toEqual([]);
    await page.screenshot({path:`${output}/screenshots/${device}-lens.png`});
    await tabs.first().click();
    await page.getByRole('button',{name:'Zoom out',exact:true}).click();
    await expect(page.getByTestId('map-zoom-level')).toHaveText(`Z${target-1}`);
    await page.locator('.ds-property-pin-lens').click();
    await expect(page.getByTestId('map-zoom-level')).toHaveText(`Z${target}`);
    expect(queries).toHaveLength(2);
    if(device==='desktop') {
      await page.locator('.map-list-item.property').first().click();
      await expect(page.getByTestId('map-zoom-level')).toHaveText('Z15');
      await page.locator('.leaflet-popup-close-button').click();
      await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(1);
      await page.locator('.ds-parcel-lens-status button').click();
      await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(0);
      expect(await page.evaluate(()=>window.__initialTiles===window.__map.getPane('tilePane').firstElementChild)).toBe(true);
      expect(queries).toHaveLength(2);
    }
    results.push({device,viewport:{width,height},language,theme,initialZoom,pinZoom:15,lensZoom:target,canonicalAssetUnlocked:unlockedFixture,
      initialPopup:initial,activePopup:active,pill,viewportStableAfterSwitch:true,queries:queries.length,
      cameraFlights:await page.evaluate(()=>window.__camera.filter(move=>move.method==='flyTo').length),
      spotlightAndCloseControlsTested:device==='desktop',repeatedMagnifierRestoresExactZoom:true,errors});
    await context.close();console.log(`${device}: PASS`);
  }
  await writeFile(`${output}/runtime-validation${scope?`-${scope}`:''}.json`,JSON.stringify({mode:'LOCAL_REAL_LEAFLET_WITH_EXPLICIT_SYNTHETIC_GIS_AND_MOCKED_AUTH',
    productionUserAuthentication:false,diameterMiles:.20,radiusMiles:.10,results,paidProviderCalls:0,liveParcelGISCalls:0,basemapTiles:'NORMAL_EXISTING_BASEMAP_REQUESTS'},null,2)+'\n');
} finally {await browser.close();}
