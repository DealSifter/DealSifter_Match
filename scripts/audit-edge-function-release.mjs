import { exec, git, localFunctionInventory, parseFunctionRows, readJson, requireTarget } from './release-safety-lib.mjs';

const target = requireTarget();
const targets = readJson('config/release-targets.json');
const projectRef = targets[target].supabaseProjectRef;
const local = localFunctionInventory();
const expected = readJson('supabase/functions-manifest.json').functions.map((row) => row.name).sort();
const receipts = readJson('config/function-deployments.json');

let remote = [];
try {
  remote = parseFunctionRows(exec('supabase', ['functions', 'list', '--project-ref', projectRef]));
} catch (error) {
  console.error(`[function-parity] target=${target} projectRef=${projectRef} status=UNKNOWN reason=REMOTE_LIST_FAILED`);
  process.exit(2);
}

let unknown = 0;
let possiblyStale = 0;
let confirmedStale = 0;
for (const item of local) {
  const remoteRow = remote.find((row) => row.name === item.name);
  const receipt = receipts[target]?.[item.name];
  let status = 'UNKNOWN';
  let latestLocalCommit = '';
  try {
    const paths = [`supabase/functions/${item.name}`];
    paths.push(...item.sharedFiles.map((path) => `supabase/functions/${path}`));
    latestLocalCommit = git('log', '-1', '--format=%cI', '--', ...paths);
  } catch {
    latestLocalCommit = '';
  }
  const receiptMatches = Boolean(
    remoteRow && receipt &&
    receipt.combinedHash === item.combinedHash &&
    Number(receipt.remoteVersion) === Number(remoteRow.version) &&
    receipt.remoteUpdatedAt === remoteRow.updatedAt &&
    receipt.projectRef === projectRef,
  );
  if (receiptMatches) {
    status = 'IN_SYNC';
  } else if (!remoteRow) {
    status = 'CONFIRMED_STALE';
    confirmedStale += 1;
  } else if (latestLocalCommit && remoteRow.updatedAt) {
    const localTime = Date.parse(latestLocalCommit);
    const remoteTime = Date.parse(`${remoteRow.updatedAt.replace(' ', 'T')}Z`);
    if (Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime > remoteTime) {
      status = 'POSSIBLY_STALE';
      possiblyStale += 1;
    } else {
      unknown += 1;
    }
  } else {
    unknown += 1;
  }
  console.log(
    `[function-parity] target=${target} name=${item.name} hash=${item.combinedHash} ` +
    `usesShared=${item.usesShared} remoteVersion=${remoteRow?.version || 'missing'} ` +
    `deployedAt=${remoteRow?.updatedAt || 'missing'} evidence=${receiptMatches ? 'CONTROLLED_DEPLOY_RECEIPT' : 'UNVERIFIED'} status=${status}`,
  );
}

const remoteNames = remote.map((row) => row.name).sort();
const missing = expected.filter((name) => !remoteNames.includes(name));
const unexpected = remoteNames.filter((name) => !expected.includes(name));
console.log(
  `[function-parity] target=${target} local=${local.length} remote=${remote.length} expected=${expected.length} ` +
  `possiblyStale=${possiblyStale} unknown=${unknown} missing=${missing.length} unexpected=${unexpected.length}`,
);
if (missing.length || unexpected.length || confirmedStale) process.exitCode = 1;
