# Contract: di-math-facts

- **Derived:** 2026-10-02 (static: QA reports, tests, git history; no live census) · evidence window: 2026-07-24 → 2026-10-02
- **Component:** `primitives/visual-primitives/direct-instruction/DiMathFactsTeaching.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diMathFactsDomain.ts`, `diMathFactsLevers.ts` · **Generator:** `service/direct-instruction/gemini-di-math-facts.ts` · **Catalog:** `service/manifest/catalog/di.ts` (`id: 'di-math-facts'`)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K/G1 addition fact fluency (within 5 / 10, doubles, make ten): answer_fact, fact_review | catalog + QA | `qa/eval-reports/di-math-facts-structural-difficulty-2026-08-04.md`, payloads `w1-payloads/di-math-facts.answer_fact.json`, `.fact_review.json` | 2026-10-02 |
| G1 take-away facts within 10: subtraction_fact | catalog + QA | payload `di-math-facts.subtraction_fact.json` | 2026-10-02 |
| G1 counting forward within 120: counting_next | handoff 14g | `qa/eval-reports/HANDOFF-di-14g-counting-next-2026-08-05.md` | 2026-10-02 |
| K.CC.3 name written numerals: name_numeral | handoff | `qa/eval-reports/HANDOFF-di-math-facts-name-numeral-2026-09-05.md`, commit `c529d240` | 2026-10-02 |
| Live tutor + JEV observer on the shared workspace | tutor reports | `qa/tutor-reports/di-math-facts-*` (LA-13 JEV runs 09-22/26, workspace audio 09-20), verdict probe `scripts/tutor-verdict-probe.mjs --facts` | 2026-10-02 |
| Support levers (DI pilot, user rulings 2026-10-02) | `/add-support-tiers` | `qa/support-levers/di-math-facts-lever-table-2026-10-02.md`, replay `qa/tutor-reports/replay/di-math-facts-2026-10-02.json` | 2026-10-02 |

## Requirements

### R1 — The answer is never on the stage before a committed answer · OBSERVED
- **Property:** a computed mode's `display` has no `=` and no answer word; the solved form appears only in the trail after a committed correct attempt; a missed fact recaps by its problem.
- **Demanded by:** every computed-mode consumer.
- **Evidence:** `mathFactChallengeValid` leak gate; `DiMathFacts.teaching.test.tsx`.
- **Probe:** `npm test -- DiMathFacts.teaching.test.tsx`.

### R2 — Answer word and numeral are the same number · OBSERVED
- **Property:** `answerWord === spokenIntegerWord(answerNumeral)`; a desynced item is dropped, never repaired.
- **Demanded by:** the tutor (judges the word) and evaluation (records the numeral).
- **Probe:** teaching test "rejects a desynced answer key…".

### R3 — name_numeral inverts the gate · OBSERVED
- **Property:** the printed numeral IS the answer (display = numeral); no counting route; reciting the sequence is the `recited_sequence` miss.
- **Demanded by:** K.CC.3 numeral naming.
- **Probe:** teaching test, name_numeral cases; `diMathFactsLevers.test.ts` (no dots lever on name_numeral).

### R4 — Counting to 120 keeps teen/decade and whole-compound discriminations · OBSERVED
- **Property:** above twelve the assignment states teen ≠ decade and a compound number arrives whole; `decade_rollover` and `teen_decade_swap` are named misses.
- **Demanded by:** G1 counting within 120.
- **Probe:** `diSpokenMisses.test.ts`; teaching test counting_next cases.

### R5 — Tier sets operand structure, not the mode · OBSERVED
- **Property:** easy within five, medium crosses five, hard crosses ten; the objective pool ceiling wins.
- **Demanded by:** fact-fluency consumers.
- **Probe:** `gemini-di-math-facts.structural.test.ts`.

### R6 — Guidance fits the offer cap and has no line to recite · OBSERVED
- **Property:** adapter guidance (domain + `WORKSPACE_DOCTRINE` + `LEVER_DOCTRINE`) ≤ 2000 characters; no "say exactly".
- **Demanded by:** the Live offer (`parse_activity_spec` closes the socket above the cap).
- **Probe:** `activityContract.test.ts`; teaching test "keeps guidance inside the backend offer cap".

