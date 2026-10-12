import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const root = process.cwd();
const baseline = process.env.P0_BASELINE_SHA || 'd9ea801ffd1c57a85e418acddb0c198be744a02c';
const artifactDir = process.env.P0_QA_OUTPUT_DIR || 'qa/p0-canonical-truth';
const clean = path => relative(root, path).replaceAll('\\', '/');
// Caller supplies git diff + untracked paths, avoiding nested process permissions on Windows.
if (!process.env.P0_CHANGED_MODULES) throw new Error('P0_CHANGED_MODULES must contain the git-derived changed paths');
const changed = process.env.P0_CHANGED_MODULES.split(';');
const shared = [...new Set(changed)].filter(path => path.startsWith('supabase/functions/_shared/') && /\.[cm]?[jt]s$/.test(path) && !/\.test\./.test(path));
const direct = [...new Set(changed)].filter(path => path.startsWith('supabase/functions/') && !path.startsWith('supabase/functions/_shared/') && /\.[cm]?[jt]s$/.test(path) && !/\.test\./.test(path));
const dependencies = new Map();
const unresolved = new Set();
function imports(file) {
  if (dependencies.has(file)) return dependencies.get(file);
  const result = [];
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
    const specifier = match[1]; if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier);
    const found = [target, target + '.ts', target + '.js', resolve(target, 'index.ts')].find(path => existsSync(path));
    if (!found) { unresolved.add(`${clean(file)} -> ${specifier}`); continue; }
    if (/\.[cm]?[jt]s$/.test(found)) result.push(found);
  }
  dependencies.set(file, result); return result;
}
function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen; seen.add(file);
  for (const imported of imports(file)) closure(imported, seen);
  return seen;
}
const affected = [];
for (const entry of readdirSync(resolve(root, 'supabase/functions'), { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
  const main = resolve(root, 'supabase/functions', entry.name, 'index.ts'); if (!existsSync(main)) continue;
  const graph = closure(main);
  const matches = [...shared, ...direct].filter(path => graph.has(resolve(root, path)));
  if (matches.length) affected.push({ function: entry.name, changedDependencies: matches });
}
const artifact = { baseline, method: 'transitive local import graph including re-exports and dynamic imports',
  changedSharedModules: shared.sort(), changedFunctionModules: direct.sort(), affectedFunctions: affected.sort((a, b) => a.function.localeCompare(b.function)),
  unresolvedLocalImports: [...unresolved].sort() };
mkdirSync(resolve(root, artifactDir), { recursive: true });
writeFileSync(resolve(root, artifactDir, 'backend-dependency-closure.json'), JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify(artifact));
if (unresolved.size) process.exitCode = 1;
