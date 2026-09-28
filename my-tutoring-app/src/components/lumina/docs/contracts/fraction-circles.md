# Contract: fraction-circles

- **Derived:** 2026-09-27 · evidence window: 2026-03-17 to 2026-09-27 (eval reports, misconception, fraction-touch, workspace rollout, lever brief); census 2026-09-27 (8 objectives, manifestOnly)
- **Component:** `primitives/visual-primitives/math/FractionCircles.tsx` · **Generator:** `service/math/gemini-fraction-circles.ts` · **Workspace domain:** `primitives/visual-primitives/math/fractionCirclesWorkspace.ts` · **Catalog:** `service/manifest/catalog/math.ts:373`
- **Status:** ACTIVE (no open conflict)

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G1 partition circles into halves and fourths | census | routed 1/1 | 2026-09-27 |
| G2 recognize halves, thirds, fourths; name the shaded fraction | census + fraction-touch | routed 2/2; `qa/fraction-touch/README.md` | 2026-09-27 |
| G3 unit fractions 1/b | census | routed 1/1 | 2026-09-27 |
| G3/G4 equivalence with visual models | census | routed 2/2 | 2026-09-27 |
| G3/G4 compare (like and unlike parts) + misconception loop (5 reviewed subskills) | census + misconception | routed 2/2; `qa/misconception/fraction-circles-2026-09-13.md` | 2026-09-27 |
| `touch_fraction` DI (hear a fraction, touch its picture) | eval mode + live drive | `qa/tutor-reports/fraction-circles-live-di-plain-2026-09-12.md` | 2026-09-12 |
| Live tutor workspace (all 5 modes, gesture) | W1 rollout | `qa/tutor-reports/workspace-rollout-B1-2026-09-23.md` | 2026-09-23 |
| Pip shared surface | pip rollout | `qa/pip-surface/ROLLOUT.md:20` | 2026-09-15 |

Authored curriculum map (channel 3): no fraction-circles subskills (2026-09-27). Calibration items (channel 4): not read (endpoint needs auth).

## Requirements

### R1 — Denominators fit the grade band · OBSERVED
- **Property:** K-2 draws denominators from {2,3,4}; 3-5 from {2,3,4,5,6,8,10,12}. The band comes from the canonical grade (G1/G2 → K-2), never from prose. The first item is not always 1/2.
- **Demanded by:** G1, G2 consumers; every band.
- **Evidence:** FC-1 `qa/eval-reports/fraction-circles-2026-06-18.md:19-48`; `qa/reader-fit/14m-sweep-2026-08-04.md:27,41-43`; `gemini-fraction-circles.grade-band.test.ts`.
- **Probe:** `npm test -- src/components/lumina/service/math/gemini-fraction-circles.grade-band`; oracle `service/qa/oracles/fraction-circles.ts` (scope ceiling) via `/oracle-test fraction-circles`.

### R2 — A named fraction family is honoured · OBSERVED
- **Property:** a topic or intent naming a family ("tenths and twelfths", "halves and thirds") draws denominators from that family.
- **Demanded by:** topic-scoped lessons.
- **Evidence:** `qa/topic-fidelity/_MATH_TRIAGE-2026-06-27.md:30-35` (residual: one 6/8 under "halves and thirds").
- **Probe:** `/topic-fidelity fraction-circles` with intent "halves and thirds": every denominator in {2,3}.

### R3 — Displayed numbers are the checked numbers · OBSERVED
- **Property:** instruction and narration are rebuilt by code from the validated fractions; compare and equivalent denominators stay under the band ceiling; `numerator × equivalentDenominator` is divisible by `denominator`.
- **Demanded by:** every mode.
- **Evidence:** `qa/fraction-touch/README.md:9` (text disagreed with the diagram, fixed 09-12); oracle `fraction-circles.ts:27-40`.
- **Probe:** `/oracle-test fraction-circles` (answer-key and reachability checks).

