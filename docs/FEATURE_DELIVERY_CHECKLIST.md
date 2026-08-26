# Future Feature Delivery Checklist

Use this checklist before implementation and again before release. Link the completed copy in the PR.

## Design review

- [ ] Business purpose, user outcome and success metric are explicit.
- [ ] Data read/written and ownership are listed; RLS impact was reviewed.
- [ ] PII handling, retention and redaction follow the privacy policy.
- [ ] External/API/AI/storage cost impact and performance budget are stated.
- [ ] Abuse protection and rate limits cover every costly or mutating path.
- [ ] Idempotency protects retries; concurrency behavior is defined.
- [ ] Observability has safe logs, metrics and actionable alerts.
- [ ] Analytics events use the approved taxonomy and contain no PII.
- [ ] Migration is additive/reversible, dry-run in staging and has a recovery plan.
- [ ] Rollback or compensation is executable and has an owner.
- [ ] A server-authoritative feature flag and rollout cohort are defined when exposure is gradual.
- [ ] A security kill switch exists when immediate operational shutdown is required; it is not a rollout flag.
- [ ] Accessibility, keyboard, mobile and responsive behavior are specified.
- [ ] Unit, integration, E2E, negative-security and performance tests are identified.
- [ ] Maxxis Deal AI capability declares its autonomy level from `MAXXIS_AUTONOMY_LEVELS.md`.

## Definition of Done

A feature is done only when code and generated contracts are current; tests and CI are green; security/RLS/privacy reviews are complete; observability and privacy-safe analytics are queryable; performance budgets and accessibility/mobile gates pass; rollout and rollback are rehearsed in staging; documentation and operational ownership are current. Product approval is explicit for pricing, payments, RLS or Maxxis Deal AI `EXECUTE` behavior.

