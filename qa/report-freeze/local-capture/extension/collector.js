// Runs only after the user clicks the extension. No DOM, cookies, storage or request payloads are read.
export function installCollector() {
  if (window.__dsLocalCapture) window.__dsLocalCapture.stop();
  const start = performance.now(), marks = [], longTasks = [], resources = {}, observers = [];
  const allowed = new Set(['T0_user_click','pdf_generation_start','pdf_assets_ready',
    'pdf_assembly_complete','pdf_generation_complete','pdf_blob_created','pdf_artifact_ready',
    'pdf_download_dispatched','final_ui_unlock']);
  const numeric = ['durationMs','totalMs','preparationMs','moduleMs','pageRenderMs','assemblyMs',
    'pageCount','bytes','largestLongTaskMs','longTasksOver50Ms','longTasksOver200Ms','longTasksOver1000Ms'];
  let previous = start, gap = 0;
  const receive = e => {
    const d = e.detail || {};
    if (!allowed.has(d.stage) || marks.length >= 300) return;
    const m = { stage: d.stage, atMs: performance.now() - start };
    numeric.forEach(k => { if (Number.isFinite(d[k])) m[k] = d[k]; });
    marks.push(m);
  };
  function entries(list) {
    for (const e of list) {
      if (e.startTime < start) continue;
      if (e.entryType === 'longtask' && longTasks.length < 500)
        longTasks.push({ atMs: e.startTime - start, durationMs: e.duration });
      if (e.entryType !== 'resource') continue;
      let kind = 'other';
      try {
        const u = new URL(e.name);
        kind = u.pathname.includes('presentation-translate') ? 'translation'
          : /(^|\.)tile\.openstreetmap\.org$/.test(u.hostname) ? 'map_tiles'
          : e.initiatorType === 'img' ? 'images' : e.initiatorType === 'script' ? 'scripts'
          : /\/rest\/v1\/|\/functions\/v1\//.test(u.pathname) ? 'backend' : 'other';
      } catch { /* Unparseable resource URLs retain the other category. */ }
      const b = resources[kind] ||= { count: 0, totalMs: 0, maxMs: 0 };
      b.count++; b.totalMs += e.duration; b.maxMs = Math.max(b.maxMs, e.duration);
    }
  }
  for (const type of ['longtask','resource']) try {
    const o = new PerformanceObserver(l => entries(l.getEntries()));
    o.observe({ type, buffered: false }); observers.push(o);
  } catch { /* Unsupported observation types are optional. */ }
  addEventListener('dealsifter:maxxis-performance', receive);
  const timer = setInterval(() => { const n = performance.now(); gap = Math.max(gap, n-previous); previous=n; }, 100);
  const snapshot = () => ({ elapsedMs: performance.now()-start,
    largestTimerGapMs: Math.max(gap, performance.now()-previous), marks, longTasks, resources });
  function stop() {
    clearInterval(timer); clearTimeout(deadline);
    removeEventListener('dealsifter:maxxis-performance', receive);
    observers.forEach(o => { entries(o.takeRecords()); o.disconnect(); });
    return snapshot();
  }
  const deadline = setTimeout(stop, 185000);
  window.__dsLocalCapture = { snapshot, stop };
  return true;
}
