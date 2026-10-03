# Contract: di-dice-roll

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-09-02 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiDiceRoll.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diDiceRollWorkspace.ts`, `diDiceRollLevers.ts`, `diDiceRollScript.ts` · **Generator:** `service/direct-instruction/gemini-di-dice-roll.ts` · **Catalog:** `service/manifest/catalog/di.ts` (`id: 'di-dice-roll'`)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| Pre-K–G1 count one die / subitize: count_pips | catalog + QA | `qa/eval-reports/di-dice-roll-birth.md`, payload `w1-payloads/di-dice-roll.count_pips.json` | 2026-10-03 |
| Pre-K–G1 compare two quantities: compare_dice | catalog + QA | `qa/eval-reports/di-dice-roll-eval-modes-2026-09-03.md`, payload `.compare_dice.json` | 2026-10-03 |
| K–G1 concrete addition to 12: sum_two_dice | catalog + QA | payload `.sum_two_dice.json` (saved 2026-10-03) | 2026-10-03 |
| Live tutor + JEV on the shared workspace | tutor reports | `qa/tutor-reports/di-dice-roll-w1-compare_dice-audio-2026-09-26.json`, commit `bb380730` | 2026-10-03 |
| Support levers (DI family 2) | `/add-support-tiers` | `qa/support-levers/di-dice-roll-lever-table-2026-10-03.md`, replay `qa/tutor-reports/replay/di-dice-roll-*-2026-10-03.json` | 2026-10-03 |

## Requirements

### R1 — The roll is the child's, and comes first · OBSERVED
- **Property:** the dice are covered until the child taps them; until then the workspace is not ready and the scene says so. The tutor cannot roll.
- **Probe:** `DiDiceRoll.workspace.test.tsx` ("binds, and is not ready until the learner rolls").

### R2 — No face value reaches the tutor's packet · OBSERVED
- **Property:** task, scene and objects never name a face of the child's dice. This holds under levers too: a model never shares a face with the child's dice (R8).
- **Probe:** workspace test "the scene and the task never name a face value"; `diDiceRollLevers.test.ts`.

### R3 — Valid rolls only · OBSERVED
- **Property:** faces 1-6; a sum adds up; a comparison agrees with its dice. The adapter refuses otherwise.
- **Probe:** workspace test "the adapter refuses…".

### R4 — The key accepts counting aloud; a comparison has three words · OBSERVED
- **Property:** counting aloud and ending on the answer is the answer; compare accepts left / right / same in the child's words.
- **Probe:** `diceKey` via the workspace test; spoken misses `diSpokenMisses.test.ts`.

### R5 — Tier shapes the roll, not the mode · OBSERVED
- **Property:** count_pips unchanged by tier; non-tie compare gap 3/2/1; sum keeps its total while the count-on path lengthens.
- **Evidence:** `qa/eval-reports/di-dice-roll-structural-difficulty-2026-09-03.md`.
- **Probe:** `gemini-di-dice-roll.test.ts`.

### R6 — Roll feel · OBSERVED
- **Property:** answerable from the tap; tap once, four ticks, one snap; a rolled die cannot be rolled again.
- **Probe:** workspace test "is answerable from the tap…".

### R7 — Credit prints the answer; a miss never does · OBSERVED
- **Probe:** workspace test "a wrong answer reopens with the dice still rolled…".

### R8 — DI's model is a different roll · OBSERVED (user ruling 2026-10-02; R1 2026-10-03)
- **Property:** `model_roll` shows a different roll of the same mode, solved. For count and sum `modelLeaks` holds false: not the child's dice or their swap, no shared face, no total within one of the child's, the child's answer nowhere in it (faces, total, spoken words), not one step away. A comparison model is THREE pairs, one per answer (left more, right more, same), in that fixed order, sharing no face with the child's dice, and all three are voiced every time. One pair pointed at an answer: the item's relation handed it over, the other relation could be inverted (plan ruling R1).
- **Evidence:** replay 2026-10-03, `di-dice-roll.compare_dice-hard` (tier hard, so the model is pulled): 15/15 lines voice all three pairs in order, 0 flags.
- **Probe:** `diDiceRollLevers.test.ts`; `DiDiceRoll.levers.workspace.test.tsx`; `tutor_replay.py --primitive di-dice-roll --payload di-dice-roll.compare_dice-hard --samples 5`.

### R9 — Help never counts for the child · OBSERVED
- **Property:** `touch_dots` rings only the dots the child taps (no number, no order); `both_bracket` draws no number and no combined group. compare_dice has no in-item help, because any of it would show the answer.
- **Probe:** `DiDiceRoll.levers.workspace.test.tsx`.

### R10 — Simplify keeps the mode, and the full roll stays rolled · OBSERVED
- **Property:** `fewer_dots`, `far_pair` (other relation, never for a tie) and `smaller_dice` build a valid roll of the same mode with id `<item>~simpler`; it starts covered and is ungraded. Returning to the full roll keeps it rolled (`DiTeachingStage` remembers every prepared item). Only the full roll is credited.
- **Probe:** `DiDiceRoll.levers.workspace.test.tsx` (compare case).

### R11 — A starting position is not a pull · OBSERVED
- **Property:** easy, or no tier, starts with `model_roll` on screen and records no lever.
- **Probe:** `DiDiceRoll.levers.workspace.test.tsx` (easy case).

### R12 — Every named miss is answered · OBSERVED
- **Probe:** `journeySweep.test.tsx` (J9, all three payloads); `diDiceRollLevers.test.ts`.

## Conflicts

None open.

## Catalog projection

- **description / constraints:** faithful as of 2026-10-03. The guidance now says "never model this roll; your model is the model_roll lever".
- **evalModes:** faithful.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 12 requirements, 0 conflicts. Check: `qa/primitive-contracts/di-dice-roll-check-2026-10-03.md`.
- 2026-10-03: R8 rewritten for plan ruling R1 (three compare pairs, one per answer).
