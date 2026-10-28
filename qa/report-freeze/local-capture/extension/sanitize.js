const stages = new Set(['T0_user_click', 'pdf_generation_start', 'pdf_assets_ready',
  'pdf_assembly_complete', 'pdf_generation_complete', 'pdf_blob_created',
  'pdf_artifact_ready', 'pdf_download_dispatched', 'final_ui_unlock']);
const numeric = ['durationMs', 'totalMs', 'preparationMs', 'moduleMs', 'pageRenderMs',
  'assemblyMs', 'pageCount', 'bytes', 'largestLongTaskMs', 'longTasksOver50Ms',
  'longTasksOver200Ms', 'longTasksOver1000Ms'];
const knownFunctions = new Set(['drawStrictReportPdf', 'drawReferenceReportPdf',
  'renderMaxxisReportPdf', 'renderMaxxisReportDocument', 'prepareReportAssets',
  'prepareReportMaps', 'prepareReportNarrativePresentation', 'localizePresentationText',
  'generateReleasePdf', 'handleConfirmEmailExport', 'handleExportAnalysisPdf',
  '(root)', '(idle)', '(program)', '(garbage collector)']);
const num = n => Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
export function safePage(raw = {}) {
  const out = { elapsedMs: num(raw.elapsedMs), largestTimerGapMs: num(raw.largestTimerGapMs),
    marks: [], longTasks: [], resources: {} };
  for (const m of (Array.isArray(raw.marks) ? raw.marks : []).slice(0, 300)) {
    if (!stages.has(m.stage)) continue;
    const item = { stage: m.stage, atMs: num(m.atMs) };
    for (const k of numeric) if (Number.isFinite(m[k])) item[k] = num(m[k]);
    out.marks.push(item);
  }
  for (const t of (Array.isArray(raw.longTasks) ? raw.longTasks : []).slice(0, 500))
    out.longTasks.push({ atMs: num(t.atMs), durationMs: num(t.durationMs) });
  for (const k of ['translation', 'images', 'map_tiles', 'scripts', 'backend', 'other']) {
    const b = raw.resources?.[k];
    if (b) out.resources[k] = { count: num(b.count), totalMs: num(b.totalMs), maxMs: num(b.maxMs) };
  }
  return out;
}
function asset(raw) {
  // Only public compiled application asset filenames. Never retain origin, query, path or inline script text.
  try {
    const u = new URL(raw);
    const file = u.pathname.split('/').pop();
    return u.origin === 'https://dealsiftermatch.vercel.app' && u.pathname.startsWith('/assets/') &&
      /^(?:index|pdf-vendor|maxxisReportPdf|referenceReportPdf|strictReportPdf|Maxxis[A-Za-z]+|MatchesPortfolio|report[A-Za-z]+|vendor|react-vendor|map-vendor)-[A-Za-z0-9_-]{6,20}\.js$/.test(file)
      ? file : '[source omitted]';
  } catch { return '[source omitted]'; }
}
export function safeProfile(profile = {}) {
  const nodes = Array.isArray(profile.nodes) ? profile.nodes : [];
  const times = new Map(), parents = new Map();
  const samples = Array.isArray(profile.samples) ? profile.samples : [];
  const deltas = Array.isArray(profile.timeDeltas) ? profile.timeDeltas : [];
  nodes.forEach(n => (n.children || []).forEach(c => parents.set(c, n.id)));
  samples.forEach((id, i) => times.set(id, (times.get(id) || 0) + num(deltas[i]) / 1000));
  const inclusive = new Map();
  for (const [id, duration] of times) {
    let p = id; const seen = new Set();
    while (p !== undefined && !seen.has(p)) {
      seen.add(p); inclusive.set(p, (inclusive.get(p) || 0) + duration); p = parents.get(p);
    }
  }
  return { durationMs: num((profile.endTime - profile.startTime) / 1000), sampleCount: samples.length,
    samplingIntervalUs: 10000, functions: nodes.map(n => ({
      function: knownFunctions.has(n.callFrame?.functionName) ? n.callFrame.functionName : '[function omitted]',
      asset: asset(n.callFrame?.url), line: num((n.callFrame?.lineNumber ?? -1) + 1),
      column: num((n.callFrame?.columnNumber ?? -1) + 1),
      selfMs: num(times.get(n.id) || 0), inclusiveMs: num(inclusive.get(n.id) || 0),
    })).filter(n => n.inclusiveMs > 0).sort((a,b) => b.selfMs - a.selfMs).slice(0, 100) };
}
