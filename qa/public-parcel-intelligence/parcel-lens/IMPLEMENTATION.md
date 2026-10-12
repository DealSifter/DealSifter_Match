# Contextual Parcel Lens

## Scope and root causes

The original public layer is a QA viewport grid: its zoom threshold, viewport request lifecycle and cleanup are appropriate for that diagnostic mode, but incompatible with a user-activated persistent lens. The normal property popup did not have a contextual parcel page or a real-record-only magnifier.

The contextual controller is separate from the viewport controller. It has no zoom/pan inputs. It resolves the physical property point (not the visually spread marker position), requires exactly one containing public parcel, and loads one fixed-radius neighbor query only after activation. Loaded geometries stay frozen across zoom-out; no new viewport queries are scheduled.

Native browser validation also identified unstable marker position arrays: unrelated popup/UI renders invoked Leaflet setLatLng/move again and restarted native popup autopan, making clicks miss their visual targets. StableMapMarker memoizes the coordinate tuple without changing coordinates, drag behavior, marker identity or popup content. The native lens circle class is assigned at Leaflet construction rather than through setStyle, which cannot initialize an SVG class.

A second native camera feedback path replayed viewport snapshots emitted by Leaflet back into MapController during popup autopan. Native snapshots now carry a local origin tag and are not re-applied as camera commands. Initial/session restores and explicit fit commands remain separate and functional. Contextual native popup padding is initialized/refreshed to keep close controls below the zoom control, including when server eligibility arrives after marker construction.

Visual inspection caught a CSS specificity collision: the generic property popup's width:auto overrode the neighbor public popup's explicit width, allowing its grid text to collapse to a single-character column. The contextual dual-class popup now has a bounded explicit width with higher specificity. Both main and neighbor panels are required to exceed 240 CSS pixels in real-browser QA.

Neighbor popups explicitly use Leaflet's standard popupPane, rather than inheriting the geometry pane. This keeps all public text above parcel SVG strokes, and native-browser QA checks popup-pane ancestry for both pages.

## Geometry and public data

- Radius: 0.25 mile / 402.336 meters, named central constants.
- Original public Polygon/MultiPolygon geometry is preserved; intersecting neighbors are spatially filtered and deduplicated, not converted into social property records.
- Principal and neighbors use solid #00cbd4 outlines; principal is heavier with subtle glow/fill. The circle is non-interactive and below normal marker panes.
- Existing 120-parcel cap remains. Source-limited results show an explicit incomplete-neighborhood warning, not a claim of complete coverage.
- Existing property popup is reused with property/public-parcel pages. Neighbor public popups reuse its native Leaflet visual pattern, with no feed/match actions.
- Contextual missing values are localized as Not available. Explicit zero remains zero. Source fields, public agency link, retrieval date, area conflict and stale evidence remain visible.

## Lifecycle and isolation

Explicit close, map clear/reset, selecting another PIN, eligibility/account change or an existing manual PIN move cancels pending context. Merely closing the data popup does not close the lens. An account-local bounded cache prevents repeat point/neighbor calls; stale inactive contexts refresh, whereas already active lenses remain frozen.

The existing feature-flag framework now separates public_parcel_intelligence from public_parcel_qa_grid. Both require the server's authenticated internal cohort. The QA grid defaults OFF and is absent from the normal contextual flow. Existing production cohort configuration is not overwritten; broad public exposure remains disabled.

No new sources, source activation, migrations, paid providers, URL proxy permissions, canonical fact projection, Maxxis analysis or report behavior were introduced. The shared feature-flag dependency closure requires only feature-flags and public-parcel function redeployment.

## Validation boundary

Runtime GIS validation uses approved live MassGIS data through the real resolver/adapter, with mocked local app authentication. It is not authenticated production-user validation. Production access configuration exists, but no user session/password/token is requested or fabricated.

See targeted-tests.json, full-tests.json, runtime-validation.json, screenshots and the final production receipt for actual results. A code/config deployment must not be mistaken for a successful real-user authenticated production acceptance test.
