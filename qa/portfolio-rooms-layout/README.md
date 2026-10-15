# Portfolio rooms layout and L1 export regression

## Scope

- Beds and baths share one responsive fact cell with existing icons and localized labels. No fact is dropped or duplicated; property photos remain unchanged.
- L1 export accepts valid factual PDF continuation pages. Subscription and higher-tier authorization are unchanged.
- A failed export shows localized feedback and retains its delivery selections for retry.

## Reproduced incident

Read only the public property fields for the user-specified incident, using configured application credentials. No owner contacts, user sessions, provider calls, or database writes were used. The fixture replaces the persisted identifier with a synthetic UUID. All actual property facts, generated PDFs, and full-app screenshots remain local and git-ignored; they are not included in the commit or deployment. Checked-in regression tests use a fictional address and generated notes.

The real PDF renderer generated two L1 pages to preserve the property's long description. The portfolio delivery code rejected any result whose physical page count was not exactly one, throwing `PROPERTY_RELEASE_RENDER_FAILED` in desktop and phone browsers. See `l1-reproduction.json`.

After correction, both devices downloaded the real two-page PDF. Injected browser download failures produced a visible alert, remained retryable, and succeeded on retry without an unhandled rejection. The simulated Free account remained unauthorized for L2 and L3. See `l1-validation.json`.

`l1-pdf-content.json` verifies the address, beginning and end of the description, two physical pages, and absence of higher-tier analysis in the downloaded PDFs. The continuation screenshot was visually reviewed.

## Checks

- 85 targeted tests passed, including report access, PDF delivery, report schema, contact/email isolation, and responsive property facts.
- Six real PortfolioDetail browser cases: Portuguese/English/Spanish, desktop/phone, light/dark themes. One room group, both icons, same-line beds/baths, no missing labels or overflow.
- Full-app desktop/phone checks with synthetic authenticated Free-account data: labels, units, single rehab value, room grouping, and real L1 PDF download passed.
- Scoped lint and contract TypeScript checks passed.
- `build.json` records the isolated modern/legacy build. It excludes the unrelated unfinished enrichment changes, backend changes, and pending migration.

Production deployment and post-deploy evidence are recorded separately. Production browser checks use the actual published frontend with a fully mocked backend, not a real user session. Real authenticated user acceptance is **NOT_PERFORMED_NO_USER_SESSION**.
