import { parseArg, readJson, requireTarget } from './release-safety-lib.mjs';

const target = requireTarget();
const operation = parseArg('operation') || 'read-only';
const targets = readJson('config/release-targets.json');
const contract = targets[target];

if (!contract) throw new Error(`Unknown release target: ${target}`);

if (target === 'production' && operation === 'destructive-e2e') {
  throw new Error('Blocked: destructive E2E is prohibited in production.');
}

const mutatingOperations = new Set(['deploy', 'migration', 'secrets', 'destructive']);
const mode = mutatingOperations.has(operation) || operation === 'destructive-e2e' ? 'MUTATING' : 'READ_ONLY';
if (target === 'production' && mutatingOperations.has(operation)) {
  const confirmation = parseArg('confirm-production') || process.env.PRODUCTION_CONFIRMATION || '';
  if (confirmation !== contract.supabaseProjectRef) {
    throw new Error(
      `Blocked production ${operation}: explicit confirmation must equal the production project ref.`,
    );
  }
}

console.log(`TARGET: ${target.toUpperCase()}`);
console.log(`MODE: ${mode}`);
console.log(
  `[release-guard] target=${target} operation=${operation} ` +
  `destructiveE2E=${contract.destructiveE2EAllowed ? 'allowed' : 'blocked'} status=PASS`,
);
