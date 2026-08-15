# Frontend architecture boundaries

Phase 5F keeps the existing application contracts and enforces incremental dependency direction.

## Layers

- `pages` compose user flows and may depend on components, hooks, services, domain and lib.
- `components` render UI and may depend on hooks, services, domain and lib.
- `hooks` own reusable React lifecycles and may depend on services, domain and lib.
- `services` own external/data access and may depend on domain and lib.
- `domain` contains pure rules and cannot depend on pages, components, hooks or services.
- `lib` contains shared infrastructure primitives.

Forbidden imports are `services -> pages`, `hooks -> pages`, and
`domain -> pages/components/hooks/services`. Circular dependencies fail the gate.

## Data-access rule

New page/component modules should not introduce direct Supabase access. Put new queries in a
service or inject an existing client into a lifecycle hook. The current baseline of 15 direct
access modules is a non-regression ceiling, not a target architecture.

## Budgets and exceptions

Historical hotspot budgets live in `config/architecture-budgets.json`. A file above its warning
budget is visible in CI; a file above its fail budget or a newly forbidden dependency blocks CI.
Temporary exceptions must be explicit in that configuration, narrow, documented and reviewed.

Run `npm run audit:architecture` locally. The same command is mandatory in the quality workflow.
