export function normalizeReportEmailPreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(['to', 'cc', 'bcc'].map(field => {
    const text = typeof value[field] === 'string' ? value[field].trim() : '';
    return [field, /[\r\n]/.test(text) || text.length > 1000 ? '' : text];
  }));
}
