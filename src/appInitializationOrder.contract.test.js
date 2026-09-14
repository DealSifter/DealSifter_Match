import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

describe('App initialization order', () => {
  it('declares the Maxxis property context before deriving active entitlements', () => {
    const contextDeclaration = appSource.indexOf('const [maxxisPropertyContextId, setMaxxisPropertyContextId]');
    const entitlementDerivation = appSource.indexOf('const activeMaxxisReportEntitlements = useMemo');

    expect(contextDeclaration).toBeGreaterThan(-1);
    expect(entitlementDerivation).toBeGreaterThan(contextDeclaration);
  });
});
