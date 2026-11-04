/** A4 coordinates traced from the supplied 1055 × 1491 design, not a new layout. */
export const REFERENCE_DESIGN = Object.freeze({
  page: { width: 595.28, height: 841.89, x: 24, widthInside: 547.28, bottom: 790 },
  masthead: { x: 0, y: 0, width: 595.28, height: 90, radius: 0 },
  brand: { x: 28, y: 20, width: 145, source: { x: 0, y: 42, width: 4356, height: 918 }, taglineY: 56, taglineSize: 7.5 },
  propertyStrip: { x: 26, y: 82, width: 543.28, height: 58 },
  // The opening title sits inside the overlapping card; later titles follow the strip.
  heading: { y: 96, continuedY: 164, topPadding: 14, continuedTopPadding: 24, bottomPadding: 14, height: 34, icon: 25, textX: 66, titleSize: 17, subtitleSize: 9 },
  overview: { cardY: 82, paddingBottom: 8, factsGap: 7, y: 144, height: 155, photoX: 291, photoWidth: 274, factsY: 314, minFactsHeight: 100, mapWidthRatio: .57, mapHeight: 194 },
  gallery: { gapBefore: 4, imageTop: 33, paddingBottom: 8, heights: { PROPERTY_RELEASE: 110, MAXXIS_ANALYSIS: 125, DEAL_INTELLIGENCE: 112 } },
  release: { heroHeight: 134, tailReserve: 78, compactTailReserve: 42, recordsColumns: 2 },
  comparableMaps: { pairedHeight: 165, singleHeight: 190 },
  panel: { radius: 6, gap: 7, padding: 8, titleSize: 11, icon: 19, header: 29 },
  profile: { topHeight: 184, bottomHeight: 204, gaugeRadius: 52, gaugeWidth: 15 },
  palette: { ink: [12, 24, 56], text: [43, 65, 99], dark: [43, 49, 53], line: [225, 234, 240], panel: [251, 253, 254] },
});
