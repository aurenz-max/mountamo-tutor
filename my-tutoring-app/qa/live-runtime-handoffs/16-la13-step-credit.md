# The observer refuses credit for an item that is one step of a larger problem (LA-13, part 2)

Date: 2026-09-26 · Owner: roadmap LA-13 · Executor: `/add-live-tutor-tools` (the shared observer and its
criterion are in scope without a new ruling, user ruling 09-21; the measurement is the gate) · Prior:
[14](14-la13-crediting-reply-abstains.md) (part 1, done 09-22), [C6 report](../tutor-reports/workspace-rollout-C6-2026-09-26.md)

## Status (09-26): DONE

Candidates 2 and 3 kept; candidate 1 kept as one instruction sentence (c1c) on a user ruling (word-reading
`wrong_then_corrected` 3/3 → 2/3 in the probe accepted); plus a finished confirming reply that does not credit now
reopens the item (no-dead-end gap). Final connected `--audio`: word-problem build_family 3/3, worked-procedure
regroup 3/3, word-reading 3/3, counting-board 3/3, sentence-reading 2/3 (a cut-off show turn). 0 false credit.
[Report](../tutor-reports/la13-step-credit-2026-09-26.md).

## Why this slice

Rollout C6 put the first multi-step packs on the workspace: di-worked-procedure (one item per column step) and
di-word-problem-setup (one item per setup step of a story). In both, the tutor credits a correct step clearly and the
observer refuses to commit it, so the lesson stalls on a solved item. The child can still press the shell's Next
button, so this is not a dead end, but the tutor keeps talking about an item that is already done. The binding is not
the cause. The observer's own criterion is.

The criterion tells the model to judge "the WHOLE assignment", and the `none` option says: "Only a partial step … is
credited" and "Praise that states no result and does not refer to the whole task credits only the step the prior
tutor turn asked about." When an item is itself a step, the tutor's natural words ("step", "ready to subtract",
"in the big spot") match that sentence exactly.

## Evidence

| Pack | Exchange | Observer result | Source (`qa/tutor-reports/`) |
|---|---|---|---|
| worked-procedure | Task starts with the whole problem ("Sixty-nine minus fifty-four. Look at the ones column…"); "Excellent, nine minus four is indeed five." | `none` 0.71–0.76, 3/3 on replay. The column-only task credits 3/3 | `di-worked-procedure-w1-subtract_no_regroup-audio-r3-2026-09-26.json` |
| worked-procedure | Object label "the problem 92 − 75 printed in columns…"; "Spot on, eight minus seven gives us one!" | `unsupported` 3/3. Without the numbers, 3/3 reach `confirm_credit` | `…subtract_regroup-text-r2-2026-09-26.json` |
| worked-procedure | Confirming turn: "That's right, you nailed the regrouping step and are ready to subtract!" | `unsupported` 3/3. Scoping the key or a fact to "this item is only the decision" changes nothing | `…subtract_regroup-audio-2026-09-26.json` |
| word-problem | Checked-correct build, then "Great job placing the starting number of shells in the big spot!" | verdict `none` 0.76, advance 0.87 < 0.9 | `di-word-problem-setup-w1-build_family-audio-r1-2026-09-26.json` |
| word-problem | Family credited (correct 0.94), then "…five plus box equals seven!" and "…let's keep going!" | `transition_uncertain`, advance 0.57 then 0.64: the item is held as solved and never advances | `…build_family-audio-2026-09-26.json` |

The first two are worked around in the binding: no problem numbers reach the observer, and the task is the column
instruction alone. Keep those workarounds, because they are also better pedagogy. The last three are not worked around.

Replay scripts that produced these numbers are in the C6 session. Rebuild them from the saved `dialogue_observation`
inputs: POST `result.input` to `/api/lumina/live-activity/observe-dialogue`, three runs per variant.

## Where the decision is made

