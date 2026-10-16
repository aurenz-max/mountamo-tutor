# Drawers: queue

Ungraded, spec-driven displays the manifest can place (proposal artifact: https://claude.ai/artifact/698K51Y7qApYS5bwPg1dXY).
Gemini writes a spec; `drawerSpecs.ts` checks it in code; a fixed renderer draws it. No eval modes, no score,
no `maxPerLesson` cap (user 10-11: one per lesson is too limiting; measure instead).

Code: `src/components/lumina/primitives/visual-primitives/drawers/`, `service/drawers/gemini-drawers.ts`,
catalog `service/manifest/catalog/drawers.ts`, lab `/lumina/lab/drawers` (dev only).

## D0-D1 pilot — BUILT 10-11 (committed 9e39be02)

Kinds: `drawer-model-slider`, `drawer-part-whole`, `drawer-cause-chain`.

- vitest 16/16 (`drawers/`): parser rejects names and anything not arithmetic; each kind's checks drop bad specs;
  every drawer survives a malformed spec without throwing.
- Generation: 12/12 specs passed checks, 8-25 s each (one 78 s outlier, likely retries).
- Headless Chromium drive of all three in the lab: render, slider changes outputs, part breakdown opens,
  cause chain reveals one link at a time from "?"; 0 console errors.
- Manifest selection, `topic-trace?manifestOnly=true`, 12 topics: 8/9 fitting topics got the expected kind
  (miss: area of rectangles, already covered by area-model); 0/2 controls (counting to 10, short vowels);
  2 lessons picked 2 drawers. Runs: `drawer-runs/trace-on.json` in the session scratchpad.

## D2 wave — 15 more kinds BUILT 10-11 (committed 9e39be02)

User 10-11: build the kinds first and let them be seen; post-generation quality work (DR-2 judge, reader
level) waits for the next phase. Model switched to `gemini-flash-lite-latest` (all 18 kinds, 1-6 s each).

Kinds: magnitude-ladder, band-scale, range-bars, metric-switch (`scaleSpecs.ts`); unit-chain, ratio-scaler,
growth-race, chance-run (`growthSpecs.ts`); cycle-wheel, story-arc, then-and-now, perspective-lens,
word-anatomy, shades-of-meaning, rhythm-grid (`textSpecs.ts`). Generators in `service/drawers/gemini-*-drawers.ts`,
one map `service/drawers/index.ts`; registry entries in `drawers/drawerRegistry.ts`.

- vitest 74/74: every new kind's fixture passes its checks and renders; each kind's check catches its failure
  (band gaps, ranges off the scale, metrics that rank alike, a chain whose fact disagrees, a race with no
  crossing, a viewpoint that skips a question, a word without its root, a pattern of the wrong length).
- Generation: 18/18 kinds passed checks through `/api/lumina/eval-test`.
- Headless Chromium, all 18 in the lab: generate, render, one interaction each changes the display
  (scale switch, slider, marker, metric re-rank, 1000 dice rolls, stage tap, viewpoint open, prefix on,
  rhythm plays with a moving playhead and a cell toggles); 0 console errors. Fixed from the drive: story-arc
  dots had no hit area (transparent hit disc added), cycle-wheel pills clipped, rhythm cells oversized,
  ratio bar summed mixed units (now shown only for one unit), growth-race crossing misreported when the
  multiplying series led at the start (now a check), big totals shown as "3.1 billion".
- Manifest, `topic-trace?manifestOnly=true`, 12 topics: 11/11 fitting topics got the expected new kind;
  control (counting to 10) got none. Boston Tea Party picked perspective-lens and cause-chain beside
  `cause-effect-chain` (DR-3).
- Seen in generated content, held for the next phase (DR-2): adult register at grade 6-8 ("vinaigrette
  emulsion", "observe the exponential leap"), misspelled forms ("reuseable"), then-and-now marking changed
  rows as same, a nonsense input label ("Bifrost friction coefficient").

## Open, in order

| # | Item | Executor | State |
|---|---|---|---|
| DR-1 | Model slider invented a formula for supply and demand with a tautological check. Fixed: check must differ from defaults; description + prompt restrict to established formulas. Re-trace 10-11: supply and demand now gets drawer-cause-chain 3/3, never the slider. Limit found: when forced, the generator still writes a self-consistent invented model with a plausible citation; code checks catch inconsistency, not invented facts | DR-2 judge covers the fact sentence | DONE 10-11 (selection side) |
| DR-2 | NEXT PHASE (user 10-11). Text kinds can be untrue or above grade; D2 wave examples listed above (grade 3 heart chain: "rush fresh air through your body"; grade 6 erosion: "subterranean", "detachment"). Code checks cannot see it | `/eval-test` (agent-judged) per kind | open |
| DR-3 | Leak risk: a drawer and a graded primitive in the same lesson on the same content (drawer-cause-chain before `cause-effect-chain` build_chain shows the chain the learner must build). Both in one lesson in 2 of 10 traces (American Revolution 1/5, supply and demand 1/5); content overlap not yet compared | trace sweep, then a leak check | open |
| DR-4 | Does a drawer improve the lesson? Needs lessons played by a person; record in HUMAN-CHECKS | user | open |
| DR-5 | Tutor sees the drawer: ungraded teaching surface (`teachingWorkspace.ungraded`, `useTeachingSurface`) bound once in `DrawerFrame`, adapters per kind | `/add-live-tutor-tools` | open |
| DR-6 | Second wave of kinds | this queue | DONE 10-11: 15 kinds (D2 wave above). Not built from the proposal: 3D scene, and the lesson rail slots |
