import { renderPreparedReportPdf } from './reportPdfCore';
import { reportPdfFailureCode } from './reportPdfFailures';

// Receives only the authorized display model and already-prepared raster data.
// It cannot acquire property evidence or translate/report to an external service.
self.onmessage = async ({ data }) => {
  const { id, input } = data;
  try {
    const result = await renderPreparedReportPdf(input);
    self.postMessage({ id, result }, result.document?.binary ? [result.document.binary.buffer] : []);
  } catch (error) {
    // Do not send property text, contacts, or arbitrary error messages across this boundary.
    self.postMessage({ id, error: reportPdfFailureCode(error) });
  }
};
