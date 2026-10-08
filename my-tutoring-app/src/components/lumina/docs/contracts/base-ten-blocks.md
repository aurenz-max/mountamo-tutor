# Contract: base-ten-blocks

- **Derived:** 2026-09-28 · evidence window: eval reports 2026-03-15, 2026-05-19, 2026-06-20; lesson-bench packages 2026-09-06 and BACKLOG item 26(d); DI drives 2026-09-12 (`qa/base-ten-blocks-di/`); misconception origin 2026-09-13; W1 payloads and reports 2026-09-23; handoff 20 A2 (2026-09-27); M1 lever table and defect list 2026-09-28; operate payload 2026-09-28 (working tree, untracked); authored map read live 2026-09-28; catalog/generator/component/oracle source and tests
- **Component:** click mat `src/components/lumina/primitives/visual-primitives/math/BaseTenBlocks.tsx` (build_number, operate, any mixed payload) and spoken mat `BaseTenBlocksDi.tsx` (homogeneous read_blocks or regroup), chosen by `BaseTenBlocksRouter` (`BaseTenBlocks.tsx:857`, `usesBaseTenDi`). Support files: `baseTenModel.ts`, `baseTenModes.ts`, `baseTenScript.ts`, `baseTenWorkspace.ts`, live adapter `components/live-activity/adapters/baseTenBlocksLive.ts` · **Generator:** `src/components/lumina/service/math/gemini-base-ten-blocks.ts` (+ `baseTenRemediation.ts`) · **Catalog:** `src/components/lumina/service/manifest/catalog/math.ts` (`id: 'base-ten-blocks'` :326; `teachingWorkspace` :327-345; `evalModes` :390-411)
- **Status:** ACTIVE. No open conflict. R12, R13, R14 and R16 were VIOLATED at derivation and fixed 2026-09-28 (handoff 21 M1).

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| Grade 1 — tens and ones, a ten as a unit (build_number at K-1 band 1-20, read_blocks, regroup; mixed build+read decks) | authored map + lesson-bench + curriculum-fit | `GET :8000/api/curriculum/primitive-mappings/MATHEMATICS` (NBT001-02-a, -03-a, -03-b, -05-a, -06-b, -07-a; mode not recorded); `qa/lesson-bench/packages/*tens-and-ones*base-ten-blocks*` (build_number easy/medium, read_blocks medium, regroup easy, `build_number\|read_blocks`); `qa/curriculum-fit/_sweep-math-2026-06-07.md` (G1 NBT001-03) | 2026-09-28 |
| Grades 2-3 — add/subtract with regrouping on blocks (operate), 3-digit build/read with interior zeros | eval report + oracle + W1 payload | `qa/eval-reports/base-ten-blocks-2026-06-20.md`; `service/qa/oracles/base-ten-blocks.ts`; `w1-payloads/base-ten-blocks.operate.json` (untracked 2026-09-28) | 2026-09-28 |
| Grade 4 — read_blocks at medium, NBT004-01: observation source and adaptation consumer | misconception loop | `qa/misconception/base-ten-blocks-origin-2026-09-13.md`; HUMAN-CHECKS #157; `baseTenDeliveryEligible` | 2026-09-15 |
| Spoken place value: read a block size aloud (count, then worth), predict a trade then make it | DI drives + mic check | `qa/base-ten-blocks-di/README.md` (3 drives, 0 findings); `qa/tutor-reports/base-ten-blocks-live-di-{plain,signature}-2026-09-12.md`; HUMAN-CHECKS #155 | 2026-09-12 |
| Click-mat answer channel: blocks are the answer where the value is on screen, keypad where it is not (BT-4) | component tests + human check | `BaseTenBlocks.answer-channel.test.tsx`; HUMAN-CHECKS #70 (OPEN) | 2026-08-06 |
| Live tutor on the shared teaching workspace (W1, all four modes, the only teaching path) | workspace rollout + journey sweep | `qa/live-runtime-handoffs/15-workspace-rollout.md` (B1 2026-09-23); handoff 20 A2 row (misses); `qa/tutor-reports/base-ten-blocks-{w1,workspace-only,runtime}-*-2026-09-23.json` | 2026-09-28 |
| Handoff 21 M1 in-item levers (approved, not built) | lever table | `qa/support-levers/m1-lever-tables-2026-09-28.md` § base-ten-blocks | 2026-09-28 |
| Lesson planner requirement compiler (what each mode assesses) | script | `scripts/lib/lesson-planner-requirements.mjs:19` ("build_number judges the standard tens/ones construction … regroup starts in standard form and assesses a trade") | 2026-09-28 |
| IRT/mastery + content-contract QA across all modes | evaluation hooks + oracle | `usePrimitiveEvaluation` submit (both surfaces); oracle checks answer-key-desync, scope, clustering, schema | ongoing |
| Pip shared surface | pip rollout | `pip/BaseTenBlocks.surface.test.tsx` | 2026-09-15 |

