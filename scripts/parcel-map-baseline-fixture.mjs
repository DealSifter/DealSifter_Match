import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

// Historical QA only, never included in the application or committed as duplicated business logic.
const baseline = '9dbedf145bbe775248cc18e0a8801fc3209f1c71';
const source = execFileSync('git', ['show', `${baseline}:src/pages/MapView.jsx`], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
await mkdir('.tmp-codex', { recursive: true });
await writeFile('.tmp-codex/parcel-map-baseline.jsx', source.replace(/(['"])\.\.\//g, '$1/src/'));
console.log('Historical MapView QA fixture generated (ignored, local only).');
