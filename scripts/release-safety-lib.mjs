import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

export const root = process.cwd();

export function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

export function exec(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

export function git(...args) {
  return exec('git', args);
}

export function parseArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || '';
}

export function requireTarget() {
  const target = parseArg('target') || process.env.TARGET_ENV || '';
  if (!['staging', 'production'].includes(target)) {
    throw new Error('Explicit target required: --target=staging or --target=production.');
  }
  return target;
}

export function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const result = [];
  for (const name of readdirSync(directory).sort()) {
    const path = resolve(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...listFiles(path));
    else if (stat.isFile()) result.push(path);
  }
  return result;
}

export function hashFiles(files, base = root) {
  const hash = createHash('sha256');
  for (const path of [...files].sort()) {
    hash.update(relative(base, path).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function localFunctionInventory() {
  const functionsRoot = resolve(root, 'supabase/functions');
  const sharedRoot = resolve(functionsRoot, '_shared');
  return readdirSync(functionsRoot)
    .filter((name) => name !== '_shared')
    .filter((name) => statSync(resolve(functionsRoot, name)).isDirectory())
    .sort()
    .map((name) => {
      const directory = resolve(functionsRoot, name);
      const files = listFiles(directory);
      const queue = [...files];
      const visited = new Set();
      const importedSharedFiles = new Set();
      while (queue.length) {
        const path = queue.shift();
        if (!path || visited.has(path)) continue;
        visited.add(path);
        const source = readFileSync(path, 'utf8');
        const imports = source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g);
        for (const match of imports) {
          const specifier = match[1];
          if (!specifier.startsWith('.')) continue;
          const unresolved = resolve(dirname(path), specifier);
          const candidates = [unresolved, `${unresolved}.ts`, `${unresolved}.js`, resolve(unresolved, 'index.ts')];
          const imported = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
          if (!imported || !(imported === sharedRoot || imported.startsWith(`${sharedRoot}${sep}`))) continue;
          if (!importedSharedFiles.has(imported)) {
            importedSharedFiles.add(imported);
            queue.push(imported);
          }
        }
      }
      const sharedPaths = [...importedSharedFiles].sort();
      const usesShared = sharedPaths.length > 0;
      const sourceHash = hashFiles(files, functionsRoot);
      const sharedHash = usesShared ? hashFiles(sharedPaths, functionsRoot) : null;
      const combinedHash = createHash('sha256')
        .update(sourceHash)
        .update(sharedHash || '')
        .digest('hex');
      return {
        name,
        entrypoint: `supabase/functions/${name}/index.ts`,
        sourceHash,
        usesShared,
        sharedHash,
        sharedFiles: sharedPaths.map((path) => relative(functionsRoot, path).replaceAll('\\', '/')),
        combinedHash,
      };
    });
}

export function localMigrationInventory() {
  const directory = resolve(root, 'supabase/migrations');
  const files = readdirSync(directory)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort();
  return {
    count: files.length,
    head: files.at(-1)?.replace(/\.sql$/i, '') || '',
    versions: files.map((name) => name.match(/^\d+/)?.[0]).filter(Boolean),
  };
}

export function frontendSourceHash() {
  const paths = [
    resolve(root, 'src'),
    resolve(root, 'public'),
    resolve(root, 'index.html'),
    resolve(root, 'package.json'),
    resolve(root, 'package-lock.json'),
    resolve(root, 'vite.config.js'),
    resolve(root, 'vercel.json'),
  ];
  const files = paths.flatMap((path) => {
    if (!existsSync(path)) return [];
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
  return hashFiles(files, root);
}

export function parseFunctionRows(output) {
  return String(output || '')
    .split(/\r?\n/)
    .filter((line) => /^\s*[0-9a-f-]{36}\s*\|/i.test(line))
    .map((line) => {
      const columns = line.split('|').map((value) => value.trim());
      return {
        id: columns[0],
        name: columns[2] || columns[1],
        status: columns[3],
        version: Number(columns[4] || 0),
        updatedAt: columns[5],
      };
    });
}