Not a consumer: K teen numbers. The math-k atlas routes teens to ten-frame/number-bond and records "base-ten-blocks stays unrouted because it shows a ten as one rod" (`scripts/curriculum-coverage-review-math-k.py:134,158`). Calibration channel [4] not read (403, needs auth).

## Requirements

### R1 — each eval mode emits its own challenge types · OBSERVED
- **Property:** `build_number` → `build_number`; `read_blocks` → `read_blocks`; `regroup` → `regroup`; `operate` → `add_with_blocks` / `subtract_with_blocks`; `build_two_ways` → `build_two_ways` (R24). read_blocks and regroup are projected from `baseTenModes.ts` (identity, β, docs), never re-typed in the catalog or generator.
- **Demanded by:** manifest routing, IRT task identity, the oracle `schema` check.
- **Evidence:** catalog `evalModes`; generator `resolveEvalModeConstraint` + `constrainChallengeTypeEnum`; `BASE_TEN_DI_EVAL_MODES`, `BASE_TEN_DI_TYPE_DOCS`.
- **Probe:** `baseTenScript.test.ts` "the catalog agrees with the pack" (2 tests); all four modes PASS in `qa/eval-reports/base-ten-blocks-2026-06-20.md`.

### R2 — the payload picks one surface, and the choice never changes mid-session · OBSERVED
- **Property:** a homogeneous read_blocks or regroup payload with at least one askable problem renders the spoken mat (`data-base-ten-mat="judged"`). A mixed payload, build_number, operate, or a read/regroup payload whose numbers all fail the build gate renders the click mat (`"click"`). The router is a pure function of `data.challenges`, the same predicate the catalog's `audioInputByMode` resolver applies. An unbound mount of either surface renders the "needs the tutor" card, never a scripted fallback.
- **Demanded by:** catalog `constraints` (homogeneous sessions); the spoken DI consumer; the live adapter (`initialState` uses the same predicate).
- **Evidence:** `usesBaseTenDi` in `baseTenScript.ts`; `BaseTenBlocksRouter`; `baseTenBlocksLive.ts`.
- **Probe:** `BaseTenBlocks.answer-channel.test.tsx` "the payload routes to one surface" (4 cases); `baseTenScript.test.ts` "usesBaseTenDi routes HOMOGENEOUS judged payloads only"; `BaseTenBlocks.workspace.test.tsx` "an unbound mount of %s … renders the needs-the-tutor card".

### R3 — click-mat answer channel: blocks where the value is on screen, keypad where it is not (BT-4) · OBSERVED
- **Property:** build_number and click-mat regroup show no keypad and are judged from the columns ("Check My Blocks" / "Check My Trade"). Click-mat read_blocks (mixed decks) and operate keep the keypad and show no Check button.
- **Demanded by:** BT-4 (typing a number the instruction states is transcription); HUMAN-CHECKS #70 (a), (d); the oracle's two-channel model.
- **Evidence:** `BLOCK_JUDGED_TYPES` (`BaseTenBlocks.tsx:134`); `blocksAreTheAnswer` in `baseTenWorkspace.ts`.
- **Probe:** answer-channel "shows a Check My Blocks button and NO number keypad", "keeps the keypad and offers no Check My Blocks button", "a MIXED deck keeps the whole deck on the click mat" (read_blocks on the keypad).

### R4 — build_number is judged in standard form · OBSERVED
- **Property:** a build is correct only when every column equals the target's digit. The right value in non-standard form (twelve ones cubes for 12) is not credited: it is a wrong check with miss `not_traded_up` and feedback that sends the learner to a trade. A direct standard build and a build reached through the trade button are both credited.
- **Demanded by:** BT-4; HUMAN-CHECKS #70 (b) ("it should send you to the trade"); lesson planner fact ("build_number judges the standard tens/ones construction").
- **Evidence:** `judgeBuild`, `checkBlocks` (`BaseTenBlocks.tsx:144`, :483-493); `plainMiss` (`not_traded_up`).
- **Probe:** answer-channel "rejects 12 unit cubes as NOT standard form …" (the `/not with the fewest blocks/` half; the other half is R14), "accepts 1 ten + 2 ones, including via the trade button", "accepts a direct 1 ten + 2 ones build"; workspace "build_number: Check My Blocks commits …".

### R5 — read_blocks never shows a count, a value or a total, on either surface, at any tier (BT-2) · OBSERVED
- **Property:** on the spoken mat each column shows blocks and the block name only; nothing prints a count, value, total or composed number, and there is no keypad or Check button. On the click mat `showColumnCounts` and `showBlocksTotal` are forced off for read_blocks whatever the payload says. The generator emits both flags false for read_blocks at every tier. The workspace scene never describes the read_blocks mat (spoken: "no counts, values or total printed"; click: no `learnerBlocks`).
- **Demanded by:** pedagogy rule #1 (the count is the answer); BT-2; the DI consumer; the tutor guidance ("the mat prints no counts or totals").
- **Evidence:** `BaseTenBlocksDi.tsx` column render (":275 The block NAME, never the count"); `BaseTenBlocks.tsx:319-321`; generator `resolveSupportStructure` read_blocks branch; `diWorkspaceScene`, `plainWorkspaceScene`.
- **Probe:** workspace "the spoken mat prints no count, total or composed number, and offers no keypad or Check button"; `qa/eval-reports/base-ten-blocks-2026-06-20.md` (read_blocks F/F at every tier).

