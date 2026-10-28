import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { safePage, safeProfile } from './extension/sanitize.js';

const secret = 'PRIVATE_TOKEN_PROPERTY_SENTINEL';
const safe = safePage({ marks: [{ stage: 'pdf_generation_complete', totalMs: 123, traceId: secret },
  { stage: secret }], resources: { images: { count: 1, totalMs: 5, url: secret }, [secret]: {} },
  longTasks: [{ durationMs: 75, atMs: 5, secret }], secret });
assert(!JSON.stringify(safe).includes(secret));
assert.equal(safe.marks.length, 1);
const cpu = safeProfile({startTime: 0, endTime: 30000, samples: [2,2], timeDeltas: [10000,10000],
  nodes: [{id:1,callFrame:{functionName:'(root)'},children:[2]}, {id:2,
    callFrame:{functionName:secret,url:`https://example.com/${secret}`,lineNumber:4,columnNumber:8}}]});
assert(!JSON.stringify(cpu).includes(secret));
assert.equal(cpu.functions.find(f => f.line===5).selfMs, 20);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-capture-test-'));
const ext = path.join(profile,'fixture-extension');
fs.cpSync(path.resolve('qa/report-freeze/local-capture/extension'),ext,{recursive:true});
fs.copyFileSync(path.resolve('qa/report-freeze/local-capture/test-entry.js'),path.join(ext,'test-entry.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(ext,'manifest.json'),'utf8'));
manifest.background.service_worker='test-entry.js';
fs.writeFileSync(path.join(ext,'manifest.json'),JSON.stringify(manifest));
const context = await chromium.launchPersistentContext(profile, { headless: true, channel:'chromium',
  args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`], acceptDownloads:true });
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page = await context.newPage();
  await context.route('https://dealsiftermatch.vercel.app/**', r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic diagnostic test</title>'}));
  await page.goto('https://dealsiftermatch.vercel.app/');
  const result = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs[tabs.length-1];
    await chrome.debugger.attach({tabId:tab.id},'1.3');
    try {
      await chrome.debugger.sendCommand({tabId:tab.id},'Profiler.enable');
      await chrome.debugger.sendCommand({tabId:tab.id},'Profiler.start');
      const r = await chrome.debugger.sendCommand({tabId:tab.id},'Profiler.stop');
      return {profiler:!!r.profile};
    } catch { return {profiler:false}; }
    finally { await chrome.debugger.detach({tabId:tab.id}); }
  });
  assert(result.profiler, 'Profiler domain must actually be supported by extension transport');
  // Entire extension start -> page collector -> CPU profile -> automatic sanitized download.
  await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    await globalThis.__testStartCapture({id: tabs[tabs.length-1].id, url:'https://dealsiftermatch.vercel.app/'});
  });
  let partialReady = false;
  for (let attempt=0;attempt<50;attempt++) {
    const firstDownload = await worker.evaluate(() => chrome.downloads.search({limit:1,orderBy:['-startTime']}));
    if (firstDownload[0]?.state==='complete') { partialReady=true; break; }
    await new Promise(r=>setTimeout(r,100));
  }
  const before = await worker.evaluate(()=>chrome.storage.session.get('checkpoint'));
  const downloadState = await worker.evaluate(async()=> (await chrome.downloads.search({limit:2})).map(d=>({
    state:d.state,error:d.error,file:d.filename.split(/[\\/]/).pop(), expected:d.url.startsWith('data:application/json;')})));
  assert(partialReady, `partial download created; status=${before.checkpoint?.cpuStatus}; downloads=${JSON.stringify(downloadState)}`);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('dealsifter:maxxis-performance', {detail:{
      stage:'pdf_generation_complete',totalMs:123,traceId:'PRIVATE_TOKEN_PROPERTY_SENTINEL'}}));
    const end = performance.now()+200;
    while (performance.now()<end) Math.sqrt(Math.random());
    window.dispatchEvent(new CustomEvent('dealsifter:maxxis-performance', {detail:{stage:'final_ui_unlock',totalMs:234}}));
  });
  let report;
  for (let attempt=0; attempt<100; attempt++) {
    const checkpoint = await worker.evaluate(() => chrome.storage.session.get('checkpoint'));
    if (checkpoint.checkpoint?.cpuStatus === 'captured') { report=checkpoint.checkpoint; break; }
    await new Promise(r=>setTimeout(r,100));
  }
  assert(report, 'capture must finish automatically');
  let finalFile;
  for (let attempt=0; attempt<50; attempt++) {
    const files = await worker.evaluate(() => chrome.downloads.search({limit:3,orderBy:['-startTime']}));
    finalFile=files.find(f=>f.state==='complete' && fs.existsSync(f.filename) && JSON.parse(fs.readFileSync(f.filename,'utf8')).reason==='ui_unlocked');
    if (finalFile) break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert(finalFile, 'final download created');
  const downloaded = fs.readFileSync(finalFile.filename,'utf8');
  assert.equal(JSON.parse(downloaded).cpuStatus,'captured');
  assert(!downloaded.includes(secret));
  assert.equal(report.reason,'ui_unlocked');
  assert.equal(report.cpuStatus,'captured');
  assert(report.page.marks.some(m=>m.stage==='pdf_generation_complete'));
  assert(report.page.longTasks.some(t=>t.durationMs>=100));
  assert(!JSON.stringify(report).includes(secret));
  assert.equal(await page.evaluate(()=>window.__dsLocalCapture.snapshot().marks.length),2);
  assert.equal(await worker.evaluate(async()=>{
    const tabs=await chrome.tabs.query({});
    try { await chrome.debugger.sendCommand({tabId:tabs[tabs.length-1].id},'Runtime.evaluate',{expression:'1'}); return false; }
    catch { return true; }
  }),true);
  console.log(JSON.stringify({privacySentinel:'PASS',cpuAggregation:'PASS',realExtensionProfiler:result.profiler,
    automaticDownload:'PASS',longTaskCapture:'PASS',detach:'PASS',
    authenticatedSessionTested:false}));
} finally { await context.close(); }
