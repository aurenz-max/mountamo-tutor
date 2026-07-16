# Contract: addition-subtraction-scene

- **Derived:** 2026-07-16 · evidence window: reader-fit 2026-07-13 (STIMULUS/ORIENT) + 2026-07-14 (1b typing/create-story) + Pulse walk 2026-07-16 (item 11), eval-reports 2026-03/06, topic-fidelity 2026-06-27, tutor-reports 2026-07-13, oracle registry, support-tier + structural-difficulty campaigns
- **Component:** `src/components/lumina/primitives/visual-primitives/math/AdditionSubtractionScene.tsx` · **Generator:** `src/components/lumina/service/math/gemini-addition-subtraction-scene.ts` · **Catalog:** `service/manifest/catalog/math.ts:2850`
- **Status:** ACTIVE (static derivation — no live census this run; refresh with `--census K` when the dev server is up)

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K PRE band — `act_out` ("add/subtract within 5", "count to tell number of objects up to 5") | reader-fit + live `--lesson` | `qa/reader-fit/addition-subtraction-scene-PRE-2026-07-13.md` + `-1b-2026-07-14.md`; Pulse 2026-07-16 | 2026-07-16 |
| K PRE band — `solve_story`, `create_story` (same K math census) | reader-fit 1b | `-PRE-1b-2026-07-14.md` | 2026-07-14 |
| Grade-1 (EMERGING+) — all four modes; count-the-scene + keyboard + equation tiles | catalog `constraints` + code (`gradeBand==='1'`) | component non-K branches | ongoing |
| Support-tier axis (config.difficulty easy/medium/hard) — AXIS 1 scaffolding + AXIS 2 problem shape | support-tier + structural-difficulty campaigns | generator `resolveSupportStructure` / `resolveProblemShape` / `constrainStructuralEnums` | 2026-07 |
| Oracle (content-contract QA — arithmetic + scope + clustering) | oracle registry | `service/qa/oracles/addition-subtraction-scene.ts` | 2026-07 |
| Evaluation / IRT (per-type accuracy metrics) | `usePrimitiveEvaluation` | `AdditionSubtractionSceneMetrics` | ongoing |

## Requirements

### R1 — story text (the STIMULUS) is READ ALOUD by the tutor; on-screen text never gates · OBSERVED
- **Property:** On each challenge start (`[PRIMITIVE SWITCH]`/`[ACTIVITY_START]`/`[NEXT_ITEM]`) the tutor reads `{{storyText}}` word-for-word, then states `{{instruction}}` — as the durable catalog `aiDirectives` beat that overrides the lesson one-sentence cap. The K–1 child is a non-reader; the on-screen story is decorative to them.
- **Demanded by:** all K PRE modes (live K failure 2026-07-13).
- **Evidence:** catalog `math.ts:2875` aiDirective; `addition-subtraction-scene-PRE-2026-07-13.md`; live `--lesson` 3/3 `qa/tutor-reports/addition-subtraction-scene-live-lesson-2026-07-13.md`.
- **Probe:** `/tutor-test --probe` — `{{storyText}}`+`{{instruction}}` resolve `by component`; live `--lesson` `stimulus-not-read` oracle silent.

### R2 — `{{instruction}}` resolves from the COMPONENT bag (not generator-only) · OBSERVED
- **Property:** `aiPrimitiveData.instruction` forwards `currentChallenge.instruction` so the R1 directive interpolates a real string, never `(not set)`.
- **Demanded by:** R1 (the directive names `{{instruction}}`).
- **Evidence:** `-PRE-2026-07-13.md` `{{instruction}}`→`(not set)` bug fixed; component `aiPrimitiveData` line ~344.
- **Probe:** `/tutor-test --probe` var table shows `instruction` = `component`.

