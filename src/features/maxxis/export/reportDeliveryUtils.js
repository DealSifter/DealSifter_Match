export function buildReportMailtoUrl(copy) {
  return `mailto:?subject=${encodeURIComponent(copy.subject)}&body=${encodeURIComponent(copy.body)}`;
}
