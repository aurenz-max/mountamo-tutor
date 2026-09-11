# Contract: Ramp Lab investigation extension

Built 2026-09-10. This extends the existing primitive with `plan_fair_test` and
`explain_from_trials` for Grades 3–5. The three existing task identities remain.

| Mode | Learner work | Beta prior |
|---|---|---:|
| compare_conditions | Compare matched conditions | -1.0 |
| find_threshold | Find the smallest working push | 0.0 |
| plan_fair_test | Edit a controlled comparison, predict, collect both trials | 0.75 |
| design_with_budget | Find the steepest feasible ramp at fixed height | 1.5 |
| explain_from_trials | Predict, collect two controlled trials, explain the comparison aloud | 2.5 |

Priors are mirrored in the backend; they are not empirical calibration.

## Learning and evidence boundaries

- A fair plan changes exactly the requested variable: ramp angle, surface, or box
  mass. All other settings, including box type, stay fixed. Unchanged and confounded
  plans fail. Rejected attempts remain in the record; accepted settings lock.
- Prediction precedes either trial. A wrong prediction does not invalidate a fair
  plan. Prediction accuracy and first-attempt task correctness are separate.
- The simulated test bench increases force in 0.5 N steps. Movement begins above
  `m * 9.8 * (sin(angle) + mu * cos(angle))`. Each record stores the tested setup,
  last still force, and first moving force. This is deterministic simulated evidence,
  not a physical sensor measurement, acceleration experiment, or noisy repeat trial.
- Two records are required before completion or spoken explanation. The notebook
  stays visible during the spoken turn. No conclusion is supplied before an attempt.
- The spoken judge uses facts calculated from the records. Accept a true comparison
  connecting the changed condition to both setups, including qualitative paraphrases.
  Exact wording and spoken numbers are optional; contradictory numbers are wrong.
  Refuse reversed comparisons, one isolated observation, slogans, echoes, and off-task talk.
- Every spoken answer gets a `Yes,` or `My turn:` verdict through the existing
  `concept_statement` / `useJudgedScriptRunner` contract. Two corrections cap the
  turn. A capped failure may complete the session but stays unsolved with no success
  credit. A corrected answer remains distinguishable from an independent answer.
- `studentWork.investigations` preserves plan attempts, prediction correctness,
  immutable trial snapshots, and explanation outcome/correction count. The existing
  submission pipeline receives this evidence; no new mastery-update logic was added.

## Content and scope

Code owns 18 investigation setups per new mode, six per variable, with both comparison
directions. The generator selects the requested variable from the objective/intent;
explicit mode pins constrain selection and blends rotate between modes. Within a
session, selected IDs are unique. Cross-session novelty is not implemented.

Kindergarten–Grade 2 generation excludes the new modes in mixed sessions and rejects
explicit investigation pins. Legacy cached data with no challenges retains the old
three-mode fallback. Free exploration remains available explicitly.

Single-mode hard support hides the general investigation guide; easy/medium retain it.
This is a small support difference, not a completed three-tier structural-difficulty
ladder. Numeric ranges do not grow with support tier. Mixed sessions have no single tier.

The current curriculum probe found Grade 3 friction content with a matching learning
demand and related fair-test planning content. The latter also asks for ordering
steps, which this build does not assess. Grade 4 exact attribution and Grade 5
published coverage are unconfirmed; see the curriculum report.

## Validation and acceptance

[Implementation QA](../../../../../qa/eval-reports/ramp-lab-2026-09-10.md) records the
automated, fresh-generation, browser, and live semantic checks. Human microphone,
pause timing, tutor handoff, and tablet acceptance remain OPEN in HUMAN-CHECKS #148.
The semantic harness sends synthetic learner answers and does not establish child
audio recognition reliability.
