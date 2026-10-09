# life-cycle-sequencer — W1 workspace binding (C14), 2026-10-09

Plain shape (P). Not committed.

## Mode registered first
The catalog had 0 `evalModes`, so `workspaceAdapter` had nothing to mount. The component has a real code check (slot
order), so the one existing task identity is registered: `sequence` (β 3.0, scaffolding 3, single-mode generator
wiring via `logEvalModeResolution`; backend `problem_type_registry.py` gains `sequence` 3.0 beside `default`).

## What was built
- `lifeCycleSequencerWorkspace.ts`: one item `cycle` per payload, seeded `bankOrder`, `describeCycleWork`,
  `cycleCorrect`, `cycleMiss` (`cycle_rotated`, `reversed`, `adjacent_swap`, `two_swapped`, `one_moved`, `mixed_order`),
  scene facts (bank order, card descriptions, learner's slots, check marks, band-specific controls).
- Component: `LifeCycleSequencerSurface` + `withWorkspaceController`; `commitCheck` on Check Answer; `learnerBlocked`
  on every tap/drag/check; Hint (selects the first stage), misconception card, read-aloud, tutorial and scripted Try
  Again hidden with the tutor; sends muted, `useLuminaAI({ enabled: !tutorOwned })`; submission from `onFinished` only
  under an evaluation provider. Cards and slots carry `data-pip-object` (`card-<id>`, `slot-<n>`). The bank is seeded
  on both paths (it was `Math.random`, which could land in order).
- `adapters/lifeCycleSequencerLive.ts` (custom validate: payload is one sequence, positions exactly 0..n-1), registered.
- Catalog `teachingWorkspace` (guidance ~1150 chars, misses), journey row (touch cards, or card + slot past K-2, then
  check), id in `lessonWorkspacePlan.test.ts`, contract `docs/contracts/life-cycle-sequencer.md`.
- Payloads: `life-cycle-sequencer.sequence.json` (K-2 circular butterfly), `.sequence-circular.json` (3-5 water cycle).

## Gates
- `typecheck:lumina`: 0. Full tsc: 772 total, none in these files (one sibling error in liveJourneySpec.ts:687,
  letter-workshop row).
- Own tests: workspace 6/6, reader-fit + Pip surface pass (biology dir 314/314).
- Journey sweep J1-J13, both payloads: 0 findings; miss named 1/1 each; recover score 67 / first-response 0, clean 100.
- workspaceContract, misses, lessonWorkspacePlan, activityContract: all pass (2495).

## Replay (text, 5 samples × 2 payloads)
Run 1: all checks 0/10. Read by hand: circular `stuck` linked two stages ("In Condensation, that vapor cools…") and
K `stuck` steered to the egg as the beginning. Guidance changed once (linking two pictures, calling one the beginning
or end, or asking which of two comes first is the answer). Run 2 (`-r2`): 0/10; 3 of 5 circular stuck replies describe
one card and ask about another; 2 still chain Evaporation→Condensation, carried by the generated descriptions (G2).

## Undriven
None: the row drives both bands; `cycle_rotated` is driven by the workspace test, not the row.

## Open
- G2 generator: card descriptions name the neighbouring stage → `/eval-fix`.
- G3 ruling: credit a correct circle started elsewhere?
- The cards show a sparkle placeholder, not a picture: at K the tutor's voice carries every stage name.
