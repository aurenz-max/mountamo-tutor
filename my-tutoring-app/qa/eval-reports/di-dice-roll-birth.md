# Birth Certificate — di-dice-roll (2026-09-02)

> **Current lifecycle: L5 polished (promoted 2026-09-03).** The L0 notes below remain the historical birth record; L1 adds comparison and two-dice addition, the DI-native tutor satisfies L2, L3 adds answer-safe easy/medium/hard retry support, L4 adds exact within-mode pair shaping, and L5 adds sparse procedural press/rattle/settle feedback while preserving the shared judged-runner verdict and completion sounds. See `qa/eval-reports/di-dice-roll-eval-modes-2026-09-03.md`, `qa/eval-reports/di-dice-roll-support-tiers-2026-09-03.md`, `qa/eval-reports/di-dice-roll-structural-difficulty-2026-09-03.md`, and `qa/eval-reports/di-dice-roll-sound-2026-09-03.md`.

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, multi-instance, with the DI family's required judged-tutor exception at birth.

- Core task identity: `count_pips` — start the Live tutor, tap a six-sided die to roll it, inspect the pip pattern, and produce the quantity as a spoken number word.
- Generator fork: **Fork A — local pool service.** Gemini writes answer-free title/description chrome only. Code selects the finalized die values, derives every spoken answer and ASR alias, and builds 3–6 challenges (five by default). Seeded and controlled-value paths are deterministic; malformed controlled values fall back as a unit.
- Multi-instance contract: one component contains a `challenges[]` run, the default local pool samples without replacement, and every default run spans low (1–3) and high (4–6) faces. The registry also permits multiple Dice Roll blocks in one lesson.
- Cue channel: `[DICE_ITEM]`, `[DICE_MOVE_ON]`, and `[DICE_COMPLETE]` through `useJudgedScriptRunner`. Exact affirmations begin with “Yes”; every re-model-and-retry correction begins with “My turn”.
- DI-native tutoring block: shipped at birth because the generic tutor cannot execute in-band spoken judging. Runtime context is restricted to `challengeType` and the answer-free interaction description.
- Measurement: solved count, first-try count, attempts, accuracy, average attempts, diagnosis evidence, and silent mean response time. There is no visible timer.
- Answer-leak audit: the final value exists in challenge data before animation and is the only scoring source of truth; intermediate roll frames are presentational. Before affirmation, title/description, prompts, status text, runtime tutor context, and ARIA labels omit the value and number word. The pip pattern is the intended visual stimulus. The numeral and number word appear only in the affirmed reward state.

## Design gate

- Direct manipulation — pass: the child rolls by tapping the die itself after starting the tutor.
- Living behavior — pass: a controlled roll lifecycle animates through transient faces and settles on the precomputed semantic value; reduced-motion users land immediately on that same value.
- Production over recognition — pass: the learner says the quantity aloud; there are no numeral-choice buttons.
- No visible timer — pass: response duration is captured silently for evaluation only.
- No answer leak by layout — pass: the screen and accessibility labels withhold the numeral/number word until the tutor affirms the response.

## Verification

- Focused Vitest: **35/35 passed** across the generator, eval-mode, judged-script, tier-propagation, structural-shaping, strategy-withdrawal, and sound-choreography contracts.
- Lumina typecheck: **0 errors** (`npm run typecheck:lumina`). The repository-wide TypeScript command remains red on its large pre-existing baseline; no errors reference Dice Roll files.
- Real registry/API generation: the L0 **3/3** and L1 **8/8** gates passed. The L3 sweep then passed **9/9** live draws across all three eval modes × easy/medium/hard; every item carried the requested tier and retained exact code-derived answers.
- L4 structural verification: **32/32** focused tests passed, including **7,200** stress-checked tiered challenges, and the live three-mode × three-tier sweep passed **9/9** with exact comparison gaps and total-preserving addition shapes.
- Runtime compile: the eval route and application root compiled successfully under Next dev; the root returned HTTP 200.
- Subject routing regression: **1/1 pytest passed**; `di-dice-roll` resolves to MATHEMATICS before the DI family's Language Arts default.
- Live microphone/Tutor semantic drive: **not attempted**. The scripted pack gates pass, but pronunciation, child speech, and the actual audio correction experience still need a human sitting.

## Curriculum home

- **Kindergarten MATCH:** COUNT001-02 “Count to tell the number of objects” (cosine 0.7362, coherence 4/5). This is an honest home for the current one-die `count_pips` task.
- **Grade 1 machine match manually rejected:** the top result was MEAS001-06 “Interpreting Data,” which is not pip quantity/cardinality. Treat L0 adaptive attribution as Pre-K/K. Grade 1 needs an honest counting/subitizing curriculum node before Dice Roll attempts should write Grade 1 mastery.
- Report: `qa/curriculum-fit/di-dice-roll-2026-09-02.md`.

