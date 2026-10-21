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

**Boss:** `rampLab.card.ts` + `rampLab.boss.ts` (spoken preset; was `adapters/rampLabLive.ts` and the `DI_PORTS` row).

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

## In-item levers (2026-10-08, `/add-support-tiers`)

`rampLabLevers.ts` declares the levers as one lever set (`RAMP_LEVERS`); `RampLab.levers.workspace.test.tsx` and `rampLabLevers.test.ts` hold each rule.

- Help levers describe what is drawn, never the key: `both_ramps` draws both compare setups at one scale with no force,
  arrow or mark; `test_log` lists only values the learner checked (offered from the first check); `same_or_changed`
  tags every setting of setup B alike; `push_bars` draws the two recorded trials with no ranking words (offered once
  both trials are recorded). Model levers (`model_pair`, `model_plan`, `model_explain`) use a condition the item does not touch, and
  their `does` text forbids carrying the model over to the learner's setups.
- Simplify levers (`lighter_load`, `fewer_angles`, `two_settings`) open an ungraded `<id>~simpler` item of the same mode
  built by code, never the parent's setup or answer. A practice plan is checked at the plan (a fair plan is its success)
  and leaves no `investigations` record. The full item comes back blank; a plan item keeps its rejected plans from before
  the practice in its record.
- A start from `supportTier` easy is not a recorded pull. The step buttons (Less/More push, Gentler/Steeper) move the same
  value as the slider, one slider step at a time.
- explain_from_trials publishes its known spoken misses (`rampSpokenMisses`: `reversed_comparison`, `said_same`,
  `one_setup`) on the assignment; they are never sent to the tutor. Compare and explain have no simplify (see the report).

## Changelog

- 2026-09-27 — handoff 19 (shared runtime, `/add-live-tutor-tools`): the workspace reads the eval mode from the wrapper's lesson pin, not a mode rebuilt in this primitive (slice 1), and publishes the scene after every render, so the scene setter drops its publish call and default fields (slice 3). Wiring only: no content, check, miss, verdict or tutor input changed; the sweep over saved payloads (J1-J8) and this primitive's tests pass. Compatible: no requirement changed.
- 2026-09-27 — handoff 20 A4 (`/add-support-tiers`, misses): the lab's checks name what a wrong answer shows (`rampMiss` in `rampLabWorkspace.ts`: compare_conditions 3, find_threshold 2, design_with_budget 2, plan_fair_test 3), listed in the catalog `teachingWorkspace.misses`. The verdicts, feedback text and the key the tutor is never told are unchanged; explain_from_trials stays spoken. Compatible: no requirement changed.
- 2026-10-08 — `/add-support-tiers` (class sweep): levers on all five modes (section above), step buttons beside the push and angle sliders, explain spoken misses, `editable` on an investigation challenge (absent = all three settings, so existing payloads are unchanged). Verdicts, feedback, keys and the investigation record of an unassisted session are unchanged. Compatible: no requirement changed. Report: qa/eval-reports/ramp-lab-levers-2026-10-08.md.
- 2026-10-20 — moved onto a boss (wave 3): `rampLab.card.ts` + `rampLab.boss.ts` on the spoken preset replace `adapters/rampLabLive.ts`, the catalog `teachingWorkspace`/`tutoring` blocks, the `DI_PORTS` row and the scripted `rampExplanationScript.ts` pack. explain_from_trials keeps its key as a meaning `SpokenKey` (`rampKey`; numbers optional) and its known misses; the other four modes stay checked by the lab. Levers became one lever set (model levers now get the tier `support` fact from a per-item `supportTier` the generator stamps; `test_log`/`push_bars` are offered once there is something to show instead of refused at pull). Pip moved to `<PipDock />`/`<PipWorkspace>`; Hear the question goes through the runner's `requestHear`. Verdicts, feedback, keys and the investigation record are unchanged. Compatible: no requirement changed.