### R7 — The verdict probe replays exactly the mounted packet · OBSERVED
- **Property:** `demand` = `workspaceScene(item).facts` + `onScreen` from the tier's starting levers + response/presentation; the probe builds the same.
- **Demanded by:** JEV verdict probes.
- **Probe:** teaching test "publishes exactly the domain assignment and scene that the verdict probe replays".

### R8 — DI's model is a parallel item, never the learner's fact · OBSERVED (user ruling 2026-10-02)
- **Property:** `model_fact` shows and voices a different item of the same mode, solved. `modelLeaks` holds false: not the item or its turnaround, answer not within one of the item's, the item's answer not printed in it nor said in its words ("one hundred two" beside 100), not one step from the item. No scene fact, `support` fact or guidance licenses modelling the learner's own fact. Its `does` text forbids applying the model to the item.
- **Demanded by:** the DI ruling; every mode.
- **Evidence:** replay 2026-10-02, start moment: "My turn: one plus two is three. Your turn: what is four plus one?" (0 flags in 25 samples).
- **Probe:** `diMathFactsLevers.test.ts` (leak table + every askable item); replay `tutor_replay.py --primitive di-math-facts --samples 5`.

### R9 — Help levers draw only what is printed · OBSERVED
- **Property:** `dot_model` = one group per printed number, no total; `take_away_dots` = the start with the amount taken away crossed out, the remainder never counted; `number_path` never prints a number above the printed one. No lever's scene fact names the item's answer.
- **Demanded by:** every computed-mode consumer (R1 under a pulled lever).
- **Probe:** `diMathFactsLevers.test.ts`; `DiMathFacts.levers.workspace.test.tsx`.

### R10 — Simplify keeps the mode and never repeats the item · OBSERVED
- **Property:** `smaller_fact`, `take_one_away`, `inside_decade`, `single_digit` build an item of the same mode with id `<item>~simpler`, never the item, its turnaround or its answer. The practice item is ungraded, survives a retry, and gives the full item back; only the full item, answered with the lever recorded, is credited.
- **Demanded by:** the lever ladder; mastery (assisted work never counts as independent).
- **Probe:** `DiMathFacts.levers.workspace.test.tsx` (subtraction case).

### R11 — A starting position is not a pull · OBSERVED
- **Property:** easy starts with `model_fact` on screen; a first try under it records no lever. Medium and hard start with none.
- **Demanded by:** first-response gate / IRT credit.
- **Probe:** `DiMathFacts.levers.workspace.test.tsx` (easy case).

### R12 — Every catalog miss is answered by a lever · OBSERVED
- **Property:** for each item, every miss `mathFactSpokenMisses` names is in some lever's `answers` (J9).
- **Demanded by:** the observer's lever ladder (`nextLever`).
- **Probe:** `journeySweep.test.tsx` (J9); `diMathFactsLevers.test.ts`.

### R13 — The shared DI stage's levers are opt-in · OBSERVED
- **Property:** `DiTeachingStage` publishes `levers`/`pullLever`/`endPractice` only when a pack passes `levers`; packs without it publish exactly what they did before.
- **Demanded by:** the 8 other DI packs on the stage.
- **Probe:** `npm test -- direct-instruction` (all DI workspace and teaching tests).

## Conflicts

None open.

## Catalog projection

- **description:** "the tutor models a printed fact aloud ('two plus one is three'), practices it together, then asks the child…" → "the tutor models a DIFFERENT fact aloud ('My turn: two plus one is three'), then asks the learner their own printed fact…". Applied 2026-10-02 (R8; the old wording described modelling the learner's fact).
- **constraints:** faithful as of 2026-10-02.
- **evalModes:** answer_fact "modeled and guided first, then answered alone" → "a different fact may be modeled first; the learner answers their own fact alone". Applied 2026-10-02.

## Changelog

- 2026-10-02: derived (initial, static) with the DI lever pilot. 13 requirements, 0 conflicts. Check: `qa/primitive-contracts/di-math-facts-check-2026-10-02.md`.
