# Contract: math-fact-fluency

- **Derived:** 2026-10-02 · evidence window: eval-reports 2026-03-17 / 06-27 / 06-29, tutor-reports 2026-09-26 / 09-28 (w1 + runtime payloads), oracle registry, git log through `670039ad`
- **Component:** `src/components/lumina/primitives/visual-primitives/math/MathFactFluency.tsx` · **Boss:** `mathFactFluency.card.ts` + `mathFactFluency.boss.ts` · **Workspace module:** `mathFactFluencyWorkspace.ts` · **Levers:** `mathFactFluencyLevers.ts` (`FLUENCY_LEVERS`) · **Generator:** `src/components/lumina/service/math/gemini-math-fact-fluency.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`id: 'math-fact-fluency'`)
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

### R2 — No unearned credit; a match's key never reaches the tutor · OBSERVED (re-based 2026-10-13)
- **Property:** A tap or Submit is checked by `mathFactMatches` and committed through `commitCheck`. A number answer (`choice`, `stepper` channels) may also be said aloud: the card mode is `SAY_OR_SHOW`, the boss's `mathFactKey` is the number word with its digits, `acceptsGesture` is set by the preset, and JEV credits only from the tutor's feedback against it. A match (equation ↔ picture) stays gesture-only and publishes no key. Scene facts name what is drawn ("the learner counts it"), never a count or the answer.
- **Demanded by:** live workspace (C9); spoken answers (session 2026-10-13 750ca99a).
- **Probe:** `mathFactFluencyWorkspace.test.ts`, `MathFactFluency.workspace.test.tsx`, `scripts/tutor-verdict-probe.mjs --fluency`.

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
- **Probe:** `mathFactFluencyLevers.test.ts` (no levers on speed-round). Its misses are the card's `speed_round.unanswered` (2026-10-08; card since 2026-10-20).

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

- 2026-10-13 — `/add-item-space`, all five modes measured and wired. Before: every tier and run opened with
  the same facts (7 + 8, 14 − 6, 9 + 9, 17 − 9); the tier moved only distractors and the blank. Now, with a
  tier and a lesson the resolver fits to add-sub-20, code picks each fact at the tier's band
  (`mathFactFluencyItemSpace.ts`): result unknown for visual-fact, equation-solve, speed-round and match; the
  change or start unknown for missing-number (the tier's blank preference does not run on this path).
  Options for visual-fact and equation-solve come from the space's mistakes at the tier's spread, inside
  0..maxNumber; speed-round and missing-number are typed; match equations are built in code with distinct
  results inside the range. A failed wording call on this path ships code asks instead of failing the lesson.
  Own-path fixes: match distractors outside the lesson's range are dropped (11 + 11 = 22 in a within-20
  lesson), the gap re-synthesis no longer reaches maxNumber + 2, and a fact repeated in one session is
  dropped. Probes `qa/difficulty-demo/2026-10-13/mff-<mode>.txt`; pins `mathFactFluencyItemSpace.test.ts`.
  Each challenge carries `itemSpace`, never rendered or sent to the tutor. Compatible.

- 2026-10-20: re-based onto the boss framework (`mathFactFluency.card.ts`/`.boss.ts`, `spokenBoss`; match `TAP_ONE` keyless via `show`). R2: the key is a `SpokenKey` (number word + digits); `printed_number` is now ONE spoken known miss naming every printed number (two entries with one id made the spoken-miss request invalid). R6: `unanswered` moved from the catalog to the card. R7/R8: the levers are one lever set (`FLUENCY_LEVERS`: two_parts `layout`, count_marks/fact_dots/part_whole `marks`, smaller_fact/far_match `easier`); same offers, words, scene facts and builders. R1 unchanged: no timer; the silent response-time metric and `isFast` are recorded as before. Compatible.
- 2026-10-02: derived (initial, static). 8 requirements, 0 conflicts. R6-R8 added with the M3 lever slice.
- 2026-10-08: R6 speed_round misses listed as unanswered; R7 fingers pictures get `two_parts` / `count_marks` (dots under the hands), and per-item miss coverage is probed on every saved payload.
- 2026-10-13: R2 re-based. "One checked gesture per item" protected no unearned credit and no key leak; a spoken "18" to 9 + 9 was praised and never credited (session 750ca99a). Number answers are now spoken items that also take the tap/Submit (`TeachingItem.acceptsGesture`); JEV verdict probe 33/33, false credit 0.
