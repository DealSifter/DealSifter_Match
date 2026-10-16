# Scoped report supplement

L1 unchanged. L2 only main monthly estimate, no range/comps/map. L3 adds one Market
Rent page only when valid authorized cached evidence exists; commercial page cap
is conditionally seven instead of six for this specific page. ARV pages/formulas
remain separate. This bounded presentation addition is authorized by the later
user supplement, superseding the initial report-isolation scope only here.

Existing ARV infrastructure audited: resolveComparableMap in maxxisReportPdf.js,
mapWorldPoint, loadMapTile, canvas renderer, numbered marker language, viewport
fitting and PDF embedding; ComparableMap in the inline report preview; schematic
fallback in renderComparables. These are reused, not duplicated. Fit-bounds was
extracted as comparableMapViewport and shared by ARV, rentals and coordinate fallback.

One reportRentalComparables projection takes first five valid unique provider
rentals in provider order; no reranking or invented correlation. Both map and table
consume it; missing-coordinate rows retain their original numbers in the table.
Subject marker S is distinct. No fixed radius, geocoding, per-comp lookup or RentCast
call during rendering. Missing subject coordinates follow existing ARV fallback,
never an invented position. No comps → no empty map, explicit unavailable details.

Automated PDF QA uses deterministic offline mock tiles through the actual ARV map
renderer. It does not claim an authenticated production smoke or real GIS basemap.
