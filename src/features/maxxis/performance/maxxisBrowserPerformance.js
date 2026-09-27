const traces = new Map();
let longTaskObserver = null;

const now = () => typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
const safeMark = (name) => {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') performance.mark(name);
};

function ensureLongTaskObserver() {
  if (longTaskObserver || typeof PerformanceObserver === 'undefined') return;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        traces.forEach((trace) => {
          if (entry.startTime >= trace.startedAt) trace.longTasks.push(entry.duration);
        });
      });
    });
    longTaskObserver.observe({ type: 'longtask', buffered: true });
  } catch {
    longTaskObserver = null;
  }
}

function emit(detail) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('dealsifter:maxxis-performance', { detail }));
  }
}

export function startMaxxisBrowserTrace(id, metadata = {}) {
  const traceId = String(id || `maxxis-${Date.now()}`);
  ensureLongTaskObserver();
  traces.set(traceId, { id: traceId, startedAt: now(), stages: {}, longTasks: [], metadata });
  safeMark(`${traceId}:T0_user_click`);
  emit({ traceId, stage: 'T0_user_click', durationMs: 0, ...metadata });
  return traceId;
}

export function markMaxxisBrowserStage(traceId, stage, details = {}) {
  const trace = traces.get(String(traceId || ''));
  if (!trace) return null;
  const durationMs = Math.round((now() - trace.startedAt) * 10) / 10;
  trace.stages[stage] = durationMs;
  safeMark(`${trace.id}:${stage}`);
  emit({ traceId: trace.id, stage, durationMs, ...details });
  return durationMs;
}

export function finishMaxxisBrowserTrace(traceId, details = {}) {
  const trace = traces.get(String(traceId || ''));
  if (!trace) return null;
  const totalMs = Math.round((now() - trace.startedAt) * 10) / 10;
  const durations = trace.longTasks.map((value) => Math.round(value * 10) / 10);
  const summary = {
    traceId: trace.id,
    stage: 'final_ui_unlock',
    totalMs,
    stages: { ...trace.stages },
    largestLongTaskMs: durations.length ? Math.max(...durations) : 0,
    longTasksOver50Ms: durations.filter((value) => value > 50).length,
    longTasksOver200Ms: durations.filter((value) => value > 200).length,
    longTasksOver1000Ms: durations.filter((value) => value > 1000).length,
    ...details,
  };
  emit(summary);
  traces.delete(trace.id);
  return summary;
}
