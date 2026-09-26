# Workspace rollout C6: the five spoken DI packs for older learners (2026-09-26)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C6. Executor: `/add-live-tutor-tools`.

## What shipped

All five packs now run only on the teaching workspace, with every catalog mode bound (one-path ruling 09-23). An
unbound mount shows the shared needs-the-tutor card. Four packs moved onto `DiTeachingStage`. di-word-problem-setup
has a hands step, so it uses `useWorkspaceRunner` instead.

| Primitive | Commit | Items | Production (+/−) |
| --- | --- | --- | --- |
| di-spoken-practice | `ca9f5ffe` | One spoken answer per item. The key carries the pack's alternates, the `compare_choice` word menu, `acceptRule`, `signatureError`, and for `explain_concept` the one idea, judged on meaning | +259 / −327 |
| di-dice-roll | `bb380730` | The learner taps to roll (not an attempt), then gives one spoken answer: count, compare, or sum | +234 / −356 |
| di-deduction | `48fbe404` | One spoken case. deny and cannot_tell need a verdict WITH a reason; "yes, because it has the property" is the signature error | +224 / −376 |
| di-worked-procedure | `6e4c7015` | One spoken step: the column decision, or the difference after a regroup. A regroup counts only with both new numbers | +240 / −394 |
| di-word-problem-setup | `375b203b` | Placing the big amount or building the family is a checked gesture (the big slot decides it; the build commits after 1.8 s still). Kind, family, operation and solve are spoken | +445 / −556 |

Production +1,402 / −2,009. Tests +1,418 / −883, mostly the eleven generated payloads. Five runner-mock suites were
replaced by `<X>.workspace.test.tsx` files, and the five packs left the runner-mock Pip suite. The DI drive adapters
(`DI_PORTS`), the benches and the `*Script.ts` modules stay, as they did in C5: their retirement belongs to LA-14.

`DiTeachingStage` gained a stage view: the committed step ids, for packs that write credited steps onto one problem,
and a per-item `ready` for a pack whose learner acts first (`awaitsStimulus`). It also gained an optional counter.

## Behaviour changes (recorded)

- **The tap-to-hear and hear-the-rule/problem/story buttons are gone.** With the tutor present, the learner asks the
  tutor to repeat.
- **A wrong answer no longer closes a step**, so deduction, worked-procedure and word-problem have no dimmed "carried"
  marks. The page draws only credited steps.
- **dice-roll is answerable from the tap, not from the landing.** The faces are fixed before the animation starts.
  In the first smoke the driver answered during the 420 ms roll, and the tutor was told the die was still covered.
- **worked-procedure's decide ask no longer gives the decision away.** It used to say "Say why you need to regroup…"
  or "Say that you do not regroup…", but the decision is the skill that step judges. It now says "Look at the ones
  column and say what you do there" (`diWorkedProcedureModes.ts`). I tried "Tell me what you do." first, and the
  tutor stayed silent at `[LESSON_START]` in 4/4 `--audio` drives. A dice-roll control drive passed in the same
  window, and the silence stopped with the learner-addressed wording.
