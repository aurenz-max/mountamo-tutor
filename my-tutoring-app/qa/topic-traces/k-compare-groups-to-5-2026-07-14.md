# Topic Trace: "Compare two groups of up to 5 objects using more than, less than, equal to" (kindergarten) — 2026-07-14

Scope intended by the topic: quantity comparison, values ≤ 5.
Part of the 2026-07-14 K demand census.

## Components

| Component | In scope? | Off-scope value / issue | Broken link | Fix target |
|-----------|-----------|-------------------------|-------------|------------|
| concept-card-grid | ✓ | values ≤ 5; dense prose at K is a reader-fit concern, not scope | — | reader-fit backlog |
| counting-board | ✓ | counts 2–5; minor: narrations say "scattered"/"circle" while `arrangement` is always "line" | GENERATOR (cosmetic) | note only |
| comparison-builder ×2 | ✓ | all compare-groups, counts ≤ 5 | — | — |
| foundation-explorer | ✓ | groups of 3–4; text selfCheck options at K → reader-fit | — | reader-fit backlog |
| ten-frame | ✓ | build 1–5 | — | — |
| sorting-station | ✓ | count-and-compare ≤ 5 | — | — |
| comparison-panel | ✓ | 5 vs 3, one-to-one correspondence framing | — | — |
| take-home-activity | ✓ | ≤ 10 snacks; parent-facing by design (band-exempt) | — | — |
| knowledge-check | ✓ (scope) | values ≤ 5 ✓, but includes a **bar-chart inset** at K + text options | GENERATOR | knowledge-check PRE band-gate (reader-fit backlog) |

## Scope drops

None — every component stayed inside "compare quantities ≤ 5". This lesson is the healthiest of the six census traces, largely because comparison-builder was already reader-fit-fixed and the numeric primitives (ten-frame, counting-board) carry narration fields.

## Data-integrity flag (not scope)

comparison-builder draws contain internally inconsistent auxiliary fields: e.g. `leftGroup.count: 4, rightGroup.count: 1` but `rightNumber: 2`; and `targetNumber` sometimes matching neither group. The rendered compare-groups mode reads the `*Group.count` fields, so students see consistent content — but if any eval mode reads `rightNumber`/`targetNumber`, it would judge against wrong values. **Probe before assuming unused** (value-origin rule). Oracle candidate: `rightNumber === rightGroup.count`.
