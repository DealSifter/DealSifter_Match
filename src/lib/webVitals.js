import { onCLS, onINP, onLCP } from 'web-vitals';
import { captureWebVital } from './observability';

export function startWebVitals() {
  const options = { reportAllChanges: false };
  onCLS(captureWebVital, options);
  onINP(captureWebVital, options);
  onLCP(captureWebVital, options);
}
