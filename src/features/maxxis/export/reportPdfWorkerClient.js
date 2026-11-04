export const REPORT_PDF_WORKER_TIMEOUT_MS = 45000;
const IDLE_MS = 30000;
let worker = null;
let idleTimer = null;
let sequence = 0;
let queue = Promise.resolve();

function closeWorker() {
  clearTimeout(idleTimer);
  worker?.terminate();
  worker = null;
}

/** One active PDF job bounds memory and avoids competing full-resolution encoders. */
export function renderReportPdfInWorker(input) {
  const job = queue.then(() => new Promise((resolve, reject) => {
    clearTimeout(idleTimer);
    try {
      worker ||= new Worker(new URL('./reportPdf.worker.js', import.meta.url), { type: 'module', name: 'maxxis-report-pdf' });
    } catch {
      closeWorker();
      reject(new Error('REPORT_PDF_WORKER_UNAVAILABLE'));
      return;
    }
    const id = ++sequence;
    const current = worker;
    const cleanup = () => {
      clearTimeout(timeout);
      current.onmessage = null;
      current.onerror = null;
      current.onmessageerror = null;
    };
    const fail = code => { cleanup(); closeWorker(); reject(new Error(code)); };
    const timeout = setTimeout(() => fail('REPORT_PDF_WORKER_TIMEOUT'), REPORT_PDF_WORKER_TIMEOUT_MS);
    current.onerror = () => fail('REPORT_PDF_WORKER_FAILED');
    current.onmessageerror = () => fail('REPORT_PDF_WORKER_MESSAGE_FAILED');
    current.onmessage = ({ data }) => {
      if (data?.id !== id) return;
      cleanup();
      if (data.error) { closeWorker(); reject(new Error('REPORT_PDF_RENDER_FAILED')); return; }
      idleTimer = setTimeout(closeWorker, IDLE_MS);
      resolve(data.result);
    };
    try { current.postMessage({ id, input }); } catch { fail('REPORT_PDF_WORKER_MESSAGE_FAILED'); }
  }));
  queue = job.catch(() => {});
  return job;
}
