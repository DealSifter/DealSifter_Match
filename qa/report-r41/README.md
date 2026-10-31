# R-4.1 — offline report finish

Nine fictional fixtures (rich, partial and sparse × L1/L2/L3) are rendered through the application schema, view model and production PDF renderer. Each PDF has a PNG for every physical page and a measured layout audit. See [metrics.md](metrics.md) and [metrics.json](metrics.json).

Reproduce with:

```sh
node --import ./scripts/r1-offline-runtime.mjs scripts/report-r41-qa.mjs
```

The runtime blocks fetch and Node HTTP/HTTPS. RentCast/Gemini live calls: **0**. No production mutation, commit, push or deployment. The protected stash is preserved.

## Completion

Complete requires an accepted external property record, primary ARV, calculated financial indicators and no unresolved blocking input. Partial requires accepted external evidence and usable ARV/value but incomplete principal indicators. Without accepted external evidence or ARV/value, the report is Preliminary. A two-sale preliminary ARV can support Partial but never Complete. Paid level alone does not establish completeness.

The rich L3 control includes fictional calculated NOI and cap rate, but still has an unresolved ROI input; its honest badge is Partial. The partial L3 control is also Partial. Sparse controls are Preliminary. Lower tiers omit valuation/property evidence sections by their existing policy and remain Preliminary when those prerequisites are absent. Separate deterministic tests cover every prerequisite for Complete, including explicit blocking input despite numeric financial results.

## Layout and lint

Only page 1 has the large title, subtitle and tagline. Following pages retain the dark brand masthead, plan and compact completion badge. Blocks are measured before placement; full-width evidence is prioritized and smaller cards fill available columns across earlier pages. The numbered comparable table and its map stay together. The final qualification is reserved during planning; a trailing page reserved only for that qualification is rejected/reflowed.

Metrics measure unoccupied two-dimensional body area from the union of the actual section bounds (page 1: y=130–790; later pages: y=86–790), excluding chrome. This is not a pixel-whiteness metric or a promise of identical density in sparse reports. Atomic tables can require a second page even when other cards are small.

All nine PDFs are checked using extracted PDF text for raw ISO dates and internal labels, and layout audits for duplicate blocks, title repetition and a final page containing only map/qualification. Every count must be zero. Source, table and footer dates share the localized short-month date format. The residual gap table drives a deduplicated list of at most three next checks. Profile compatibility and signal coverage stay outside the financial-indicator gap table. Empty strategy basis and repeated subject dimensions in rent are omitted.

## Cartographic behavior and Production finding (code inspection only)

Production export entry points in MaxxisAssistant, MaxxisCanonicalReportPreview, MaxxisReportExportActions and MatchesPortfolio call prepareReportNarrativePresentation with media enabled. This calls prepareReportMaps, whose resolveComparableMap loads real tiles from `https://tile.openstreetmap.org/{z}/{x}/{y}.png` and draws the numbered markers before caching the raster. The PDF reads that prepared raster and includes OpenStreetMap attribution. Mocked tests verify the actual tile URL path, cache reuse and map/table marker alignment.

**Actual tile delivery in deployed Production was not exercised in this offline phase.** The code has a real tile-generation path; whether a given browser successfully receives those tiles remains dependent on transport/CORS/media preparation. No claim of a live Production observation is made.

These nine fixtures intentionally have no prepared basemap: comparable coordinates produce a map explicitly labeled **Schematic, not to scale**; subject-only maps are omitted. A separate mocked prepared-raster test covers the cartographic-base branch. The application's public example previews are also regenerated from the same renderer using its existing locally stored OSM base; no tile is fetched during regeneration.
