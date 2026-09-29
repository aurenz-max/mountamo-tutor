# Contract: number-bond

- **Derived:** 2026-09-28 · evidence window: eval report 2026-06-14, topic traces 2026-06-12 to 2026-08-08, live DI reports 2026-08-14, K band-floor re-audit 2026-09-08, K held-floors probe 2026-09-09, W1 report 2026-09-23, handoff 20 A2 (2026-09-27), saved payloads to 2026-09-28 (commit `763e5e98`), authored map read live 2026-09-28, catalog/generator/component/oracle source and tests
- **Component:** `src/components/lumina/primitives/visual-primitives/math/NumberBond.tsx` (+ `numberBondScript.ts`, `numberBondModes.ts`, `numberBondSplit.ts`, `numberBondWorkspace.ts`, `SplitAndSayBoard.tsx`, `useNumberBondRuntime.ts`) · **Generator:** `src/components/lumina/service/math/gemini-number-bond.ts` · **Catalog:** `src/components/lumina/service/manifest/catalog/math.ts` (`id: 'number-bond'`, :3484; `teachingWorkspace` :3485-3500; `evalModes` :3585-3660)
- **Status:** ACTIVE. No open conflict. Four requirements are VIOLATED with fixes queued (R4 as NB-REP-1; R12, R13, R14 as handoff 21 M1 "fix first" items). Static derivation plus the authored map; no live census. Written before the handoff 21 M1 lever slice.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K — decompose wholes to 5, every pair, each pair kept on screen (OPS001-01-D, OPS001-02-B) | K Math atlas + topic traces + lesson-bench | `qa/curriculum-coverage/math-k/review.json`; `qa/topic-traces/counting-to-10-2026-08-08.md`; `qa/topic-traces/pairs-that-make-10-2026-06-12.md`; lesson-bench packages "decompose numbers up to 5" 2026-09-06 | 2026-09-09 |
| K — teen numbers as a ten and some ones, K.NBT.1 (COUNT001-05-B..F) | K Math atlas + live draws | atlas rows; `qa/curriculum-coverage/math-k/evidence/COUNT001-05-D-number-bond-ten_and_ones-{1,2}.json`; EVAL_TRACKER NB-1 (resolved by the `ten_and_ones` fork 2026-09-08) | 2026-09-22 |
| K — related facts / inverse operations, said out loud (OPS001-02-G, OPS001-03-F) | K Math atlas + probe | `qa/eval-reports/k-held-floors-2026-09-09.md` (probe 18/18); `qa/reader-fit/k-band-floor-2026-09-08.md` | 2026-09-09 |
| K — missing part within 5 said aloud (OPS001-03-E, OPS001-03-F) | K Math atlas + live Live drives | `qa/tutor-reports/number-bond-w1-2026-09-23.md` (missing_part --audio PASS x2) | 2026-09-23 |
| Grade 1 — bonds to 10, fact family and number sentences (inverse relationship) | topic traces + eval report | `qa/topic-traces/subtraction-within-20-2026-06-14.md` (fact_family); `qa/eval-reports/number-bond-2026-06-14.md` | 2026-06-14 |
| Authored map, MATHEMATICS: 10 of 111 mappings (OPS001-03-b, -03-c, -04-b, -05-b, -05-d, -06-b, -07-b, -08-a, -09-b, -10-a; mode not recorded) | channel [3] | `GET :8000/api/curriculum/primitive-mappings/MATHEMATICS`, read 2026-09-28 | 2026-09-28 |
| Live tutor on the shared teaching workspace (W1, all six modes bound) | workspace rollout + journey sweep | `qa/workspace-rollout/ROLLOUT.md`; `qa/tutor-reports/number-bond-w1-2026-09-23.md`; handoff 20 A2 row | 2026-09-28 |
| Standalone judged DI runner (scripted cues, non-workspace hosts) and its headless drive plan | DI pack + drive plan + live DI reports | `numberBondScript.ts`; `service/qa/di/numberBondDrivePlan.test.ts`; `qa/tutor-reports/number-bond-live-di-{plain,signature}-2026-08-14.md` | 2026-08-14 |
| Handoff 21 M1 in-item levers (approved, not built) | lever table | `qa/support-levers/m1-lever-tables-2026-09-28.md` § number-bond | 2026-09-28 |
| IRT/mastery + content QA across all modes | evaluation hooks + oracle | `usePrimitiveEvaluation` submit; `service/qa/oracles/number-bond.ts` | ongoing |
| Pip shared surface | pip rollout | `qa/pip-surface/ROLLOUT.md`; `pip/NumberBond.surface.test.tsx` | 2026-09-14 |

