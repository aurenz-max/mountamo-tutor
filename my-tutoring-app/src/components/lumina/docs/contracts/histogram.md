# Contract: histogram

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C19) for the workspace and lever requirements only. A full `/primitive-contract histogram` derivation (consumers per statistics skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/Histogram.tsx` · **Workspace:** `histogramWorkspace.ts` · **Levers:** `histogramLevers.ts` · **Generator:** `service/math/gemini-histogram.ts` · **Oracle:** `service/qa/oracles/histogram.ts` · **Adapter:** `components/live-activity/adapters/histogramLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`histogram`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own check (`histogramCorrect`: the shape chip, the tapped bar's start, the typed count exactly, the typed center within the item's tolerance). Each wrong check names a `HistogramMiss` from the catalog list. Scene facts name the bars' span and width, the axis labelling, whether counts are printed, the stats panel as drawn, the outlined bin, the tolerance and the learner's work; never the shape, the tallest bar, any bar height, the asked count or the center. Try again clears the chip, the tapped bar or the box. The hint, the hint button and the scripted Try Again are not shown on the workspace path; the scripted auto-advance timer does not run there.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C19.
- **Evidence:** `Histogram.workspace.test.tsx` 11; sweep J1-J13 on 4 payloads (20 items), 0 findings; replay 4 x 5 (`qa/tutor-reports/histogram-w1-2026-10-09.md`).
- **Probe:** `Histogram.workspace.test.tsx`; `journeySweep -t histogram`.

### R2 — a bar's height can be read exactly, and bar edges sit at the bar edges · OBSERVED (2026-10-09)
- **Property:** the frequency axis is labelled on whole counts (`frequencyAxis`: every 1 up to 10, every 2 up to 20, else 5, with a faint line at each whole count up to 30), its top one step above the tallest bar. Before, ticks were rounded fifths of 1.1 × the tallest bar, so a bar of 9 stopped under a line labelled 10 and read_frequency could not be read exactly. Each bar's start value is printed under its left edge (it was printed under its middle).
- **Probe:** `Histogram.workspace.test.tsx` ("the frequency axis is labelled on whole counts").

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `histogramLevers.ts` declares levers on every mode and every catalog miss is answered by a help lever on every item. Help: outline_tops, tail_model, peak_model (identify); level_line (modal); isolate_bar, axis_names, count_marks (read); axis_names, count_labels (only where the session withdrew them), balance_model (center). Leak rules in code: no lever text or fact carries a digit or the item's shape name; a model's shape is never the item's; the level line sits at the tapped bar's height and is refused with nothing tapped; count marks and the balance model carry no number. Simplify (`simpler_graph`, every mode) opens a clean same-mode graph with its own `~simpler` id and ask whose answer is not the item's (`practiceLeaks`), ungraded; the full item comes back blank.
- **Evidence:** `histogramLevers.test.ts`, `Histogram.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/histogram-levers-2026-10-09.md`).

### R4 — the key is what the drawn bars show · OBSERVED (2026-10-09)
- **Property:** one `computeBins` (histogramWorkspace.ts) for component and generator, its last bar closed on the right, so every value is drawn. An identify_shape key equals `classifyShape` of the drawn bars; an item whose bars read as no clear shape is not generated.
- **Probe:** `histogramWorkspace.test.ts`; oracle `histogram` (e) and the axis-maximum case.

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C19); R4 added (closed last bin, drawn-shape key).
