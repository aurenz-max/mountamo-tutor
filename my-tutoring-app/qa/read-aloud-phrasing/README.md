# Read Aloud Studio: Phrase and Read

Implemented 2026-09-11 in the existing `expression` mode.

## Try it

In the Language Arts Primitives Tester, select **Read Aloud Studio**, then
**Phrase and Read (Tier 3)**. Generate a new passage and start the tutor.

Each printed line now has three steps:

1. **Mark phrases:** tap between words to add/remove pause marks. Tap **Use my
   phrase plan** to commit. A line with no marks is a valid plan. The tutor
   acknowledges completion; the plan is not graded.
2. **First reading:** read using the chosen marks. The tutor has not modeled
   the line before this first attempt. Word errors use the existing correction
   and retry policy.
3. **Listen and reread:** compare the retained plan with one suggested grouping,
   hear the model, and read again. Flat but word-correct reading is accepted.

The pilot's model boundaries follow commas, semicolons, or colons. Generated
passages alternate whole-line and comma-grouped sentences. The learner can
explore any between-word boundary; the model is not a unique answer key.
Legacy payloads without phrase groups remain usable with whole-line models.

## Evidence and scoring

Only the modeled reread contributes to the existing expression word-accuracy
score: one scored reading per printed line. Planning acknowledgments and first
readings do not inflate it. Student work stores first-read outcomes, learner
and model phrase groups, `practiceVersion`, the scoring basis, and
`prosodyAssessed: false`. Failure evidence is restricted to scored readings.
No speed, prosody score, or claim of expressive improvement is produced.

## Verification

- 115 tests passed across the existing reading scripts, new phrase scripts,
  component interactions, generator contract, shared runner and script contract.
- Three real production-generator calls passed phrase/text binding and runtime
  pack validation: grade 2 (5 lines / 15 steps), grade 3 (6 / 18), grade 5 (7 / 21).
  Payloads are saved beside this document. These validate generation and script
  construction, not the live audio loop or the accuracy of estimated Lexile labels.
- Reading-group review caught arbitrary verb/object splits in an earlier probe;
  model-boundary validation and generation instructions were tightened to explicit
  punctuation. Final saved groups preserve those boundaries. The grade-5 sample
  still contains a generated article error (`a earthy scent`); exact text binding
  is not a general grammar validator.
- Final Lumina typecheck reported six errors in unrelated in-progress work:
  missing `SpatialPathMetrics` and `DiWordProblemSetupMetrics`, RhymeStudio and
  WordWorkout mode unions, and NumberSequencer's `spotErrorAccuracy`. No errors
  were reported in this feature's files. Those unrelated edits were not changed.
- `git diff --check` passed for the changed tracked feature files.

Reproduce real generation from `my-tutoring-app`:

```text
node scripts/read-aloud-phrasing-probe.mjs --run
```

## Live microphone acceptance still required

- Speak while marking: no reading verdict or early model should occur.
- Commit both a marked plan and a whole-line plan; each acknowledgment must
  open the first reading exactly once.
- Read correctly with flat delivery: accepted, followed by the phrasing model.
- Omit a word: receive the existing word correction and retry, not prosody grading.
- Hear the model: groups should be smooth with short natural pauses; no slash,
  bracket tag, or internal instruction should be spoken.
- Reread with an alternative sensible phrasing: word-correct reading is accepted.
- Reach the next line and the summary: marks reset per line, the passage appears
  once, and planning/first reads do not count as additional scored lines.
- Repeat once in an assembled lesson to verify shared-microphone handoff.