Calibration channel [4] not read (403, needs auth).

## Requirements

### R1 — each eval mode emits its own challenge type, and the symbolic modes stay Grade 1 · OBSERVED
- **Property:** `decompose`→`decompose`, `ten_and_ones`→`ten-and-ones`, `missing_part`→`missing-part`, `related_fact`→`related-fact`, `fact_family`→`fact-family`, `build_equation`→`build-equation`. At K only decompose, ten-and-ones, missing-part and related-fact survive: the generator strips the other two and `itemsFromChallenge` drops them again. `fact_family` stays Grade 1 because building written equations is its declared skill; its K rows are served by `related_fact`/`missing_part`.
- **Demanded by:** manifest routing, IRT task identity, the K band floor ruling.
- **Evidence:** catalog `evalModes[].challengeTypes`; generator `validTypes`/`kOnlyTypes`; `numberBondScript.ts` `K_KINDS`; `qa/reader-fit/k-band-floor-2026-09-08.md` (fact_family HELD at PRE).
- **Probe:** `__tests__/NumberBond.di-script.test.ts` "DROPS out-of-range wholes and symbolic modes at K" and "maps modes to the ruled answer material and benched classes"; oracle `schema`.

### R2 — number windows: K wholes 2-5, Grade 1 wholes 2-10, ten_and_ones wholes 11-19 · OBSERVED
- **Property:** outside `ten-and-ones`, every whole is in 2..min(maxNumber, 10), with maxNumber clamped to 5 at K and 10 at Grade 1, and a manifest maxNumber override can only narrow it. `ten-and-ones` wholes are code-owned: `resolveTeenWindow` reads the lesson's window and `teenSweep` assigns the wholes, clamped to 11-19 at both bands; the K cap does not bind because the answer is a placement. A harder support tier never changes a magnitude.
- **Demanded by:** K rows capped at 5, COUNT001-05-* (teen), topic fidelity (grade = ceiling), EVAL_TRACKER NB-1 (the cap-below-objective defect that forced the fork).
- **Evidence:** generator maxNumber clamp and teen block; `teenWindow.ts`; commit `789ae81e`; oracle `scope`.
- **Probe:** di-script "takes the teen window, not maxNumber" and "DROPS a whole outside 11-19"; `teenWindow.test.ts`; oracle tests "flags scope" and "accepts a teen whole for the ten-and-ones mode without widening bonds-to-10".

### R3 — build gates drop an unaskable item and never backfill it · OBSERVED
- **Property:** a known part must be 1..whole−1, checked by the one shared predicate `isValidBondPart` (the generator imports it to repair, the script uses it to drop). Every spoken answer is in 1..20, and in practice 1..9. A related-fact bond with equal parts is repaired by the generator and dropped by the script. Duplicate challenge ids and consecutive same-content challenges (type + whole + part1) are dropped. `allPairs` is recomputed in code and never trusted from the model.
- **Demanded by:** the spoken judge's benched range (zero is not benched); related_fact's two different answers; the ruling that N challenges must be N problems.
- **Evidence:** `numberBondScript.ts` `itemsFromChallenge`/`buildBondItems` docblocks; generator per-challenge validation; commit `404c5877`.
- **Probe:** di-script "build gates" block (5 tests); oracle "flags answer-key-desync" tests.

### R4 — a session's challenges are different bonds · OBSERVED · **VIOLATED (NB-REP-1, queued `/eval-fix`)**
- **Property:** the N challenges of one session are N different bonds, and the answers vary across them.
- **Demanded by:** the N-challenges-N-problems ruling, oracle `clustering`, and the lever slice, since J9 sees only the items a payload produces.
- **Evidence:** oracle `clustering` (identical card, answer spread); EVAL_TRACKER NB-REP-1. The four payloads saved 2026-09-28 each repeat one bond: decompose 5 x3, related_fact 5=1+4 x3, fact_family 10=3+7 x5, build_equation 10=5+5 x5. Because `buildBondItems` drops consecutive same-content challenges, each of those payloads runs one logical item. The missing_part and ten_and_ones payloads vary as required.
- **Probe:** run oracle `clustering` over a fresh generation per mode. The saved payloads under `components/live-activity/runtime/testing/w1-payloads/number-bond.*.json` must produce more than one logical item after `buildBondItems`.

