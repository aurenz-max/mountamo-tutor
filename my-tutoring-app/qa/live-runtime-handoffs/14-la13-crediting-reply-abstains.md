# The observer refuses credit the tutor clearly gave (LA-13, shared criterion)

Date: 2026-09-22 · Owner: roadmap LA-13 · Executor: `/add-live-tutor-tools` (the shared observer and
its criterion are in scope without a new ruling, user ruling 09-21; the measurement is the gate) ·
Prior: [13](13-delete-di-scripted-drills.md) ([report](../tutor-reports/di-drill-deletion-2026-09-22.md)),
[workspace doctrine](../tutor-reports/workspace-doctrine-2026-09-21.md)

## Why this slice

Since S5 the tutor workspace is the only teaching path for eight adopters. When the tutor
credits a correct answer and the outcome observer refuses to commit it, the item does not
advance. In a live lesson the tutor then keeps teaching an item the child has already done,
until the child gives up or the session times out. The observer never gives *false* credit;
every failure below is a correct answer it refused to record.

The 09-21 doctrine fixed the tutor's side ("credit the learner and name what they got right":
40/42 correct answers credited, 0 abstentions on a crediting reply across 21 journeys). The
observer's own criterion was deliberately not changed then. The evidence now points at it.

## Evidence (seven domains)

| Domain | Case | Result | Source |
|---|---|---|---|
| di-sentence-reading | "You read every word. The cat sat!" / "Yes, you read every word, nice and careful." | abstain 3/3 each, `uncertain_or_invalid` | `di-sentence-reading-jev-2026-09-22.json` (`noisy`, `slow_read`) |
| di-sentence-reading | "You read it all! What did the cat do?" | `none` 3/3, `unsupported` (expected `correct`/`none`) | same, `open_question` |
| di-sentence-reading | "There you go, every word!" after a modelling turn | 1/3 missed | same, `wrong_then_corrected` |
| di-letter-sounds | "Great job, you made the "mmm" sound just right." | abstained in a live `--audio` run | `di-letter-sounds-lesson-entry-audio-2026-09-22.json` run 1 |
| di-word-reading | "You did it!" after a corrective turn | 0.86 < 0.9, stalled `sight_word` 0/3 | [report](../tutor-reports/di-word-reading-teaching-2026-09-20.md) |
| letter-sound-link | a reply that is only the answer token ("Yes, sss.", "Yes, /t/.") | abstain 3/3; the same exchange as a sentence scores 0.99–1.00 | [report](../tutor-reports/letter-sound-link-teaching-2026-09-20.md) |
| shape-sorter `sort` | correct sorts credited in the mat's own label words | 0/5 connected runs, every failure an under-confident refusal | [report](../tutor-reports/shape-sorter-siblings-teaching-2026-09-22.md) |
| di-math-facts | same `wrong_then_corrected` shape | does NOT reproduce (0.94–0.96) | [report](../tutor-reports/di-math-facts-teaching-2026-09-20.md) |
| di-worked-procedure (C6, 09-26) | a column step whose task or scene names the whole problem ("Sixty-nine minus fifty-four. Look at the ones column…"; an object label "the problem 92 − 75…"; a `printedProblem` fact), credited "nine minus four is five" | refused 3/3 on replay each (`uncertain_or_invalid` / `unsupported`); the same exchange with the column-only task credits 3/3. Worked around in the binding (no problem numbers reach the observer); the observer has no notion of one step of a larger printed problem | [C6 report](../tutor-reports/workspace-rollout-C6-2026-09-26.md) |
| di-worked-procedure (C6, 09-26) | confirming turn "That's right, you nailed the regrouping step and are ready to subtract!" after a `confirm_credit` at correct 0.88 | `unsupported` 3/3 on replay; scoping the key or a fact to "this item is only the decision" changes nothing (0/3 each). Candidate 1 below | `di-worked-procedure-w1-subtract_regroup-audio-2026-09-26.json` |
| di-word-problem-setup (C6, 09-26) | a checked-correct build, then "Great job placing the starting number of shells in the big spot!" | transition advance 0.87 < 0.9, `uncertain_or_invalid`; the drive stalled on a solved hands step | `di-word-problem-setup-w1-build_family-audio-r1-2026-09-26.json` |
| di-word-problem-setup (C6, 09-26) | family credited (correct 0.94), then "You got it right by saying five plus box equals seven!" and "…let's keep going!" | `transition_uncertain` (advance 0.57, then 0.64): a held success that never advances. Same step framing as candidate 1 | `di-word-problem-setup-w1-build_family-audio-2026-09-26.json` |