## Follow-up queue

> **L1 promotion update — 2026-09-03:** `/add-eval-modes` is complete. Shipped `count_pips` (β1.5), `compare_dice` (β2.5), and `sum_two_dice` (β3.5), including single, blended, mixed, and intent-resolved generation paths. Catalog and backend priors match; 19/19 focused frontend tests, 3/3 backend tests, zero Lumina type errors, and 8/8 live registry draws passed. `match_quantity`, `make_number`, and `roll_until` remain deferred because they need distinct gesture/state mechanics. Full report: `qa/eval-reports/di-dice-roll-eval-modes-2026-09-03.md`.

> **L3 promotion update — 2026-09-03:** `/add-support-tiers` is complete. Easy supplies the explicit mode-specific retry strategy, medium supplies one brief reminder, and hard re-models then immediately re-asks. The visible status and exact tutor script consume the same per-challenge tier; values, answers, modes, and judging remain invariant. Focused tests passed 28/28, Lumina typecheck passed with zero errors, and the live 3-mode × 3-tier sweep passed 9/9. Full report: `qa/eval-reports/di-dice-roll-support-tiers-2026-09-03.md`.

> **L4 promotion update — 2026-09-03:** `/add-structural-difficulty` is complete. `compare_dice` narrows non-tie gaps from 3 to 2 to 1; `sum_two_dice` lengthens the right-die count-on path while preserving every selected total; `count_pips` stays structurally unchanged because its proposed face-range ladder would be numeric difficulty. Focused tests passed 32/32, 7,200 tiered challenges passed offline invariants, and the live 3-mode × 3-tier sweep passed 9/9. Full report: `qa/eval-reports/di-dice-roll-structural-difficulty-2026-09-03.md`.

> **L5 promotion update — 2026-09-03:** `/add-sound` is complete. A valid die press plays one tactile tap, each of the four transient frames plays a light tick, and the finalized face lands with a snap. Reduced-motion users receive press and settle feedback without the rattle. Correct/incorrect verdicts remain owned by `useJudgedScriptRunner`, and terminal celebration remains owned by the shared submission layer, preventing duplicate sounds. Focused tests passed 35/35 and Lumina typecheck passed with zero errors. Full report: `qa/eval-reports/di-dice-roll-sound-2026-09-03.md`.

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| ✓ | `/add-eval-modes` | L1 eval-dense | **DONE 2026-09-03** — shipped `count_pips` (β1.5), `compare_dice` (β2.5), and `sum_two_dice` (β3.5). Single, blended, mixed, and intent-resolved paths are code-owned and tested; backend priors match the catalog. Deferred `match_quantity`, `make_number`, and `roll_until` because they require distinct gesture/state mechanics. Report: `qa/eval-reports/di-dice-roll-eval-modes-2026-09-03.md`. |
| ✓ | `/add-tutoring-scaffold` | L2 tutored | DI-native exception shipped at birth and remains synchronized through L5. Runtime context contains only the current task identity, support tier, and answer-free interaction; die values, totals, relations, and spoken answers stay private to the post-attempt judging branch. |
| ✓ | `/add-support-tiers` | L3 tiered | **DONE 2026-09-03** — easy uses an explicit mode-specific retry strategy, medium a brief reminder, and hard a direct re-model-and-retry. Visible and spoken scaffolds agree. L4 later added pair shaping while preserving task identity, magnitude bands, answer derivation, and judging. Report: `qa/eval-reports/di-dice-roll-support-tiers-2026-09-03.md`. |
| ✓ | `/add-structural-difficulty` | L4 shaped | **DONE 2026-09-03** — `compare_dice` uses exact non-tie gaps 3/2/1 and `sum_two_dice` uses short/middle/long right-die count-on paths while preserving totals. `count_pips` remains unchanged: restricting its face range would be numeric difficulty, and adding a die would change eval mode. Report: `qa/eval-reports/di-dice-roll-structural-difficulty-2026-09-03.md`. |
| ✓ | `/add-sound` | L5 polished | **DONE 2026-09-03** — `tap` on valid press, four light `tick` frames during the roll, and `snap` on settle; reduced motion skips the rattle. Shared judged-runner verdict sounds and terminal celebration were deliberately not duplicated. No audio files and no sound during the learner response/judging interval. Report: `qa/eval-reports/di-dice-roll-sound-2026-09-03.md`. |
| — | `/add-spoken-judge` | Voice | N/A — spoken production and `useJudgedScriptRunner` are the primitive's native interaction, not an add-on. |
| ✓ | `/eval-test di-dice-roll` | QA loop | Run after every layer; route findings through `/eval-fix`. Current lifecycle report: `qa/eval-reports/di-dice-roll-sound-2026-09-03.md`. |