### R5 — decompose: every pair, one hand turn and one spoken turn per pair, found pairs stay on screen · OBSERVED
- **Property:** a whole w has ⌊w/2⌋+1 pairs, zero included, and each becomes a build phase and then a say phase. The split commits only on stillness with every counter placed, so an incomplete split is exploration and never commits. It is accepted when its sum is right and the pair is new. The say phase asks about the non-empty part, so zero is never spoken. The same counters move between the whole and the parts, and the child's banked pairs stay visible ("Ways found: k of N", with "(with help)" marked). A capped hand turn may show a tutor example with an unused pair, attributed to the tutor.
- **Demanded by:** OPS001-01-D, OPS001-02-B ("every decomposition retained on screen"), K.OA.3.
- **Evidence:** `numberBondSplit.ts` (`validSplit`, `prepareSplit`, `splitQuestion`); component `armSplitSettle`, found-pairs panel; commit `6d09ee9d`.
- **Probe:** `__tests__/NumberBond.split-and-say.test.ts` (all 7); `NumberBond.split-and-say.test.tsx` "moves the same counters between parts…", "freezes the chosen split for speech…", "allows returning and undoing counters…", "attributes a capped construction…"; di-script "expands one decompose challenge…", "judges a split by sum AND novelty, in code".

### R6 — ten_and_ones accepts exactly one pair, a full ten and the rest · OBSERVED
- **Property:** a split is accepted only when one part is exactly 10 and the parts sum to the whole. A sum-correct split with no ten (7+7 for 14) is refused, and the correction names the missing property, never a pair. The say phase asks "One ten and how many ones?" and the ones appear only in the affirmation and the reward (`14 = 10 + 4`). The how-to-play teaches the rule on entry, because decompose just taught the opposite.
- **Demanded by:** COUNT001-05-B..F (K.NBT.1).
- **Evidence:** `numberBondScript.ts` `tenAndOnesFaultOf`/`tenAndOnesVerdictCue`; `numberBondSplit.ts` `validSplit`; EVAL_TRACKER NB-1.
- **Probe:** di-script "ten-and-ones" block (8 tests); `numberBondModes.test.ts` teen rows; `split-and-say.test.ts` "requires a ten for teen tasks…"; `qa/tutor-reports/number-bond-w1-ten-and-ones-2026-09-22.json` (wrong split → retry → right split → spoken ones, PASS).

### R7 — missing_part keeps the unknown covered until it is verified · OBSERVED
- **Property:** the whole and the known part are shown. The covered part is opaque, and its aria-label is "Covered part, quantity hidden" until the answer is affirmed or the correction reveals it. The ask states the whole and the known part in words and never contains the answer (hence "is the whole", not "has two parts"). The stimulus channel carries no number. Optional counters appear only when the child presses "Use counters", can be set aside only into the known part, and are recorded as `independent` / `counters` / `revealed` evidence; they are never scored as a second answer. The support tier moves only which side is unknown (easy: the larger part; medium: the smaller).
- **Demanded by:** OPS001-03-E, OPS001-03-F; the answer-leak rule; the W1 observer (LA-13).
- **Evidence:** component missing-infer section and `missingEvidence`; `askFor`/`stimulusFor` comments; generator `unknownSide`.
- **Probe:** `NumberBond.split-and-say.test.tsx` "keeps the missing quantity covered…" and "reveals the covered counters only on an explicit correction path"; di-script "never puts the missing part in a spoken ask…", "pushes only the answer-free question side…"; W1 `missing_part --audio` drives (`number-bond-w1-missing-part-audio-2026-09-23-{c,d}.json`).

