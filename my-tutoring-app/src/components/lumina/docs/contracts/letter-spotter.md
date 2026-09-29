# Contract: letter-spotter

- **Derived:** 2026-09-28 · evidence window: eval-reports 2026-03-15 + 2026-06-21 + DI port reports 2026-08-16 + workspace rollout C2 live 2026-09-24 + authored map (live backend, 2026-09-28) + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/LetterSpotter.tsx` (+ `letterSpotterWorkspace.ts`, `letterSpotterScript.ts` helpers) · **Generator:** `service/literacy/gemini-letter-spotter.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:2375` · **Pip pose:** `pip/letterSpotterPipPose.ts`
- **Status:** CONFLICTED (C1 open: the find_it tier reference prints the same form as the target; edits to the find_it reference must fork, see C1)

Derived as step 1 of handoff 22 L1 (`qa/live-runtime-handoffs/22-literacy-levers.md`), before
in-item levers are added to `find_it` and `match_it`. Channel [4] (calibration) not queried
(auth, as for cvc-speller). No fresh census. Channel [3]: the live `language_arts` authored map
has no mapping targeting letter-spotter (0 rows, 2026-09-28), so the consumers below come
from QA and code.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K / G1 alphabet knowledge: letter recognition, case correspondence, initial sound → letter | catalog + QA [2] | catalog `teachingWorkspace.grades` K, G1; `qa/eval-reports/letter-spotter-2026-03-15.md` | 2026-09-24 |
| Support-tier + structural-difficulty campaign (find_it/match_it NOT swept: the sweep halted on name_it runaway JSON, LSP-1) | eval [2] | `qa/eval-reports/letter-spotter-2026-06-21.md`; `7753068c`, `f891b300` | 2026-06-21 |
| DI port 11 / judged-loop harness (name_it spoken, taps code-checked) | eval + live [2] | `qa/tutor-reports/letter-spotter-19h-i-b-port6-2026-08-16.md`; `HUMAN-CHECKS.md` #97 | 2026-08-16 |
| Shared teaching workspace (W1 binding C2) + live journey harness | live [2] + code | `qa/tutor-reports/workspace-rollout-C2-2026-09-24.md:15,28,45-46`; `liveJourneySpec.ts:1336-1356` | 2026-09-24 |
| Named misses for the trigger ladder (A5) | code [5] | `1a0cd42a`; catalog `teachingWorkspace.misses` (`literacy.ts:2410`) | 2026-09 |
| Pip shared surface | code [5] | `e7beca56`; `pip/LetterSpotter.surface.test.tsx` | 2026-09-15 |
| Authored map | [3] | none (0 of language_arts mappings) | 2026-09-28 |

Real-usage channel [4]: unknown (auth), not zero.

## Requirements

### R1 — Letter-group scope · OBSERVED
- **Property:** every target, option and grid cell is one letter from the cumulative letter group (1-4; the schema is enum-locked per request). b and d are separated across groups (d in 2, b in 3). The manifest never supplies letters or sentences.
- **Demanded by:** every consumer; catalog constraints.
- **Evidence:** `gemini-letter-spotter.ts` `buildLetterSpotterSchema` (per-request enum), `buildSingleTargetGrid` (pool only), `selectDistractorsBySimilarity` (pool only); catalog `literacy.ts:2388-2394`.
- **Probe:** `GET /api/lumina/eval-test?componentId=letter-spotter&evalMode=find_it&grade=K&topic=letters s a t i p n` (and `match_it`) → every cell/option ∈ group 1.

### R2 — Mode identity and answer modality · OBSERVED
- **Property:** `name_it` is SPOKEN (no tiles; `options` ignored). `find_it`: the tutor names a letter; the child taps ONE cell of a 16-cell uppercase grid holding the target EXACTLY once (build gate drops any other grid: `itemFromChallenge`, length 16 and 1 target). `match_it`: an uppercase letter is printed; the child taps its lowercase form from the options (answer present, at least one distractor, else dropped). On both tap modes the tap IS the commit, checked in code (`commitGesture`); no Check / Next / Skip button. A spoken letter is not an answer on the tap modes, and a tap is not an answer on name_it.
- **Demanded by:** DI port ruling 2026-08-13 (drive 6ada8c0a1bcf); workspace C2.
- **Evidence:** `letterSpotterScript.ts:280-352`; `LetterSpotter.workspace.test.tsx:69` (grid without exactly one target refused); catalog `literacy.ts:2375-2395`.
- **Probe:** `npm test -- LetterSpotter letterSpotterWorkspace`.

### R3 — Nothing shows or names the answer before credit · OBSERVED
- **Property:** name_it: the star covers the target word's first character until credit. find_it: the answer is a POSITION; the tutor may say the letter but never its position, row, column or neighbours; nothing marks the target cell; Pip outlines the grid as a whole, never a cell. match_it: the ask never names the big letter, no option is marked, Pip points at the big letter, never a little one. The find_it assignment publishes no `expectedAnswer`.
- **Demanded by:** every consumer (Pedagogy rule #1).
- **Evidence:** `letterSpotterWorkspace.ts:13-37`; `pip/letterSpotterPipPose.ts:14-19`; `LetterSpotter.workspace.test.tsx:43,52`; `pip/LetterSpotter.surface.test.tsx:40,51,64`; catalog aiDirectives `literacy.ts:2542`.
- **Probe:** `npm test -- LetterSpotter.workspace LetterSpotter.surface`.

### R4 — No shape description in voice · OBSERVED
- **Property:** the tutor never describes what a letter LOOKS like (curves, lines, dots, sticks, what it resembles) at any tier, for any letter on screen. A shape description is the answer said another way. Help about letterforms is therefore visual, never spoken.
- **Demanded by:** DI port (live drive 42edfc52e539: the "hint at its shape" branch fired every item); workspace guidance.
- **Where it lives:** `teachingWorkspace.guidance` (`literacy.ts:2403-2407`, "Never say, spell or describe the shape of the answer letter before the learner has tried"), which is what bound workspace sessions receive (`workspaceAdapter` sends `tutoring: null`, `adapterContract.ts:158`); the older aiDirective "NEVER DESCRIBE WHAT THE ANSWER LOOKS LIKE" (`literacy.ts:2542`) no longer reaches bound sessions. Also stated at `letterSpotterScript.ts:440-450` (lead-in ladder) and the component header.
- **Evidence:** component header "The shape hint"; `HUMAN-CHECKS.md` #97.
- **Probe:** live journey transcript (`run_live_runtime.py --primitive letter-spotter --mode find_it|match_it`): no shape words about any on-screen letter.

### R5 — Support-tier invariants · INFERRED (find_it/match_it tier path never swept, eval 2026-06-21)
- **Property:** absent/unknown `config.difficulty` → no-op. With a tier: distractor similarity easy far / medium mixed / hard near (confusable clusters b d p q g · m n h r u · i l t j f · c e o a s · v w y x z k), saturating inside the group. find_it: `showTargetReference` true at easy and medium ("Looking for X", the SAME uppercase form as the grid), false at hard. match_it option count easy 3 / medium 4 / hard 4. A tier never changes the target, the one-target grid or the answer. The spoken lead-in is tier-composed (find_it model line "Look at one row at a time, all the way across").
- **Note:** the grid cycles through all ranked pool letters, so in a small group (group 1: 6 letters) all five non-targets appear at every tier and the similarity axis barely moves.
- **Demanded by:** support-tier campaign.
- **Evidence:** `gemini-letter-spotter.ts:193-240,305-445,1023-1097`; `LetterSpotter.tsx:501-525`.
- **Probe:** eval-test `evalMode=find_it|match_it&grade=K&difficulty=easy|hard|none` → reference on/off/absent, option counts 3/4/LLM, cells in group, one target.

### R6 — Named miss on a checked tap · OBSERVED
- **Property:** a wrong tap commits with `letterSpotterMiss`: find_it `same_shape_family` | `other_letter` (no `mirror_form`: the grid is uppercase); match_it `mirror_form` (b/d, p/q, b/p, d/q, n/u, m/w) | `same_shape_family` | `other_letter`. Matches catalog `teachingWorkspace.misses`. A second tap before Try again is not an attempt; Try again clears the tap.
- **Demanded by:** trigger ladder / named misses (A5); workspace C2.
- **Evidence:** `1a0cd42a`; `letterSpotterWorkspace.ts:40-58`; `letterSpotterWorkspace.test.ts`; `LetterSpotter.workspace.test.tsx:52`.
- **Probe:** `npm test -- letterSpotterWorkspace LetterSpotter.workspace`.

### R7 — Workspace-only path and evaluation · OBSERVED
- **Property:** runs only bound to the teaching workspace (`withWorkspaceOnly`). One evaluation per session with `LetterSpotterMetrics`; `confusedLetterPairs` come only from wrong taps and single-letter spoken misses, never from a word said back; the first-response gate fails a run of corrected misses.
- **Demanded by:** workspace C2 (LA-14 one path); IRT/mastery.
- **Evidence:** `d53dc3d2`; C2 report `:28`; `LetterSpotter.capture.test.tsx:44,54`.
- **Probe:** `npm test -- LetterSpotter.capture`.

### R8 — Stable tap targets and hear-again · OBSERVED
- **Property:** grid cells are `data-pip-object="cell-<n>"` with `n` the index into the item's `letterGrid`; match_it tiles are `option-<letter>`; mount probes `grid` / `letter` / `marker`. The live harness computes the cell index from `item.letterGrid`. Hear-again sends a silent request to repeat the question only, never more help than the first ask.
- **Demanded by:** live journey harness; workspace C2.
- **Evidence:** `liveJourneySpec.ts:1344-1356`; `qa/tutor-reports/letter-spotter-w1-find_it-text-2026-09-24.json` (PASS); `letterSpotterWorkspace.ts:61-62`.
- **Probe:** `run_live_runtime.py --primitive letter-spotter --mode find_it` presses `cell-<n>`.

### R9 — Pre-reader chrome · INFERRED
- **Property:** at K the group and mode badges are hidden.
- **Demanded by:** K band (reader-fit rule 7). No reader-fit report exists.
- **Evidence:** `LetterSpotter.tsx` `isPreReader`.
- **Probe:** mount at grade K → no `Group` badge.

### R10 — In-item levers on find_it and match_it · OBSERVED
- **Property:** `letterSpotterLevers.ts`; name_it declares none. find_it: `other_case_reference` (the named letter in lowercase beside the capital grid, only where the cases differ in shape), `row_scan` (a highlight sweeping the four rows on a 900 ms clock, alike on every row), `small_far_grid` (simplify: a 2x2 practice grid, new letter the session never targets, far letters). match_it: `wrong_choice_partner` (declared only after a wrong tap; the capital of each wrongly tapped tile on that tile, never the target's, kept through Try again), `two_far_choices` (simplify: new capital, two lowercase tiles). Every lever is visual (R4). Practice items are ungraded, stay out of `confusedLetterPairs`, and answer no session letter (the session invariant). A pull is a synchronous commit; the next attempt records the lever.
- **Demanded by:** handoff 22 L1; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/letter-spotter-levers-2026-09-28.md`.
- **Probe:** `npm test -- letterSpotterLevers LetterSpotter.levers.workspace`.