- **No worked-procedure problem number reaches the observer.** When the whole problem appeared in the task ("Sixty-nine
  minus fifty-four. Look at…"), in an object label ("92 − 75") or in a fact, the observer refused a clear column credit
  3/3 on replay each. The column-only task credits 3/3. The first step no longer says the problem aloud; the child reads
  it off the page.
- **The adapters refuse a payload that contains a rule, problem or story the plan gates would drop.** The component
  used to drop such items silently.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| di-spoken-practice compare_choice text | PASS | `di-spoken-practice-w1-compare_choice-text-2026-09-26.json` |
| di-spoken-practice count_and_say `--audio` | PASS | `di-spoken-practice-w1-count_and_say-audio-2026-09-26.json` |
| di-dice-roll count_pips text | PASS on r2 (after the readiness fix) | `di-dice-roll-w1-count_pips-text-2026-09-26.json` |
| di-dice-roll compare_dice `--audio` | PASS (and a later control PASS) | `di-dice-roll-w1-compare_dice-audio-2026-09-26.json` |
| di-deduction deny text | PASS (1 Live resume) | `di-deduction-w1-deny-text-2026-09-26.json` |
| di-deduction conclude `--audio` | PASS | `di-deduction-w1-conclude-audio-2026-09-26.json` |
| di-deduction cannot_tell `--audio` | FAIL ×2, content: each draw built one rule (one case), and the lesson completed after it | `…cannot_tell-audio-r1…`, `…cannot_tell-audio…` |
| di-worked-procedure subtract_regroup text | PASS on r3 (after the label fix; r1 had a `[LESSON_START]` silence) | `di-worked-procedure-w1-subtract_regroup-text-2026-09-26.json` |
| di-worked-procedure subtract_no_regroup text | PASS | `di-worked-procedure-w1-subtract_no_regroup-text-2026-09-26.json` |
| di-worked-procedure subtract_no_regroup `--audio` | PASS on r7 (final ask) | `di-worked-procedure-w1-subtract_no_regroup-audio-2026-09-26.json` |
| di-worked-procedure subtract_regroup `--audio` | FAIL: the observer refused a confirming "…the regrouping step and are ready to subtract!" | `di-worked-procedure-w1-subtract_regroup-audio-2026-09-26.json` |
| di-word-problem-setup find_big_number text | PASS (wrong placement, retry, three stories) | `di-word-problem-setup-w1-find_big_number-text-2026-09-26.json` |
| di-word-problem-setup build_family `--audio` | FAIL ×2 on observer transitions after credit; every spoken step kind was credited | `…build_family-audio-r1…`, `…build_family-audio…` |

Every failed run is kept (`-r1` … `-r6`). Undriven modes: spoken-practice say_answer, read_aloud and explain_concept;
dice-roll sum_two_dice; word-problem classify_and_build. The workspace test covers each of them on hand-built items.

## Findings

- **LA-13 again: the observer does not credit a step of a larger problem.** There are two adopters now. worked-procedure
  shows it three ways: the whole problem in the task, label or facts; a confirming "you nailed the regrouping step and
  are ready to subtract!" (refused 3/3 whatever the key says); and word-problem's "…in the big spot!" (advance 0.87) and
  a credited family held at advance 0.57/0.64. It matches candidate 1 in
  [handoff 14](../live-runtime-handoffs/14-la13-crediting-reply-abstains.md): praise read as crediting only the step.
  The evidence rows are added there. The fix belongs in the shared verdict/transition criterion and needs the
  eight-domain measurement, so it is the next pull for this executor rather than a per-pack patch. In a live lesson the
  learner still has the shell's Next challenge button, so it is not a dead end; the harness has no step that presses it.
- **deduction cannot_tell yield.** Both draws for a pure cannot_tell session built one rule, so the lesson had one case.
  Both used the lookalike "pillow" (for feathers), which the prompt forbids. Queued for `/eval-fix`.
- **ASR "no" and "now".** Synthetic audio heard "no regrouping" as "Now regrouping", which is the clean column's
  signature error. The tutor credited, then hedged, and the observer correctly refused. A child's "no regroup" can be
  misheard the same way. The harness now says the whole fact.
- **Tutor feedback after a correct build.** On word-problem story 1, after a checked-correct build, the tutor said "Go
  ahead and try arranging the cards again for the equation."
- **Leading hints after a wrong answer (C4/C5 finding, three more families).** Examples: "What is nine minus four?"
  after a wrong ones column, "which card shows the total number of all the marbles?", and "other things can have
  feathers too". This is a scoring question for `$student-data-loop`, not a W1 defect.
- **Two-turn credits.** Most spoken credits went through `confirm_credit`, so the tutor says its credit twice, often
  almost word for word.

## Checks

- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- The five workspace tests, the direct-instruction folder, DI service and qa, pip, evaluation and live-activity: 144
  files, 1,889 tests. The generic W1 contract passes on the eleven new payloads. `livePlan.test` now finds the saved
  K-addition package's dice-roll and spoken-practice sections bound, and looks up the number-line item by id.
- Full frontend suite: 577 files, 7,950 tests passed (10 skipped).

Human acceptance (browser and mic) remains open under HUMAN-CHECKS #167.
