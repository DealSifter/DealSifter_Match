# R2.7B-E2E defect ledger

Environment: staging `oqdcnjupquhybwdbeeew` only. Production was not accessed or changed.

## E2E-001 — Matches portfolio contradiction

- Surface: Matches / profile portfolio
- Symptom: `730 Peachtree Duplex` was associated with R27A Georgia Wholesaler, while the profile rendered `Properties (0)` and the empty state.
- First broken boundary: frontend state filter.
- Root cause: global inventory normalized the discovery scope to `fsbo`; `MatchesPage` filtered only by that transformed scope and discarded canonical portfolio membership returned by `ds_get_unlocked_contact_cards`.
- Repair: preserve canonical portfolio item IDs as authoritative membership while retaining the owner check and independent property entitlement.
- Test: unit regression plus real Human Preview assertion `Properties (1)`, property visible, empty state absent.
- Status: repaired.

## E2E-002 — Next Interaction action collapse

- Surface: Maxxis Deal AI conversation.
- Symptom: distinct actions converged on a generic deal snapshot presentation.
- First broken boundary: message composition bridge.
- Root cause: all deterministic local deal-intelligence replies were tagged with generic `ANALYSIS`, causing the composer to replace their semantic response with the same snapshot layout.
- Repair: preserve each structured response type; use the generic composition only for actual deal snapshots and comparison composition only for tradeoffs.
- Test: unit semantic matrix and real browser execution of Why, Missing information, Providers, Metrics and Deal snapshot with pairwise-distinct outcomes.
- Status: repaired.

## E2E-003 — Internal instruction exposed as user text

- Surface: Matches property → Maxxis.
- Symptom: the operational English property instruction could be rendered as the human message.
- First broken boundary: transcript message construction.
- Root cause: one string was used both as the internal execution prompt and the visible user message.
- Repair: transport a localized `visibleUserMessage` independently from the internal prompt.
- Test: real Human Preview transcript shows `Analyze with Maxxis Deal AI: 730 Peachtree Duplex`; forbidden internal instruction is absent.
- Status: repaired.

## E2E-004 — Proactive flag could remain false after transient failure

- Surface: Maxxis proactive runtime initialization.
- Symptom: one failed/late authenticated feature-flag request permanently disabled proactive insights for that mounted account session.
- First broken boundary: client feature-flag hydration.
- Root cause: fail-closed fallback was accepted after a single attempt without bounded recovery.
- Repair: bounded three-attempt recovery; flags remain fail-closed if all attempts fail.
- Test: deterministic transient-fallback unit test and real staging state `data-maxxis-proactive="enabled"`.
- Status: repaired.

## E2E-005 — Avatar overlap and first-load scale flash

- Surface: Maxxis header at narrow viewport.
- Symptom: persisted 1.75x art overlapped the header title; initial default art could appear before remote preference hydration.
- First broken boundary: header layout/presentation readiness.
- Root cause: the fixed avatar slot did not reserve scaled overflow and avatar art rendered before account preference hydration completed.
- Repair: reserve scale-dependent header space and hide only the art until account preferences are hydrated; stored/effective scale remains continuous and unchanged.
- Test: real 390px viewport reports stored/effective `1.75`, with no title or controls overlap.
- Status: repaired.

## E2E-006 — R27 provider fixture could not receive chat

- Surface: staging dataset / messaging.
- Symptom: canonical message insert failed with `recipient plan does not include chat`.
- First broken boundary: fixture entitlement.
- Root cause: the existing R27 provider fixture had `plan_id=free`, although it is the canonical provider used by the messaging acceptance path.
- Repair: staging-only fixture entitlement changed to `pro`; no production or real-user record was changed.
- Test: one controlled outbound message and one controlled provider reply persisted with canonical sender/recipient IDs; reply drove the real proactive bubble.
- Status: repaired in staging dataset.
