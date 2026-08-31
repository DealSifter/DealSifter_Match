# Maxxis R1 — Router audit and conversation contract

## Baseline and HB-06 root cause

The official R1 baseline is HB-01..05 PASS, HB-06 FAIL, HB-07..10 PASS, with real Gemini on staging and `stub=false`.

Before the R1 deployment, HB-06 produced two different results against the unchanged staging function (version 47):

- request `913db562-cc8b-42d6-93d3-d5223c955a3b` selected `getPropertyDetails` and failed with `WRONG_TOOL`;
- request `8230f6ad-007a-4831-9cc3-d185c8f18e90` selected `getDealCopilotOverview` and passed.

The evidence isolates model variance amplified by ambiguous tool semantics. The former post-model keyword correction recognized broad readings phrased with `deal`, but did not generalize the equivalent wording `Como está este imóvel?`. It therefore accepted Gemini's factual-detail tool selection. This was not a context, tool-result, or second-pass failure.

## Pre-LLM and post-LLM router inventory

| Router | Trigger | Purpose | Can return? | Can skip Gemini? | R1 classification / treatment |
| --- | --- | --- | --- | --- | --- |
| Client configuration guard | Missing Supabase URL/key | Prevent an invalid request | Yes | Yes | REQUIRED, retained; explicitly `unavailable` |
| Client auth/session guard | Missing/expired access token | Enforce authenticated Maxxis access | Yes | Yes | REQUIRED, retained |
| Explicit Deal Memory commands | Controlled UI command metadata | Immediate deterministic memory operation | Yes | Yes | SAFE_LOCAL, retained unchanged |
| Provider conversation handler | Natural provider intent or continuity reference | Analyze an authorized provider conversation | Yes | Yes | OVERBROAD, restricted to trusted provider context or validated continuity |
| Frontend surface-context responder | Broad natural surface question | Describe current screen | Yes | Yes | DUPLICATED, removed from frontend; backend is authority |
| Frontend local deal-intelligence responder | Broad phrase heuristics or controlled action | Explain existing structured deal output | Yes | Yes | OVERBROAD, restricted to explicit `controlledIntent` |
| Natural-reference validation | Missing, ambiguous, or stale trusted entity reference | Prevent the wrong entity from being used | Yes | Yes | REQUIRED, retained |
| Edge auth, kill switch, rate, payload, UUID and context guards | Invalid or unsafe request | Security and cost controls | Yes | Yes | REQUIRED, retained |
| Edge structured surface-context responder | Explicit context-awareness request with trusted context | Deterministic current-screen description | Yes | Yes | SAFE_LOCAL, retained as the sole surface authority |
| Gemini conversation route | All other natural messages | Intent and tool decision | Yes | No | REQUIRED, primary conversational path |
| Legacy mandatory keyword correction | Small literal phrase list after Gemini | Recover/correct a tool choice | No | No | OBSOLETE/fragile, replaced by semantic validation |
| Semantic tool validator | Gemini proposal plus trusted property/comparison context | Enforce factual-details versus broad-copilot contract | No | No | REQUIRED, deterministic policy boundary after Gemini |
| Structured tool-result fallback | Real provider second pass unavailable after bounded retry | Return safe existing tool data | Yes | No | SAFE_LOCAL, explicitly `degraded` |
| General local fallback | Gemini unavailable or unusable after bounded retry | Explain temporary reduced capability | Yes | No | SAFE_LOCAL, restricted to post-provider failure and explicitly `degraded` |

## Final precedence

1. Security, authentication, kill switch, rate, size, UUID, and trusted-reference validation.
2. Explicit deterministic commands only.
3. Trusted context collection/enrichment.
4. Gemini conversational intent/tool proposal.
5. Deterministic semantic validation of the proposed tool.
6. Server-authoritative tool execution.
7. Gemini interpretation of the structured result, with bounded empty-response retry.
8. Explicit success, degraded, or unavailable rendering.

The frontend now collects context and handles controlled UI commands. The Edge function is the authority for natural-language routing and tools.

## Tool semantics and failure contract

- `getPropertyDetails`: explicit canonical/published facts, named fields, or a focused stored metric.
- `getDealCopilotOverview`: broad reading, overview, analysis, current situation, gaps, missing information, or what is visible in a deal/property/opportunity in Portuguese, English, or Spanish.
- A Gemini HTTP 200 is successful only when its candidate contains nonblank text or an allowed tool call. Empty, whitespace-only, or unknown-tool candidates retry within the existing call budget.
- Responses expose `status=success|degraded|unavailable` and a sanitized `providerStatus`; HTTP 200 fallbacks remain visibly degraded.
- Sanitized logs use `requestId` for request receipt, router path, model attempt, tool selection/result, second pass, and final conversation status. Message bodies, secrets, tokens, and private contact data are not logged.
