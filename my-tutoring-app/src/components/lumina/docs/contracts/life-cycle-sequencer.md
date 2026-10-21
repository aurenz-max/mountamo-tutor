# Contract: life-cycle-sequencer

- **Derived:** 2026-10-09 (workspace W1 binding + levers; no earlier contract)
- **Component:** `primitives/visual-primitives/biology/LifeCycleSequencer.tsx` (workspace-only) · **Boss:**
  `biology/lifeCycleSequencer.card.ts` + `biology/lifeCycleSequencer.boss.ts` · **Domain:** `biology/lifeCycleSequencerWorkspace.ts` ·
  **Levers:** `biology/lifeCycleSequencerLevers.ts` (`LIFE_CYCLE_LEVERS`) · **Generator:** `service/biology/gemini-life-cycle-sequencer.ts` ·
  **Catalog:** `service/manifest/catalog/biology.ts`
- **Modes:** `sequence` (β 3.0, the only task identity; registered 2026-10-09, backend `problem_type_registry.py` matches).
  The payload is ONE sequence, so a session has one item, `cycle`.

## Requirements

### R1 — the bank never shows the answer · OBSERVED
The generator returns `stages` sorted by `correctPosition`. The bank draws `bankOrder(item)` on both paths: a shuffle
seeded by the item, at most one pair of neighbouring stages side by side (across the end on a circle). Probe:
`LifeCycleSequencer.workspace.test.tsx`.

### R2 — the check is the activity's own; the key stays off the tutor · OBSERVED
Check Answer is enabled with every slot filled; correct = each slot holds the stage whose `correctPosition` is its
index (`cycleCorrect`). A circle started from another stage is wrong (`cycle_rotated`). On the workspace path the check
commits through `commitCheck` with `cycleMiss`; the scene lists stages in bank order, card descriptions and the
learner's slots, never `correctPosition`, `transitionToNext`, `imagePrompt` or the misconception correction. The Hint
(selects the first stage), the misconception card, the read-aloud, the tutorial and the scripted sends are gone (the
boss path is the only path). Try again clears the board. Probe: workspace test + journey sweep J1-J13.

### R3 — reader-fit PRE (K-2) unchanged · OBSERVED
At K-2 one tap places a picture in the next empty slot; no band badge, scale prose, tally or drop prompts. Probe:
`__tests__/LifeCycleSequencer.reader-fit.test.tsx`.

### R4 — scripted path · RETIRED 2026-10-20
The primitive is taught only on the workspace (`withWorkspaceOnly`); unbound it renders the shared "needs the tutor"
card.

### R5 — levers never place, rank or name an unmarked stage · OBSERVED (2026-10-09)
Workspace path only. `time_arrow` (help): flag + arrow over the slots start → later, plus a way-back arrow on a circle.
`keep_right` (help): after a check, locks the stages already marked right (`keptLeaks`: only right slots, never all),
the rest return to the cards; offered only after a check with some right and some wrong (an offer condition, so it is
never declared before); locked stages cannot be moved and survive Try
again. `fewer_stages` (simplify): `cycle~simpler`, same shape, 3 stages from a code pool, skipping an entry about the
item's own subject or sharing a stage word (`practiceLeaks`), ungraded. Probe: `lifeCycleSequencerLevers.test.ts`,
`LifeCycleSequencer.levers.workspace.test.tsx`.

## Open
- **G1** — per-slot marks after a check make any 2-wrong order (`adjacent_swap`, `two_swapped`) a forced swap on the
  retry. First-response scoring keeps it from counting as independent; a design question, not a defect.
- **G2** — generated card descriptions name the neighbouring stage ("Inside the egg, a baby caterpillar…", "As water
  vapor rises…"), so describing one card from its text links two. Generator → `/eval-fix`.
- **G3** — ruling: should a circular cycle in the right order but started elsewhere be credited (`cycle_rotated`)?

## Changelog
- 2026-10-20 — moved onto a boss (wave 3): card + boss replace `adapters/lifeCycleSequencerLive.ts` and the catalog
  guidance/tutoring blocks; levers declared once as `LIFE_CYCLE_LEVERS` (`keep_right` is `custom`, offered only when
  a check left something to lock); scripted path, its voice beats and the `CYCLE_*` leak tokens deleted; reader-fit
  test moved onto bound mounts.
