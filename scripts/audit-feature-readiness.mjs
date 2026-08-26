import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const requireFile = (file) => {
  if (existsSync(resolve(root, file))) passes.push(`file=${file}`);
  else failures.push(`missing=${file}`);
};
const requirePattern = (file, pattern, label) => {
  if (!existsSync(resolve(root, file))) return;
  if (pattern.test(read(file))) passes.push(label);
  else failures.push(`${label} missing in ${file}`);
};

[
  'src/types/database.types.ts',
  'config/database-types.snapshot.json',
  'supabase/functions/_shared/featureFlags.ts',
  'supabase/functions/feature-flags/index.ts',
  'src/domain/analytics/productEvents.js',
  'src/lib/productAnalytics.js',
  'playwright.accessibility.config.js',
  'playwright.mobile.config.js',
  'e2e/tests/readiness/critical.accessibility.spec.js',
  'e2e/tests/readiness/critical.mobile.spec.js',
  'docs/FEATURE_DELIVERY_CHECKLIST.md',
  'docs/adr/0000-template.md',
  'docs/RELEASE_CHECKLIST.md',
  'docs/MAXXIS_AUTONOMY_LEVELS.md',
].forEach(requireFile);

requirePattern('supabase/functions/_shared/featureFlags.ts', /deterministicCohort/, 'deterministic rollout');
requirePattern('supabase/functions/feature-flags/index.ts', /ds_is_current_user_admin/, 'server-authorized production override');
requirePattern('src/lib/productAnalytics.js', /forbiddenKeyPattern/, 'analytics PII denylist');
requirePattern('src/domain/analytics/productEvents.js', /MAXXIS_DEAL_FUNNEL/, 'Maxxis Deal AI deal funnel');
requirePattern('docs/FEATURE_DELIVERY_CHECKLIST.md', /Definition of Done/i, 'Definition of Done');
requirePattern('docs/MAXXIS_AUTONOMY_LEVELS.md', /READ[\s\S]*SUGGEST[\s\S]*PREPARE[\s\S]*CONFIRM[\s\S]*EXECUTE/, 'Maxxis Deal AI autonomy levels');
requirePattern('.github/workflows/quality.yml', /audit:feature-readiness/, 'CI readiness gate');
requirePattern('.github/workflows/quality.yml', /test:e2e:accessibility/, 'CI accessibility gate');
requirePattern('playwright.config.js', /retries:\s*0/, 'zero Playwright retries');

passes.forEach((message) => console.log(`[feature-readiness] PASS ${message}`));
failures.forEach((message) => console.error(`[feature-readiness] FAIL ${message}`));
console.log(`[feature-readiness] summary pass=${passes.length} fail=${failures.length}`);
if (failures.length) process.exit(1);

