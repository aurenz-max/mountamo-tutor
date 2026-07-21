# Contract: counting-board

- **Derived:** 2026-07-20 · evidence window: eval report 2026-03-15 (+ CB-1/CB-2 notes 2026-07-03), topic-fidelity 2026-06-27, counting-board oracle, reader-fit direct-manipulation census 2026-07-16, catalog/generator/component source
- **Component:** `src/components/lumina/primitives/visual-primitives/math/CountingBoard.tsx` · **Generator:** `src/components/lumina/service/math/gemini-counting-board.ts` · **Catalog:** `src/components/lumina/service/manifest/catalog/math.ts` (`id: 'counting-board'`, ~:2030)
- **Status:** ACTIVE (static derivation; no live census — the 2026-07-16 sibling census is declared complete and this run serves the item-13 display fix)

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| Pre-K — `subitize_perceptual` (flash 1–3, hand-image answer, no numerals) | catalog + generator + component | catalog evalMode β0.5; generator perceptual clamp `:556`; component hand picker `:1096` | ongoing |
| K PRE — `count_all` (tap each object, answer = counted set) | catalog + oracle + topic-fidelity | catalog `count` evalMode; oracle `checkCountChallenge` note; `qa/topic-fidelity/counting-board-2026-06-27.md` | 2026-06-27 |
| K PRE — `subitize` (recognize a quantity, type the numeral) | catalog + generator + component + reader-fit | catalog `subitize` evalMode β2.0; generator `subitize` `:68`; reader-fit BACKLOG item 13 | 2026-07-20 |
| Grade 1 — `count_on` (start from a known group, count on to total) | catalog + generator + oracle | catalog `count_on` β2.5; generator "Grade 1 only" `:90`; oracle startFrom range check | ongoing |
| Grade 1 — `group_count` (count by 2s/5s/10s) | catalog + generator | catalog `group` β2.0; generator group docs | ongoing |
| Grade 1 — `compare` (which group has more; answer = larger group) | catalog + generator + oracle | catalog `compare` β2.5; oracle compare independence rule; generator `:104` | ongoing |
| IRT/mastery + content-contract QA across all modes | eval-test + oracle + evaluation hooks | `qa/eval-reports/counting-board-2026-03-15.md`; counting-board oracle; `useChallengeProgress`/`usePrimitiveEvaluation` | ongoing |
| Topic/intent scope (counts ≤ objective bound, grade = ceiling) | topic-fidelity + oracle | `qa/topic-fidelity/counting-board-2026-06-27.md`; oracle `scope` check | 2026-06-27 |

## Requirements

### R1 — generated challenge type follows the selected eval mode · OBSERVED
- **Property:** each eval mode emits exactly its challenge type (`count` → `count_all`; `subitize` → `subitize`; `subitize_perceptual` → `subitize_perceptual`; `count_on`/`group`/`compare` likewise); ≥3 challenges per session (mastery-over-demo).
- **Demanded by:** manifest routing, IRT task identity, eval-test, oracle `schema`.
- **Evidence:** catalog `evalModes`; generator `validChallengeTypes` `:501`; oracle `KNOWN_TYPES` + `<3` check.
- **Probe:** all six modes PASS in `qa/eval-reports/counting-board-2026-03-15.md`; oracle `schema` fires on a missing/foreign type.

### R2 — the board renders exactly `count` objects and the answer is `count` (compare excepted) · OBSERVED
- **Property:** `positions = generatePositions(challenge.count, …)` renders exactly `count` tappable objects; for every non-compare mode `targetAnswer === count`; for `compare`, `count` is both groups' total and `targetAnswer`/`groupSize` is the strictly-larger group. The manipulative **is** the answer made visible (answer-leak is deliberately NOT checked).
- **Demanded by:** answer-key consistency, oracle `answer-key-desync`, cardinality pedagogy.
- **Evidence:** component `positions` memo `:382`, `checkCountChallenge` `:515`; generator `targetAnswer = count` `:456`; oracle `answer-key-desync`.
- **Probe:** oracle re-derives displayed count and asserts it equals `targetAnswer` (compare → `groupSize`); a `count 8 / target 7` board must fire.

