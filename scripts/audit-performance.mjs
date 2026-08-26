import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const budgets = JSON.parse(read('config/performance-budgets.json'));
const failures = [];
const warnings = [];
const passes = [];

const pass = (message) => passes.push(message);
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);
const requireSource = (source, pattern, message) => (pattern.test(source) ? pass(message) : fail(message));

if (!String(budgets.version || '').startsWith('baseline-')) fail('budgets must have a baseline version');
else pass(`budgets=${budgets.version}`);

const deterministic = budgets.deterministic || {};
for (const [name, value] of Object.entries(deterministic)) {
  if (!Number.isFinite(value) || value <= 0) fail(`invalid deterministic budget: ${name}`);
}

const migration = read('supabase/migrations/20260815000004_performance_search_paths.sql');
const serviceOptimization = read('supabase/migrations/20260815000005_optimize_batched_service_search.sql');
const propertyOptimization = read('supabase/migrations/20260815000006_optimize_property_search_plan.sql');
requireSource(migration, /create index if not exists idx_services_public_created/i, 'published service access-path index');
requireSource(migration, /create index if not exists idx_properties_public_state_created/i, 'published property state access-path index');
requireSource(migration, /create or replace function public\.ds_search_public_services/i, 'bounded service-search RPC');
requireSource(migration, /grant execute[^;]+to authenticated, service_role/is, 'service-search RPC grant boundary');
requireSource(serviceOptimization, /cross join lateral/i, 'batched service categories use bounded lateral scans');
requireSource(serviceOptimization, /limit least\(greatest\(coalesce\(p_limit_per_category/i, 'per-category work is bounded before aggregation');
requireSource(propertyOptimization, /return query execute v_sql using/i, 'property search uses parameterized active predicates');
if (/v_sql\s*:=\s*v_sql\s*\|\|[^;]*p_(?:city|state|zip|property_type|objective)/i.test(propertyOptimization)) {
  fail('property search interpolates a user value into dynamic SQL');
} else {
  pass('property search dynamic SQL keeps user values parameterized');
}

const serviceSearch = read('supabase/functions/_shared/maxxis/searchServices.ts');
requireSource(serviceSearch, /\.rpc\('ds_search_public_services'/, 'service filters execute in PostgreSQL');
requireSource(serviceSearch, /searchServicesBatch/, 'service matching supports batching');
if (/FETCH_LIMIT\s*=\s*250|\.from\('services'\)/.test(serviceSearch)) fail('unbounded/in-memory service fetch path reintroduced');
else pass('legacy 250-row service fetch absent');

const serviceMatching = read('supabase/functions/_shared/maxxis/findServicesForPropertyNeeds.ts');
requireSource(serviceMatching, /searchServicesBatch\(primaryFilters/, 'property service needs use one primary batch');
if (/for \(const need[\s\S]{0,800}await serviceSearch/.test(serviceMatching)) {
  warn('legacy injected-search loop remains for isolated compatibility tests; production path is batched');
}

const copilotRules = read('supabase/functions/_shared/maxxis/dealCopilotContextRules.ts');
const queryCount = Number(copilotRules.match(/CORE_OVERVIEW_QUERY_COUNT\s*=\s*(\d+)/)?.[1] || Infinity) + 2;
if (queryCount <= deterministic.deal_copilot_query_count) pass(`deal-copilot-query-count<=${deterministic.deal_copilot_query_count}`);
else fail(`deal copilot maximum query count ${queryCount} exceeds ${deterministic.deal_copilot_query_count}`);

const executionBudget = read('supabase/functions/_shared/maxxisExecutionBudget.ts');
const valueOf = (name) => Number(executionBudget.match(new RegExp(`${name}:\\s*(\\d[\\d_]*)`))?.[1]?.replaceAll('_', '') || Infinity);
if (valueOf('maxToolRounds') <= deterministic.maxxis_tool_rounds) pass('Maxxis Deal AI tool rounds bounded');
else fail('Maxxis Deal AI tool rounds exceed budget');
if (valueOf('maxHistoryItems') <= deterministic.maxxis_history_items) pass('Maxxis Deal AI history count bounded');
else fail('Maxxis Deal AI history count exceeds budget');
if (valueOf('maxToolPayloadChars') <= deterministic.maxxis_tool_payload_chars) pass('Maxxis Deal AI tool payload bounded');
else fail('Maxxis Deal AI tool payload exceeds budget');

const chat = read('src/hooks/useChatRealtime.js');
const chatPageSize = Number(chat.match(/CHAT_PAGE_SIZE\s*=\s*(\d+)/)?.[1] || Infinity);
if (chatPageSize <= deterministic.chat_page_size && chat.includes('.limit(CHAT_PAGE_SIZE)')) pass('chat hydration/pagination bounded');
else fail('chat history limit missing or above budget');

const feedActions = read('src/services/feedActionService.js');
const feedBaseLimit = Number(feedActions.match(/MAX_FEED_ACTION_ROWS\s*=\s*(\d+)/)?.[1] || Infinity);
if (feedBaseLimit * 3 <= deterministic.feed_action_row_limit) pass('feed action hydration bounded');
else fail('feed action hydration exceeds budget');

const app = read('src/App.jsx');
requireSource(app, /feedActionFetchRef\.current/, 'feed action hydration uses single-flight dedupe');
requireSource(app, /feedActionActiveUserRef\.current !== requestUserId/, 'late cross-user fetch responses are discarded');
const realtime = read('src/lib/realtimeLifecycle.js');
requireSource(realtime, /channel && channel !== nextChannel/, 'replacement realtime channels are removed');

const maxxisChat = read('supabase/functions/maxxis-chat/index.ts');
const logger = read('supabase/functions/_shared/maxxis/logger.ts');
for (const metric of ['provider_duration_ms', 'db_duration_ms', 'tool_duration_ms', 'system_prompt_bytes', 'tool_payload_bytes']) {
  if (maxxisChat.includes(metric) && logger.includes(metric)) pass(`Maxxis Deal AI metric=${metric}`);
  else fail(`Maxxis Deal AI metric missing: ${metric}`);
}

const workflow = read('.github/workflows/quality.yml');
requireSource(workflow, /node scripts\/audit-performance\.mjs/, 'CI deterministic performance gate');

const assetsDir = resolve(process.cwd(), 'dist', 'assets');
if (existsSync(assetsDir)) {
  const chunks = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ name, bytes: statSync(resolve(assetsDir, name)).size }))
    .sort((left, right) => right.bytes - left.bytes);
  const largest = chunks[0] || { name: 'none', bytes: 0 };
  if (largest.bytes <= deterministic.largest_javascript_chunk_bytes) pass(`largest-chunk=${largest.name}:${largest.bytes}`);
  else fail(`largest chunk ${largest.name}=${largest.bytes} exceeds ${deterministic.largest_javascript_chunk_bytes}`);
} else {
  warn('dist/assets absent; bundle budget will run after build');
}

passes.forEach((message) => console.log(`[performance] PASS ${message}`));
warnings.forEach((message) => console.warn(`[performance] WARNING ${message}`));
failures.forEach((message) => console.error(`[performance] FAIL ${message}`));
console.log(`[performance] summary pass=${passes.length} warning=${warnings.length} fail=${failures.length}`);
if (failures.length) process.exit(1);