### R6 — read_blocks spoken: per place, the count and then the worth; the child never says the whole number · OBSERVED
- **Property:** each problem asks about one place above the ones: "How many {blocks} do you see?", then "What are those {blocks} worth altogether?" (singular for one block). The asked place rotates across problems. The spoken assignment publishes the count or the value (`count × place value`) as `expectedAnswer`. No ask contains its own answer or the composed number (the block noun "ten-stick" is the only exempt span). A target must be 10-9999 with a non-zero digit above the ones; the component drops an unaskable one (never backfills) and the generator re-selects an outward neighbour (BT-6). A session holds whole problems only, at most 12 items.
- **Demanded by:** the spoken DI consumer (drives 2026-09-12, signature 10/10 in both directions); HUMAN-CHECKS #155; the misconception source (R18) reads these items.
- **Evidence:** `baseTenModes.ts` `countAsk`/`worthAsk`; `baseTenScript.ts` build gates and `itemsFromChallenges`; `baseTenModel.ts` `readablePlaces`; generator `normalizeDiTargets`.
- **Probe:** `baseTenScript.test.ts` blocks "build gates", "items", "the ask never contains its own answer", "drive-harness answers"; workspace "read_blocks: a wrong count is retried, the worth step is judged against the value …".

### R7 — regroup spoken: predict aloud first, on an untraded mat, then make the trade by tapping · OBSERVED
- **Property:** the prediction ask states the starting lower count and the trade, and asks how many there will be. The receiving place must already hold a block, so the answer is never "ten" (multiples of ten are dropped by the gate and re-selected by the generator). No block is tappable during the prediction. On the trade step every block above the ones is tappable; a trade of the wrong size or a second trade commits on stillness (1500 ms) as a wrong answer (`other_block` / `traded_twice`), a right trade commits after 900 ms. The verdict is `tradeSolved` against the problem's own start. "Put the blocks back" restores the start and clears the pending commit; Try again restores it too. The trade key is never published.
- **Demanded by:** the spoken DI consumer (drive-found defect 1, the self-answering ask); HUMAN-CHECKS #155 (d); lesson planner fact ("regroup starts in standard form and assesses a trade").
- **Evidence:** `predictAsk`, `tradeablePlaces`, `tradeSolved`, `tradeMiss`; `BaseTenBlocksDi.tsx` `tapBlock`/`undoTrade`.
- **Probe:** workspace "regroup: the prediction turn is untradeable; a wrong trade commits on stillness …", "regroup: Put the blocks back restores the starting mat before the check"; `baseTenScript.test.ts` "⭐ regroup refuses a number whose RECEIVING place is empty", "only the asked-for trade is solved".

### R8 — instructions state the task and never its answer · OBSERVED
- **Property:** a build_number instruction names the final target and never the decomposition (no "N tens", no rod/cube counts); a stale target after tier re-selection is rewritten (BT-5). A click-mat read_blocks instruction carries no block counts or block words (BT-3). An operate instruction names two operands that reconcile with `targetNumber` and `secondNumber`, and is rewritten after re-selection. Spoken-mat asks come from code, never from the generated instruction.
- **Demanded by:** pedagogy rule #1; the oracle's answer-key-desync check (a correct sum marked wrong).
- **Evidence:** `normalizeBuildNumberInstructions`; the BT-3 block in the generator; operate rewrite in the tier pass; oracle header.
- **Probe:** `gemini-base-ten-blocks.build-instruction.test.ts` (6 tests); oracle tests "passes a clean operate session …", "flags answer-key desync …", "flags schema — secondNumber not among the named operands".

### R9 — difficulty changes structure, never magnitude; the band follows the range · OBSERVED
- **Property:** with a tier set, build_number and read_blocks force 0, 1 or 2 interior zeros (easy, medium, hard; capped by digit count); operate forces 1, 2 or 3 carries or borrows (hard: a chained carry or a borrow across zero), with M > S and every number in the band; regroup has no structural lever. `gradeBand` is derived from the code-owned range (≤20 K-1, ≤999 2-3, else 4-5), and with no curator range the range comes from the grade (K/1 → 1-20).
- **Demanded by:** the structural-difficulty doctrine; lesson-bench item 26(d) (Grade 1 draws landing in 3-digit numbers); the Grade 4 adaptation (R18 dropped its move when the band was mislabelled).
- **Evidence:** `resolveProblemShape`, `buildZeroGapNumber`, `buildAdditionOperands`, `buildSubtractionOperands`, `defaultRangeForGrade`.
- **Probe:** `qa/eval-reports/base-ten-blocks-2026-06-20.md` (all four modes PASS, magnitude in band); `baseTenRemediation.test.ts` "a Grade 4 draw the model labels 2-3 keeps the code-owned 4-5 band …"; oracle `scope`.

