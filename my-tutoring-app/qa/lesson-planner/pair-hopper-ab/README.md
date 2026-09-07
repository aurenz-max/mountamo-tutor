# Primitive-mode hopper experiment

This standalone A/B tests the live production manifest plus its lesson mode resolver against a production-style manifest choosing exact primitive-mode task IDs. Production application code is unchanged.

## Fixed protocol

- Five supplied curriculum objectives, kindergarten, two repetitions per arm: ordinal naming, ordinals through tenth, representing 16–19, decomposing 16–19, and equations for 11–19.
- Reuse the prior comparison's frozen briefs and authoritative objectives. Both arms use the same live generators and package/coverage scorer.
- Capture production's actual manifest request without making an API call. The experimental request changes only the candidate catalog, the instruction about mode selection, and component identity fields in the response schema. Preserve the model, thinking settings, audience, lesson structure, support guidance and 2–4 components per objective.
- Index one source-derived card per primitive-mode pair, or one default card for primitives without declared modes. Embed primitive description plus mode description; supply shared constraints and mode affordances to the planner. A catalog declaration is not verified runtime behavior.
- Retrieve the top 20 specialist tasks and top 12 core/assessment tasks, plus the highest-ranked task from each closing-assessment family. Deduplicate task IDs. These fixed cutoffs are provisional; no topic-specific forced specialist IDs or post-result tuning.
- Selecting a task ID deterministically sets `componentId` and `config.targetEvalMode`. Reject unknown task IDs and duplicate activity instances. The experimental arm skips the separate lesson-level mode resolver. Downstream generation remains unchanged.
- Exact single modes only in the experimental arm; production can select blends/mixed modes. This tradeoff is part of the test, and can reduce within-activity breadth.
- Two concurrent lesson workers. Raw coverage evaluation and a separate common-objective evaluation retain both verdicts. The latter normalizes objective identity for judging only, without changing generated content.

This tests retrieval and joint selection together. It does not isolate their individual effects, validate all 645 catalog task variants, establish performance across open topics, or replace human lesson playback. Report cold embedding index work separately from request-path planning latency.

## Run

From `my-tutoring-app`, with the existing Gemini key in `.env.local`:

```powershell
node --test scripts/lib/lesson-planner-pairs.test.mjs
node scripts/lesson-planner-pair-ab.mjs --run --out qa/lesson-planner/pair-hopper-ab/first-controlled-run
node scripts/lesson-planner-common-objective-eval.mjs qa/lesson-planner/pair-hopper-ab/first-controlled-run
node scripts/lesson-planner-production-report.mjs qa/lesson-planner/pair-hopper-ab/first-controlled-run
node scripts/lesson-planner-pair-report.mjs qa/lesson-planner/pair-hopper-ab/first-controlled-run
```

Use a new output directory for a fresh experiment. Existing completed/error records are retained on resume. Full requests, model versions, source hashes, retrieval rankings, selected bindings, generated packages and coverage verdicts are saved. `BLIND-REVIEW.md` links replay packages without arm labels or machine ratings.
