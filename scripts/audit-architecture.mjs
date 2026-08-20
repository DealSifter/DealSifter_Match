import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const srcRoot = resolve(root, 'src');
const budgets = JSON.parse(readFileSync(resolve(root, 'config/architecture-budgets.json'), 'utf8'));
const extensions = ['.js', '.jsx', '.ts', '.tsx'];
const files = [];

function visit(directory) {
  for (const name of readdirSync(directory)) {
    const fullPath = resolve(directory, name);
    if (statSync(fullPath).isDirectory()) visit(fullPath);
    else if (extensions.some((extension) => name.endsWith(extension))) files.push(fullPath);
  }
}

function projectPath(fullPath) {
  return relative(root, fullPath).split(sep).join('/');
}

function resolveImport(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) || null;
}

visit(srcRoot);
const fileSet = new Set(files);
const graph = new Map();
const violations = [];
const directSupabase = [];
const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const sourcePath = projectPath(file);
  const dependencies = [];
  for (const match of source.matchAll(importPattern)) {
    const target = resolveImport(file, match[1]);
    if (!target || !fileSet.has(target)) continue;
    dependencies.push(target);
    const targetPath = projectPath(target);
    if (sourcePath.startsWith('src/services/') && targetPath.startsWith('src/pages/')) {
      violations.push(`${sourcePath} -> ${targetPath} (service cannot import page)`);
    }
    if (sourcePath.startsWith('src/domain/') && /src\/(pages|components|hooks|services)\//.test(targetPath)) {
      violations.push(`${sourcePath} -> ${targetPath} (domain must remain framework-independent)`);
    }
    if (sourcePath.startsWith('src/hooks/') && targetPath.startsWith('src/pages/')) {
      violations.push(`${sourcePath} -> ${targetPath} (hook cannot import page)`);
    }
  }
  graph.set(file, [...new Set(dependencies)]);
  const isCentralSupabaseGateway = sourcePath === 'src/lib/supabaseClient.js';
  if (!isCentralSupabaseGateway && /\bsupabase\.(?:from|rpc|channel|auth|functions)\b/.test(source)) directSupabase.push(sourcePath);
}

const cycles = new Set();
const visiting = new Set();
const visited = new Set();
const stack = [];

function canonicalCycle(paths) {
  const names = paths.map(projectPath);
  const variants = names.map((_, index) => [...names.slice(index), ...names.slice(0, index)].join(' -> '));
  return variants.sort()[0];
}

function detect(file) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    if (start >= 0) cycles.add(canonicalCycle(stack.slice(start)));
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  stack.push(file);
  for (const dependency of graph.get(file) || []) detect(dependency);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
}

for (const file of files) detect(file);

let warnings = 0;
let failures = 0;
for (const [file, budget] of Object.entries(budgets.majorFiles || {})) {
  const lineCount = readFileSync(resolve(root, file), 'utf8').split(/\r?\n/).length;
  if (lineCount > budget.fail) {
    failures += 1;
    console.error(`[architecture] FAIL ${file} lines=${lineCount} limit=${budget.fail}`);
  } else if (lineCount > budget.warning) {
    warnings += 1;
    console.warn(`[architecture] WARNING ${file} lines=${lineCount} target=${budget.warning}`);
  } else {
    console.log(`[architecture] PASS ${file} lines=${lineCount}`);
  }
}

for (const cycle of cycles) {
  failures += 1;
  console.error(`[architecture] FAIL cycle=${cycle}`);
}
for (const violation of violations) {
  failures += 1;
  console.error(`[architecture] FAIL boundary=${violation}`);
}
if (directSupabase.length > Number(budgets.maxDirectSupabaseModules || 0)) {
  failures += 1;
  console.error(`[architecture] FAIL direct-supabase=${directSupabase.length}`);
} else {
  console.log(`[architecture] PASS cycles=${cycles.size} boundaries=${violations.length} direct-supabase=${directSupabase.length}`);
}
console.log(`[architecture] summary warning=${warnings} fail=${failures} baseline=${budgets.baseline}`);
if (failures) process.exit(1);