### R10 — build_number self-check aids: shown untiered and at easy, withdrawn by tier · OBSERVED
- **Property:** on build_number the column counts show at easy and are off at medium and hard; the Blocks Total shows at easy and medium and is off at hard. With no tier (every saved payload) both show (`?? true`). When the total is off, a wrong check does not state the learner's total ("Not 12 yet — count each column again"); when it is on, the feedback may state the learner's own total and the target, both already on screen. On build_number the target is in the instruction, so the total leaks nothing.
- **Demanded by:** the support-tier axis (06-20 eval scaffold withdrawal); the answer-channel tests; the M1 `blocks_total` help lever (build_number only), whose starting position these flags will be.
- **Evidence:** `resolveSupportStructure`; `BaseTenBlocks.tsx:320-321`, :495-499.
- **Probe:** answer-channel "marks an empty / short build wrong …" (needs the default-on total: `/you need 12/`), "withholds the running total in the wrong-answer feedback at the hard tier"; 06-20 eval T/T → F/F.

### R11 — a keypad miss never names the target · OBSERVED
- **Property:** on read_blocks (click mat) and operate a wrong typed answer clears the entry and says "{typed} isn't it — check each column and try again", never the target. The workspace check sent to the tutor is the learner's work ("Typed 42", "Checked the blocks: …"), never the key.
- **Demanded by:** pedagogy rule #1; journey sweep J3 (a miss puts nothing new on screen).
- **Evidence:** `checkAnswer` (`BaseTenBlocks.tsx:505-519`); `describePlainCheck`.
- **Probe:** answer-channel "never states the target in the wrong-answer feedback"; workspace "operate: the keypad result is checked by the activity and never published"; journey sweep J3 on the four `base-ten-blocks.*.json` payloads.

### R12 — no hint on screen states the answer or the decomposition · OBSERVED · FIXED 2026-09-28
- **Property:** nothing the click mat shows after a wrong try states the answer: on build_number, the target's digits by place ("2 tens and 4 ones", "8 ten-rods and 7 unit cubes"); on read_blocks, a column count ("There are eight rods"); on operate, the result.
- **Demanded by:** pedagogy rule #1; the approved M1 defect list (fix 1); R5 (read_blocks counts are the answer); R8 (the instruction may not decompose, so the hint cannot either).
- **Evidence:** VIOLATED. `BaseTenBlocks.tsx:831` shows `currentChallenge.hint` after `currentAttempts >= 2` on an error. The build_number prompt doc tells the model to "Put place-value language in the HINT" (`gemini-base-ten-blocks.ts:48`); the empty-deck fallback hint is "45 has 4 tens and 5 ones." (:876). Saved payload `qa/tutor-reports/base-ten-blocks-runtime-build_number-payload-2026-09-23.json`: "The number 24 has 2 tens and 4 ones", "Count out 8 ten-rods and 7 unit cubes to make 87"; lesson-bench `…4rqx.json`: "60 is six ten-rods"; read_blocks payload: "There are eight rods" (reaches the screen on a mixed deck). The spoken mat renders no hint.
- **Who reads `hint`:** no test asserts that the hint renders; the live adapter's validator ignores it; neither workspace scene publishes it; the 2026-05-19 eval accepted hints that *describe block appearance* after failures, not hints that state the answer. The field itself is required in the schema (`required: [… "hint"]`) and in `BaseTenBlocksChallenge`, every test fixture sets it, and `normalizeBuildNumberInstructions` rewrites it on desync.
- **Probe (to add with the fix):** a mounted build_number deck whose hint is "12 is one ten and two ones." shows no digit-by-place text after two wrong checks; the same for a mixed-deck read_blocks hint naming a count.

### R13 — operate never shows its result before the typed answer · OBSERVED · FIXED 2026-09-28
- **Property:** on add_with_blocks and subtract_with_blocks no on-screen readout equals `targetNumber` before the keypad answer is checked. The learner's blocks may show the result as blocks; a printed total may not.
- **Demanded by:** pedagogy rule #1; the approved M1 defect list (fix 2); the M1 table ("`blocks_total` … never on operate").
- **Evidence:** VIOLATED. `resolveSupportStructure` sets `showBlocksTotal: true` for operate at easy and medium (`gemini-base-ten-blocks.ts:139-156`), and the component defaults an absent flag to shown (`BaseTenBlocks.tsx:321`, panel :760). Every untiered operate deck therefore shows it too, including `w1-payloads/base-ten-blocks.operate.json` and `qa/tutor-reports/base-ten-blocks-runtime-operate-payload-2026-09-28.json` (no flags). Building the first operand and then adding (or removing) the second makes the panel read the sum (or difference), which is the keypad answer. The 06-20 eval recorded operate T/T at easy as a PASS and stated "operate diff/sum computed not shown"; that line was wrong.
- **Probe (to add with the fix):** mount untiered, easy and medium operate decks, build 23 then add 18: no element reads "41" before the keypad check; build_number decks still show the total untiered and at easy/medium (R10).