- `service/typesafe/observeDialogue.ts`: `DIALOGUE_QUESTIONS.verdict` (the `none` sentences quoted above) and
  `.transition`; `decideDialogue` (`certain()` = p ≥ 0.9 and a 0.2 margin; `confirm_credit`; `grounded`).
- Checked gestures: `spoken` is false, so the activity's check grounds the verdict. Success still needs the
  verdict question to come back `correct` and certain, even though code has already decided correctness. The
  word-problem build stall is this path.

## Candidates to measure (one at a time)

1. **Scope the step sentence.** Say that the assignment is the task given, even when the screen shows a larger
   problem; crediting that task is crediting the whole assignment. Reword or narrow "Praise that states no result
   and does not refer to the whole task credits only the step the prior tutor turn asked about" so that it applies
   to a sub-step *of the task*, not to the task itself.
2. **Checked gestures: a finished affirmation after a checked-correct response is success.** The activity has
   already judged the answer, so there is no false credit to guard against on that path (`correct` comes from
   code). Consider letting `finishedSuccess` for a non-spoken item rest on the check plus finished feedback or a
   certain `advance`, instead of on the verdict question. This is a decision-rule change: measure it with
   `observer-rule-replay.mjs` first (no model calls), then live.
3. **Confirmation turn.** "You nailed the … step" is the tutor's confirming reply after `confirm_credit`, and
   `confirmedByTutor` only needs `correct` to be the likeliest option, yet it came back `unsupported`. Check whether
   the confirming turn loses that path (for example, `input.confirming` not being set) before changing any wording.

Do not lower the 0.9 gate or the margin, and do not add a per-domain threshold, phrase rule or per-pack criterion
(skill §3). False credit must stay 0 in every domain.

## Steps

1. **Add the cases.** Put a worked-procedure and a word-problem case set in `scripts/tutor-verdict-probe.mjs`
   (`--procedure`, `--wordproblem`), built from the domain modules (`diWorkedProcedureWorkspace.ts`,
   `diWordProblemWorkspace.ts`) as the other domains are. Include each exchange above verbatim, a
   step-framed praise with no result, a step-framed praise that names the result, a wrong step, a
   help turn, and a checked-correct gesture praised as a step. Mark honestly ambiguous cases in the report.
2. **Baseline.** Run the probe for all ten domains (no flag, then every flag) and save each file as
   `*-jev-la13b-before-2026-MM-DD.json`. Record passed, false credit and under-credit per domain.
3. **Try one candidate at a time**, re-running all ten domains after each (the replay script first for candidate 2).
   Keep a change only if under-credit falls and no domain gains a false credit or loses a pass. Otherwise revert it
   and record the numbers.
4. **Connected runs** with the kept change: `--lesson-entry --audio` × 3 each for di-worked-procedure
   `subtract_regroup` and di-word-problem-setup `build_family`, plus counting-board `count` and di-sentence-reading
   as regression anchors. Count a `[LESSON_START]` silence separately; it is the known harness note.
5. **Deterministic tests:** `observeDialogue.test.ts`, `live-activity/` (including the generic W1 contract),
   and the five C6 `*.workspace.test.tsx`; `typecheck:lumina` 0; full `tsc` 770.

## Exit

- The worked-procedure and word-problem step cases pass, the three stalled journey shapes above advance, 0 false
  credit in every domain, and no domain below its baseline.
- Before/after numbers and every reverted attempt are saved in `qa/tutor-reports/`. Update the evidence table in
  [14](14-la13-crediting-reply-abstains.md), the `TEACHING_WORKSPACE.md` criterion text if it changes, the ROLLOUT
  C6 row (the three FAIL smokes re-driven), and the WORKSTREAMS row, all in the same slice.

## Not in this slice

- deduction cannot_tell draws a single rule, with the forbidden lookalike "pillow" (`/eval-fix`, generator).
- The tutor told a child to rearrange a build that was correct (word-problem story 1): tutor side, W2.
- Leading hints after a wrong answer, and whether that credit is independent (`$student-data-loop`).
- Batch C7 continues after this slice (`qa/workspace-rollout/ROLLOUT.md`).
