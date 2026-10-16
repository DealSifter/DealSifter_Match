# Validation history

An initial full run executed 2,466 assertions: 2,465 passed and one failed the
existing closed-list consensus consumer guard. The new adapters imported only the
consensus CandidateInput type, which the textual guard counted as runtime imports.
The adapters now derive their type from the existing reconciliation API. The
guard/assertions/list of eight approved consumers were not changed or weakened.

Subsequent in-flight suites/builds predating final metadata, UI, cache-retention and
legacy-entry hardening were superseded, not accepted as release gates. Only child
validation processes were stopped; test wrappers completed their finally blocks
and restored historical tracked QA. Their stale JSON aggregate/Windows termination
exit is not an application failure or a successful final test run.

The accepted final receipts must be targeted/full JSON with exit 0, current-source
build and Deno binding, static checks, localized PDF checks and browser checks.
Live provider calls in deterministic tests remain zero. Authenticated production
smoke is BLOCKED unless a legitimate real user session is available; synthetic
browser authentication and operator metadata audits do not replace it.
