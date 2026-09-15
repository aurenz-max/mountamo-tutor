# Runner-owned judged evidence and the distiller census — 2026-09-14

Slice 1 of `qa/HANDOFF-judged-evidence-and-adaptation-wiring-2026-09-14.md`. The judged runner now assembles the
evidence every judged primitive submits to the shared capture layer, and a census ran that evidence through the real
distiller for every declared judged source. Fictional runs; no account, no store writes.

## What was broken

`useJudgedScriptRunner` scored an item 100 / 67 / 33 by corrections and assembled `summary.diagnosisEvidence` with no
`firstResponseScore`, the LAST 12 observations (dropping the first errors) and one observation's challenge as the
session summary. A child wrong first on three of five items and right after one correction submitted `passed: true,
80`, and `isDiagnosableFailure` skipped it. Counting-board and ten-frame each carried a ~40-line builder that fixed this
for themselves; base-ten-blocks patched `firstResponseScore` for `read_blocks`; the other 18 declared judged sources
got the runner's evidence and the gate almost never fired for them.

## What was built

| Piece | Where |
|---|---|
| Pure evidence module: `firstResponseScore`, every item's first wrong attempt ahead of later ones under the 12-phase cap, the pack's session statement plus the count, correction policy and first-time share, joined `observed`, latest judge line, `priorAttempts` kept | `hooks/judgedRunEvidence.ts` (98 lines) |
| Pack field `evidenceSummary?: (items) => { task, expected }` (takes items, not kinds: `JudgedScriptItem` has no `kind`) | `hooks/judgedScriptContract.ts` |
| Runner finish path calls the module in place of the inline assembly | `hooks/useJudgedScriptRunner.ts` |
| Counting-board and ten-frame keep only their per-mode statements (`countingBoardEvidenceSummary`, `tenFrameEvidenceSummary`); both builders deleted; base-ten's patch deleted | `countingBoardEvidence.ts`, `tenFrameEvidence.ts`, `CountingBoard.tsx`, `TenFrame.tsx`, `BaseTenBlocksDi.tsx` |
| Six runner callers now submit the runner evidence: BalanceScaleEquality and BalanceScaleWorkshop (replacing a self-gated hand-built packet), ReadAloudStudio (same), CalendarExplorer, DiSpokenPractice, PushPullArena (attached none) | those components |
| Three probe scripts point at the module | `scripts/build-counting-board-scenarios.mjs`, `probe-counting-board-applicability.mjs`, `probe-ten-frame-applicability.mjs` |
| Census: real generation → mounted pack → `judgedRunEvidence` → real distiller on :3000 | `scripts/misconception-harness/judged-evidence-census.mjs` + `evaluation/diagnosis/judgedEvidenceCensus.test.tsx` (skipped unless `JUDGED_CENSUS_DIR` is set) |

Inventory of the 14 judged components that did not submit `summary.diagnosisEvidence` before this slice:

| Component | Decision |
|---|---|
| BalanceScaleEquality, BalanceScaleWorkshop, ReadAloudStudio | built their own packet from `summary.observations` behind an `accuracy < 60` gate: replaced with the runner evidence (the shared gate decides) |
| CalendarExplorer, DiSpokenPractice, PushPullArena | had `diagnosisObservation` but attached nothing: now submit the runner evidence |
| BarModelExplanation, SpatialScene, RampInvestigation | no `diagnosisObservation`: the runner records nothing; unchanged |
| CvcSpeller, PhonicsBlender, SoundSwap, WordFlip | `useJudgedSpeechLoop`, not the runner; cvc-speller, phonics-blender and sound-swap are declared sources with their own `accuracy < 60` gate, the same defect on a different path: queued, not touched |
| BarModel | neither engine; unchanged |

## Verification

| Layer | Result |
|---|---|
| `hooks/judgedRunEvidence.test.ts` | 16 wrong attempts over 8 items → 12 phases, every first try kept, in order; no wrong attempt → undefined; first-response counts only zero-correction solves and the gate reads it (40 with score 80); mixed kinds use the pack summary; missing itemId groups as one item |
| `hooks/useJudgedScriptRunner.test.tsx` | the two evidence tests updated to the runner shape; new: three of five wrong first and corrected once finishes `accuracy 80, passed` with `firstResponseScore 40` and `isDiagnosableFailure` true |
| `CountingBoard.capture.test.tsx`, `TenFrame.capture.test.tsx`, `BaseTenBlocksDi.capture.test.tsx`, `PlaceValueChart.capture.test.tsx` | pass after the builders and patch were deleted (base-ten and place-value assertions moved from the old single-observation `observed` to the joined phases) |
| `LetterSpotter.capture.test.tsx` (new; a declared source that never had a builder) | mounted on the real runner: three words said straight back, corrected once → `true / 80`, `firstResponseScore` 40, three phases with the pack's own facts, capture calls the distiller and the store; one wrong stays above the gate, no model call |
| `countingBoardEvidence.test.ts`, `tenFrameEvidence.test.ts`, `ReadAloudStudio.phrasing.test.tsx` | rewritten to the summary functions / to assemble through the module |
| Gates | `typecheck:lumina` 0; full tsc 770 for this slice's files (last recorded 771; the working tree reads 776 because a concurrent session's untracked `pip/SpatialScene.surface.test.tsx` carries 6 errors); full vitest 485 files passed, 11 failures all in that session's untracked `pip/*.surface.test.tsx` (InteractiveBook, PictureVocabulary, SpatialScene, StoryTalk, WordFlip), none in this slice's files |

