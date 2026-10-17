# Localization and translation integrity

## Origin contract

`supabase/functions/_shared/presentationTranslationContract.ts` defines a pure, shared acquisition parser. Accepted values are a nonempty bounded narrative string, a plain object with the sole own key `translation` and a narrative string value, or the JSON serialization of that exact object. The serialized envelope is parsed once; nested objects/envelopes, arrays, unrelated/additional keys, malformed JSON, markdown wrappers, control characters and known non-text artifacts are rejected. Unknown objects are never String/JSON-stringified for display.

`safeOriginalNarrative` preserves the exact original safe source string (including whitespace) or returns an empty safe fallback for non-narrative input. Source property records are never updated by translation. The report's own deterministic localized fallback handles unavailable display text.

## Backend acquisition and poisoned legacy caches

`presentation-translate/index.ts` requests an explicit one-key translation object. Candidate text must pass the shared parser before protected identifiers are restored and before READY text is stored. Identifier restoration still fails the entire translation if any protected token is missing, duplicated or mutated. Both existing-cache read paths also parse: valid historical wrapper strings are safely unwrapped, and invalid historical payloads fall back to original text without retry/provider fan-out or cache/schema migration.

## Frontend acquisition/cache/UI

`src/services/chatTranslation.js` validates external backend and Supabase translatedText results with the same parser. `localizePresentationText` admits only safe source strings, caches only parsed translated text or the safe original, and keeps source/sourceHash separate. `getCachedPresentationText` validates again at the display cache boundary. A typed outer API response is not proof that its translatedText contains narrative rather than serialized JSON.

## Deterministic system copy

The origin parser does not replace the strict report projection. System labels, blockers, recommendations, source classes and analytical statuses must be localized by closed concept mappings before reaching the report renderer. Unknown keys/enums fail closed; generic underscore replacement or returning raw English is not a label registry. User narratives remain distinct from validated Maxxis analytical synthesis.

## Regression gates

- Pure parser tests cover clean PT strings, exact object/serialized envelopes, arbitrary objects, additional fields, arrays, malformed JSON, nested envelope objects/strings, markdown, controls and bounds.
- Frontend tests assert clean envelope extraction, safe original fallback and that cached/UI text never receives the response wrapper.
- Existing identifier protection tests remain intact; no extra translation/provider call is introduced by validation.
- Full-report golden PDF tests must scan all extracted pages for raw JSON, keys/enums, mixed system copy and invalid numeric claims. A clean lower-layer translation test alone is not sufficient.

No live translation/provider requests are used in deterministic regression tests. This document is a policy/implementation record; final PDF and release results are recorded by the root remediation gates.