### R3 — count_all / count_on / group_count are concrete tap-to-count construction · OBSERVED
- **Property:** the child taps each rendered object exactly once (`handleObjectTap`); the produced answer is `countedObjects.size`, judged against `targetAnswer`; double-counting is blocked and coached, one-to-one correspondence is scored. `count_on` pre-counts `startFrom` objects and the child counts on to the total.
- **Demanded by:** K/Grade-1 number sense, `count_all`/`count_on`/`group_count` eval modes, one-to-one metrics.
- **Evidence:** component `handleObjectTap` `:476`, `checkCountChallenge` `:515`, count-on pre-count `:817`; oracle mode notes.
- **Probe:** count_all eval-test PASS; tapping every object reaches Next; double-tap surfaces the "already counted" coaching without advancing.

### R4 — subitize @ K is flash-then-hide recognition, not tap-counting · REQUIRED
- **Property:** at `gradeBand==='K'`, a `subitize` challenge briefly flashes the objects and then **hides** them before the numeric stepper answer surface is enabled; the hidden objects cannot be tapped/counted, and the child may re-flash. The answer remains the typed numeral checked against `targetAnswer` (task identity unchanged — this is a DISPLAY fork, not a manipulation swap; enacted tap-counting would be the sibling `count_all` skill). A `subitize` challenge at reader grades (Grade 1) keeps objects visible.
- **Demanded by:** reader-fit BACKLOG item 13; `subitize` task identity (instant perceptual recognition); direct-manipulation census 2026-07-16 (objects were fully visible + tap-countable, defeating the skill). Mirrors ten-frame R4.
- **Evidence:** reader-fit census note (`CountingBoard.tsx:1120–1144`, judged `:547`); ten-frame `startSubitizeFlash` precedent; `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md` Task 2.
- **Probe:** jsdom (fake timers) — at K the objects are absent before the answer phase, appear only during the flash window, then hide as the "How many … do you see?" stepper enables; taps during K subitize never change any counted state; `count_all` @ K keeps objects visible + tappable; Grade-1 subitize is unchanged.

### R5 — subitize_perceptual (Pre-K) is a no-numeral hand-image answer over 1–3 objects · OBSERVED
- **Property:** count is clamped to [1,3]; the answer is a tap on one of three finger-count hand images ({1,2,3}, shuffled, correct never in a fixed slot); no feedback/instruction string contains a numeral; a correct answer > 3 is structurally unreachable.
- **Demanded by:** Pre-K perceptual subitizing, oracle reachability check, no-numeral rule.
- **Evidence:** generator perceptual clamp `:556`; component `handleHandPick` `:725`, `handOptions` `:391`, numeral-free feedback `:585`; oracle `PERCEPTUAL_MAX`.
- **Probe:** oracle fires when a perceptual board shows >3 objects; feedback strings assert no digit.

### R6 — magnitudes honor the objective scope ceiling (grade = ceiling, tighter topic wins) · OBSERVED
- **Property:** every displayed count and `targetAnswer` is ≤ the objective bound named by topic/intent, clamped to the grade band otherwise (K→20, Grade 1→30); the bound number never leaks into instruction/hint/narration.
- **Demanded by:** topic fidelity, oracle `scope`.
- **Evidence:** `qa/topic-fidelity/counting-board-2026-06-27.md` (Tier-1 `## TOPIC SCOPE`); generator clamps `:549`; oracle `scope`.
- **Probe:** "Counting to 5" yields all counts ≤ 5 across draws; "to 10"/"to 20" track; oracle `scope` fires on an over-ceiling magnitude.