## Distiller census

`RUN=run2` under `artifacts/learning-applicability/judged-census/` (run1 = first generation pass with a 3-item cap on
wrong answers; run2 = the same generated data with three of five, i.e. 60% of items wrong first, corrected once). Real
registry generation at the tester's topic and grade, the source's first catalog eval mode unless the judged mode is
another one (`read_blocks`, `touch_fraction`, `naming`), the component mounted with the runner mocked at the seam so
the pack it hands the runner is the real one, the pack's own `diagnosisObservation` called with the harness
`signatureWrong` text, `judgeFeedback` = "My turn: <correct answer>.", evidence through `judgedRunEvidence`, then the
real distiller through Next on :3000.

**Gate: fired for 20 of 20 censused sources** (scores 75–84 on the average, first-response 20–50). Before this slice
none of these runs would have reached the distiller.

| Source (mode) | Signature miss in the fixture | Distiller | Names it? |
|---|---|---|---|
| base-ten-blocks (read_blocks, 10 items) | count said where value was asked and the reverse | hypothesis: swaps count and collective value | yes |
| di-deduction (conclude) | the rule read back instead of the case | repeats the general rule verbatim | yes |
| di-spoken-practice (count_and_say) | counts one past the total | one extra number word after the last object | yes |
| di-word-problem-setup (find_big_number) | the two numbers combined the wrong way | applies the opposite operation | yes |
| di-worked-procedure (subtract_no_regroup) | regroups when not needed | believes every column needs regrouping | yes |
| letter-sound-link (see_hear) | letter name for its sound | recites the letter name when asked for the sound | yes |
| letter-spotter (name_it) | the word said back | repeats the target word instead of the letter | yes |
| oral-sentence-studio | a fragment, no verb | chains the adjectives before a noun phrase, no subject or verb | yes |
| phoneme-explorer (isolate) | the tutor's own example word | retrieves a keyword instead of choosing from the options | yes |
| place-value-chart (identify) | value said where place was asked | gives the value instead of the place | yes |
| rhyme-studio (recognition, 9 items) | the stimulus word repeated instead of yes/no | repeats the first word of the pair | yes |
| sorting-station (sort_one, 12 items) | the stimulus said back | repeats the full label instead of the category | yes |
| syllable-clapper (blend_syllables, 8 items) | parts said back, unblended | echoes the parts with a pause | yes |
| word-builder (simple_affix) | the root said back | gives only the base word, omits the affix | yes |
| compare-objects (identify_attribute) | one other attribute for every picture ("how heavy") | abstain: defaults to a familiar phrase | evidence adequate; the fixture reads as a default phrase, the abstain is defensible |
| sentence-analyzer (identify_pos) | a different confusable twin per item | abstain: guessing among terms | correct: the fixture carries no single rule |
| 3d-shape-explorer (identify_3d) | 2-D face name ×2, then a nearby solid | abstain: two rules | fixture mixes classes; **capture gap**: the phase says "identify_shape from the visible or spoken stimulus", not what was shown |
| decodable-reader (read_along) | a word lifted from the story, same word twice | abstain: perseveration | **capture gap**: the phase carries the question but not the story sentence it draws on |
| ordinal-line (identify) | counted from the back | abstain: no directional rule | **capture gap**: the phase says "who is in place 2 of 5" without the line's order, so counting from the back is invisible |
| picture-vocabulary (naming) | the empty superordinate ("a thing") | abstain: placeholder | **capture gap**: the phase says "Name the pictured vocabulary item" without naming the picture |

Not censused: di-dice-roll and read-aloud-studio (no drive adapter and no exported `HarnessAnswers`); fraction-circles
(`touch_fraction` is gesture-only by design, so there is no spoken signature; gesture captures are code-judged).
di-spoken-practice needed a second generation: `count_and_say` with a comparatives topic returned 0 items.

**Limits.** The fixture signature is the pack's own `signatureWrong`, which for some packs alternates classes
(3d-shape-explorer, ordinal-line, sentence-analyzer), so an abstain there is partly the fixture. `judgeFeedback` is a
generic model line, not a real correction cue. One generation per source; no paraphrase or repeat draws.

## Residual (queued in item 18)

- `/add-misconception-loop` capture repair: ordinal-line (state the line's order), decodable-reader (quote the story
  sentence), 3d-shape-explorer (describe the solid shown), picture-vocabulary (name the picture) — four sources whose
  phases omit the stimulus the error is about.
- `/tutor-test` (drive adapters): di-dice-roll and read-aloud-studio export no harness answers, so neither the DI drive
  nor the census can drive them.
- cvc-speller, phonics-blender, sound-swap: declared sources on `useJudgedSpeechLoop` with an `accuracy < 60` self-gate.
- Slices 2–4 of the handoff (one `observation` callback; catalog eval mode at the evaluation boundary; one generator
  adaptation step).

## Line ratio

Production: one new module of 98 lines and 46 edited lines, against 119 deleted (two builders, one patch, three
hand-built packets). Tests: 72 new (module) + 102 new (letter-spotter capture) + 74 edited. Harness: 153 (census spec)
+ 122 (census script) + 65 edited across three probe scripts and the skill doc.