### R8 — related_fact is two linked spoken turns over one bond with unequal parts · OBSERVED
- **Property:** turn 1 joins the groups and asks "P and how many more make W?". Turn 2 moves the found group out and asks "W take away X leaves how many?", where X is the number just found, so the answer is the other part. The red and blue groups keep their identity across join, say, separate and say. Each question and its expected answer are read from the committed model, or from the modelled move if the child's move did not match. The how-to-play says no number word.
- **Demanded by:** OPS001-02-G, OPS001-03-F (inverse operations using related facts).
- **Evidence:** `numberBondModes.ts` `groupsForBond`/`relatedQuestion`/`initialCountersForInteraction`; commit `404c5877`; `qa/eval-reports/k-held-floors-2026-09-09.md`.
- **Probe:** `__tests__/NumberBond.remaining-modes.test.ts` "keeps token group identity stable…", "derives both spoken targets from the committed model"; `NumberBond.split-and-say.test.tsx` "keeps related-fact groups stable…"; `numberBondDrivePlan.test.ts` "drives the same four-phase related-fact sequence…"; `scripts/probe-number-bond-related-fact.mjs --draws=3` (18/18).

### R9 — build_equation: the child's own action, then an equation that matches it · OBSERVED
- **Property:** the model phase offers exactly join, take away red and take away blue, with no swap. The equation must be arithmetically true, use exactly the bond's three numbers, and describe the committed action. Either orientation of = is accepted. A true fact of the bond that describes a different action is `other_fact` and gets action-specific coaching, not a bare wrong mark. The tile tray holds the three bond numbers and `+ − =`, shuffled, and can also be typed into (aria-label "Equation keyboard entry").
- **Demanded by:** Grade 1 number sentences (catalog `build_equation` description); the harness journey that writes into the typed entry.
- **Evidence:** `bondEquationFaultOf`/`bondEquationMatchesAction`; component `commitEquation`, action buttons, tile seeding; `liveJourneySpec.ts` number-bond row (`write` to "Equation keyboard entry").
- **Probe:** remaining-modes "limits the open Build Equation choice…", "separates equation arithmetic, bond-number, and action matching"; `NumberBond.split-and-say.test.tsx` "requires a build-equation response to match the action the learner chose"; journey sweep on `number-bond.build_equation.json`.

### R10 — fact_family: one transformation-linked equation at a time, 4 forms or 2 · OBSERVED
- **Property:** each form has a model phase and a build phase. Unequal parts need 4 forms (both addition orders, both subtraction directions). Equal parts need 2. Reversing = is the same form. Accepted equations stay as the child's family record and the next form is never filled in. One aggregate outcome per family keeps per-form evidence, and a partly solved family stays inspectable without counting as complete.
- **Demanded by:** Grade 1 inverse-relationship objectives; catalog `fact_family` description.
- **Evidence:** `factFamilyForms`, `familyEquationFaultOf`, `numberBondInteractionSummary`; component `familyRecord`.
- **Probe:** remaining-modes "requires four unequal family forms but only two equal-part forms", "treats reversed equality as the same required form…", "keeps partial family success inspectable…"; `NumberBond.split-and-say.test.tsx` "records one fact-family equation at a time…"; oracle "accepts the two genuinely distinct forms…", "rejects padded duplicates…".

### R11 — no answer appears on screen before the child's attempt is affirmed · OBSERVED
- **Property:** the reward line (the equation, or the revealed counters) renders only while `runner.revealHeld`, never on `currentSolved`. A hand verdict on a build phase prints nothing (`setReward(null)`), so the coming spoken answer is not shown. The live equation mirror never renders on an expanded phase. The say-phase board labels the answer part "How many here?" and prints no count. Spoken asks carry no answer word (`leakTokens`).
- **Demanded by:** pedagogy rule #1; every spoken consumer (R5-R8).
- **Evidence:** component `onAffirmed`, `liveEquation`, reward panel (18b comment); `SplitAndSayBoard` labels; `numberBondHarnessAnswers.leakTokens`.
- **Probe:** `NumberBond.split-and-say.test.tsx` "freezes the chosen split for speech, hides the numeral answer…"; di-script "answer-leak" block; journey sweep J1-J7 over the six payloads.

### R12 — the equation entry shows no operator and no answer before a try · OBSERVED · FIXED 2026-09-28
- **Property:** before the child places anything, the equation workspace shows no operator, number or pre-placed tile. On build_equation the choice of + or − is part of the assessed response, since it must match the committed action (R9).
- **Demanded by:** pedagogy rule #1; the generator's own tier contract ("no answer-bearing equation appears before the assessed response"); the approved M1 table, whose planned `equation_frame` lever is "blank slots, no tile, no operator".
- **Evidence:** VIOLATED at `NumberBond.tsx:1444`: `placeholder="_ + _ = _"` on the typed entry prints the plus before the child acts.
- **Probe (to add with the fix):** a mounted build_equation or fact_family build phase shows no `+`, `−` or digit in the entry's placeholder or the empty slot row before the first tile.

