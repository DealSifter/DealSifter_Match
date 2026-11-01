# R-4.4 offline validation

Ten fictional fixtures use the production schema, view model and PDF renderer. No provider or map-network requests are made. The OSM raster is the stored local demonstration basemap; markers identify fictional records.

See [metrics](metrics.md) for page counts, unused body area on every page, orphan detection, duplication, dates, internal labels and reading order. All non-final pages are below 30% unused body area; all final pages contain at least 25%. Sparse L3 remains one page.

Source families are grouped by provider and data type; retrieval dates come from evidence metadata. Listing support returned by a value-estimate request is identified with that request, without inventing a separate listings acquisition. A missing retrieval date is stated once.

Profile criteria split only between rows, with the score retained once. Listing descriptions split between complete paragraphs. Financial outputs and acquisition policies are unchanged.

## Live validation limitation

The v4 live acquisition and its cache-only repeat passed. The real PDF exposed a source-metadata loss not covered by the fictional source test: `comparableEvidence()` in `maxxisReportSchema.js` retains comparable rows but drops root provider/retrieval metadata. Consequently, the consolidated sources omit recorded sales. R-4.4 item 2.1 is PARTIAL. This was not changed during Part 5, where code changes are prohibited. The ten offline layout fixtures pass independently; the real PDF presentation gate fails until this metadata path is corrected and tested through the normalizer. No additional provider call is required for that correction.
