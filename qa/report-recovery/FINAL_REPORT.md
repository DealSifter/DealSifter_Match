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

This historical receipt documents the earlier recovery release; the correction below supersedes its frontend runtime.

## Reference design correction — 2026-10-18

The previous release restored analytical content but still used a generic flowing layout. It did not reproduce the supplied preview compositions.

The replacement draws the approved Pro and Enterprise page grids directly from the strict display model. It uses the dark branded header, distinct gold/teal identities, property/photo hero, three fact cards, photo strip, map/notes grid, comparable map and table, valuation panels, scenario KPIs, range graphics, profile gauge, and the two-column verification/conclusion compositions. Preview and export use this same PDF path. Missing facts stay qualified; source evidence can continue explicitly when a record genuinely exceeds its panel.

Investor criterion scores are whitelisted, evidence-linked, and kept separate from unknown scores. Rental ranges remain labeled as rent, never ARV. Existing financial acquisition, geocoding, backend and database behavior are unchanged.

Verification: 56 focused tests, report TypeScript check, selected JavaScript lint and full application build passed. Five synthetic PDFs passed content, evidence, geometry and market checks, with no source changes during the final five-PDF run. Limited-evidence L3, rental L3, land L3 and documented-ARV L3 each have six pages; rental L2 has three. Visual review covered the page grids, hero, maps/tables, valuation graphics and complete contact sheets.

A subsequent narrowly scoped map fix rejects incomplete tile mosaics. Its partial-load regression test and a newly generated ARV PDF passed. The four committed control PDFs have been replaced with the new composition; the additional synthetic ARV control remains in ignored QA storage. Long records can still require clearly identified supporting pages.

Frontend-only production release: `289148e233a59fd7fcebc7d8c727a0196cb27a50`. Commit and push PASS. Vercel `dpl_3VL2QrMGjketLaRrZFRroJjiDKqQ` READY; exact source SHA and `dealsiftermatch.vercel.app` alias verified on 2026-10-18 03:28 UTC. The production build completed for this exact final source, including the map fallback fix. Backend version 90 remains the prior release. This final receipt is a documentation-only follow-up.
