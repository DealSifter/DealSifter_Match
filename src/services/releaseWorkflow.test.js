import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('release workflow gates', () => {
  it('blocks pre-commit when lint-staged fails', () => {
    const hook = readRepoFile('.husky/pre-commit');
    expect(hook).toContain('npx --no-install lint-staged');
    expect(hook).not.toContain('|| true');
    expect(hook).not.toContain('husky.sh');
  });

  it('requires clean install and full quality gate before production push', () => {
    const workflow = readRepoFile('scripts/workflow-promote-dev-to-main.ps1');
    expect(workflow).toContain('Assert-CleanWorktree');
    expect(workflow).toContain('Invoke-Npm ci');
    expect(workflow).toContain('Invoke-Npm run quality');
    expect(workflow.indexOf('Invoke-Npm run quality'))
      .toBeLessThan(workflow.indexOf('Invoke-Git push origin safe-push:main'));
  });

  it('keeps remote parity checks in a no-deploy preflight', () => {
    const preflight = readRepoFile('scripts/release-preflight.ps1');
    expect(preflight).toContain('audit:functions:remote');
    expect(preflight).toContain('audit:secrets:remote');
    expect(preflight).not.toMatch(/\b(vercel|functions deploy|db push)\b/i);
  });
});
