# Reports + Maxxis recovery

Baseline: `3be3a48`.

Restored thematic L3 composition, maps with comparable tables, ranges, comparison bars, profile gauge, compact evidence gaps and next actions. Reports now reuse the canonical financial evidence resolver; Market Rent is not restricted to rental strategies. L2 retains point estimates only and does not initiate paid acquisition. Maxxis prioritizes the next NOI blocker.

| Control PDF | Pages | Integrity / visual review |
| --- | ---: | --- |
| 4724-L3.pdf | 6 | PASS |
| Honolulu-L2.pdf | 3 | PASS |
| Honolulu-L3.pdf | 7 | PASS |
| Gable-L3.pdf | 6 | PASS |

These are declared synthetic controls, not authenticated production valuations. All four final PDF models were matched exactly to current code; renderer identity and extracted-text integrity were checked after generation. False zeros: 0. Raw field leaks: 0.

Validation: focused five-file suite passed (83 tests); final affected two-file rerun passed (54 tests); report TypeScript check, selected JavaScript lint and production build passed. Backend Deno check retains existing baseline diagnostics (31), not a globally clean typecheck.

Production read-only check: Honolulu is registered as Sell and has no retained Market Rent estimate. The corrected path can consume authorized available evidence, but does not invent rent or purchase a query for L2. No paid provider calls or database migrations were performed. No authenticated end-to-end production session was available.

Deployment scope: frontend and `maxxis-chat` only; existing flags, other functions and secrets unchanged.

COMMIT (runtime): `58b75c47f8169cfee211c482cf328e566cf1d437`

PUSH: PASS.

PRODUCTION DEPLOY: YES. Vercel `dpl_HHFd2wC68cGZnADFbt1ZkMkk7tSh` READY; exact source SHA and `dealsiftermatch.vercel.app` alias verified on 2026-10-18 02:09 UTC. Backend `maxxis-chat` version 90 ACTIVE, JWT verification enabled. Feature-flags version 19 and public-parcel version 10 unchanged; no configuration or secret changes.

This receipt is a documentation-only follow-up; production runtime remains the SHA above.
