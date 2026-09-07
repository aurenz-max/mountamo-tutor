# Birth Certificate — letter-workshop (2026-09-07)

**Lifecycle: L0 assisted trace implemented.** Live generated content and browser mouse flow verified; manuscript-template review, child tolerance calibration, physical pen/touch and live tutor audio remain unverified. This does not close independent letter-formation curriculum requirements.

- Core task: `trace`; code-owned 52 uppercase/lowercase references, cumulative groups, 3–6 challenges.
- Generator fork: A, Gemini framing plus locally selected reference IDs. Unsupported copy/write requests fail explicitly.
- Required fields: session `title`, `description`, `gradeLevel`, `challengeType='trace'`, required `challenges[]`; each challenge `id` (unique), `type='trace'`, valid `templateId`.
- Student work: every submitted/cleared attempt retains normalized points, relative event timestamps, pointer type, stroke boundaries, template/case identity, assessment and `trace-guide` assistance. Retry never replaces earlier evidence. Evidence is attached to the normal evaluation callback; persisted backend replay was not tested.
- Tutor hooks: `[ACTIVITY_START]`, `[READ_ALOUD]`, `[ANSWER_CORRECT]`, `[ANSWER_INCORRECT]`, `[NEXT_ITEM]`, `[ALL_COMPLETE]`; generic tutor only.
- Design gate: manipulation — draw the actual letter path; simulation — ink follows pointer state (no simulated physical system); production — learner strokes, not recognition choices; timing — no countdown; visibility — the trace model is legitimate assistance and only assisted performance is reported.
- Answer visibility: no copy/independent modes; guide is always visible; corrections overlay the learner's retained path after submission.
- Curriculum: K **MATCH**, Letter Formation, cosine 0.8166 and coherence 4/5. Grade 1 runtime MATCH is semantically broader (names/labels); do not count it as verified task coverage. [Fit report](../curriculum-fit/letter-workshop-2026-09-07.md).

Validation: **165/165 focused tests**; three live eval draws / 12 valid challenges; live browser generated four further challenges and drove wrong/retry/correct/next/finish, one evidence submission, no page errors. Synthetic browser submissions were intercepted before the backend. See [eval report](letter-workshop-2026-09-07.md), [browser result](letter-workshop-browser-result.json), [feedback screenshot](letter-workshop-feedback.png).

Lumina-scoped typecheck passed at initial verification. Full project baseline was 770 unrelated errors. The final scoped check is blocked by seven concurrently introduced errors in `DiDeduction.tsx` / `diDeductionScript.ts`, with no errors in Letter Workshop files. No unrelated files were repaired.

## Follow-up queue

L1 implementation update (2026-09-07): trace/copy/write now run with mode resolution, constrained schemas, mixed selection, separate copy paper, and an auditory write cue. Copy/write feedback is provisional and local-only; calibration and actual device audio remain open. See [contracts](../../src/components/lumina/docs/contracts/letter-workshop.md) and [mode verification](letter-workshop-modes-2026-09-07.md). The original L0 observations above describe the birth state.

| Order | Executor | Concrete work |
|---|---|---|
| 0 | Human template/device review | Review all 52 manuscript forms and stroke conventions; trace with child-sized fingers/stylus, including dots and multi-stroke letters. Calibrate provisional thresholds against real attempts before claiming validated formation scoring. |
| 1 | `/add-eval-modes` + `/eval-test` | Three practice modes implemented and runtime-tested; copy/write feedback remains local-only. Finish actual audible-cue/device checks and review/calibrate the provisional formation assessor before enabling adaptive updates. Design priors are registered, not empirically calibrated. |
| 2 | `/add-tutoring-scaffold` | Implemented: mode-aware catalog scaffold, 15 context keys, three hint levels, six struggle responses, Help me, and guarded speech moments. Three-mode tutor probes and live connection pass. Full live coaching/device audio remains to verify. [Tutor report](../tutor-reports/letter-workshop-2026-09-07.md). |
| 3 | `/add-support-tiers` | Withdraw numbered starts/arrows separately; do not relabel a visible-guide trace as independent writing. |
| 4 | `/add-structural-difficulty` | After support tiers: stroke count, joins, curves, ascenders/descenders and case contrasts; retain curriculum letter-group scope. |
| 5 | `/add-sound` | Soft pen-lift/check/retry feedback; avoid continuous sound that masks tutor speech. |
| Every change | `/eval-test` | Re-run live scope draws, geometric negatives and gesture lifecycle; per-mode/tier checks after those layers exist. |

Try it: `/lumina` → Developer Tools → Language Arts → Writing → Letter Workshop → Generate Content. Example topics: `Trace lowercase l`, `Letter Formation Group 2`, or `Trace uppercase and lowercase g and j`.