## Conflicts

### C1 — R5 (find_it same-form reference) vs handoff 22 leak rule — OPEN
The tier's find_it reference prints the target in the SAME uppercase form as the grid, at easy and medium. Handoff 22's literacy leak table says the letter-spotter reference "uses the other case, never the same form": a same-form reference turns "find the letter named" into shape matching that needs no letter knowledge. Both are on record. Ruling needed at the lever slice; the cheap fork is a config axis: the tier reference becomes the `other_case_reference` lever (lowercase over the uppercase grid), with easy starting it up (as cvc-speller's `vowel_keywords`). Until then do not add a second reference beside the existing one.

## Lever notes (for the find_it / match_it slice)

- `other_case_reference`: **find_it only.** Over the uppercase grid it shows the lowercase target; keeps R3. On match_it the other case of the printed capital IS the answer (R3 regression), so it cannot exist there. Must resolve C1 rather than stack on the same-form reference.
- `row_scan`: **find_it only** (match_it has 3-4 tiles, no rows). Keeps R3 only if every row is highlighted for the same time in the same order whatever the target's position, the scan never stops on or marks a cell or row, and Pip still outlines the whole grid. It is the visual form of the existing spoken model line.
- `mirror_model`: **match_it only** (find_it has no mirror miss, R6). The pair must hold neither the target nor any on-screen option, and it is shown, not described (R4). Every mirror pair (b/d, p/q, b/p, d/q, n/u, m/w) needs a letter from group 3 or 4, so no `mirror_form` miss can occur in groups 1-2; offer the lever only where the miss can occur, and prefer a pair inside the group (R1).
- `small_far_grid`: the build gate (R2) requires 16 cells, the scene fact and catalog say "sixteen", and the harness indexes `cell-<n>` into `letterGrid` (R8). So it must be a render/workspace transform of the item's own grid: keep the one target cell, keep uppercase, far-family foils from the group, keep each cell's original index, update the scene `shown` text, and mark the work assisted.
- `two_far_choices`: match_it; answer + one far distractor meets the build gate (min 2). Keep `option-<letter>` labels, lowercase tiles, no mirror or same-family foil; assisted.

None of the five conflicts with R1-R9 when scoped as above; `other_case_reference` needs C1 settled.

## Catalog projection

- **description:** stale in one clause: "The tutor asks, waits and responds, and a credited answer moves the lesson on" still reads as the retired DI clock; otherwise faithful. Not applied here.
- **constraints:** faithful.
- **evalModes:** faithful. `match_it` says "from four"; easy gives three (R5).
- **tutoring.aiDirectives:** stale (the `[LSP_*]` scripted-runner tags); bound sessions receive `tutoring: null`, so the live shape rule is `teachingWorkspace.guidance` (R4). Removal is an `/add-live-tutor-tools` cleanup.

## Changelog

- 2026-09-28 — R10 added (find_it / match_it levers, handoff 22 L1). The draft's `formation_start` and `mirror_model` were replaced by `wrong_choice_partner` (user approval). C1 stays open: the tier's same-case reference is untouched.

- 2026-09-28 — derived (initial), step 1 of handoff 22 L1. 9 requirements (7 OBSERVED, 2 INFERRED), 1 open conflict (C1). Channel [4] not queried (auth); channel [3] 0 rows.
