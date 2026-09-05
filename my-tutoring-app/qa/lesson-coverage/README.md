# Lesson objective-coverage eval (shadow)

How to act on the rows: `/lesson-coverage` (`.claude/skills/lesson-coverage/SKILL.md`) — produce → judge → score → rate → diagnose →
route → rerun/confirm → calibrate. That skill also owns the Lesson Bench package, the code scorer and the human rail (`qa/lesson-bench/`);
`scripts/lesson-bench.mjs score` merges this judge's stored verdict (`coverage`) as rubric check Q4. A curriculum SEQUENCE is `/lesson-journey`.

**Question it answers, per objective:** was it taught, was it assessed, and is the assessment enough to infer mastery?
**Why:** a lesson can look valid while the student is never asked to demonstrate an objective it claims to teach
(phonics: the continuant guard kept t/p out of every production item; `unaskableLetters` said so, nothing read it).

## Where it runs

- **Runtime, shadow.** `/api/lumina/build-stream` judges every assembled lesson AFTER the stream closes
  (`service/qa/lessonCoverage/shadow.ts`). Never blocks, never regenerates, never touches the exhibit.
  `/api/lumina` action `buildCompleteExhibitFromManifest` does the same fire-and-forget.
- **On demand.** `/api/lumina` action `evaluateLessonCoverage` (`params.exhibit` or `params.package`) returns the verdict;
  `node scripts/lesson-coverage.mjs eval <package.json|dir>` judges Lesson Bench packages (`--write` stores it as `coverage`).
- **Kill switch.** `LUMINA_COVERAGE_EVAL=0|1` (default ON outside production). Rows go to `LUMINA_COVERAGE_EVAL_DIR`
  (default this directory).

## What it reads

`ExhibitData` → `digest.ts`: declared objectives (curator brief joined to `manifest.objectiveBlocks`), every block the child
plays with the catalog's affordance facts (`role`, `answers`, the pinned eval mode's description), every item with a citable
id (`<instanceId>#<path>[i]`), generator-reported residuals (`unaskableLetters`, …) and blocks the manifest planned but
generation dropped. Judge: `gemini-flash-latest` (never flash-lite), structured output, one loose-JSON retry, 45 s cap.

## What it enforces in code (whatever the model says)

- Evidence ids must exist in the digest; unknown ids are discarded (`discardedEvidence`), the count is the validated count.
- An "assessed" claim with no surviving citation is downgraded to `ASSESSED_INSUFFICIENTLY` — an uncited credit is not a credit.
- `ASSESSED_SUFFICIENTLY` needs ≥ 2 distinct items (`MIN_SUFFICIENT_ASSESSMENT_ITEMS`).
- `NOT_TAUGHT` / `TAUGHT_NOT_ASSESSED` are always `CRITICAL` → `blockingFailure` → `status: fail`.
- A model/transport failure yields `status: error` (every objective `NOT_EVALUATED`) and is persisted too.

## Files

- `evals.jsonl` — one `LessonCoverageEval` per row (lessonId, status, coverage, per-objective verdicts + evidence, constraints,
  meta: subject/grade/subskillIds/primitiveTypes/model/latency/source). `scripts/lesson-coverage.mjs report` aggregates it;
  `show <lessonId>` prints one.
- Tests: `lessonCoverage.test.ts` (model mocked: digest, rules, five cases, failure paths, kill switch, persistence) and
  `lessonCoverage.live.test.ts` (`LIVE_GEMINI=1`: the judge itself on the five fixtures + the real phonics-1 package).
- Replication harness: `scripts/lesson-coverage-replicate.mjs generate` (fresh phonics 1-3 via topic-trace) then `truth` (per-letter
  production/recognition counts read from the data, compared with the stored `coverage` verdict). `replicate-<date>/` = the evidence.
- Lesson Bench bridge: `toLessonBench.ts` expresses the verdict as check **Q4 Coverage** (citations per objective block).

## Not yet (by design — Phase 1 learns)

No repair, no gate, no student-facing change. Phase 2 (defect spec → smallest patch → re-eval, 1 attempt) and Phase 3
(publishing gate on objective coverage only) wait on shadow data that agrees with hand labels.