### R4 — The pinned mode is the mode produced · OBSERVED
- **Property:** pinned, intent, blend and mixed requests produce exactly the requested task types; a coverage check and one retry prevent a silently dropped type.
- **Demanded by:** eval-mode routing (IRT), mixed lessons.
- **Evidence:** `qa/fraction-touch/README.md:9`; `scripts/fraction-touch-probe.mjs`.
- **Probe:** `node scripts/fraction-touch-probe.mjs --run` (exits non-zero on a routing issue).

### R5 — Identify never shows its shaded count · OBSERVED
- **Property:** identify's caption, instruction, hint and tutor facts never state the number of shaded slices, whatever the data or tier says. The total ("N equal pieces") may show.
- **Demanded by:** identify at every tier (G2 name the shaded fraction).
- **Evidence:** commit `9bb17319`; `SUPPORT_LEVERS_BRIEF.md:22`.
- **Probe:** `npm test -- src/components/lumina/primitives/visual-primitives/math/FractionCircles.workspace` ("identify never prints its shaded count").

### R6 — touch_fraction: one match among three pictures, never named to the tutor · OBSERVED
- **Property:** exactly one of three distinct proper-fraction pictures (halves, thirds, fourths, equal-sized wholes) matches; one touch commits; the tutor is told the fraction to say, never which picture matches.
- **Demanded by:** `touch_fraction` DI.
- **Evidence:** `qa/fraction-touch/README.md:3-5`; commit `21c70759`.
- **Probe:** `node scripts/fraction-touch-probe.mjs --run`; `FractionCircles.workspace` test "touch_fraction: the tutor is told the fraction to say".

### R7 — No answer key reaches the tutor; hidden labels stay hidden · OBSERVED
- **Property:** all five modes are gesture items with no `expectedAnswer` in the packet; compare with labels withdrawn carries no fraction values in the packet.
- **Demanded by:** live tutor workspace.
- **Evidence:** `qa/workspace-rollout/ROLLOUT.md:37,57`; `07-census.md:36`.
- **Probe:** `FractionCircles.workspace` tests ("binds the workspace under tutor ownership", "compare: with labels withdrawn").

### R8 — Compare records every response · OBSERVED
- **Property:** every compare response is recorded and `firstResponseScore` is attached when the session ends at 100 after a wrong first response.
- **Demanded by:** compare misconception loop.
- **Evidence:** `qa/misconception/fraction-circles-2026-09-13.md:11`.
- **Probe:** `FractionCircles.workspace` test "records every compare response".

### R9 — Compare misconception rewrite stays gated · OBSERVED
- **Property:** `contrast_same_numerator_denominators` rewrites only compare items at medium, for the 5 reviewed subskills, at most 2 pairs, grade-legal; observation text never appears in content.
- **Demanded by:** G3/G4 compare subskills (NF001-02-e, 06-b, 06-c; NF002-02-b, 02-e).
- **Evidence:** `qa/misconception/four-math-consumers-verify-2026-09-13.md:86-100`.
- **Probe:** `npm test -- src/components/lumina/service/math/fractionCirclesRemediation`.

### R10 — Mixed chain submits one aggregate · OBSERVED
- **Property:** a touch + circle mixed session runs one workspace session per block and submits one aggregate that keeps per-task accuracy and touch attempts.
- **Demanded by:** mixed lessons.
- **Evidence:** `qa/tutor-reports/workspace-rollout-B1-2026-09-23.md:21-23`.
- **Probe:** `FractionCircles.workspace` tests "a mixed pin chains…", "a mixed chain weights each block…".

### R11 — Pip targets are the slices · OBSERVED
- **Property:** slices carry `data-pip-object="slice-i"`; touch pictures `picture-{n}-of-{d}`, which describe the picture, not its correctness.
- **Demanded by:** Pip shared surface; the live journey driver.
- **Evidence:** commit `21c70759`; `pip/FractionCircles.surface.test.tsx`.
- **Probe:** `npm test -- src/components/lumina/pip/FractionCircles`.

