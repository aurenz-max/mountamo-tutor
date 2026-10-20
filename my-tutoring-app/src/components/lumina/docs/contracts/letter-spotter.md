# Contract: letter-spotter

- **Derived:** 2026-09-28 · evidence window: eval-reports 2026-03-15 + 2026-06-21 + DI port reports 2026-08-16 + workspace rollout C2 live 2026-09-24 + authored map (live backend, 2026-09-28) + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/LetterSpotter.tsx` (+ `letterSpotterDomain.ts`, `letterSpotterLevers.ts`) · **Boss:** `letterSpotter.card.ts` + `letterSpotter.boss.ts` · **Generator:** `service/literacy/gemini-letter-spotter.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`...bossEntry(letterSpotterCard)`) · **Pip:** framework (`<PipDock />` + `<PipWorkspace>`)
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
| Pip shared surface | code [5] | `e7beca56`; shared `pip/WorkspacePip.surface.test.tsx` since the boss move | 2026-10-20 |
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
- **Evidence:** `letterSpotterDomain.ts` `itemFromChallenge`; `letterSpotterDomain.test.ts` (build gates); `LetterSpotter.workspace.test.tsx` (grid without exactly one target refused by `letterSpotterBoss.validate`).
- **Probe:** `npm test -- LetterSpotter letterSpotterDomain`.

