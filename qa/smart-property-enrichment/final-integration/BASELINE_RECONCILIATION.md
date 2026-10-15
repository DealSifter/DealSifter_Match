# Baseline reconciliation

Branch: fix/production-real-defects

Local/remote HEAD: 1e8b3b0aeed778fce1a7f80d27db4c74241cd08c / 1e8b3b0aeed778fce1a7f80d27db4c74241cd08c

Active production frontend: 6dbb16397f531137e357ed4c1d884d9fc37ee792 (READY; alias verified). The supplied 0f3e6d8 baseline is older, and remains an ancestor. Preserve all later portfolio/L1 fixes.

Original required hotfix: 0f3e6d8fcf8ab91e31b7a7452ec4ea0f36aae6aa

Enrichment previous base: 06913dce671f805a89663d3a5a07f71d17c39785

Current source: uncommitted worktree changes. No commits touching the enrichment source paths exist in any reachable local/remote/stash history. Remote heads were queried directly. Existing stashes predate this feature.

Strategy: selective integration of local changes on current HEAD; no stale branch merge, reset, or old-file checkout. Pending APN/report work is an independently validated factual fix, not an EffectivePropertyFacts report migration. It is included in the same final release; isolation is enforced at the display/report consumer boundary and verified by tests.