### R12 — Help levers change the screen and state no answer · OBSERVED
- **Property:** `mark_pieces`, `part_whole`, `running_count`, `split_reference` and `overlay` each change the circle in the pull's commit, carry no digit in their drawing, lever text or scene fact, and never state the shaded count (R5) or which side is larger. `split_reference` is offered only when each reference slice splits into a whole number; `running_count` counts only the learner's own shading.
- **Demanded by:** live tutor workspace (handoff 18 B2), every plain mode.
- **Evidence:** `fractionCirclesLevers.ts`; `qa/eval-reports/fraction-circles-levers-2026-09-27.md`.
- **Probe:** `npm test -- src/components/lumina/primitives/visual-primitives/math/fractionCirclesLevers src/components/lumina/primitives/visual-primitives/math/FractionCircles.levers`.

### R13 — A simplify lever keeps the mode and never repeats the item · OBSERVED
- **Property:** `fewer_pieces`, `unit_build`, `double_split`, `far_pair` and `two_pictures` open a new, deterministic item of the same mode in the band's denominators, never the learner's fraction (or pair) or an equal value; its work is ungraded practice and only the full item, answered after it, is credited, with the lever on its attempt.
- **Demanded by:** live tutor workspace; mastery accounting (assisted work is never independent).
- **Evidence:** as R12.
- **Probe:** as R12 (builder sweeps over every band fraction; mounted practice-then-full-item flows).

## Conflicts

None open. The B2 levers (R12, R13) were built under R5 and R7: no lever prints or says the shaded count, and no lever fact carries a key.

## Catalog projection (proposed, not applied)

- **description:** faithful. It leads with `touch_fraction`, which is one of five modes; leave as is unless routing evidence shows the curator under-picks identify/build.
- **constraints:** "Generates 4-6 challenges mixing identify, build, compare, and equivalent types. Denominators 2-12." → "4-6 challenges; one task type when an eval mode is pinned. Denominators 2-4 in K-2, up to 12 in grades 3-5." (The current text is false for pinned modes and for K-2.)
- **tutoring block:** dead on the workspace path (the adapter sets `tutoring: null`), but `scaffoldingLevels.level3` ("So the fraction is shaded/{{denominator}}") and the build directive give the answer. Delete when the legacy scripted path is retired.

## Changelog

- 2026-09-27 — derived (initial). 11 requirements, 0 conflicts. Channels: census, QA registers, git log; calibration not read.
- 2026-09-27 — R12, R13 added with the support levers (handoff 18 B2). `--check`: R1-R11 probes re-run after the edit (vitest), COMPATIBLE.
- 2026-09-27 — a wrong Check or touch names its miss (`fractionMiss`, `touchMiss`, handoff 20 A1) on all five modes; every lever lists the misses it answers. Compatible: R1-R13 unchanged; a miss names a pattern of the learner's work and carries no key to the tutor.
- 2026-09-27 — `part_whole` lever text and scene fact say "a shaded part", not "one shaded piece": on a unit fraction that named the count to shade, against the lever property (no shaded count). Found by tutor replay (RP-1): near-answer 30/30 samples before, 0/30 after. Drawing unchanged. Compatible.
- 2026-09-27 — handoff 19 (shared runtime, `/add-live-tutor-tools`): the workspace reads the eval mode from the wrapper's lesson pin, not a mode rebuilt in this primitive (slice 1), and publishes the scene after every render, so the scene setter drops its publish call and default fields (slice 3). Its checks now call `commitCheck`, which counts the attempt and records the correct result on both paths; its own attempt counter and base-only result records are deleted (slice 4). Wiring only: no content, check, miss, verdict or tutor input changed; the sweep over saved payloads (J1-J8) and this primitive's tests pass. Compatible: no requirement changed.