### R14 — the first non-standard-build feedback does not name the exact trade · OBSERVED · FIXED 2026-09-28
- **Property:** on a first wrong check with the right value in non-standard form, the feedback says the build is not in the fewest blocks and sends the learner to trading (R4), without naming which place to trade and into what.
- **Demanded by:** the approved M1 defect list (fix 3); the planned `ten_bracket` help lever, which is the tool for pointing at the column.
- **Evidence:** VIOLATED at `BaseTenBlocks.tsx:489-492`: "…trade 10 ones for 1 ten." on every such check. The generic branch at :492 ("Try trading up to a bigger place.") already has the shape R4 needs. The answer-channel test "rejects 12 unit cubes as NOT standard form and names the trade" asserts `/trade 10 ones for 1 ten/`: that assertion encodes the defect and changes with the fix; its `/not with the fewest blocks/` assertion is R4 and stays.
- **Probe (to add with the fix):** twelve ones cubes, Check My Blocks: the feedback matches `/not with the fewest blocks/` and a trade nudge, and does not match `/10 ones for 1 ten/`; the committed miss is still `not_traded_up`.

### R15 — W1 teaching-workspace binding with named misses, both surfaces · OBSERVED
- **Property:** both surfaces bind only under `LiveRuntimeContext`, with the tutor as owner and `begin_help` as the only tutor tool; no scripted cue, Next button or runner control. A spoken step's assignment publishes its number; the trade, build_number and operate assignments are `response: 'gesture'` with no key. A checked answer closes the mat until Try again, which restores the challenge's own starting mat. Every wrong check names a miss from the catalog list for its mode: build_number 7 (`one_short`, `one_over`, `one_ten_off`, `digits_swapped`, `not_traded_up`, `short_by_more`, `over_by_more`), regroup 4 (`other_block`, `traded_twice`, `no_trade`, `value_changed`), read_blocks 6 (click keypad only), operate 6; spoken steps name none. Decimal mats count misses in the smallest block.
- **Demanded by:** the live tutor/JEV (handoffs 15, 19, 20); journey sweep J1-J8; the M1 levers (J9 reads these lists).
- **Evidence:** `baseTenWorkspace.ts` (`diWorkspaceAssignment`, `plainWorkspaceAssignment`, `tradeMiss`, `plainMiss`, both scenes); catalog :339-345; `LIVE_ADAPTERS['base-ten-blocks']`.
- **Probe:** `BaseTenBlocks.workspace.test.tsx` (all cases, including "a spoken step publishes the number it asks for; the trade, build and operate keys are never published" and the fixture-covers-every-mode case); `baseTenScript.test.ts` "the click mat names what a wrong check shows" and "a decimal mat counts in its smallest block"; `journeySweep.test.tsx -t base-ten` (4/4 green 2026-09-28).

### R16 — every mode has a saved payload and a journey row that drives it · OBSERVED · FIXED 2026-09-28
- **Property:** `w1-payloads/base-ten-blocks.{build_number,read_blocks,regroup,operate}.json` exist, and the journey row drives each without throwing (click regroup and decimal mats are declared undriven and throw by design).
- **Demanded by:** the lever slice (J9 must see every mode); the sweep gate.
- **Evidence:** the operate payload is present in the working tree but untracked (2026-09-28); the other three are committed. `liveJourneySpec.ts` `'base-ten-blocks'` row.
- **Probe:** `journeySweep.test.tsx -t base-ten`: four payloads, green.

### R17 — scoring: one submission per session, shaped by surface · OBSERVED
- **Property:** the click mat records one result per challenge and submits once when every challenge is complete, only under an evaluation provider (the live host has none, so nothing is submitted there). The spoken mat scores each problem at the lowest of its steps' scores, submits once with `evalMode` = the session's mode and `success = accuracy ≥ 60`, and on read_blocks attaches `learningResponses` and `diagnosisEvidence` (with `firstResponseScore`); regroup attaches no diagnosis evidence.
- **Demanded by:** IRT/mastery; the misconception source (R18).
- **Evidence:** `BaseTenBlocks.tsx:522-542`; `BaseTenBlocksDi.tsx` `finish`.
- **Probe:** workspace "read_blocks: … the submission counts problems", "build_number: … a standard build completes once", "operate: … No evaluation provider in the live host: nothing is submitted".