### R3 — no keyboard / no typing at K; answers are tap-native · OBSERVED (item 1b) — FORKED BY MODE (item 11)
- **Property:** At `gradeBand==='K'` no numeric keyboard input is offered.
  - **`solve_story` @ K:** answer via the tappable `NumberTileRow` (0…maxNumber), tap=choose, no Check button. *(1b — PRESERVED.)*
  - **`act_out` @ K:** DIRECT MANIPULATION — the scene is seeded with the story's `startCount` objects; the child TAPS to add objects (addition) or taps objects to send them away (subtraction); the challenge auto-judges the instant the enacted scene count equals `resultCount`. No number entry — **the scene count IS the answer** (item 11, 2026-07-16). *(FORK of 1b's act-out tap-a-number: the number was a proxy for an enactment the primitive promised but didn't provide.)*
  - **`create_story` @ K:** BUILD-the-story production task — add/remove objects to match the given equation, judged by construction, no Check. *(1b — PRESERVED.)*
  - Grade 1 keeps keyboard input (act_out/solve_story), equation tiles (build_equation), and the scene+object picker (create_story).
- **Demanded by:** K PRE (reader-fit rule 6 no-typing + rule 8 instrument-over-quiz; direct-manipulation-first ruling).
- **Evidence:** `-PRE-1b-2026-07-14.md`; Pulse 2026-07-16 (act-out proxy-number finding); `AdditionSubtractionScene.reader-fit.test.tsx`.
- **Probe:** jsdom — at K no `input[type=number]`; act_out subtraction removes `changeCount` objects → complete; act_out addition adds `changeCount` → complete; solve_story number-tile tap completes.

### R4 — feedback lands on the object / by sound, not gated on reading · OBSERVED
- **Property:** Correct/complete is signalled by `SoundManager.playCorrect()` + a spoken tutor celebration; at K the enacted scene reaching `resultCount` IS the confirmation. No text card gates progress for a non-reader.
- **Demanded by:** K PRE (rule 5).
- **Evidence:** component `completeBuildStory` / `handleCheck*` sendText beats + SoundManager.
- **Probe:** jsdom completion path fires without reading a text card.

### R5 — arithmetic + equation are code-owned and self-consistent; answer derived from counts · OBSERVED
- **Property:** The generator recomputes `resultCount = startCount ± changeCount`, swaps operands so subtraction never goes negative, and rebuilds the `equation` string from the operands. The component judges act_out/create_story completion on the enacted count vs `resultCount`, solve_story on the `unknownPosition` slot, build_equation on the assembled tiles — never on a trusted stored key.
- **Demanded by:** oracle (answer-key-desync / scope), all consumers.
- **Evidence:** generator per-challenge validation (`gemini-…ts:659`); `service/qa/oracles/addition-subtraction-scene.ts` independence rule.
- **Probe:** `/oracle-test addition-subtraction-scene` — answer-key-desync + scope 0.