### R13 — the fact-family worked example is a bond the session never asks about · OBSERVED · FIXED 2026-09-28
- **Property:** `FactFamilyHelper` (family-model phases, Grade 1 only; open at easy, collapsed at medium, hidden at hard) shows a triple that is not the current item's bond and not the bond of any other item in the session.
- **Demanded by:** the `familyHelperExample` docblock ("modeled on content the session never asks about"); the generator tier prompt ("different-bond worked example"); the approved M1 `worked_family` lever ("the triple is never a session bond").
- **Evidence:** the current-item half HOLDS. The session half is VIOLATED: `numberBondScript.ts:948-957` checks only the current item against three fixed triples (2+3=5, 3+4=7, 2+4=6), so a later item can be the example's bond, and a session holding all three triples falls back to 2+3=5.
- **Probe:** di-script "picks the fact-family worked example from a bond the item is NOT" (current half; its single-item expectations still hold). To add with the fix: the example differs from every bond in the session, including a session that contains all three fixed triples.

### R14 — a hand-mode verdict correction does not state the bond fact the child must build · OBSERVED · FIXED 2026-09-28
- **Property:** a correction for a wrong equation names the fault (arithmetic, numbers, action, unfinished) and re-asks. It does not state the fact that answers the item ("three and four make seven").
- **Demanded by:** the approved M1 table (the old spoken correction states the bond; it has to go before levers can be built on the item).
- **Evidence:** VIOLATED at `numberBondScript.ts:881`: the arithmetic branch of `bondEquationVerdictCue` says "Look at the bond: {p1} and {p2} make {whole}". The same shape is at `familyVerdictCue` `bad-math` (:814), which is reachable through the harness `bondVerdictCueForPlaced`, not the mounted component (which uses `familyEquationVerdictCue`).
- **Probe (to add with the fix):** no `bondEquationVerdictCue` fault line contains the bond sentence "{p1} and {p2} make {whole}" or "{p1} plus {p2} equals {whole}"; di-script "keeps every gesture verdict line free of a sentinel collision" still passes.
- **Scope:** this covers hand-mode equation verdicts only. It does not apply to the spoken corrections in R15, which state the answer on purpose.

### R15 — the spoken DI script: model the answer in the correction, then re-ask, the same line every time · OBSERVED
- **Property:** on missing-part and related-fact, the correction starts with "My turn:", models the count-up walk (or, on the subtraction turn, the relationship), states the answer, and re-asks in the ask's own words. A repeated wrong answer gets the same correction word for word. Affirmations start with "Yes". The catalog's scaffold ladder offers no line of its own. How-to-play is re-spoken when the action changes. The echo refusal leaves out a known part that is also the answer.
- **Demanded by:** the standalone DI runner; the 2026-08-14 cap drill (the model read out ladder hints, the verdict stalled); the catalog directive "The answer belongs to the correction".
- **Evidence:** `correctionFor`/`affirmationFor`/`judgingContract`; catalog `scaffoldingLevels` comment; `qa/tutor-reports/number-bond-live-di-{plain,signature}-2026-08-14.md`.
- **Probe:** di-script "missing-part judging contract" block (6 tests), "session frame" block, "structural gates" block (`checkPackGates`, performed stage directions, repeated asks).

### R16 — scoring: one outcome per logical unit, submitted once · OBSERVED
- **Property:** build phases and model phases are not outcomes of their own. A decompose/ten-and-ones pair scores as its say outcome combined with its build outcome at the lower score, so a correct spoken answer never hides a failed construction. Related-fact and build-equation phases report under the logical id, and a fact family is one aggregate. The component submits once with `interactionVersion: 'number-bond-model-v2'` and the split, move, equation and missing-part evidence.
- **Demanded by:** IRT/mastery; judged-evidence consumers.
- **Evidence:** `numberBondInteractionSummary`, `splitAndSaySummary`; component `handleFinished` submit.
- **Probe:** remaining-modes "collapses activity phases into existing logical assessment units"; `split-and-say.test.ts` "counts a construction and its spoken interpretation once, preserving a failed construction".

