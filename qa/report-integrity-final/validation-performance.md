# Validation cost and workflow correction

The delay was partly validation orchestration, not evidence of an application outage. Heavy PDF generation, lint, build and tests competed for local resources; the initial full-suite run encountered nine timing failures and one obsolete L2 test fixture. The fixture was updated to exercise the strict report schema, and the controlled final full-suite execution passed all 2,613 tests.

Observed phase costs included a 452-second lint pass, a 683-second production build and the 633-second passing full-suite run. Blindly repeating these phases after a test-only edit was unnecessary.

The fail-closed incremental validator in this directory verifies every current source hash against the actual passing full-suite receipt. Reuse is permitted only when the changed files are tests and every production source, build configuration and public asset is unchanged. Any production-input change rejects reuse and requires the affected build/checks again.

The 453 targeted assertions are extracted from the actual current passing full-suite raw output, not represented as a second execution. Browser reuse additionally required byte-for-byte identity of all 125 served build files. Original receipts are retained; no checks or dimensions were relaxed.

An automatic preview duplicating the exact production commit was safely canceled after checking its project, SHA and non-production target. Production was unaffected. No project flags, migrations, secrets or financial engines were changed by the workflow optimization.

The first post-deploy browser attempt measured one icon at 23px instead of 24px. The unchanged original runner then passed the isolated case and all six desktop/mobile locale cases. The initial failure is preserved; its exact transient cause is not asserted.
