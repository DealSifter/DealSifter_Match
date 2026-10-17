# Report value and zero policy

`ReportValue` has explicit states VALUE, EXPLICIT_ZERO, PROVISIONAL, CONFLICTED, UNAVAILABLE and NOT_APPLICABLE. Its formatted text is distinct from numericValue, source qualification and evidenceRefs. The adapter currently uses the applicable states while retaining PROVISIONAL in the typed contract for qualified projection; it does not manufacture provisional numeric output.

| Input | Display policy |
| --- | --- |
| null / undefined / blank / invalid / unavailable | UNAVAILABLE, never zero |
| Semantic NOT_APPLICABLE | Non-applicable state; omit irrelevant analytical modules |
| Unresolved material conflict | CONFLICTED; qualify the discrepancy and do not adopt it as the calculation basis |
| Positive estimate or supported nonzero factual amount | Formatted value with source/evidence qualification |
| Stored legacy zero without explicit origin | UNAVAILABLE with an internal UNTRUSTED_LEGACY_ZERO diagnostic |
| Zero with explicit user/confirmation/current decision proof | EXPLICIT_ZERO and retained provenance |
| Nonpositive market rent/AVM/provider value | Invalid/unavailable, never a zero market estimate |

`explicitZeroProof` accepts explicitZero/explicitlyProvided/userConfirmed proof, intentional publisher declarations/explicit-user-input source markers, or a non-deferred decision with matching current evidence hash. Mere presence of status USER_PROVIDED on an old default row is not enough to establish a genuine zero.

Cap Rate is displayed only with a documented declared rate, or a calculated rate supported by the existing metric's explicit source and valid NOI/value basis. Zero requires zero proof. Missing NOI plus no legitimate declared rate remains unavailable. The report does not migrate NOI/Cap Rate or any other financial engine to produce a result.

Market Rent remains PROVIDER_ESTIMATE: it does not replace Current Contract Rent or a private investor assumption. Tax is not assessment or market value. Assessment remains a separate qualified fiscal record. Unknown HOA/expense applicability is not a positive missing expense and is not inferred zero.

Deterministic evidence counts and numbered map/table markers may legitimately contain zero/integers without being financial claims. Golden PDF zero auditing inspects user-visible monetary/percentage tokens and their typed evidence, not arbitrary textual digits. A matching-looking currency string is never itself provenance.

The legacy dealThesis money/decimal presenter now rejects absent/invalid numeric input before formatting, and its provider estimate requires a positive amount. This origin fix is not authorization to trust old preformatted narratives: strict report projection rebuilds analytical claims from supported evidence.