### R17 — W1 teaching-workspace binding with named misses · OBSERVED
- **Property:** under `LiveRuntimeContext` every mode binds through `useWorkspaceController`, and the scripted runner is not mounted beside it. Each gesture commit goes through its code judge (`validSplit`, `tenAndOnesFaultOf`, the action match, `familyEquationFaultOf`, `bondEquationFaultOf`) and names a `bondMiss`. That miss is one of the catalog `teachingWorkspace.misses` ids for the mode: decompose `same_way_again`/`not_all_placed`; ten_and_ones `ten_one_off`/`no_full_ten`/`not_all_placed`; related_fact `other_move`; build_equation and fact_family `other_move`/`unfinished_equation`/`false_equation`/`other_numbers`/`other_fact`. Spoken phases name no miss. A hands assignment carries no `expectedAnswer`; the tutor is never handed the key. A spoken assignment's task and answer are read from the board as it stands. The scene publishes counter counts only where the board is what is asked (never on a missing-part turn, LA-13). The eval mode comes from the lesson pin.
- **Demanded by:** the live tutor/JEV (handoffs 15, 19, 20); journey sweep J8.
- **Evidence:** `numberBondWorkspace.ts`; `numberBondModes.ts` `bondMiss`; catalog :3485-3500; `qa/tutor-reports/number-bond-w1-2026-09-23.md`; commits `9ca68de6`, `670039ad`.
- **Probe:** `numberBondModes.test.ts` (19 rows plus "a spoken phase names no miss"); `service/manifest/catalog/misses.test.ts`; `components/live-activity/runtime/journeySweep.test.tsx` J1-J9 over the six `number-bond.*.json` payloads.

### R18 — every mode has a saved payload and a journey row that drives it · OBSERVED · **met 2026-09-28 (M1 fix 3)**
- **Property:** `w1-payloads/number-bond.{decompose,ten_and_ones,missing_part,related_fact,fact_family,build_equation}.json` exist. The journey row drives split, spoken, model (the move button, which has no wrong input) and equation phases (typed, wrong by one on the result), and never throws.
- **Demanded by:** the lever slice (J9 must see every mode); the sweep gate.
- **Evidence:** commit `763e5e98`.
- **Probe:** `journeySweep.test.tsx` green on all six number-bond payloads.

### R19 — the scripted live-runtime adapter never advances, points, or states the answer · OBSERVED
- **Property:** on the scripted path (`useNumberBondRuntime`) the board advertises replay and a text reminder, never advance, retry or point (on every hand mode the tap is the answer). Hand aids stay hidden while the child is still building. No aid states the answer. Only one detour is allowed per item. The worked-example detour draws a nearby bond, never this bond's own numbers, and is withheld on fact-family and build-equation. The child's counters survive an example and return. Stale or duplicate commands are refused.
- **Demanded by:** `/add-live-tutor-tools` adoption on the scripted path.
- **Evidence:** `useNumberBondRuntime.ts` docblock; `bondScaffoldsFor` aids.
- **Probe:** `NumberBond.runtime.test.tsx` (all 12 cases).

### R20 — Pip follows the phases and never answers · OBSERVED
- **Property:** Pip points at the board while cued, follows the child's counter moves, receives the split, and points at the equation slot row, never at a tile. It never moves a counter or places a tile.
- **Demanded by:** Pip shared-surface rollout.
- **Evidence:** component `usePipSurface` block; `numberBondPipPose`.
- **Probe:** `pip/NumberBond.surface.test.tsx` (both tests).

### R21 — support tier changes scaffolding and the unknown side, never magnitude · INFERRED
- **Property:** counters stay on in every model mode at every tier. `showEquation` is off for the model modes. The fact-family helper is open at easy, collapsed at medium, hidden at hard. On missing-part the tier moves only which part is unknown. With no tier, the output is the same as before tiers existed.
- **Demanded by:** the structural-difficulty doctrine; future lever starting positions.
- **Evidence:** generator `resolveSupportStructure`. `qa/eval-reports/number-bond-2026-06-14.md` observed magnitude invariance and the unknown-side lever, but it predates the port (it recorded `showCounters: false` at hard, which the code now overrides). There is no current probe, so this stays INFERRED until an eval-test run at easy and hard re-observes it.

