# LA-13 part 2: the observer and step items (handoff 16)

Date: 2026-09-26 · Executor: `/add-live-tutor-tools` · Handoff: [16](../live-runtime-handoffs/16-la13-step-credit.md)

## Outcome

Three decision-rule changes in `service/typesafe/observeDialogue.ts` (`decideDialogue`) and one criterion
sentence are kept. The sentence (c1c) was first reverted under the handoff's keep rule and restored on a user
ruling (09-26), trading word-reading `wrong_then_corrected` 3/3 → 2/3 in the probe for the step domains.

1. **A confirming reply credits at the gate too** (candidate 3). `confirmedByTutor` required the verdict to be
   *below* 0.9. A confirming reply that cleared the gate (the C6 family, correct 0.94) then needed a certain
   `finished` feedback as well, and "…five plus box equals seven!" scored finished 0.56, so the item was held as
   solved and never advanced. Now: spoken, reply most likely finished, `input.confirming`, `correct` likeliest.
2. **A checked-correct response settles on finished feedback** (candidate 2). The activity's check already
   judged a gesture, so a certain `finished` reply advances it unless the tutor most likely says `incorrect`.
   It no longer also needs a certain `correct` verdict, which step-framed praise ("placing the starting number
   of shells in the big spot", verdict `none` 0.83) never gives. Confidence reported = `feedback.finished`.

3. **A finished confirming reply that does not credit reopens the item** (user-approved follow-up). The host asks
   for a plain verdict once per answer; a confirming reply most likely `none` (gated or not) left the item open
   with no further cue (word-problem run 2). It now resolves as not credited → retry, the 09-24 rule's own branch.
4. **Criterion sentence (c1c):** "When the assignment is itself one step of a larger problem on screen, that step
   is the whole assignment."

Production diff: about 15 lines of logic plus comments. Tests: 2 new cases in `observeDialogue.test.ts`.

## Verdict probe (real JEV, 3 repetitions per case)

New case sets: `--procedure` (13 cases) and `--wordproblem` (18 cases), built from `diWorkedProcedureWorkspace.ts`
and `diWordProblemWorkspace.ts` with the C6 payloads' numbers; every C6 exchange verbatim, plus step praise with
and without a result, wrong steps, a sub-step of the item, help, tutor models and checked builds. The probe gained
`confirming` and `alsoAccept` (a checked item advances on the transition alone in `DialogueObserver`, so
`none/advance` passes there). Labels were set before any run; `step_praise_no_result` / `family_step_no_result` /
`build_step_no_result` ("Great job on that step!" with no result) are honestly ambiguous in isolation and
labelled `correct` because the item is the step.

| Domain | before | c1 (reverted) | c1b (reverted) | **after (kept)** | c1c (reverted) | c1c r2 |
|---|---|---|---|---|---|---|
| counting-board | 60/60 | 60/60 | 60/60 | **60/60** | 60/60 | 60/60 |
| shape-sorter | 96/111 | 99/111 | 96/111 | **96/111** | 96/111 | 96/111 |
| di-letter-sounds | 46/57 | 50/57 | 46/57 | **46/57** | 48/57 | 48/57 |
| di-word-reading | 51/54 | 47/54, 1 false credit | 51/54 | **51/54** | 51/54 | 50/54 (r3 50/54) |
| number-sequencer | 48/48 | 47/48 | 48/48 | **48/48** | 48/48 | 48/48 |
| di-math-facts | 69/69 | 69/69 | 69/69 | **69/69** | 69/69 | 69/69 |
| letter-sound-link | 61/69 | 68/69 | 64/69 | **61/69** | 64/69 | 67/69 |
| di-sentence-reading | 34/42 | 34/42 | 33/42 | **34/42** | 36/42 | 35/42 |
| di-worked-procedure | 15/39 | 26/39 | 15/39 | **15/39** | 30/39 | 28/39 |
| di-word-problem-setup | 30/54 | 32/54 | 30/54 | **42/54** | 42/54 | 42/54 |

False credit 0 in every kept run. Files: `*-jev-la13b-<tag>-2026-09-26.json`. `before`, `c1`, `c1b` ran on
HEAD's rule; `after`, `c1c` include both rule changes.

**Rule replay** (`observer-rule-replay.mjs` answers, HEAD rule vs new rule, no model calls) over all 127 saved
verdict-probe files, 7,988 real answers: 12 cases better, 0 worse, false credit/advance 9 → 9 (the nine are in
superseded 09-20 word-reading criterion variants). Changed: the three `build_*` step praises 3×3 → `none/advance`,
`family_live_confirming` 3/3 → `correct/advance`, letter-sound-link `tap_correct` 30× → `none/advance`.

### Reverted wording attempts

- **c1** (instruction: "The assignment is the task given, even when it is one step of a larger problem shown on
  screen: crediting the answer to that task credits the whole assignment"; `none` step sentence rescoped): worked
  procedure 15 → 26, but word-reading 1 false credit (`homophone_praise`, "Yes, son." for *sun*, 1/3) and
  `wrong_then_corrected` 3/3 → 0/3.
- **c1b** (only the `none` step sentence rescoped to "a smaller part within the assignment"): no gain on either
  step domain, sentence-reading −1.
- **c1c** (one instruction sentence: "When the assignment is itself one step of a larger problem on screen, that
  step is the whole assignment."): worked procedure 15 → 30 / 28, letter sounds +2, sentence +2 / +1, links +3 / +6,
  0 false credit anywhere. Word-reading `wrong_then_corrected` fell 3/3 → 2/3 in two of three runs (the miss
  goes to `confirm_credit`: no false credit, no dead end). Reverted because the handoff's rule is "no domain
  loses a pass". **This is the decision to put to the user** (below).

## Connected runs (`--lesson-entry --audio`, 3 each)

| Journey | Result | Notes |
|---|---|---|
| di-worked-procedure `subtract_regroup` (`--progression-only`) | **3/3 PASS** (C6: FAIL) | 27 steps. The first clear credit of a step lands below the gate almost every time (`confirm_credit`); the tutor's confirmation advances it (`confirmed_by_tutor`, 0.58–0.93; three at ≥ 0.9 advance only because of change 1). One regroup credit cleared the gate directly |
| di-word-problem-setup `build_family` (`--progression-only`) | **1/3** (C6: FAIL) | Every checked-correct build advanced (`checked_success_feedback_finished`, 6/6), the C6 stall. Run 2 stalled on the last `operation` step: the confirming reply "You did it, you've solved this step!" read `none` → `unsupported`, and nothing follows a confirming turn. Run 3: the tutor went silent after "Let me try that again" (three empty-transcript turns), a Live/tutor silence, not an observer decision |
| counting-board `count` | 3/3 PASS | regression anchor (with help/show prompts) |
| di-sentence-reading | 3/3 PASS | regression anchor |

Harness note: the first worked-procedure attempt omitted `--progression-only` and failed 3/3 on "Help never
changed the actual board": a W1 binding offers no demonstration. That file was discarded; the C6 smokes use the flag.

### Final connected runs (all changes, `-la13b-final-*`)

| Journey | Result | Notes |
|---|---|---|
| di-word-problem-setup `build_family` (`--progression-only`) | **3/3 PASS** | 9/9 builds advanced; 24 spoken steps credited on the first reply, 3 through a confirmation; 0 not-credited reopens |
| di-worked-procedure `subtract_regroup` (`--progression-only`) | **3/3 PASS** | 26/27 step credits clear the gate on the first reply (before c1c nearly every step needed a confirm round trip); 1 confirm |
| di-word-reading | 3/3 PASS | anchor for the c1c trade |
| counting-board `count` | 3/3 PASS | anchor |
| di-sentence-reading | 2/3 | run 1: the tutor's show turn was cut off mid-sentence ("Let's look at the first "), so no demonstration happened ("Help never changed the actual board"); the known narrated-demonstration family, not an observer decision |

Rule replay for change 3 (HEAD vs final over 11,057 saved answers): 60 better, 0 worse, false credit/advance
10 → 10 (pre-existing). Its one visible effect: the C6 confirmation "you nailed the regrouping step…" now reopens
for a retry in 2 of 3 c1c runs instead of stalling. A retry after that praise is awkward; it did not occur in
the connected runs.

## Deterministic checks

`observeDialogue.test.ts` 17/17; `service/typesafe`, `components/live-activity` (incl. the generic W1 contract)
and `primitives/visual-primitives` (incl. the five C6 `*.workspace.test.tsx`): 259 files, 4,777 tests green.
`typecheck:lumina` 0; full `tsc` 770 (baseline).

## Remaining

1. The C6 regroup confirmation shape ("you nailed the regrouping step") can still read `none`; it now reopens for a
   retry rather than stalling. Not seen in the final connected runs.
2. Tutor silence after a learner's "Let me try that again" on a checked-wrong build (one occurrence, earlier run).
3. A show turn cut off mid-sentence without a demonstration (sentence-reading run 1): the existing
   narrated-demonstration family.