### R3 — Nothing shows or names the answer before credit · OBSERVED
- **Property:** name_it: the star covers the target word's first character until credit. find_it: the answer is a POSITION; the tutor may say the letter but never its position, row, column or neighbours; nothing marks the target cell; Pip outlines the grid as a whole, never a cell. match_it: the ask never names the big letter, no option is marked. Pip watches the answer surface as a whole (`<PipWorkspace>`), never a cell or tile. The find_it and match_it assignments publish no `expectedAnswer` (null key on the boss); name_it's key is a `SpokenKey` (the letter, or its sound in slashes).
- **Demanded by:** every consumer (Pedagogy rule #1).
- **Evidence:** `letterSpotterDomain.ts` `askFor`, `letterSpotterKey`, `letterSpotterScene` (constraints); `letterSpotterDomain.test.ts` (what the ask may say; `askLeaks` with `askGiven`); `LetterSpotter.workspace.test.tsx`; `pip/WorkspacePip.surface.test.tsx` (shared Pip contract).
- **Probe:** `npm test -- LetterSpotter.workspace letterSpotterDomain WorkspacePip.surface`.

### R4 — No shape description in voice · OBSERVED
- **Property:** the tutor never describes what a letter LOOKS like (curves, lines, dots, sticks, what it resembles) at any tier, for any letter on screen. A shape description is the answer said another way. Help about letterforms is therefore visual, never spoken.
- **Demanded by:** DI port (live drive 42edfc52e539: the "hint at its shape" branch fired every item); workspace guidance.
- **Where it lives:** each item's scene `constraints` (`letterSpotterScene`): name_it "never say, spell or describe the shape of the letter behind the star", find_it "never say where the named letter is … or describe what any letter looks like", match_it "never name the big letter or the little letters, and never describe what any letter looks like". The prose guidance and the catalog `tutoring` block (with its aiDirective) are deleted; the boss guidance is built from the card.
- **Evidence:** component header "The shape hint"; `HUMAN-CHECKS.md` #97.
- **Probe:** live journey transcript (`run_live_runtime.py --primitive letter-spotter --mode find_it|match_it`): no shape words about any on-screen letter.

### R5 — Support-tier invariants · INFERRED (find_it/match_it tier path never swept, eval 2026-06-21)
- **Property:** absent/unknown `config.difficulty` → no-op. With a tier: distractor similarity easy far / medium mixed / hard near (confusable clusters b d p q g · m n h r u · i l t j f · c e o a s · v w y x z k), saturating inside the group. find_it: `showTargetReference` true at easy and medium ("Looking for X", the SAME uppercase form as the grid), false at hard. match_it option count easy 3 / medium 4 / hard 4. A tier never changes the target, the one-target grid or the answer, except on name_it's key-word path (R11), where it picks the letter and the key word. The tier reaches the tutor as the lever set's `support` fact; at easy the name_it ask also says the word alone (re-based 2026-10-20: the scripted lead-in ladder is deleted).
- **Note:** the grid cycles through all ranked pool letters, so in a small group (group 1: 6 letters) all five non-targets appear at every tier and the similarity axis barely moves.
- **Demanded by:** support-tier campaign.
- **Evidence:** `gemini-letter-spotter.ts:193-240,305-445,1023-1097`; `LetterSpotter.tsx:501-525`.
- **Probe:** eval-test `evalMode=find_it|match_it&grade=K&difficulty=easy|hard|none` → reference on/off/absent, option counts 3/4/LLM, cells in group, one target.

### R6 — Named miss on a checked tap · OBSERVED
- **Property:** a wrong tap commits with `letterSpotterMiss`: find_it `same_shape_family` | `other_letter` (no `mirror_form`: the grid is uppercase); match_it `mirror_form` (b/d, p/q, b/p, d/q, n/u, m/w) | `same_shape_family` | `other_letter`. Matches catalog `teachingWorkspace.misses`. A second tap before Try again is not an attempt; Try again clears the tap.
- **Demanded by:** trigger ladder / named misses (A5); workspace C2.
- **Evidence:** `1a0cd42a`; `letterSpotterDomain.ts` `letterSpotterMiss`; card `LETTER_SPOTTER_MISSES`; `letterSpotterDomain.test.ts`; `LetterSpotter.workspace.test.tsx`.
- **Probe:** `npm test -- letterSpotterDomain LetterSpotter.workspace`.

### R7 — Workspace-only path and evaluation · OBSERVED
- **Property:** runs only bound to the teaching workspace (`withWorkspaceOnly`). One evaluation per session with `LetterSpotterMetrics`; `confusedLetterPairs` come only from wrong taps and single-letter spoken misses, never from a word said back; the first-response gate fails a run of corrected misses.
- **Demanded by:** workspace C2 (LA-14 one path); IRT/mastery.
- **Evidence:** `d53dc3d2`; C2 report `:28`; `LetterSpotter.capture.test.tsx:44,54`.
- **Probe:** `npm test -- LetterSpotter.capture`.

### R8 — Stable tap targets and hear-again · OBSERVED
- **Property:** grid cells are `data-pip-object="cell-<n>"` with `n` the index into the item's `letterGrid`; match_it tiles are `option-<letter>`; mount probes `grid` / `letter` / `marker`. The live harness computes the cell index from `item.letterGrid`. Hear-again sends a silent request to repeat the question only, never more help than the first ask.
- **Demanded by:** live journey harness; workspace C2.
- **Evidence:** `letterSpotter.boss.ts` `drive` (`letterTap`, `mounted`); `qa/tutor-reports/letter-spotter-w1-find_it-text-2026-09-24.json` (PASS); `letterSpotterDomain.ts` `hearQuestionRequest`, sent through `runner.requestHear`. The cell and tile `data-pip-object` ids stay as harness targets only (Pip no longer reads them).
- **Probe:** `run_live_runtime.py --primitive letter-spotter --mode find_it` presses `cell-<n>`.

### R9 — Pre-reader chrome · INFERRED
- **Property:** at K the group and mode badges are hidden.
- **Demanded by:** K band (reader-fit rule 7). No reader-fit report exists.
- **Evidence:** `LetterSpotter.tsx` `isPreReader`.
- **Probe:** mount at grade K → no `Group` badge.

### R10 — In-item levers on find_it and match_it · OBSERVED
- **Property:** one lever set, `LETTER_SPOTTER_LEVERS` in `letterSpotterLevers.ts` (types: `other_case_reference` clue, `row_scan` and `wrong_choice_partner` marks, `small_far_grid` and `two_far_choices` easier, `first_letter_model` model; see the 09-29 changelog for name_it). find_it: `other_case_reference` (the named letter in lowercase beside the capital grid, only where the cases differ in shape), `row_scan` (a highlight sweeping the four rows on a 900 ms clock, alike on every row), `small_far_grid` (simplify: a 2x2 practice grid, new letter the session never targets, far letters). match_it: `wrong_choice_partner` (declared only after a wrong tap; the capital of each wrongly tapped tile on that tile, never the target's, kept through Try again), `two_far_choices` (simplify: new capital, two lowercase tiles). Every lever is visual (R4). Practice items are ungraded, stay out of `confusedLetterPairs`, and answer no session letter (the session invariant). A pull is a synchronous commit; the next attempt records the lever.
- **Demanded by:** handoff 22 L1; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/letter-spotter-levers-2026-09-28.md`.
- **Probe:** `npm test -- letterSpotterLevers LetterSpotter.levers.workspace`.

### R11 — name_it key words: with a support tier, code picks the letter and the word · OBSERVED 2026-10-13
- **Property:** with a support tier on name_it and no remediation focus, `keyWordSpace` (`service/wordSpace/letterSpaces.ts`) picks each item's letter (letter-name effect: b d t p first; vowels and g c last) and key word: a familiar noun of one or two syllables that starts with the letter AND its basic sound (never sheep, city, giraffe), two thirds from the group's new letters. The model writes only the sentence; the code-chosen letter and word override the model's, and the existing splice / sentinel / fallback-frame gates decide the printed sentence. Name-it items beyond the plan are dropped. find_it and match_it are unchanged (their grids and options are code-built by tier). The private group table now reads `letterGroups.ts` (`qu` shows as `q`).
- **Probe:** `npm test -- src/components/lumina/service/wordSpace/letterSpaces.test.ts`; `scripts/word-space-lab/probe.sh letter-spotter after ...`.

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

- **description:** faithful (the runner-era clause rewritten 2026-10-20).
- **constraints:** faithful.
- **evalModes:** faithful (`match_it` now says "from three or four").
- **teachingWorkspace / tutoring:** built from the card (`bossEntry`); the `tutoring` block is deleted.

## Changelog
- 2026-10-20 — **Moved onto the boss framework** (`/add-live-tutor-tools`, wave 2). Card + boss on `spokenBoss`: name_it `SPOKEN` (key: the letter, or its sound in slashes; the word said back is the signature error), find_it and match_it `TAP_ONE` with null keys played through `speech.show`. Script + workspace modules merged into `letterSpotterDomain.ts` (cue builders, DISTAR lead-in ladder, tap verdict cues deleted); levers on one lever set (`first_letter_model` now a `model` lever, so the tier's `support` fact says when it comes); catalog `teachingWorkspace` prose, `audioInput` and the `tutoring` block replaced by `...bossEntry(letterSpotterCard)`; `DI_PORTS` row, live adapter, Pip pose and hand Pip deleted. Re-based: R2/R3/R6/R8 evidence onto the domain and boss; R4 now lives in each item's scene `constraints`; R7 unchanged (same evaluation metrics). The lead-in tier ladder (R5's last sentence) is gone with the script: the tier reaches the tutor as the `support` fact and, at easy, the word said alone in the ask. Catalog: the description's runner-era clause and match_it's "names neither case until it corrects" / "from four" were rewritten. C1 still open.

- 2026-10-13 — **R11 name_it key words** (`/add-word-space`). Before (`qa/word-space-lab/2026-10-13/letter-spotter/before.txt`): name_it was s/sun, a/ant, t/top at every tier. After: group 1 easy t/towel, p/pudding → hard a/apple, s/scoop; group 3 easy b/bacon, f/fog → hard g/grill, c/coach. R5 narrowed. `LETTER_GROUPS`/`NEW_LETTERS` now come from `letterGroups.ts`.

- 2026-09-29 — handoff 24: `name_it` declares `first_letter_model` (help, both): another picture word, printed, its first letter lit; its first letter is no session target and it is no word of any session sentence (`firstLetterModelLeak`). R3 holds (the star still covers the item's letter). All three name_it misses answered. Catalog `levers: true` set. `npm test -- letterSpotter LetterSpotter` 99/99.

- 2026-09-28 — R10 added (find_it / match_it levers, handoff 22 L1). The draft's `formation_start` and `mirror_model` were replaced by `wrong_choice_partner` (user approval). C1 stays open: the tier's same-case reference is untouched.

- 2026-09-28 — derived (initial), step 1 of handoff 22 L1. 9 requirements (7 OBSERVED, 2 INFERRED), 1 open conflict (C1). Channel [4] not queried (auth); channel [3] 0 rows.