### R6 — config.difficulty drives AXIS 1 (scaffolding) + AXIS 2 (problem shape), NOT magnitude · OBSERVED
- **Property:** For a pinned mode + tier, `difficulty` withdraws on-screen aids and hardens the problem SHAPE within the same number band:
  - `act_out` → AXIS 1 only: `showCountBadges` (ordinal-on-tap) + `groupedReveal` (change group animates separately). **These aids serve the Grade-1 count-the-scene model; at K, act_out is direct manipulation and the count-badge aid is moot (superseded by R3's enactment) — see Conflicts.**
  - `build_equation` → AXIS 1 `allowedTiles` (exact→+distractors→full) + AXIS 2 `storyType` enum (join/separate→part-whole→compare).
  - `solve_story` → AXIS 2 `unknownPosition` enum (result→change→start).
  - `create_story` → no tier (open-ended).
  Magnitude stays inside `maxNumber` (K 5, G1 10) at every tier.
- **Demanded by:** support-tier + structural-difficulty axes.
- **Evidence:** generator `resolveSupportStructure`/`resolveProblemShape`/`constrainStructuralEnums`; memory `structural-difficulty-story-primitives`.
- **Probe:** generator draws per tier — magnitude band constant; `allowedTiles`/`storyType`/`unknownPosition` flip per tier.

### R7 — instanceId eval-id stamping + mastery-over-demo · OBSERVED
- **Property:** ≥3 challenges/session; evaluation submits via `useChallengeProgress` on completion with per-type accuracy metrics (`equationBuildingAccuracy`, `storySolvingAccuracy`, …).
- **Demanded by:** oracle (schema ≥3), IRT, K-stage advance gate ([[kstage-instanceId-advance-gate]]).
- **Evidence:** oracle schema check; `advanceToNextChallenge` submit path.
- **Probe:** `/oracle-test` schema 0; jsdom completion reaches Next/submit.

### R8 — grade band is a CEILING; instruction/story name no answer beyond the story's own operands · OBSERVED
- **Property:** Counts stay within the band ceiling; spoken/displayed instruction never states `resultCount`. Story operands (start/change) ARE public by design ("2 frogs hop away") — cueing them is not a leak; stating the result to-be-discovered is.
- **Demanded by:** oracle (scope), grade-fidelity, pedagogy rule #1.
- **Evidence:** generator `maxNumber` clamps; oracle scope + deliberately-not-answer-leak note.
- **Probe:** `/oracle-test` scope 0; K act_out spoken cue names `changeCount` (story-public), never `resultCount`.

## Conflicts

_None open._ The item-11 `act_out` K rebuild is a **fork by band + mode**, assessed COMPATIBLE — see changelog. R6's `act_out` count-badge/grouped-reveal aids still apply to **Grade 1** act_out (unchanged count-the-scene model); at K those aids are superseded by the R3 enactment, and no consumer depends on K act_out count badges (reader-fit already flagged the proxy count as the failure). R3's solve_story tap-a-number and create_story build are untouched.

## Catalog projection

- **description:** "act out stories by counting objects" is now imprecise for K (the mode is manipulate-not-count-then-answer). Softened to "act out stories by adding and taking away objects" 2026-07-16. Otherwise faithful.
- **constraints:** faithful (maxNumber 5 K / 10 G1; four challenge types).
- **evalModes:** `act_out` description "Manipulate objects in scene" was ALREADY the intended contract — the pre-item-11 count-a-number implementation betrayed it; item 11 restores it. No evalMode change.

## Changelog

- 2026-07-16 — derived (initial). 8 requirements, 0 open conflicts.
- 2026-07-16 — item 11 (K `act_out` → direct manipulation). Assessed **COMPATIBLE / fork-by-band+mode**: replaces 1b's K act_out `NumberTileRow` (a proxy number) with seed-startCount + tap-add/remove + auto-judge-on-count. Preserves R3 solve_story tiles + create_story build (band+mode scoped), R1/R2 read-aloud (instruction rewritten tap-accurate, still voiced), R5 code-owned arithmetic (no schema change — `startCount`/`changeCount`/`resultCount` already model the scene), R6 Grade-1 act_out aids. No new data fields required.
- 2026-07-16 — runtime fix (browser-reported): scene objects were unclickable — SVG `<g onClick>` with a `pointer-events:none` `<text>` and no hit area. Added a transparent hit-target `<circle pointerEvents:all>` per object. Real-browser proof (playwright-core + Chrome): old variant 0 hits, fixed 2 hits. jsdom is blind to this class (see memory [[svg-g-unclickable-jsdom-blind]]).
- 2026-07-16 — follow-on (user-requested): `solve_story` @ K `unknownPosition==='result'` gains a **tap-to-count aid** (ordinal badge in tap order + highlight; `tappedObjects` is now an ordered array). Answer surface stays the number tiles (R3 count-and-report identity intact). Not enabled for change/start unknowns (scene count ≠ answer). Additive AXIS-1 scaffold; no conflict with R6.
