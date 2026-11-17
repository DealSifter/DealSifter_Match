const prefix = 'dealsifter:r3:request:';
const validTypes = new Set(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function saveReportCompletionRequest(account, request, storage = globalThis.localStorage) {
  if (!account || !validTypes.has(request.reportType) || !uuid.test(request.propertyId) || !request.id) return false;
  const safe = { id: String(request.id), account: String(account), propertyId: request.propertyId, reportType: request.reportType,
    language: request.language || 'en', expectedRevision: Number(request.expectedRevision || 0), status: request.status || 'NEEDS_INPUT',
    origin: request.origin || 'REPORT', partialAccepted: request.partialAccepted === true, pending: request.pending || [],
    options: { includePublisher: request.options?.includePublisher === true }, updatedAt: new Date().toISOString() };
  try {
    const current = JSON.parse(storage?.getItem(prefix + account) || 'null');
    const rows = Array.isArray(current?.requests) ? current.requests : current?.id ? [current] : [];
    const requests = rows.filter(row => row.account === String(account) && row.id !== safe.id
      && !(row.propertyId === safe.propertyId && row.reportType === safe.reportType));
    storage?.setItem(prefix + account, JSON.stringify({ requests: [...requests, safe].slice(-10) })); return true;
  } catch { return false; }
}
export function readReportCompletionRequest(account, storage = globalThis.localStorage, scope = {}) {
  if (!account) return null;
  try {
    const current = JSON.parse(storage?.getItem(prefix + account) || 'null');
    const rows = (Array.isArray(current?.requests) ? current.requests : current ? [current] : []).filter(row =>
      row?.account === String(account) && validTypes.has(row.reportType) && uuid.test(row.propertyId)
      && row.id && Number.isSafeInteger(row.expectedRevision) && row.expectedRevision >= 0 && row.status !== 'COMPLETE'
      && (!scope.propertyId || row.propertyId === scope.propertyId) && (!scope.reportType || row.reportType === scope.reportType));
    return rows.length === 1 ? rows[0] : null;
  } catch { return null; }
}
export function clearReportCompletionRequest(account, requestId, storage = globalThis.localStorage) {
  try {
    const current = JSON.parse(storage?.getItem(prefix + account) || 'null');
    const rows = Array.isArray(current?.requests) ? current.requests : current?.id ? [current] : [];
    const requests = rows.filter(row => row.account === String(account) && row.id !== requestId);
    if (requests.length) storage?.setItem(prefix + account, JSON.stringify({ requests })); else storage?.removeItem(prefix + account);
  } catch { /* A storage denial must not generate another report. */ }
}
