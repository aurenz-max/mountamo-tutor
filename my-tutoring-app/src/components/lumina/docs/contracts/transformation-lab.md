# Contract: transformation-lab

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C18) for the workspace and lever requirements only. A full `/primitive-contract transformation-lab` derivation (consumers per 8.G skill, tiers) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/TransformationLab.tsx` · **Workspace:** `transformationLabWorkspace.ts` · **Levers:** `transformationLabLevers.ts` · **Generator:** `service/math/gemini-transformation-lab.ts` · **Adapter:** `components/live-activity/adapters/transformationLabLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`transformation-lab`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all five modes are gesture items checked by the activity's own Check (`transformCorrect`): the pink corners match the expected image as a set of grid points (drag and compose), or the tapped option is the right one (identify). Each wrong check names a `TransformMiss` from the catalog list. Scene facts name the ask, the grid, the pre-image (its coordinates only when its labels are on screen), the amber image and the options (identify), the target outline (compose, unlabelled), the rule card only when one is on screen, and where the learner's corners are; never a drag item's image corners, the compose moves or which option is right. Try again puts the figure back on the pre-image. The generated hint and Next are not shown on the workspace path. The grid canvas takes pointer events, and mouse events only where no pointer event came first (`data-pip-object="canvas"`, the journey driver's strokes).
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C18.
- **Evidence:** `TransformationLab.workspace.test.tsx` 11; sweep J1-J13 on 5 payloads, 0 findings; replay 5 x 5 (`qa/tutor-reports/transformation-lab-w1-2026-10-09.md`).
- **Probe:** `TransformationLab.workspace.test.tsx`; `journeySweep -t transformation-lab`.

### R2 — nothing on screen shows a drag item's answer · OBSERVED (2026-10-09)
- **Property:** a drag item draws no target (the image is the answer); the rule card is the tier's (never on identify, where the motion is the answer); the pink corners start on the pre-image.
- **Probe:** `TransformationLab.workspace.test.tsx`.

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `transformationLabLevers.ts` declares levers on every mode and every catalog miss is answered by a help lever on every item. Drag modes: corner_letters, model_point (the item's motion on a point P that is not a corner of the pre-image or the image), pre_coords and rule_card (only where the screen lacks them), origin_rays (dilation), simpler_figure (simplify: the same motion on a smaller triangle). identify: corner_letters, motion_models (a six-corner model flag moved by each option, none marked), pre_coords, two_choices (simplify: another motion on another figure, two options, the item's answer not among them). compose: motion_models, target_coords, corner_letters, simpler_target (simplify: another flip or turn and a one-square slide). Leak rules in code: `leverTextLeaks`, `modelPointLeaks`, `practiceLeaks`. Practice items carry a `~simpler` id and are ungraded; the full item comes back blank. Starting positions are the existing tier's pre-image labels and rule card; they are not pulls.
- **Evidence:** `transformationLabLevers.test.ts` 31, `TransformationLab.levers.workspace.test.tsx` 7; sweep J9/J12/J13 0 findings (`qa/eval-reports/transformation-lab-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C18).
