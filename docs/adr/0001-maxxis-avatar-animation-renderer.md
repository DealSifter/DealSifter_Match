# ADR 0001 — Maxxis Deal AI avatar animation renderer

- Status: proposed; PNG + CSS remains the official production renderer
- Date: 2026-08-26
- Scope: presentation only; no business-state or autonomous-action authority

## Context

The six official transparent PNG states are the visual authority for Maxxis Deal AI. The current renderer moves complete PNG layers with CSS. It must become more expressive now, while allowing future part-level animation only after explicit visual approval.

## Options

| Criterion | Lottie | Layered SVG | Animated WebP / frame sequence |
| --- | --- | --- | --- |
| Fidelity to current raster art | Medium; requires authored layered source and can drift during vector recreation | Medium; highest risk of changing the official raster look during vectorization | High when frames are rendered from an approved master |
| Independent part animation | High | High | Low for a single WebP; medium with separately authored sequences |
| Typical payload | Low–medium | Low–medium | Medium–high, proportional to frames, dimensions and state count |
| CPU / GPU | Good when shape count is controlled; expensive masks/effects can raise CPU | Good for simple transforms; filters and complex paths can be expensive | Low runtime composition cost; decode and texture memory can be high |
| Memory | Low–medium | Low–medium | Medium–high because decoded frames are larger than transfer size |
| Mobile suitability | Good with complexity budgets and lazy loading | Good with complexity budgets | Good for short, compressed sequences; risky for long/high-resolution loops |
| Browser support | Requires a React/runtime dependency | Native SVG/CSS/WAAPI | Native WebP is broad; frame-sequence orchestration is custom |
| Transparency | Supported | Native | Supported |
| Scaling | Excellent | Excellent | Raster-limited; source resolution must cover 2.5x |
| React integration | Mature libraries, extra dependency | Native components, no runtime dependency required | Native image plus a small asset resolver/player |
| Reduced motion | Player must be stopped and replaced with a static state | CSS/WAAPI can be disabled directly | Must resolve to a static PNG/frozen frame |
| Lazy loading / cache | Per-state JSON/assets can be lazy loaded and cached | Per-state modules can be lazy loaded and cached | Per-state files can be lazy loaded and cached |
| Maintenance | Good if original design source is layered | High manual authoring cost | Simple runtime; higher asset-production and payload discipline |

## Decision for this iteration

Keep `PNG + CSS` as the only active renderer. Add a renderer-resolution seam that can later select an approved experimental format per state, but do not add, download or activate experimental assets now.

Recommended future order:

1. Use short animated WebP/frame sequences for body-heavy actions such as PROCESSING and SUCCESS, because this best preserves the approved raster character.
2. Evaluate Lottie only if an official layered source is supplied; do not auto-vectorize PNGs.
3. Use layered SVG only if design produces and approves a new official layered master.

A hybrid state map is preferred over forcing one technology on all states. Every experimental resolver must lazy-load by state, fall back synchronously to the official PNG, honor reduced motion, and remain behind a production-off feature flag.

## Acceptance gate for any future asset

No experimental asset may replace an official PNG until visual fidelity, payload, CPU/GPU, decoded memory, mobile, browser support, reduced-motion behavior and cache behavior are measured and explicitly approved.
