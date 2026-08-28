import fs from 'node:fs';

const fail = (message) => {
  console.error(`[observability] ${message}`);
  process.exitCode = 1;
};

const read = (path) => fs.readFileSync(path, 'utf8');
const config = JSON.parse(read('config/observability.json'));
const requiredSlis = ['AUTH', 'FEED', 'MAXXIS', 'STRIPE', 'UNLOCK', 'MESSAGING'];
const requiredAlerts = [
  'elevated_5xx',
  'maxxis_failure_rate',
  'gemini_timeout_quota',
  'stripe_webhook_failure',
  'unlock_transaction_failure',
  'auth_failure_anomaly',
  'deployment_health_regression',
];

if (!String(config.version || '').startsWith('baseline-')) fail('SLO config must identify an initial baseline.');
for (const id of requiredSlis) {
  const sli = config.slis?.find((item) => item.id === id);
  if (!sli) fail(`Missing SLI: ${id}`);
  else if (!(sli.success_rate_percent > 0) || !(sli.p95_latency_ms > 0) || !(sli.max_error_rate_percent >= 0)) fail(`Invalid SLI thresholds: ${id}`);
}
for (const id of requiredAlerts) {
  const alert = config.alerts?.find((item) => item.id === id);
  if (!alert) fail(`Missing alert policy: ${id}`);
  else if (!['CRITICAL', 'HIGH', 'WARNING'].includes(alert.severity) || !(alert.window_minutes > 0) || !(alert.frequency_minutes > 0)) fail(`Invalid alert policy: ${id}`);
}
if (config.sampling?.session_replay !== 0) fail('Session Replay must remain disabled for this privacy baseline.');

const frontend = read('src/lib/observability.js');
const vite = read('vite.config.js');
const edge = read('supabase/functions/_shared/observability.ts');
const maxxisLogger = read('supabase/functions/_shared/maxxis/logger.ts');
const workflow = read('.github/workflows/observability-smoke.yml');
const sourceCorpus = [read('src/lib/observability.js'), read('vite.config.js')].join('\n');

if (!frontend.includes('sendDefaultPii: false') || !frontend.includes('beforeSend: scrubTelemetryEvent')) fail('Frontend PII boundary is not enforced.');
if (!frontend.includes('browserTracingIntegration') || !frontend.includes('captureWebVital')) fail('Frontend performance/Web Vitals instrumentation is incomplete.');
if (!vite.includes("sourcemap: sentryUploadEnabled ? 'hidden' : false") || !vite.includes('filesToDeleteAfterUpload')) fail('Private Sentry sourcemap strategy is incomplete.');
if (!edge.includes("signal: 'operational_event'") || !edge.includes('request_id') || !edge.includes('error_category')) fail('Edge structured logging schema is incomplete.');
for (const metric of ['gemini_request_count', 'gemini_success_count', 'gemini_failure_count', 'fallback_count', 'degraded_count', 'tool_selection_count', 'tool_success_count', 'tool_failure_count', 'second_pass_success', 'response_duration_ms']) {
  if (!maxxisLogger.includes(metric)) fail(`Missing Maxxis operational metric: ${metric}`);
}
if (!workflow.includes('schedule:') || !workflow.includes('force_alert')) fail('Uptime and controlled alert workflow is incomplete.');
if (/VITE_(?:SUPABASE_SERVICE_ROLE|STRIPE_SECRET|SENTRY_AUTH_TOKEN)/.test(sourceCorpus)) fail('A server-side secret is exposed through a VITE_ name.');

if (!process.exitCode) {
  console.log(`[observability] slis=${config.slis.length} alerts=${config.alerts.length} replay=off sourcemaps=private status=ok`);
}