### R18 — read_blocks is an observation source, and a saved observation re-pairs later mats · OBSERVED
- **Property:** read_blocks corrections become factual, skill-scoped evidence (`misconceptionScope: 'skill'`). With a delivered observation at the eligible task (read_blocks, medium, Grade 4) and a validated `contrast_block_count_and_worth` move, `selectBlockWorthContrast` changes at most two targets so two mats share a count at different block sizes, keeping every mat's zero pattern, the 1000-9999 band and the compiled item ids. Decimal mode, an out-of-band deck or a mixed deck report `insufficient-capacity` or `no-focus` and keep the baseline. The observation text never reaches the wrapper model or the child.
- **Demanded by:** the misconception loop (`qa/misconception/base-ten-blocks-origin-2026-09-13.md`); HUMAN-CHECKS #157.
- **Evidence:** `baseTenRemediation.ts`; generator selector block (:1005-1009); catalog `learningObservations`.
- **Probe:** `baseTenRemediation.test.ts` (3), `service/generation/baseTenObservationServer.test.ts` (3), `components/MisconceptionLoopTester.mount.test.tsx`; workspace "read_blocks correction evidence reaches the skill-scoped observation capture".

### R19 — Pip shares the mat as a whole and never answers · OBSERVED
- **Property:** Pip's dock sits above the click mat and outlines the whole mat, never one column or block; it never places, checks or advances.
- **Demanded by:** Pip shared-surface rollout.
- **Evidence:** `BaseTenBlocks.tsx:547-558`, :673-678.
- **Probe:** `pip/BaseTenBlocks.surface.test.tsx` "keeps the classic workspace contract on the mat".

### R20 — decimal mats live on the click mat only · INFERRED
- **Property:** `decimalMode` adds tenths and hundredths columns to the click mat. The spoken mat has no decimal places (`MAX_BT_PLACE = 3`, targets are integers), the journey row does not drive decimal mats, and the adaptation refuses them.
- **Demanded by:** catalog description ("decimal mode (tenths/hundredths)"); no saved decimal payload or report was found.
- **Evidence:** `getActivePlaces`; `baseTenModel.ts`; `selectBlockWorthContrast` call with `data.decimalMode ? null : move`.
- **Probe:** `baseTenScript.test.ts` "a decimal mat counts in its smallest block" covers the miss arithmetic only. Upgrade to OBSERVED when an eval-test run renders a decimal deck.

