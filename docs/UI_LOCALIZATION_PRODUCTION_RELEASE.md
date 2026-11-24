# Interface localization and profile activities — published

Date: 2026-11-24 (America/Sao_Paulo).

Scope: isolated frontend correction. Translate settings, confirmations, system notices, report delivery controls and card labels in English, Portuguese and Spanish. Explain category IDs and abbreviations, prioritize published profile activities/services, keep locality separate with `/`, and remove the standalone zero from service tiles. Existing category IDs, filters, pricing rules, permissions and stored contacts are unchanged.

The profile contact verification API, SQL proposal, confirmation route and new onboarding verification flow are **not part of this release**. They remain preserved as a local preparation requiring a coordinated, separately validated backend release. This frontend does not activate SMS, WhatsApp, voice, email verification providers or a new badge requirement.

Validation of the previous combined candidate: interface tests, visual fixtures and build passed. Before publication, validate the exact isolated commit again: lint, applicable TypeScript contracts, directly related tests, compiled browser smoke and visual fixtures. Public checks use GET/HEAD; external provider calls and backend writes are blocked in browser checks.

Baseline and rollback: `dpl_AFHx1AFTwsTuGnXWyV5khESJ23bn`. Production project: `prj_QPyhaESQ9dpLfgSfwzm4wxirLbs5`, Supabase `cyeipfskwwisbbayyaca`. Preserve the public configuration of the previously approved prebuilt release; Vercel API masks sensitive/encrypted values. Do not alter environment variables or feature flags.

Release evidence: `.tmp-codex/ui-localization-release-20261124/`. Publication status: **published and verified**. Source commit `7b7048358b467c8a30bca2145bab479764c74cc6`; deployment `dpl_6PTzjfCSBJ4Cq3FdZCS7gmgbNubk`, READY. Final validation: 124 tests, lint, TypeScript contracts, offline build/secret scan, 6 local public cases, 14 read-only staging checks, 6 Production public cases, 6 domain checks, and 28 unchanged backend functions. No backend deploy, SQL, push, real email, unlock, purchase or paid provider call is included. Existing launch-closure decisions remain unchanged.
