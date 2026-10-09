# Contract: length-lab

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C10) for the workspace requirement only. A full `/primitive-contract length-lab` derivation (consumers per K.MD skill, tiers, the generator's code-owned counts) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/LengthLab.tsx` · **Workspace:** `lengthLabWorkspace.ts` · **Adapter:** `components/live-activity/adapters/lengthLabLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`length-lab`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all six modes (compare, estimate_then_tile, two_unit_compare, tile_and_count, order, indirect) are gesture items checked by the activity's own check (`lengthLabMatches`); each wrong check names a `LengthMiss` from the catalog list. Scene facts name the objects, units, clues and on-screen choices, never a length, a count, the order or the answer. On the workspace a wrong tile count does not print the right count (Try again follows); Try again clears the tiles, the slots and the choice, and keeps an estimate's guess (never graded). The scripted path is unchanged: one try per challenge, Next, wrong tile counts print the right count.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C10.
- **Evidence:** `LengthLab.workspace.test.tsx` 10; sweep J1-J8 on 6 payloads, 0 findings, 19/19 misses named; replay 6 x 5 (`qa/tutor-reports/replay/length-lab-2026-10-09.json`).
- **Probe:** `LengthLab.workspace.test.tsx`; `journeySweep -t length-lab`.

### R2 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `lengthLabLevers.ts` declares levers on every mode, and every catalog miss is answered by a lever on every item (no `unanswered`). Help levers draw a picture (word model, end lines, unit marks, object outline, unit model, order steps, chain model); models outside the item never use an item object's name or unit; no lever text or scene fact carries a digit (`leverTextLeaks`). Simplify (far_pair, shorter_object, far_three; none on indirect) stays in the mode, gets its own `~simpler` id, never repeats the learner's object, length, count or units (`simplerLeaks`), and is ungraded; the full item comes back blank. A pull that changes nothing is refused (already pulled; object_outline before an estimate's guess). The tier's unit marks and fit line stay starting positions; `unit_marks` is offered only where the session hides them.
- **Demanded by:** /add-support-tiers, C10 lever pass.
- **Evidence:** `lengthLabLevers.test.ts` 25, `LengthLab.levers.workspace.test.tsx` 6; sweep J1-J12 on 6 payloads, 0 findings; replay 6 x 5 all checks 0 (`qa/eval-reports/length-lab-levers-2026-10-09.md`).
- **Probe:** `lengthLabLevers.test.ts`; `LengthLab.levers.workspace.test.tsx`; `journeySweep -t length-lab`.

## Changelog

- 2026-10-09 — created with R1 (W1 plain-shape binding).
- 2026-10-09 — R2 (levers, every mode).
