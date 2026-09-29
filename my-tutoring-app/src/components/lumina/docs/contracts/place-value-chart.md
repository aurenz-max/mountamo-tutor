# Contract: place-value-chart

- **Derived:** 2026-09-28 · evidence window: eval reports 2026-03-17, 2026-05-15, 2026-06-20; DI port and drives 2026-08-18 (`qa/di/BACKLOG.md` item 18, `qa/tutor-reports/place-value-chart-live-di-*-2026-08-18.md`); misconception pilot and opportunity contract 2026-09-12 (`qa/misconception/place-value-opportunities-2026-09-12.md`, `qa/curriculum-fit/place-value-chart-2026-09-12.md`); lesson-bench packages 2026-09-06; W1 batch A1 2026-09-23 (`qa/tutor-reports/workspace-rollout-A1-2026-09-23.md`); named misses 2026-09-27 (`670039ad`); M1 lever table and defect list 2026-09-28; W1 payloads for all four modes (compare and expanded_form untracked, 2026-09-28); authored map read live 2026-09-28; catalog, generator, component, oracle source and tests
- **Component:** `src/components/lumina/primitives/visual-primitives/math/PlaceValueChart.tsx`, two controllers behind `withWorkspaceController`: the scripted judged runner (outside a live runtime: tester, DI harness) and the shared teaching workspace (live lessons). Support files: `placeValueScript.ts` (items, gates, cues, scaffolds), `placeValueWorkspace.ts` (assignment, scene, miss), `placeValueEvidence.ts`, `usePlaceValueRuntime.ts`, live adapter `components/live-activity/adapters/placeValueLive.ts` · **Generator:** `src/components/lumina/service/math/gemini-place-value.ts` (+ `placeValueRemediation.ts`, `placeValueOpportunityContract.ts`, `placeValueTeachingCapabilities.ts`) · **Catalog:** `src/components/lumina/service/manifest/catalog/math.ts` (`id: 'place-value-chart'` :584; `teachingWorkspace` :679-690; `evalModes` :691-746)
- **Status:** CONFLICTED. C1 (build's zero-trap identity vs the structural tier ladder) is open; its zone is the generator's tier structure, which no M1 fix or lever edits. R8, R9 and R6 are VIOLATED with fixes queued (handoff 21 M1).

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| Grade 1 — tens and ones (identify at medium; dictations include teens 13, 18, 19) | authored map + lesson-bench | `GET :8000/api/curriculum/primitive-mappings/MATHEMATICS`: NBT001-02-b, -02-c, -03-c, -04-a, -05-c, -06-c, -07-c (mode not recorded; objectives endpoint returns placeholders); `qa/lesson-bench/packages/*tens-and-ones*` (identify/medium: 21,19,36; 97,65,35; 81,18,13; 91,67,84) | 2026-09-28 |
| Grade 2 — routed once off-target to an addition objective (identify/easy) | lesson-bench | `…j2q2` package; `qa/lesson-bench/BACKLOG.md` item 26(f) ("noise, not filed") | 2026-09-06 |
| Grades 3-4 — digit place and worth, construct multi-digit numbers | curriculum-fit | `qa/curriculum-fit/place-value-chart-2026-09-12.md`: G3 NBT003-02-a MATCH (three-digit, incompatible with compare's 1111-9999), G4 NBT004-02-d MATCH, NBT004-01-b bound for the pilot | 2026-09-12 |
| Grade 4 NBT004-01-b — compare/medium observation source, adaptation and certified retest (shared hypothesis with base-ten-blocks read_blocks) | misconception loop | `qa/misconception/place-value-opportunities-2026-09-12.md`; HUMAN-CHECKS #113 (OPEN); catalog `learningObservations` | 2026-09-15 |
| Spoken DI on the scripted runner (find_place, say_value, dictated build; all four modes) | DI drives + mic row | `qa/tutor-reports/place-value-chart-live-di-{plain,signature}-2026-08-18.md`, `…-2026-09-12.md`; HUMAN-CHECKS #113 (= #63 acceptance material, OPEN) | 2026-09-12 |
| Live tutor on the shared teaching workspace (W1, all four modes, the lesson path) | workspace rollout + journey sweep | A1 report 2026-09-23 (build text PASS, identify audio PASS); handoff 20 A2 (misses); HUMAN-CHECKS #167; `qa/tutor-reports/place-value-chart-w1-*-2026-09-23.json` | 2026-09-28 |
| Handoff 21 M1 in-item levers (approved, not built) | lever table | `qa/support-levers/m1-lever-tables-2026-09-28.md` § place-value-chart | 2026-09-28 |
| Support tiers: scaffold withdrawal + non-zero-digit ladder | eval sweep | `qa/eval-reports/place-value-chart-2026-06-20.md` (4/4 PASS) | 2026-06-20 |
| Content-contract QA (click-era model of the payload) | oracle | `service/qa/oracles/place-value-chart.ts` + tests | ongoing |
| IRT/mastery submission | evaluation hooks | `usePrimitiveEvaluation` in `handleFinished` | ongoing |
| Pip shared surface | pip rollout | `pip/PlaceValueChart.surface.test.tsx` | 2026-09-15 |

Calibration channel [4] not read (needs auth). No topic-fidelity or reader-fit report exists for this primitive.

## Requirements

### R1 — each eval mode owns a magnitude band; numbers are code-picked · OBSERVED
- **Property:** `identify` 11-99, `build` 111-999, `compare` 1111-9999, `expanded_form` 1111-99999 (`MODE_PROFILES`), drawn by the number pool service. The wrapper model writes only title, description and flags; a manifest `numberRange` overrides the band. Every kept target is a whole number 11-99,999 (`isInBandTarget`), and a zero digit is never the glowing digit (`isAskablePlace`); the generator and the component run the same predicates and DROP, never repair.
- **Demanded by:** catalog constraints; IRT task identity; the oracle `scope`/`schema` checks; the spoken vocabulary (`place_value_word` covers one digit's worth only).
- **Evidence:** `gemini-place-value.ts` `buildChallenges`, the drop filter at :893-910; `placeValueScript.ts` :118-168.
- **Probe:** `PlaceValueChart.di-script.test.ts` "band and askability gates", "an unaskable challenge drops whole, never repaired"; 06-20 eval (magnitude invariance PASS); oracle "flags scope …", "flags schema — highlighted place lands on a zero digit".

### R2 — a challenge is analyzed or dictated, never both · OBSERVED
- **Property:** kept challenges alternate roles. ANALYZE prints the number with one digit glowing and yields `find_place` then `say_value`; DICTATE never prints the number and yields `build_number`. `build` mode starts on dictate, every other mode on analyze. A number is dictated at most once; a `say_value` whose value word was already said (by an ask or inside a dictation) is dropped; a place ask with the same place and digit as the previous one is dropped; place asks over a fresh digit are kept. At most 12 items, whole challenges only. The live adapter rejects a payload with no askable item, more than 12 challenges or duplicate ids.
- **Demanded by:** pedagogy rule #1 (a printed number dictated is an echo-copy; a dictated number's value words answer a later value ask); the DI port's leak gate; the certified retest (R14 compiles items with this function).
- **Evidence:** `itemsFromChallenges`; `validatePlaceValueData` in `placeValueLive.ts`.
- **Probe:** di-script "analyze/dictate rotation" block (7 tests); journey sweep `-t place-value` (4 payloads, the adapter validates each).

### R3 — an analyze item shows the numeral only; the place name appears only after credit · OBSERVED
- **Property:** on `find_place` and `say_value` the stage renders the comma-grouped numeral with one digit glowing: no column headers, no multiplier row, no expanded form. The place name under the numeral renders only on `find_place` and only while `revealHeld` after an affirmed answer. The reward line (digit, place, worth) also waits for `revealHeld`. The scene publishes `printedNumber` and `glowingDigit` and says the number is printed without column labels.
- **Demanded by:** pedagogy rule #1 (on "which place?" a labelled column is the answer); the DI port ("the chart is an answer key in pixels"); the tutor guidance ("A printed number shows no column labels").
- **Evidence:** `renderNumeral` (`PlaceValueChart.tsx:473-505`), reward at :696; `workspaceScene`.
- **Probe:** `PlaceValueChart.workspace.test.tsx` "identify: the place name reveal waits for the credited answer, then the value ask opens" (no "4 — tens" before credit); "a printed number publishes its spoken key …" (scene facts).

### R4 — a dictated number is never printed or published; the tutor says it · OBSERVED
- **Property:** on `build_number` the target appears nowhere on screen or in the scene: the assignment is `response: 'gesture'` with no `expectedAnswer`; the task text carries the dictation words; the scene publishes only `columns` and `columnsFilled`. The labelled chart (place-name headers over one input per column) is the page. The tutor guidance tells the tutor to say the number before the learner writes (added after the A1 audio run where the tutor opened a dictation without saying it).
- **Demanded by:** the build mode's identity (dictation, catalog `evalModes.build`); the W1 tutor (A1 finding); pedagogy rule #1.
- **Evidence:** `workspaceAssignment`, `workspaceScene`; catalog guidance :681-683; A1 report "The tutor omits what the screen withholds".
- **Probe:** workspace "a printed number publishes its spoken key; a dictated number never publishes its digits" (`demand` has no 45, task contains "forty-five"). The A1 guidance sentence has not been re-driven (A1 report).

### R5 — the chart checks itself on stillness, whatever it holds · OBSERVED
- **Property:** there is no Check or Next control. Every edit re-arms a stillness window: 4000 ms while any column is empty, 1500 ms once every column holds a digit; a keystroke never commits. The commit is never gated on correctness or completeness: a half-written chart that stays still commits and is checked wrong (`zero_left_empty` or `column_empty`). The match is computed in code (`chartMatches`) and the tutor is told what was written and whether it matches.
- **Demanded by:** the named misses (R7): `zero_left_empty` and `column_empty` exist only because an incomplete chart commits; the scripted correction's incomplete-chart line ("a column I hear nothing for gets a zero"); the workspace aid `every-column-needs-a-digit`; HUMAN-CHECKS #113 step 5 ("check the ~4s stillness commit"); DI port record ("stillness close 4000/1500ms").
- **Evidence:** `armWriteSettle`, `WRITE_SETTLE_MS`/`WRITE_COMPLETE_SETTLE_MS` (`PlaceValueChart.tsx:181-184`, :439-445), component docblock "never correctness-gated"; `buildVerdictCue` incomplete branch.
- **Probe:** workspace "build: the chart checks a still, full chart, Try again clears it, and a right one completes once"; "build: a half-written chart that stays still commits and is checked wrong, as on the runner"; di-script "an incomplete chart gets the every-column-gets-a-digit line, not the walk".

### R6 — tutor-facing text describes the commit as it happens · OBSERVED · FIXED 2026-09-28
- **Property:** what the tutor and observer read about the build check matches R5: the chart checks when the learner stops writing, full or not.
- **Demanded by:** the live tutor, which reads the catalog guidance and the scene `constraints` fact; a tutor told the chart waits for a full chart would stay silent over a half-written one, or say it has not been checked when it has.
- **Evidence:** VIOLATED in three places, all written in `5a749406` (2026-09-23), the same commit that added the R5 test: scene constraint `placeValueWorkspace.ts:74` ("checks the number once every column is filled and the learner stops"), catalog guidance `math.ts:682-683` (same wording), and the journey-spec comment `liveJourneySpec.ts:768` ("a half-written chart never commits", a code comment only). The stillness commit predates them (2026-08-18 port) and the misses that depend on it came later (2026-09-27).
- **Verdict:** the behavior is intended; fix the text, not the commit.
- **Probe (to add with the fix):** the build scene `constraints` fact and the catalog guidance say the chart checks when the learner stops, and neither says "once every column is filled"; R5's two workspace tests unchanged.

### R7 — a wrong chart names one miss from a fixed list; spoken items name none · OBSERVED
- **Property:** `placeValueMiss` returns, for a wrong build: `zero_left_empty` (only zero columns empty), `column_empty`, `digits_swapped`, `teen_ty_swap` (last two columns, 13↔30 shape), `one_short`, `one_over`, `one_ten_off`, `short_by_more`, `over_by_more`; undefined for a right chart and for `find_place`/`say_value`. The catalog declares the same nine for all four modes. The committed description is "Wrote {place}: {digit or empty}, …" in the learner's terms.
- **Demanded by:** the W1 tutor/JEV (handoff 20); the M1 levers, each of which declares the misses it answers (J9); capture (a named miss is stored beside its phase).
- **Evidence:** `placeValueWorkspace.ts:37-61`; catalog `teachingWorkspace.misses`.
- **Probe:** `placeValueWorkspace.test.ts` (11 rows + "a spoken item names no miss"); `placeValueCapture.test.ts` "records a named miss beside its phase and eval mode …".

### R8 — the readout under the chart is the learner's own writing · OBSERVED · FIXED 2026-09-28
- **Property:** the number readout and the expanded-form readout show only digits the learner wrote, in neutral colour at every tier (no match colouring). An empty column reads as empty, never as 0.
- **Demanded by:** pedagogy rule #1 and R5/R7: the check marks a chart with an empty zero column wrong (`zero_left_empty`), and the correction teaches that writing the zero is the learner's job, so a readout that supplies the zero contradicts the verdict; the component docblock ("the readout survives as the child's own trace"); the M1 `expanded_readback` lever ("the learner's own digits").
- **Evidence:** VIOLATED at `PlaceValueChart.tsx:515` (`digitsByPlace[p] || '0'`) and :517 (the expanded parts treat an empty column as 0 and drop it): for 501 written "5 _ 1" the readout shows "501" and "500 + 1", both correct-looking, while the chart is checked wrong with `zero_left_empty`. No test covers the readout.
- **Probe (to add with the fix):** mount a build item for 501, write 5 and 1 with tens empty: no element reads "501" or "500 + 1"; after settle the miss is `zero_left_empty`. A full "5 0 1" still shows its readout.

### R9 — the build correction models a foreign number of the same width · OBSERVED · FIXED 2026-09-28
- **Property:** after a wrong full chart, the scripted correction walks `modelNumber` column by column and re-dictates the target, never the target's own walk. `modelNumber` is not a session number (printed or dictated), carries a zero column, has the same number of digits as the chart, and shares no digit in any column with the target.
- **Demanded by:** the scripted DI correction ("modeling the target's own walk would turn the retry into a copy task"; a shared column digit is part of that copy); the M1 `model_chart` lever ("model ≠ target, not a session number, no shared column digit"), which needs a model the width of the chart it sits beside.
- **Evidence:** holds: foreign and carries a zero (di-script test). VIOLATED: `buildModelFor` caps width at 3 (`placeValueScript.ts:263-267`, `Math.min(3, magnitude)`), so the 4- and 5-digit candidates are unreachable, and it never compares digits with the target. On the saved payloads: identify dictates 44 → model 40 (tens 4 shared); build dictates 501 → 306 (tens 0 shared); compare dictates 3580 → 306 (3 digits for a 4-column chart); expanded_form dictates 72603 → 306 (3 digits for 5 columns, tens 0 shared). The lever table's case, 406 → 306, shares tens 0 and ones 6. The workspace path does not speak this correction (the tutor teaches in its own words); the scripted runner and DI harness do (2026-08-18 build drive: "the foreign model walk on 306").
- **Probe:** di-script "a wrong chart is corrected on a FOREIGN model number, then re-dictated" (holds today; its fixture is 3156, whose 3-digit model it accepts). **To add with the fix:** for every dictated item in the four `w1-payloads/place-value-chart.*.json` and for 406, `magnitudeOf(modelNumber) === chartPlaces.length`, no column digit equal to the target's, not a session number, contains a 0.

### R10 — spoken asks never contain their answer · OBSERVED
- **Property:** `find_place` asks "Find the glowing {digit}. Which place is it in?" and, at easy and medium only, lists the chart's places (the one exempt span); `say_value` names the place and never the digit (the ones-place leak fixed 2026-08-18); no greeting or how-to-play names a place or a value; the easy-tier worked example for `say_value` uses a value word the session never says; stimulus lines describe shape only. The misstep aids (`METHOD`, `AIDS`) never contain a place word, a value or the number.
- **Demanded by:** pedagogy rule #1; the DI cap drill (HIGH fixed class-wide); the judged conformance contract.
- **Evidence:** `askFor`, `leakExemptSpanFor`, `howToPlayFor`, `stimulusFor`, `METHOD`/`AIDS` in `placeValueScript.ts`.
- **Probe:** di-script "leak rules" block (6 tests); `PlaceValueChart.runtime.test.tsx` `describeJudgedConformance` (leak numbers 4, 40, 45 and place words) plus the two routing tests.

### R11 — the spoken judge: place name for place, worth for worth · OBSERVED
- **Property:** on `find_place` the answer is the place name; the value or the bare digit said instead is wrong. On `say_value` the answer is the worth word ("forty", "three hundred"); the bare digit is wrong, the digit at a shifted place is wrong, the unit form ("four tens") is accepted. In the ones place digit and worth coincide and the shifted place is the signature miss. Where place 4 is askable, a bare "thousands" for the ten-thousands column is wrong. Affirmations open "Yes", corrections open "My turn:", and the correction is the same line on every wrong answer.
- **Demanded by:** the DI drives (compare signature 5/5 refused, 5/5 affirmed, 2026-08-18; plain/signature/independent 2026-09-12); HUMAN-CHECKS #113; the misconception hypothesis `digit_face_value_for_worth`; catalog `aiDirectives`.
- **Evidence:** `discriminationFor`, `correctionFor`, `affirmFor`, `placeValueHarnessAnswers`.
- **Probe:** di-script "the ones place collapses digit and worth", "the ten-thousands ear", "verdict wording", "harness answers mirror the discrimination"; the Live drives above (paid; re-run only when the spoken contract changes).

### R12 — tiers: the menu, the model clause, and two chart scaffolds · OBSERVED
- **Property:** the component reads an absent `supportTier` as medium. `find_place` lists the places at easy and medium, not at hard; `say_value` carries the worked example at easy only. The generator sets `showMultipliers` (the ×10ⁿ row) on at easy only and `showExpandedForm` (the learner's expanded readback) on at easy and medium; with no tier both are on, which is every saved payload. Both render only on build items (R3). The tier also raises the non-zero-digit floor (build 2 → 3, compare 2 → 3 → 4, expanded_form 2 → 3 → 4; identify has no room) and moves the glowing digit from an edge to the interior. Magnitude never changes.
- **Demanded by:** the 06-20 sweep (scaffold flips and structural ladder PASS); the M1 `column_worth` and `expanded_readback` levers, whose starting positions these two flags will be.
- **Evidence:** `resolveSupportStructure`, `resolveProblemShape`, `enforceNonZeroDigits`; component defaults `showExpandedForm = true`, `showMultipliers = true` (:232-233); `namesChoices`.
- **Probe:** 06-20 eval table; di-script "the place name lives ONLY in the menu clause, and hard names no menu", "the easy-tier model example never uses a VALUE word this session says".

### R13 — W1 binding under the live runtime · OBSERVED
- **Property:** in a live runtime with a resolved pin, the workspace controller replaces the scripted runner: owner `tutor`, `begin_help` the only tutor tool, no scripted cue or `[PV` tag sent, no hear-again button. A spoken item publishes `expectedAnswer` (the place word or worth word). Try again clears the chart; a right chart is credited once, completes once and submits once; the correct sound plays once.
- **Demanded by:** the live tutor/JEV (handoffs 15, 20); journey sweep J1-J8; the M1 levers (they add `pull_lever` to this tool list).
- **Evidence:** `withWorkspaceController`, `useWorkspaceController`, `workspaceAssignment`.
- **Probe:** `PlaceValueChart.workspace.test.tsx` (all 5 tests; the tool-list assertion `['begin_help']` changes in the lever slice); `journeySweep.test.tsx -t place-value` (4/4 green 2026-09-28).

### R14 — compare/medium is an observation source with a certified retest · OBSERVED
- **Property:** delivery is eligible only for `targetEvalMode: 'compare'` at `difficulty: 'medium'`, Grade 3 or 4, with no numeric anchor in topic, intent or objective (the reviewed NBT004-01-b text excepted). With a validated `contrast_digit_worth` or `contrast_place_name_and_value` move, `selectPlaceValueContrast` changes at most two analyze slots so two `say_value` items share a digit at different places, keeping 1111-9999, each slot's non-zero count and the compiled item ids and kinds. Certification compiles the items with `itemsFromChallenges` and binds `placeValueContentIdentity` (challenge ids, numbers, highlighted places, place range, `supportTier`, `challengeType`). The observation text never reaches the wrapper model or the child.
- **Demanded by:** the misconception loop and its backend certification (HUMAN-CHECKS #113; `qa/misconception/place-value-opportunities-2026-09-12.md`); the shared base-ten hypothesis.
- **Evidence:** `placeValueRemediation.ts`, `placeValueOpportunityContract.ts`, `placeValueTeachingCapabilities.ts`, generator :862-878.
- **Probe:** `placeValueRemediation.test.ts` (all cases), `gemini-place-value.remediation.test.ts` (4), `placeValueMisconception.test.ts`.

### R15 — every attempt is evidence; one submission per session · OBSERVED
- **Property:** the scripted pack's `observation` records a written build as `write N from dictation` with the columns as written (`·` for empty) and a spoken answer with its transcript (the heard text kept on an affirmed attempt). The session submits once with `success = every item solved`, `challengeResults`, `diagnosisEvidence`, `learningResponses`, teaching attempts when present, and the opportunity evidence with a SHA-256 content hash when an opportunity is set.
- **Demanded by:** IRT/mastery; the misconception loop (R14); capture.
- **Evidence:** `pack.observation`, `handleFinished` (`PlaceValueChart.tsx:288-349`); `placeValueEvidence.ts`.
- **Probe:** `PlaceValueChart.capture.test.tsx` (4); `placeValueCapture.test.ts` (6); `placeValueEvidence.test.ts` (2).

### R16 — the payload keeps the oracle's click-era fields valid · OBSERVED
- **Property:** each challenge still carries `placeNameChoices` (the right place name once) and `digitValueChoices` (the right value once, no duplicates), `minPlace`/`maxPlace` that can build the target, and a session has at least 3 challenges. The component reads none of the choice arrays.
- **Demanded by:** the content oracle, whose header still describes the click-era phases.
- **Evidence:** `buildPlaceNameChoices`, `buildDigitValueChoices`, rebuilt after adaptation (generator :872-879); `PlaceValueChartChallenge` comment "READ BY NOTHING".
- **Probe:** `service/qa/oracles/__tests__/place-value-chart.test.ts` (11).

### R17 — every mode has a saved payload that the journey drives · OBSERVED
- **Property:** `w1-payloads/place-value-chart.{identify,build,compare,expanded_form}.json` exist; the journey row writes a dictated chart by column label (`placeLabel`) and answers spoken items from `placeValueHarnessAnswers`.
- **Demanded by:** the lever slice (J9 must see every mode); the sweep gate.
- **Evidence:** identify and build committed 2026-09-23; compare and expanded_form present in the working tree, untracked (2026-09-28). All four are untiered.
- **Probe:** `journeySweep.test.tsx -t place-value`: 4 payloads, green.

### R18 — Pip shares the stage and never writes · OBSERVED
- **Property:** Pip points at the stage as a whole, never a digit or column; it looks at the column the learner focuses (`data-pip-object="digit-{place}"`), receives on judging, celebrates on reveal. It never writes, judges or advances.
- **Demanded by:** Pip shared-surface rollout.
- **Evidence:** `PlaceValueChart.tsx:407-420`, :545-547, :687-690.
- **Probe:** `pip/PlaceValueChart.surface.test.tsx` (2).

### R19 — in-item levers on dictated build items (slice 1) · IMPLEMENTED 2026-09-28
- **Property:** `placeValueLevers.ts` declares on every build_number item, with a synchronous `pullLever`: `model_chart` (a small chart of the correction's own `modelNumber`, R9, beside the learner's; plain boxes, no input, no place-label aria-label, no digit pip object), `column_worth` and `expanded_readback` (the tier's `showMultipliers`/`showExpandedForm` are their starting positions, never recorded pulls; still only on build items, R3/R12), `model_teen` (a teen and its -ty from a digit the item does not use in its last two places) and `plain_number` (simplify; an ungraded dictation with the same places, no zero, no teen, no shared column digit, no session number, only when the item has a zero or a teen; `data.challenges` and the item list are untouched). Each declares the `placeValueMiss` ids it answers (J9). The spoken asks (find_place, say_value) declare no levers yet.
- **Evidence:** `placeValueLevers.test.ts` (13, incl. plain_number over 4000 targets), `PlaceValueChart.levers.workspace.test.tsx` (3), W1 binding test (tools gain `pull_lever` on build items only), sweep J1-J9 on four payloads, replay 4 payloads x 5 clean (`qa/tutor-reports/replay/place-value-chart-2026-09-28.json`).

### R20 — in-item levers on say_value · IMPLEMENTED 2026-09-29
- **Property:** say_value publishes `model_value` (help: a model number of the same width with a different digit glowing in the same place and its worth written under it) and `block_picture` (help: the glowing digit drawn as that many blocks of its place, no numeral or word; tens and above). find_place has no lever: any place label, on the item or on a model, names its answer by column position; its own misses (`said_value`, `next_place`, `other_place`) are listed as unanswered.
- **Leak rules (code, `placeValueLevers.test.ts`, 400 sessions):** the model digit is never the item's and its worth is no say_value answer in the session; no scene fact names a place or states the answer.
- **Evidence:** `PlaceValueChart.levers.workspace.test.tsx` (say_value: both levers beside the number in one commit, credit assisted). A second build payload (`place-value-chart.build-g2.json`) carries a say_value ask; the first spends its values in dictation.

## Conflicts

### C1 — R12 (structural tier) vs build's zero-trap identity (R4/R5/R7) — OPEN
The `build` catalog mode says "the zero-trap (four hundred six is 4-0-6, not 46) is the target skill", and the DI port, `wrongBuildFor` (406 → 460) and the `zero_left_empty` miss all serve it. The 06-20 tier ladder treats zeros as the easy case: at medium and hard it forces every column of a 3-digit number non-zero (`enforceNonZeroDigits`, floor 3 = the band's width), so a tiered build session never dictates a zero. Real lessons pass a tier (every lesson-bench package does). Compare and expanded_form lose most zeros the same way at hard. Both demands are observed. No M1 fix or lever edits the ladder, so this does not block M1; it does mean `plain_number` ("offered only when the item has a zero or a teen") is never offered on tiered build items. Resolving it is a decision about what the tier ladder means for dictation (config axis rung: the non-zero floor applied to analyze numbers only, or zero placement as the build lever), for `/pm` to route.

Notes for the M1 fixes and levers (none is an open conflict today):

- **Fix 1, readout (R8): compatible.** No test reads the readout. The same change must cover the expanded-form line (:517), which `expanded_readback` will show.
- **Fix 2, text (R6): compatible.** Change the scene constraint, the catalog guidance and the journey comment; do not change `WRITE_SETTLE_MS`, the R5 tests or the incomplete-chart correction. Changing the behavior to "checks only when full" would be a REGRESSION on R5 and R7 (`zero_left_empty` and `column_empty` could never be observed) and on the incomplete-chart correction.
- **Fix 3, model (R9): compatible.** It changes spoken correction text on the scripted runner only; the di-script test's assertions (foreign, re-dictated, contains a 0) still hold. The model must also avoid the target's column digits when the target has a zero, so a zero column may need to sit where the target's is non-zero (406 → a model with its zero in the hundreds is impossible; a 3-digit model like 520 avoids 4, 0 and 6 column-wise). `model_chart` should reuse this function, not copy it.
- **Levers:**
  - `column_worth` is the `showMultipliers` row and `expanded_readback` is the `showExpandedForm` line. Treat the flags as starting positions, never as pulls (base-ten R10 precedent). Changing their untiered default (on) or their tier values changes R12's 06-20 flips. Neither may ever render on an analyze item: a ×10 row above the glowing digit answers `find_place` and gives `say_value`'s worth (R3).
  - `model_chart` and `model_teen` draw a second chart. It must not use `<input>` elements, `aria-label` equal to a place label, or `data-pip-object="digit-…"`: the workspace test reads `querySelectorAll('input')` by index, the journey writes by `placeLabel`, and the Pip test selects `[data-pip-object^="digit-"]` (R5, R17, R18). Its number must not be a session number and must not carry a (digit, place) pair a later `say_value` item asks, or it speaks that item's answer (R2's value-word dedup; `buildModelFor` does not check this either). For identify, the 2-digit candidates are 40/70/90, so `model_teen` needs its own foreign teen.
  - `plain_number` must not change `data.challenges`, the item list or item ids. It is an ungraded side item. Changing any of these changes `placeValueContentIdentity` and breaks the certified retest (R14). Its number must not be a printed session number (R2 echo-copy).
  - `glowing_place_label` belongs on `say_value` only, whose ask already names the place. It must be cleared when the item changes. `find_place` uses the same slot under the numeral, and the next item is often a `find_place` on a new number, where the label is the answer (R3). The lever table's "find_place: no lever" matches R3.
  - **Spoken items.** Their consumers are R11 (DI drives, mic #113), R14 (certified `say_value` retest items, judged on `answer_text` and the numeric worth) and R15 (evidence). A help lever pulled on a certified `say_value` item has to be recorded as assistance on that attempt, or the retest credits an assisted answer. The lever texts must follow R10: no place word on `find_place`, no worth on `say_value`.
  - Adding `pull_lever` changes the `['begin_help']` assertion in the W1 test in the same slice. Adding lever `answers` is additive. Removing ids from `teachingWorkspace.misses` changes R7.

## Catalog projection

Proposed only; not applied.

- **description:** faithful as of 2026-09-28.
- **constraints:** faithful.
- **evalModes:** `build`: "the zero-trap … is the target skill" holds only untiered and at easy (C1). Leave the wording alone until C1 is ruled on, because the fix may be in the generator rather than the text.
- **teachingWorkspace.guidance (outside the curator prompt):** "the chart checks the written digits itself once every column is filled and the learner stops" becomes "the chart checks the written digits itself when the learner stops writing, whether or not every column is filled" (R6).

## Changelog

- 2026-09-29 — R20 added (say_value levers). Compatible: the draft `glowing_place_label` was replaced by the model, because a label beside the item names the place.
- 2026-09-28 — R19 added (build-item levers). Compatible: an untiered build item renders as before (worth row and read-back start pulled); the model and teen charts render only when pulled and outside the learner's chart.

- 2026-09-28 — R6, R8, R9 fixed (handoff 21 M1, before the levers). R6: the behavior was right; the scene constraint, the catalog guidance and the journey comment now say a written chart is checked once the learner stops, even with a column empty. R8: the readout reads back only a full chart; an empty column shows as a gap ("5 _ 1"), and the expanded form waits for a full chart; mounted probe in `PlaceValueChart.workspace.test.tsx`, mutation-checked. R9: `buildModelFor(target, width, session, askedPairs)` builds a model as wide as the chart, never a session number, no column digit shared with the target or with a say_value ask, a zero where the target has none; `placeValueModel.test.ts` over every seventh target to 99999. Also: compare and expanded_form payloads saved. Compatible: place-value suites and sweep green.

- 2026-09-28: derived (initial). 18 requirements (all OBSERVED), 1 open conflict (C1, outside the M1 zone). Three are VIOLATED with fixes queued (handoff 21 M1): R6 (stale "checks only when full" text; the behavior is right), R8 (readout fills empty columns with 0) and R9 (model number capped at 3 digits and sharing column digits). R17's compare and expanded_form payloads are untracked in the working tree. Probes run: place-value suites 12 files / 121 tests green; `journeySweep -t place-value` 4/4 green. Occasion: step 1 of handoff 21 M1 (place-value-chart), before `/eval-fix` on the content defects and the lever slice.
