# Tax pipeline

1. Public parcel signed receipt, validated for authenticated subject/point/source policy → propertyTax candidate, ANNUAL_RECORDED_TAX, tax year/source.
2. RentCast normalized record `propertyTaxes[year].total` → annualPropertyTax + propertyTaxYear, independent of `taxAssessments[year].value` → assessedValue + assessmentYear.
3. Canonical tax projection / current publisher Fact Review candidate history → financial evidence adapter. Original candidates and unresolved conflict remain; no silent winner or midpoint. Different tax periods do not establish confirming agreement.
4. Current publisher KEEP/ACCEPT may select an effective tax input when the choice matches the current row hash, value, unit, source and year. REVIEW_LATER/obsolete proofs cannot resolve a conflict. Consensus is not rewritten.
5. Non-publishers see a bounded sanitized current-publisher proof only after the public RPC gate; previous publishers, decision actors, private assumptions and history are never returned. Current reader assumptions are loaded separately under RLS/reviewer scope.

Amount plus ANNUAL cadence is explicit in the recorded-tax contract. Missing tax stays null, explicit actual zero survives. Assessment candidates cannot enter the tax adapter. Private scenario propertyTax is INVESTOR_ASSUMPTION, not a public annual-tax record. No trustworthy approved effective-rate dataset exists in the audited path; activated benchmark tax estimates remain zero.

Fail-closed controls: a sanitized public CONFLICTED fact blocks a provider-only winner; public declared tax remains a PUBLISHER candidate rather than proof of KEEP; an adopted public value differing from current evidence cannot be replaced without proof; failed review/proof reads yield unavailable, not a guessed effective tax. Missing proof never becomes independent source confirmation.