### R22 — in-item levers, slice 1 · IMPLEMENTED 2026-09-28
- **Property:** `numberBondLevers.ts` declares, with a synchronous `pullLever`: decompose build `made_ways` (the learner's own ways as dot pictures, in the order made; offered once a way exists); ten_and_ones build `ten_frame_part` (each part's own counters in a two-by-five outline, empty boxes drawn, never filled) and `smaller_teen` (ungraded split of eleven on its own id, then the full item on a whole board; not at twelve or below); related-fact join/separate `show_move` (the move button highlighted); missing-part `open_counters` (the tray opened for the learner, support recorded as counters, the covered part stays covered). Each lever declares the `bondMiss` ids it answers; `not_all_placed` is catalog `unanswered` on decompose and ten_and_ones (J9). The equation-mode levers are R23.
- **Leak rules (code):** no lever text or scene fact carries a digit or a count word (`numberBondLevers.test.ts`); made_ways is never sorted and never shows an unfound pair; smaller_teen is never the learner's whole.
- **Credit:** a pull is recorded; the next attempt carries it and is assisted; practice attempts are ungraded.
- **Evidence:** `numberBondLevers.test.ts` (18), `NumberBond.levers.workspace.test.tsx` (6, including the R12 probe), sweep J1-J9 on all six payloads, replay 6 payloads x 5 (`qa/tutor-reports/replay/number-bond-2026-09-28.json`): 2 of 40 flagged, both read by hand. One is the key 1 on a whole of eleven colliding with ordinary "one" ("a full ten in one part"); no reply states the ones count. The other is outside the levers: on the fact_family opening model step, which accepts any move, the tutor proposed "join the groups" (1/25), steering a free choice.

### R23 — in-item levers, slice 2: the equation steps · IMPLEMENTED 2026-09-28
- **Property:** on every build step of build_equation and fact_family, `numberBondLevers.ts` declares `equation_frame` (help: empty slot shapes and an equals sign above the tray; answers `unfinished_equation`, `other_numbers`), `move_strip` (help: the move the equation must describe, before and after, as dots in the group colours; answers `false_equation`, `other_fact`) and `smaller_bond` (simplify: one ungraded fact-family build step on a bond with a whole of five or less and the same move, on its own id, then the full step; answers `false_equation`, `other_numbers`). fact_family model steps reuse `show_move`. build_equation's model step has no lever; `other_move` there is catalog `unanswered` (its only wrong move, a swap, is not offered). Easy starts with `equation_frame` drawn; a starting position is published as pulled and never recorded on an attempt. The equation check runs on the shown item, so a practice step is checked on its own bond; a retry on a practice step keeps its tiles; `endPractice` restores the full step's move, tiles and an empty entry.
- **Leak rules (code):** the frame's slots are empty and carry no `+` or `-` (R12); the strip carries no numeral, operator or equals sign and shows only the committed move; `smaller_bond` is never the bond of any session item (the R13 rule), keeps the form (join stays join, a take-away keeps its side, a swap or second-group take-away never lands on equal parts), and its key is a true equation from the family builder. No lever text or scene fact carries a digit, a sign or a count word.
- **Compatibility:** R9 holds on graded work; the practice step shows its move instead of asking the learner to choose one, which is the simpler shape and ungraded. R12 holds (the frame is empty). R13's rule is reused, not changed.
- **Evidence:** `numberBondEquationLevers.test.ts` (65: the miss-to-lever table, the builder over every bond from 3 to 10 and every form, a multi-bond session, the strip and text leak rules on both saved payloads); `NumberBond.levers.workspace.test.tsx` (4 new: strip pull and assisted credit, empty frame, smaller-bond practice and return with the tray holding the smaller bond, easy start not recorded; the practice-check fix is mutation-checked); sweep J1-J9 and the W1 contract green on both payloads. Text replay does not reach these levers yet: the recorder drives each payload's first item, which is a model step on both modes.

