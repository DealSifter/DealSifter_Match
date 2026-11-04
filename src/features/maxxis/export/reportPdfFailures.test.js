import { describe, expect, it } from 'vitest';
import { canRenderBasicWithoutWorker, propertyReleaseFailureMessage, reportPdfFailureCode } from './reportPdfFailures';

describe('L1 real-renderer compatibility and safe failure details', () => {
  it.each(['REPORT_PDF_WORKER_UNAVAILABLE', 'REPORT_PDF_WORKER_FAILED'])('permits the same L1 renderer after %s', code => {
    expect(canRenderBasicWithoutWorker('PROPERTY_RELEASE', new Error(code))).toBe(true);
    expect(canRenderBasicWithoutWorker('MAXXIS_ANALYSIS', new Error(code))).toBe(false);
    expect(canRenderBasicWithoutWorker('DEAL_INTELLIGENCE', new Error(code))).toBe(false);
  });
  it.each(['REPORT_PDF_WORKER_TIMEOUT', 'REPORT_PDF_RENDER_FAILED', 'REPORT_REFERENCE_BASIC_OVERFLOW'])('preserves %s rather than rerunning invalid or stuck work', code => {
    expect(canRenderBasicWithoutWorker('PROPERTY_RELEASE', new Error(code))).toBe(false);
  });
  it('retains a known error code but never exposes private exception content', () => {
    expect(reportPdfFailureCode(new Error('REPORT_TEXT_OUTSIDE_BOUNDS:private listing text'))).toBe('REPORT_TEXT_OUTSIDE_BOUNDS');
    expect(reportPdfFailureCode('private@example.invalid')).toBe('REPORT_PDF_RENDER_FAILED');
    expect(propertyReleaseFailureMessage(new Error('private@example.invalid'), 'pt')).not.toContain('private@example.invalid');
  });
  it.each(['en', 'pt', 'es'])('explains over-cap content and includes a safe diagnostic in %s', language => {
    const message = propertyReleaseFailureMessage(new Error('REPORT_REFERENCE_BASIC_OVERFLOW'), language);
    expect(message).toContain('[REPORT_REFERENCE_BASIC_OVERFLOW]');
    expect(message).not.toContain('undefined');
  });
});