Already ruled out (do not retry):
- **Naming the answer in the reply** (word reading's first remedy): a reply that names the
  answer is still refused on math facts; a relational credit phrase is what rescued it.
- **"Produced sound" or "same channel"** as the line: letter-sound-link accepts the
  corrected-then-affirmed shape on a produced sound at 0.94–0.96.
- **Per-primitive success-condition clauses:** two tried on word reading and reverted (no
  effect; one nudged a single case onto the threshold at a cost elsewhere).
- **Doctrine in the backend session instruction:** measured worse (demonstrations 19→14/21), reverted.

## Where the decision is made

- Criteria: `service/typesafe/observeDialogue.ts`, `DIALOGUE_QUESTIONS.verdict`
  (`correct` / `incorrect` / `none`), plus the `feedback` and `transition` questions.
- Route gate: `certain()` in the same file — the chosen option's probability ≥ 0.9 and a margin
  ≥ 0.2 over the next option. The sentence `noisy`/`slow_read` misses fail here (no confidence
  reported).
- Client gate: `components/live-activity/runtime/DialogueObserver.ts:~105` — verdict and
  transition confidence ≥ 0.9, grounding ≥ 0.9.

Candidates the evidence suggests, to be measured rather than assumed:
1. The `none` sentence "Praise that states no result and does not refer to the whole task
   credits only the step the prior tutor turn asked about" competes with `correct` for
   whole-task praise that states no result ("You read it all!", "You did it!"). The margin rule
   then refuses even when `correct` wins.
2. The `correct` criterion has no sentence for praise that names the *quality* of the whole
   read or sound ("every word", "just right") rather than the answer.
3. A bare answer-token reply ("Yes, sss.") may read as the tutor's own model; see the
   letter-sound-link pair.

Do not lower the 0.9 gate or the margin, and do not add a per-domain threshold or phrase rule
(skill §3). The false-credit cases are the constraint: every change must keep them at 0.

## Scope

In: the shared verdict/feedback/transition criteria, and the probe case sets that measure them.
Out: tutor guidance and `WORKSPACE_DOCTRINE` (the tutor side is already fixed); observation
kinds for learner intent; student-record semantics.

## Steps

1. **Baseline.** Run every adopter's verdict probe (`node scripts/tutor-verdict-probe.mjs`
   with no flag, then `--shapes --letters --words --trains --facts --links --sentences`) and
   save each as `*-jev-la13-before-2026-MM-DD.json`. Record per domain: passed, false credit,
   under-credit.
2. **Add the missing cases** to the probe, built from the domain modules as the probe already
   does: the letter-sounds live miss above verbatim; a shape-sorter `sort` crediting reply from
   the saved runs; for each domain one whole-task-praise-without-result case and one
   quality-of-answer case. Mark any honestly ambiguous case in the report, and never tune a
   label after a failure without saying why.
3. **One criterion change at a time**, re-running all eight domains after each. Keep a change
   only if under-credit falls and no domain gains a false credit or a new failure. Revert and
   record the numbers otherwise.
4. **Connected runs** with the kept change: 3 `--lesson-entry --audio` runs each for
   di-sentence-reading, di-word-reading, di-letter-sounds and shape-sorter `sort`, plus counting
   board as the regression anchor. Compare with the S5 journeys (sentence 3/3, word 1/3 then 3/3,
   letter sounds 1/3 and 1/3, sort 0/5). Letter-sound failures where the synthetic "sss"
   transcribes as "S" are the synthetic-audio limit, not this criterion. Count them separately.
5. **Deterministic tests:** `observeDialogue.test.ts`, `live-activity/`, and every
   `*.teaching.test.tsx`; `typecheck:lumina` 0; full `tsc` 770.

## Exit

- Under-credit falls in at least the sentence, word and letter-sound domains, with 0 false
  credit in every domain and no domain's pass count lower than its baseline.
- Before/after numbers and every reverted attempt in `qa/tutor-reports/`.
- `WORKSTREAMS.md` row, this README's "Next session", and `TEACHING_WORKSPACE.md` (if the
  criterion's stated contract changes) updated in the same slice.

## Not in this slice, already queued

- Pip on the four DI packs: `qa/pip-surface/ROLLOUT.md` (REOPEN row), `/add-pip-surface`.
- Workspace misconception evidence for the DI packs: `qa/di/BACKLOG.md` item 18 (2026-09-22),
  `/add-misconception-loop`.
- The pre-existing `PulseActivityRenderer.workspace.test.tsx` "content that is not the pinned
  mode" failure: it expects the deleted `modeContentGate.ts`. Whoever owns the uncommitted
  deletion updates or removes that row.
- Human sitting: HUMAN-CHECKS #167.