### R24 — in-item levers on the spoken turns · IMPLEMENTED 2026-09-29
- **Property:** the say turns (decompose and ten_and_ones after the split, related_fact after the move) publish `ten_frame_part`: the counters the learner is asked about in a two-by-five outline (on related_fact, the whole's counters, each in its colour). It answers each turn's spoken misses (`numberBondSpokenMisses`). missing_part's `open_counters` now answers that turn's spoken misses. Only `not_all_placed` (decompose, ten_and_ones) and build_equation `other_move` stay unanswered.
- **Leak rules (code, `numberBondLevers.test.ts`):** the frame draws only counters already on the board and empty boxes, never fills one; no scene fact carries a digit or number word; the covered part of missing_part stays covered.
- **Evidence:** `NumberBond.levers.workspace.test.tsx` (the ten-and-ones say turn: counts unchanged, credit assisted; the related-fact say turn frames the whole).

## Conflicts

_None open._ Notes for the four M1 fixes and the lever slice:

- **Fix 1 (R12)** is compatible as long as the typed entry keeps aria-label "Equation keyboard entry" and still accepts typed input, because the journey row (R18) writes through it. Replacing the input, or renaming it, is a REGRESSION on R18/R9.
- **Fix 2 (R13)** is compatible as long as the single-item call keeps its current results (the di-script test) and there is a fallback outside the three fixed triples.
- **Fix 3 (R18)** has landed (`763e5e98`). It exposed R4 (NB-REP-1). Until that is fixed, four of the six payloads carry one logical item each, so a J9 or lever check on them exercises one bond per mode.
- **Fix 4 (R14)** is compatible only if it is limited to hand-mode equation verdict cues. Removing the answer from `correctionFor` (missing-part, related-fact) would contradict R15, which is a CONFLICT and must fork, not be edited in place. New fault lines must still start with "My turn:" and pass the sentinel-collision test.
- **Levers:** `not_all_placed` (decompose, ten_and_ones) never fires on the split-and-say path, because a split commits only when full (R5). If no lever answers it, J9 needs it in the catalog's unanswered list. Removing it from `teachingWorkspace.misses` would change R17's miss set.

## Catalog projection

- **description:** faithful as of 2026-09-28. It names all six modes and their answer channels correctly.
- **constraints:** faithful. The windows (R2), the K mode set (R1) and the fact-family form counts (R10) match the code.
- **evalModes:** faithful. One possible sharpening, not applied: `ten_and_ones` ends "Kindergarten." although the mode runs at both bands and `teachingWorkspace.grades` lists Grade 1. Leave it unless a Grade 1 consumer appears.
- **tutoring:** the `aiDirectives` and `taskDescription` describe the scripted DI cue protocol (`[NS_ITEM]`, `[NB_*]`, "your own affirmation advances"). That path is still live for non-workspace hosts (`useScriptedController`), so the block is not stale yet. If the scripted path is retired, it goes stale the same way cvc-speller's and letter-sound-link's did. Not applied.

## Changelog

- 2026-09-29 — R24 added (spoken-turn levers). Compatible: `SplitAndSayBoard`'s `frame` takes 'whole' as well as true.
- 2026-09-28 — R23 added (levers slice 2, the equation steps). Additive: nothing is drawn until a pull, except the easy tier's empty frame. `commitEquation` now checks the shown item, which equals the session item whenever no practice step is open, so every existing probe holds (number-bond suites green).

- 2026-09-28 — R22 added (levers slice 1). Additive: no lever is pulled at start, so every board renders as before; `SplitAndSayBoard` gains an optional `frame`; the related-fact move button gains a highlight when pulled; `open_counters` runs the same state the learner's own button sets. Compatible: R1-R21 probes green (math suites 149 files).

- 2026-09-28 — R12, R13, R14 fixed (handoff 21 M1, before the levers). R12: the typed entry's placeholder is "Type the number sentence" (aria-label unchanged, so the journey row still types through it); probe `NumberBond.levers.workspace.test.tsx` on the build_equation and fact_family payloads, mutation-checked. R13: `familyHelperExample(item, session)` skips every session bond, from the three usual triples then every unequal pair within ten; the single-item expectations hold; new di-script probe with all three usual triples in the session. R14: the hand-mode equation corrections (`bondEquationVerdictCue` arithmetic and numbers, `familyVerdictCue` bad-math and wrong-numbers) name the fault and point at the groups, never the bond fact; still "My turn:"; R15's spoken corrections untouched. Compatible: no other requirement's probe changed (number-bond suites 116 green).

- 2026-09-28 — derived (initial). 21 requirements (20 OBSERVED, 1 INFERRED), 0 open conflicts. Four are VIOLATED with fixes queued: R4 (NB-REP-1, `/eval-fix`), R12, R13 and R14 (handoff 21 M1 fixes 1, 2 and 4). R18 (M1 fix 3) was met the same day by `763e5e98`. Occasion: step 1 of handoff 21 M1 (number-bond levers), before `/eval-fix` on the four content defects.