### R21 — in-item levers on build_number (slice 1) · IMPLEMENTED 2026-09-28
- **Property:** `baseTenLevers.ts` declares on build_number, with a synchronous `pullLever`: `column_counts` and `blocks_total` (help; the tier's `showColumnCounts`/`showBlocksTotal` are their starting positions, never recorded pulls), `ten_bracket` (help; a bracket round the learner's own column of ten or more, offered only while one exists) and `plainer_build` (simplify; an ungraded build of a plainer number with the same places, then the full item on an empty mat). Each declares the `plainMiss` ids it answers; every build_number catalog miss is answered (J9). operate and the spoken mat declare no levers yet.
- **Leak rules (code, `baseTenLevers.test.ts`):** counts and total are the learner's own blocks on a mode whose number is printed; never on operate (R13); the bracket carries no count; the plainer number is never the number or its reversal (all numbers to 999 checked); no lever text or scene fact carries a number.
- **Evidence:** `baseTenLevers.test.ts`, `BaseTenBlocks.levers.workspace.test.tsx` (3), sweep J1-J9 (the journey's wrong build is now the documented untraded ten), replay 4 payloads x 5 clean (`qa/tutor-reports/replay/base-ten-blocks-2026-09-28.json`).

### R22 — in-item levers on operate (slice 2) · IMPLEMENTED 2026-09-28
- **Property:** on add_with_blocks and subtract_with_blocks `baseTenLevers.ts` declares `column_counts` (help, answers `one_short`/`one_over`; the tier's `showColumnCounts` is its starting position), `ten_bracket` (help, answers `one_ten_off`, a carry left as ten ones; offered only while a learner column holds ten or more) and `single_regroup` (simplify, answers `one_ten_off`/`short_by_more`/`over_by_more`: an ungraded operation with one carry or borrow fewer, floor one, then the full item on an empty mat with the keypad cleared). No total lever (R13). `digits_swapped` is in the catalog's `unanswered` list. The carry/borrow builders moved from the generator to `baseTenOperands.ts`, with the random source as a parameter; the lever seeds it from the item, so a pull always builds the same practice operation.
- **Leak rules (code, `baseTenLevers.test.ts`):** the practice operation has the item's place count, exactly one regroup fewer, M > S, and never the item's operands (either order) or its result (400 built items); an item with one regroup offers no simplify; no lever text carries a number.
- **Evidence:** `BaseTenBlocks.levers.workspace.test.tsx` (2 operate cases), sweep J1-J9 on the operate payload (its wrong answer is now a lost carry after modelling both numbers), replay 4 payloads x 5 clean (`qa/tutor-reports/replay/base-ten-blocks-2026-09-28.json`; operate records `one_ten_off` → `ten_bracket`).

### R23 — in-item levers on the spoken mat (read_blocks, regroup) · IMPLEMENTED 2026-09-29
- **Property:** `BaseTenBlocksDi` publishes levers from `baseTenSpokenLevers.ts` with a synchronous `pullLever` and `endPractice`. read_blocks: `block_worth` (one block of the asked size and what one is worth), `dim_others` (other sizes faded; only when another size is on the mat), `group_fives` (the asked blocks five, gap, the rest; from six), `fewer_blocks` (simplify: the same step on a mat with about half as many of the asked block). regroup: `trade_model` (a model mat with a different trade of the same sizes, before and after, with its counts; on both steps), `asked_column_glow` (predict: the receiving column glows round the blocks already there), `small_start` (simplify, predict: one or two in the receiving column; from three). Every catalog miss is answered except the click-mat ids of a mixed payload (`no_trade`, `value_changed`, `one_ten_off`, `digits_swapped`), which the catalog lists as unanswered.
- **Leak rules (code, `baseTenSpokenLevers.test.ts`):** the worth key is refused on the worth step when one block is on the mat (it would be the answer) and is never the step's answer on any number 10-999; the model trade's starting count is no session problem's, so its result is no session prediction, and it never draws on the learner's mat; with every lever pulled, no scene fact states the step's answer; a practice mat keeps the mode, place and digit count, is never the item's number or another session number, and has a new answer.
- **Credit:** practice items are ungraded and give the full item back on its own mat; the full item's answer carries the lever and is assisted (`BaseTenBlocksDi.levers.workspace.test.tsx`, 5).
- **Also (2026-09-29):** the click mat's trades land on the tap (they waited 400 ms, so a check pressed in that window judged the untraded mat); the mixed payload's regroup items are driven (`liveJourneySpec.ts`).

### R24 — build_two_ways: an open build judged on value, then different-from-first · IMPLEMENTED 2026-10-07
- **Property:** a fork, not an edit of build_number (R4 still judges build_number in standard form). The item opens on an empty svg mat (`BaseTenBuildScene`, whole-number places only); tap a column or its + button to put a block in, tap a block or - to take one out. Any blocks whose value is the target pass the first way (34 ones passes); that is not a commit: the first way is kept, drawn small above the mat, and the mat keeps it to change. "I'm done!" on the second way commits: right when the value matches and the blocks differ from the first way. No stillness check. Try again keeps the build and the first way. The mat never prints a value or a total; the instruction states the target (the task) and is code-written (`twoWaysInstruction`), as is every target (distinct in the session, at least 10, inside the range).
- **Misses:** the value misses of `plainMiss` and `same_as_first` (catalog list `build_two_ways`). Feedback never states the learner's total.
- **Scene:** numeric `valueMade` and `<place>OnMat` per place, `way` first/second, `firstWay` in words; the check sent is the blocks in words ("Second way: 2 tens and 14 ones (first way: 3 tens and 4 ones)").
- **Levers:** start bare at every tier (`startLevers` returns none; the generator sets both flags false). `column_counts` (help, every value miss; counts drawn as `data-aid`), `ten_model` (help, `same_as_first`; a ten-stick beside the ones cubes it is worth, a hundred-flat beside ten-sticks when the item is 100 or more), `smaller_number` (simplify, far off; about half, at least 10, never the number or its reversal; ungraded, then the full item on an empty mat). No total lever.
- **Live line:** `useBuildWatcher` with `numbers: 'never'` on the mat svg; off while closed or complete.
- **Probe:** `BaseTenBlocks.twoWays.workspace.test.tsx` (7), `baseTenTwoWays.test.ts` (11); generation `qa/open-build/base-ten-blocks-2026-10-07/generation.json`.
- **Compatibility:** `blocksAreTheAnswer` now includes `build_two_ways` (its check describes blocks). The catalog guidance's "the right value without the fewest blocks is not yet a build" is scoped to build.

## Conflicts

_None open._ Notes for the four M1 fixes and the lever slice:

- **Fix 1, hint (R12): compatible.** No consumer depends on the hint being shown. Keep the `hint` field in the schema and in `BaseTenBlocksChallenge` (the fixtures in the answer-channel, workspace, pip, remediation and misconception-tester tests set it, and so does the BT-5 desync rewrite), or change the schema, the type and every fixture in one slice. The fix has to cover the generator prompt (:48) and the fallback (:876) as well as the render at :831. A hint limited to how blocks look ("ten-sticks are long, ones cubes are small") is still allowed (05-19 eval).
- **Fix 2, operate total (R13): compatible if scoped by type.** It must cover the untiered default, not only easy and medium, because every saved operate payload is untiered. Flipping the component default `?? true` to off for all types would be a REGRESSION on R10: build_number's untiered total is what the answer-channel test "marks an empty / short build wrong" reads (`/you need 12/`) and what `blocks_total` starts from. After the fix, the 06-20 eval's operate scaffold row reads T/F → F/F. The tier still moves through the column counts, so R9/R10 hold.
- **Fix 3, trade feedback (R14): compatible.** R4 needs the build rejected and the learner sent to trading; HUMAN-CHECKS #70 (b) says "send you to the trade", which a generic nudge meets. The answer-channel assertion `/trade 10 ones for 1 ten/` changes in the same slice. The miss id `not_traded_up` must not change (R15, J8). The regroup-button success line "10 ones = 1 ten!" follows the learner's own trade and is not in scope.
- **Fix 4, operate payload (R16):** in progress. It is what lets J9 see operate.
- **Levers and scene facts:**
  - read_blocks' scene publishes nothing about the mat (R5). A `block_worth` fact or a lever text that carries a count or a value on read_blocks is a REGRESSION on R5.
  - `trade_model` must not change the learner's mat or its start: `tradeSolved` compares against `problem.start` (R7). A second mat must not reuse `data-base-ten-mat`, because the router tests and the journey probe select the first element with that attribute (R2).
  - `plainer_build` and `single_regroup` change targets and operands, so they re-emit the instruction (R8) and keep the band (R9).
  - `column_counts` on build_number and operate reads the learner's own blocks, which R10 already allows. On read_blocks it would contradict R5; the table does not list it there.
  - Adding a lever's `answers`, or adding ids to the catalog `unanswered` list, is additive. Removing ids from `teachingWorkspace.misses` changes R15's miss set.

## Catalog projection

Proposed only; not applied.

- **description:** one inaccuracy. "students drag blocks to build numbers" becomes "students add and remove blocks with each column's buttons to build a number (checked in standard form, fewest blocks) and add or subtract with regrouping, typing the result". The rest is faithful as of 2026-09-28.
- **constraints:** faithful (homogeneous spoken sessions, the askable-target gate).
- **evalModes:** `build_number`: "…by placing blocks in place value columns" becomes "…in place value columns; only the standard form (each column holding its digit) counts". `operate`: faithful.
- **tutoring (outside the curator prompt):** the `aiDirectives` "CHALLENGE TYPE COACHING" line says "For READ_BLOCKS: … Count each column and combine", which contradicts R6 (the child never composes the number), and "For REGROUP: Trade 10 ones for 1 ten!", which names the trade (R14's concern). `scaffoldingLevels` level2 and level3 recite the column counts and `{{currentTotal}}`, which is the answer on read_blocks. No reference to these fields was found under `components/live-activity/runtime/` (not verified at runtime). Both surfaces are workspace-only, so these lines may be unread; confirm before trimming.

## Changelog

- 2026-10-07 — R24 added (build_two_ways, open build). Compatible: no existing mode's component path, generator path or lever changes; the guidance sentence on non-standard builds is now scoped to build; the W1 fixture list gains the mode; new payload `w1-payloads/base-ten-blocks.build_two_ways.json` and a journey branch.

- 2026-09-29 — R23 added (spoken-mat levers). Compatible: an unpulled mat renders as before. The click mat's trade now updates the columns immediately; only the pulse animation is delayed.
- 2026-09-28 — R22 added (operate levers). Compatible: an untiered operate deck renders as before (counts start pulled, no total); the generator draws the same operands through the moved builders (`Math.random` stays their default).

- 2026-09-28 — R21 added (build_number levers). Compatible: an untiered or easy build renders as before (counts and total start pulled); catalog guidance trimmed by one clause to stay under the 2000-character cap with the lever doctrine; the W1 test's tool list gains `pull_lever` on build_number only.

- 2026-09-28 — R12, R13, R14, R16 fixed (handoff 21 M1, before the levers). R12: `hintLeaks` (a digit or a count word; place names are not counts) keeps a generated hint off screen, and the prompt and fallbacks ask for a way to work instead of a count; the guard hides 10 of the 18 saved payload hints, every one that stated the answer among them. R13: operate never shows the Blocks Total, whatever the tier or flag; build_number keeps its default (R10). R14: a non-standard build gets "not with the fewest blocks. Try trading up to a bigger place", never the exact trade; the miss id is unchanged. R16: `w1-payloads/base-ten-blocks.operate.json` (one generation), driven by the existing journey row. Probes: `BaseTenBlocks.answer-channel.test.tsx` (hint table, hidden hint, operate total, trade line); base-ten suites 440 green; sweep green.

- 2026-09-28 — derived (initial). 20 requirements (19 OBSERVED, 1 INFERRED), 0 open conflicts. Four are VIOLATED with fixes queued: R12 (hint), R13 (operate total, untiered included), R14 (trade feedback) and R16 (operate payload, in the working tree). Probes run: base-ten suites 7 files / 94 tests green; `journeySweep -t base-ten` 4/4 green. Occasion: step 1 of handoff 21 M1 (base-ten-blocks), before `/eval-fix` on the four content defects and the lever slice.
