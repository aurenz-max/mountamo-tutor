# Contract: math-fact-fluency

- **Derived:** 2026-10-02 · evidence window: eval-reports 2026-03-17 / 06-27 / 06-29, tutor-reports 2026-09-26 / 09-28 (w1 + runtime payloads), oracle registry, git log through `670039ad`
- **Component:** `src/components/lumina/primitives/visual-primitives/math/MathFactFluency.tsx` · **Workspace module:** `mathFactFluencyWorkspace.ts` · **Levers:** `mathFactFluencyLevers.ts` · **Generator:** `src/components/lumina/service/math/gemini-math-fact-fluency.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`id: 'math-fact-fluency'`)
- **Status:** ACTIVE (static derivation: no live census this run; refresh with `--census K` when the dev server is up)

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 addition/subtraction fact fluency within 5/10/20, all five modes | catalog + eval-reports | `qa/eval-reports/math-fact-fluency-2026-06-*.md` | 2026-06-29 |
| K Math atlas `missing-difference-form` (missing_number count-on vs start-unknown) | atlas slice 6 | `4341786a` | 2026-09-09 |
| Live tutor / JEV workspace (W1 plain binding, rollout C9) | tutor-reports | `qa/tutor-reports/math-fact-fluency-w1-*-2026-09-26.json`, `-runtime-*-2026-09-2{6,8}.json` | 2026-09-28 |
| Support-tier axis (config.difficulty) | structural-difficulty campaign | `cbf07171`; generator `resolveProblemShape` | 2026-08 |
| Lever ladder (M3, handoff 30) | `/add-support-tiers` | `qa/support-levers/m3-lever-tables-2026-10-02.md` | 2026-10-02 |
| Oracle (content contract) | oracle registry | `service/qa/oracles/math-fact-fluency.ts` | ongoing |

## Requirements

### R1 — No timer, ever · OBSERVED (user ruling)
- **Property:** Nothing advances, grades or displays on a clock. Response time is a silent metric only; the scene tells the tutor never to mention speed.
- **Demanded by:** every consumer ([[no-timer-on-fact-fluency]]).
- **Probe:** `MathFactFluency.workspace.test.tsx`; scene `timing` fact present.

### R2 — One checked gesture per item; the key never reaches the tutor · OBSERVED
- **Property:** Every answer is checked by `mathFactMatches` and committed through `commitCheck`; scene facts name what is drawn ("the learner counts it"), never a count or the answer.
- **Demanded by:** live workspace (C9).
- **Probe:** `mathFactFluencyWorkspace.test.ts`, `MathFactFluency.workspace.test.tsx`.

### R3 — missing_number blank assigned in code · OBSERVED
- **Property:** `missingNumberPosition()` picks the blank after operand reconciliation; easy/medium alternate count-on and start-unknown, hard is start-unknown.
- **Demanded by:** K Math atlas `missing-difference-form`.
- **Evidence:** `4341786a`. **Probe:** `gemini-math-fact-fluency.unknown-position.test.ts`.

### R4 — Answer keys are consistent · OBSERVED
- **Property:** the answer appears exactly once in `options`; exactly one `equationOptions` entry and one `visualOptions` entry resolve to it; subtraction never goes negative.
- **Demanded by:** oracle. **Probe:** `/oracle-test math-fact-fluency`.

### R5 — Named misses · OBSERVED
- **Property:** `mathFactMiss` names `other_operation`, `printed_number`, `one_short`, `one_over`, `short_by_more`, `over_by_more` from the number answered; a picture-to-equation match prints no fact, so it names distance only.
- **Demanded by:** live workspace, lever ladder. **Probe:** `mathFactFluencyWorkspace.test.ts`.

### R6 — speed_round is aid-free and has no levers · OBSERVED (user ruling 2026-10-02)
- **Property:** speed_round shows a bare fact and a stepper; no picture, and `levers` is empty. A picture would make it equation_solve; recall has no step to make simpler.
- **Probe:** `mathFactFluencyLevers.test.ts` (no levers on speed-round). Its misses are the catalog's `unanswered.speed_round` (2026-10-08).

### R7 — Lever leak rules · OBSERVED (2026-10-02)
- **Property:** `two_parts` and `fact_dots` draw only the printed numbers (no dots under the "?", no numeral on any dot group); `count_marks` numbers only the dots the learner tapped, and never splits a match picture into the fact's parts; `part_whole` draws the whole with the known part shaded and leaves the unknown part plain and unlabelled. On a fingers picture `two_parts` / `count_marks` keep the hands and draw their dots under them (2026-10-08). Scene facts for levers state no count. Per item, every miss a wrong choice can produce is answered by a lever on that item (visual_fact, match, equation_solve, missing_number).
- **Probe:** `mathFactFluencyLevers.test.ts` leak tables on every saved payload; `MathFactFluency.levers.workspace.test.tsx`.

### R8 — Lever assistance record and simplify floor · OBSERVED (2026-10-02)
- **Property:** a runtime pull is recorded on the next attempt; an easy tier's starting lever is not. `smaller_fact` / `far_match` open an ungraded item of the same type, unknown position and operation, which is never the learner's fact and never has its answer; the full item returns and only its answer is credited.
- **Probe:** `mathFactFluencyLevers.test.ts` builder sweep; `MathFactFluency.levers.workspace.test.tsx`.

## Conflicts

None open.

## Catalog projection

- **description / constraints / evalModes:** faithful as of 2026-10-02.

## Changelog

- 2026-10-02: derived (initial, static). 8 requirements, 0 conflicts. R6-R8 added with the M3 lever slice.
- 2026-10-08: R6 speed_round misses listed as unanswered; R7 fingers pictures get `two_parts` / `count_marks` (dots under the hands), and per-item miss coverage is probed on every saved payload.
