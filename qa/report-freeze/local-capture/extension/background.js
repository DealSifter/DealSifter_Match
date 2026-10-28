/* global chrome */
import { safePage, safeProfile } from './sanitize.js';
import { installCollector } from './collector.js';
let run = null;
const command = (method, params = {}) => chrome.debugger.sendCommand({ tabId: run.tab }, method, params);
const bounded = (p, ms = 4000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('capture-timeout')), ms);
  p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
});
async function persist() {
  if (run) await chrome.storage.session.set({ checkpoint: run.report });
}
async function save(report, suffix = 'final') {
  // No network transmission. Only sanitized JSON reaches the download API.
  await chrome.downloads.download({
    url: 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2)),
    filename: `DealSifter-Diagnostico/captura-${report.capture}-${suffix}.json`,
    saveAs: false, conflictAction: 'overwrite',
  });
}
async function poll() {
  if (!run || run.busy || run.stopping) return;
  const current = run; current.busy = true;
  try {
    const r = await bounded(command('Runtime.evaluate', {
      expression: 'window.__dsLocalCapture ? window.__dsLocalCapture.snapshot() : null',
      returnByValue: true, silent: true,
    }));
    if (run !== current) return;
    if (r.result?.value) current.report.page = safePage(r.result.value);
    current.report.lastPageReplyMs = Date.now()-current.started;
    await persist();
    const marks = current.report.page?.marks || [];
    const pdfMark = marks.findLast(m => ['pdf_generation_start','pdf_generation_complete','pdf_blob_created'].includes(m.stage));
    if (pdfMark && marks.some(m => m.stage === 'final_ui_unlock' && m.atMs >= pdfMark.atMs) && !current.finishTimer)
      current.finishTimer = setTimeout(() => finish('ui_unlocked'), 2000);
  } catch {
    if (run === current) { current.report.pageReplyTimeouts++; await persist(); }
  } finally { current.busy = false; }
}
async function finish(reason) {
  if (!run || run.stopping) return;
  const current = run; current.stopping = true;
  clearInterval(current.pollTimer); clearInterval(current.checkpointTimer);
  clearTimeout(current.finishTimer);
  await chrome.alarms.clear('ds-capture-stop');
  current.report.reason = reason;
  current.report.elapsedMs = Date.now()-current.started;
  try {
    const r = await bounded(command('Profiler.stop'), 8000);
    current.report.cpu = safeProfile(r.profile);
    current.report.cpuStatus = 'captured';
  } catch { current.report.cpuStatus = 'unavailable_renderer_or_debugger_unresponsive'; }
  try {
    const r = await bounded(command('Runtime.evaluate', {
      expression: 'window.__dsLocalCapture ? window.__dsLocalCapture.stop() : null', returnByValue: true, silent: true,
    }), 2000);
    if (r.result?.value) current.report.page = safePage(r.result.value);
  } catch { /* The external Windows sampler does not depend on this thread. */ }
  await chrome.storage.session.set({ checkpoint: current.report });
  // Detach even if profile/collector retrieval failed. Never close or reload the user's tab.
  try { await bounded(chrome.debugger.detach({ tabId: current.tab }), 2000); } catch { /* The debugger may already be detached. */ }
  run = null;
  try {
    await save(current.report);
    await chrome.action.setBadgeText({ text: 'OK' });
    await chrome.action.setTitle({ title: 'Captura encerrada; JSON em Downloads/DealSifter-Diagnostico' });
  } catch {
    await chrome.action.setBadgeText({ text: 'ERRO' });
    await chrome.action.setTitle({ title: 'O Edge nao aceitou o download. Preserve o arquivo parcial e o monitor externo.' });
  }
}
export async function startCapture(tab) {
  if (run) { await finish('user_stopped'); return; }
  // Permission is powerful, but operation is restricted to the explicit production origin and user's click.
  let allowed = false;
  try { allowed = new URL(tab.url).origin === 'https://dealsiftermatch.vercel.app'; } catch { /* Invalid URLs remain disallowed. */ }
  if (!allowed) {
    await chrome.action.setBadgeText({ text: 'APP' });
    await chrome.action.setTitle({ title: 'Abra o DealSifter e clique neste icone novamente.' }); return;
  }
  run = { tab: tab.id, started: Date.now(), busy: false, stopping: false,
    report: { diagnostic: 'dealsifter-local-opt-in-v1', capture: new Date().toISOString().replace(/\D/g,'').slice(0,14),
      cpuStatus: 'pending', pageReplyTimeouts: 0,
      limitations: ['CPU profiling changes timing slightly; 10ms sampling.',
        'Resource durations are aggregates, not exact image/map/translation CPU phase durations.',
        'No DOM, input text, tokens, cookies, request bodies, screenshots, raw URLs or exception messages.',
        'A permanently unresponsive renderer may not return its CPU profile; use the external Windows sampler.',
        'Source coordinates refer to the deployed bundle; no source maps or property content collected.'] } };
  try {
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    await bounded(command('Profiler.enable'));
    await bounded(command('Profiler.setSamplingInterval', { interval: 10000 }));
    await bounded(command('Runtime.evaluate', { expression: `(${installCollector.toString()})()`, returnByValue: true }));
    await bounded(command('Profiler.start'));
    await chrome.action.setBadgeText({ text: 'REC' });
    await chrome.action.setBadgeBackgroundColor({ color: '#c62828' });
    await chrome.action.setTitle({ title: 'Gravando: gere UM relatorio L3. Clique para encerrar antes de 3 minutos.' });
    await persist();
    // A partial JSON exists BEFORE the possible freeze. It is refreshed outside the page thread.
    await save(run.report, 'parcial');
    run.pollTimer = setInterval(poll, 1000);
    run.checkpointTimer = setInterval(() => { if (run && !run.stopping) save(run.report, 'parcial').catch(() => {}); }, 15000);
    await chrome.alarms.create('ds-capture-stop', { when: Date.now()+180000 });
  } catch { await finish('capture_setup_failed'); }
}
chrome.action.onClicked.addListener(startCapture);
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'ds-capture-stop') finish('three_minute_limit'); });
chrome.debugger.onDetach.addListener(source => {
  if (run && !run.stopping && source.tabId === run.tab) finish('debugger_detached');
});
