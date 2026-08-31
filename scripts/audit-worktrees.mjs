import { existsSync } from 'node:fs';
import { exec, git } from './release-safety-lib.mjs';

const raw = git('worktree', 'list', '--porcelain');
const blocks = raw.split(/\r?\n\r?\n/).filter(Boolean);
let hasOrphan = false;
let hasUnknown = false;

for (const block of blocks) {
  const rows = Object.fromEntries(
    block.split(/\r?\n/).map((line) => {
      const separator = line.indexOf(' ');
      return separator < 0 ? [line, true] : [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
  const path = rows.worktree;
  const exists = existsSync(path);
  let status = 'UNKNOWN';
  let dirty = '';
  if (!exists) {
    status = 'ORPHAN_METADATA';
    hasOrphan = true;
  } else {
    try {
      dirty = exec('git', ['-C', path, 'status', '--short', '--untracked-files=no']);
      status = dirty ? 'HAS_UNCOMMITTED_WORK' : 'SAFE';
      if (process.cwd().replaceAll('\\', '/').toLowerCase() === path.toLowerCase()) status = 'ACTIVE';
    } catch {
      status = 'UNKNOWN';
      hasUnknown = true;
    }
  }
  console.log(
    `[worktree] path=${path} branch=${String(rows.branch || '').replace('refs/heads/', '') || 'detached'} ` +
    `head=${rows.HEAD || 'unknown'} status=${status} trackedChanges=${dirty ? dirty.split(/\r?\n/).length : 0}`,
  );
}

const localMain = git('rev-parse', 'main');
const originMain = git('rev-parse', 'origin/main');
const divergence = git('rev-list', '--left-right', '--count', 'origin/main...main').split(/\s+/);
const cherry = git('cherry', 'origin/main', 'main');
console.log(
  `[git-main] local=${localMain} origin=${originMain} ahead=${divergence[1] || 0} ` +
  `behind=${divergence[0] || 0}`,
);
for (const row of cherry.split(/\r?\n/).filter(Boolean)) {
  const [marker, sha] = row.split(/\s+/);
  console.log(`[git-main-commit] sha=${sha} classification=${marker === '-' ? 'ALREADY_IN_ORIGIN_MAIN' : 'USER_WORK_OR_OBSOLETE_REVIEW_REQUIRED'}`);
}

if (hasUnknown) process.exitCode = 1;
if (hasOrphan) console.warn('[worktree] orphan metadata found; inspect the path before git worktree prune.');
