import { spawnSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
const varianceCheck = process.argv.includes('--variance-check');
const stages = [
  ['lint', ['run', 'lint:maxxis:acceptance']],
  ['types', ['run', 'audit:types']],
  ['tests', ['run', 'test:maxxis:acceptance:contract']],
  ['build', ['run', 'build']],
  ['real-runtime', ['run', varianceCheck ? 'test:heartbeat:staging:variance' : 'test:heartbeat:staging']],
];

if (!npmCli) {
  console.error('[maxxis-release-gate] status=FAIL classification=ENVIRONMENT reason=NPM_EXEC_PATH_MISSING');
  process.exit(1);
}

for (const [name, args] of stages) {
  console.log(`[maxxis-release-gate] stage=${name} status=RUNNING`);
  const result = spawnSync(process.execPath, [npmCli, ...args], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(
      `[maxxis-release-gate] stage=${name} status=FAIL ` +
      `exit=${result.status ?? 'SPAWN_ERROR'} reason=${result.error?.code || 'STAGE_FAILED'}`,
    );
    process.exit(result.status || 1);
  }
  console.log(`[maxxis-release-gate] stage=${name} status=PASS`);
}

console.log('[maxxis-release-gate] status=PASS authority=REAL_RUNTIME_STAGING');