### R7 — support/scaffold structure is code-owned, never leaking the answer · OBSERVED
- **Property:** in the untiered path `showLastNumber`/`highlightOnTap` are pinned true (per-object counter aid), while `showRunningCount` (the "N / total" tally that exposes the target) is left as-generated and hidden during subitize phases; tiered withdrawal at `hard` removes aids without changing magnitude.
- **Demanded by:** CB-2 fix, support-tier axis, pedagogy rule #1.
- **Evidence:** eval report CB-2 note 2026-07-03; component running-count gate `:1087`; generator untiered pin.
- **Probe:** count/subitize/group eval-tests return `showLastNumber: true`; running-count panel absent in any subitize phase.

### R8 — evaluation records one result per challenge and submits once · OBSERVED
- **Property:** a challenge records a single correct result before advancing; all-complete auto-submits once with per-mode `CountingBoardMetrics` (counting accuracy w/ retry penalty, one-to-one, subitize accuracy/speed, count-on/grouping flags). Subitize timing stays isolated to subitize challenges.
- **Demanded by:** mastery, IRT, K-stage lifecycle.
- **Evidence:** component `recordResult`, `advanceToNextChallenge` `:741`, auto-submit guard `:864`, `CountingBoardMetrics` build `:775`.
- **Probe:** behavioral completion reaches Next then a single evaluation submission with no duplicate.

## Conflicts

_None open._ Item 13 (R4) is **COMPATIBLE / fork-by-band+mode**. It changes only the K `subitize` display lifecycle. R2/R3 keep `count_all` tap-to-count and the `count`↔`targetAnswer` identity; R5 keeps Pre-K perceptual untouched; the reader-grade branch of R4 preserves Grade-1 subitize. No generator schema or catalog change is justified — `count`/`targetAnswer` already carry everything the flash needs, and display timing is a component concern.

## Gap requirements (close matches — the improvement queue)

### G1 — `count_on` @ Grade 1 has the same visible-scene defect · OPEN
- **Near-consumer:** Grade-1 `count_on` (`CountingBoard.tsx:1146–1173`, judged `:609`) — objects stay visible and tap-countable while the answer is entered on a stepper.
- **Shortfall:** the count-on total is entered via a numeric proxy over a fully visible, tappable board, one band above K. Whether this is a defect depends on the EMERGING-band pedagogy (count-on legitimately keeps the pre-counted head visible), so it is noted, not pre-ruled.
- **Path:** band gate → `/reader-fit --lesson` at EMERGING, then `/reader-fit --fix` if confirmed.
- **Relation to R-series:** adjacent to R4 but a different band + task identity; do not fold into the K fix (reader-fit census 2026-07-16 explicitly deferred it to the EMERGING re-audit).

### G2 — `subitize_perceptual` (Pre-K) does not actually flash/hide · OPEN
- **Near-consumer:** Pre-K perceptual subitize — the catalog promises "Flash 1–3 objects" but the component shows them persistently (same class of defect as item 13, one band down).
- **Shortfall:** Pre-K perceptual recognition should also flash-then-hide before the hand-image answer, per its own catalog description.
- **Path:** band+mode gate → reuse the K `subitize` flash lifecycle for the `subitize_perceptual` render at Pre-K.
- **Relation to R-series:** extends R4's flash lifecycle to R5's answer surface; a clean follow-up once the K subitize fork is proven.

## Catalog projection

- **description:** faithful as of 2026-07-20. The subitize clause ("recognize and type the numeral") stays accurate; the flash-then-hide behavior is a band-scoped display detail below the curator's routing altitude.
- **constraints:** faithful. No change for the K display fork.
- **evalModes:** faithful. `subitize` remains "quickly recognize quantity without counting"; the K flash lifecycle enacts exactly that recognition. `subitize_perceptual` description already says "Flash 1-3 objects" (see G2 — the component owes that behavior at Pre-K).

## Changelog

- 2026-07-20 — derived (initial). 8 requirements, 0 open conflicts, 2 gaps (G1 count_on@EMERGING, G2 perceptual flash@Pre-K). Occasion: reader-fit item 13, K `subitize` flash-then-hide display fork.
