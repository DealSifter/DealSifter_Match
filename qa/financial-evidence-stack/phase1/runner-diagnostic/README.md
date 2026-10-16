# Test-runner initialization diagnostic

The resumed three-worker run collected/passed 2338 assertions in 236 files but exited 1. Its JSON reporter misleadingly had success=true and no failed assertions; the wrapper correctly rejected the run because the process failed.

Comparison with the prior complete suite identified three absent files:

- `src/components/map/PropertyPinPopup.test.jsx` — 14 tests.
- `src/features/propertyFacts/reviewStabilization.test.jsx` — 12 tests.
- `src/features/maxxis/intelligence/MaxxisAnalysisGapResolution.interaction.test.jsx` — 20 tests.

All three passed in an isolated one-worker execution: 46/46, exit 0 (`full-tests.json` here). No application or test assertions were changed to obtain this result. An opt-in default reporter was added to the existing QA wrapper so initialization failures remain diagnosable alongside JSON output; the original default behavior is preserved.

The accepted final complete execution used two workers: **2384/2384 in all 239 files**, exit 0, no skipped or pending assertions. See the parent `full-tests.json` and `quality-gates.json`. The initial incomplete run is not used as a release PASS.
