---
name: lesson-coverage
description: One assembled Lumina lesson, end to end — produce a package, judge objective coverage (the shadow judge that runs on every build-stream lesson), score the form checks by code, rate it in the rail, route every signal to the owning executor, confirm by re-eval. Rows in qa/lesson-coverage/evals.jsonl; packages and queue in qa/lesson-bench/.
---

# Lesson Coverage — One Lesson: Judged, Scored, Rated, Routed

Every assembled lesson is judged in shadow, per objective: *taught → assessed → enough
independent evidence to infer mastery?* (`service/qa/lessonCoverage/`). This skill owns
everything that happens to ONE lesson around that judge — producing a package, the
code-judged form checks, the human rail — and turns any signal (a judge row, a scorer
citation, a rater's label) into a fix at the layer that PRODUCED the defect. A
curriculum SEQUENCE is `/lesson-journey`.

**Outcome:** one defect class closed end to end — a before/after table on the same
package AND on fresh generation, the fix committed at its mechanism boundary, a fixture
added if the class was new to the judge, queue + `WORKSTREAMS.md` updated. Or: a queue
entry with the evidence lessonIds and a named executor when the fix needs a ruling.
Never a gate, never a ban, never a curator rule.

**Arguments:** `/lesson-coverage <verb> [args]`
- `report` — aggregate `evals.jsonl`; name the top class and the instrument's health
- `produce "<topic>" <grade>` — one package through the real pipeline
- `judge <pkg|dir>` — the coverage judge on packages (`--write` stores `coverage`)
- `score [pkg …]` — code checks + the stored Q4; agreement table for a labeled package
- `diagnose <lessonId|pkg>` — one lesson to the item; classify the layer
- `route [labeled.json]` — signal → layer → executor → paste-ready queue entry
- `rerun <labeled.json>` — regenerate topic+grade, score, diff by slot, carry keeps
- `confirm <pkg>` — same package re-judged + fresh generation ×3
- `calibrate` — machine vs hand labels, Q4 included; the trust gate
- `sweep <topics …>` — produce + judge a slice to grow the dataset

## Three instruments, one vocabulary

| Instrument | Decides | Runs | Cost |
|---|---|---|---|
| **Coverage judge** (LLM, `gemini-flash-latest`) | **Q4** — per objective `NOT_TAUGHT` · `TAUGHT_NOT_ASSESSED` · `ASSESSED_INSUFFICIENTLY` · `ASSESSED_INDIRECTLY` · `ASSESSED_SUFFICIENTLY`, plus constraints | shadow after every `build-stream` lesson; `lesson-coverage.mjs eval` on packages | one call per lesson |
| **Code scorer** (no LLM) | G1 band · G4 mode exists · G6 modality · Q3 concrete-before-symbol · Q6 variety · Q7 evidence · Q8 text load · Q9 length | `lesson-bench.mjs score`; merges Q4 from the package's `coverage` | free |
| **Human rail** (`LessonBenchPanel`) | holistic 1–5, keep/fix/cut per block, plain-language reasons that carry check ids underneath | drop a package, play, rate, **Download labeled JSON** | a sitting |

All three speak `LESSON_BENCH_CHECKS` (`lessonPackage.ts`), so `machineVsHuman` compares
them per check. There is no fourth judge: the planned Tier B LLM judge (BACKLOG item 7)
was retired 2026-09-05 — the coverage judge IS Tier B, with categories instead of a 1–5
and every citation validated in code. G2 G3 G5 Q1 Q2 Q5 stay human-only until a labeled
set says otherwise.

## The loop

```text
produce → judge (shadow, or on demand) → score → rate (a sitting, when the slice needs one)
                 ↓ evals.jsonl · scores · human
            report   → the class with the most rows; calibrate → the disagreements
                 ↓
            diagnose → the LAYER the value originates in
                 ↓
            route    → the executor that owns that layer (ONE table, below)
                 ↓
            fix      → smallest change at the mechanism, pilot first
                 ↓
            confirm  → same package (judge unchanged?) + fresh ×3 (fix landed?)
                 ↓
            bank     → queue, WORKSTREAMS, fixture, memory (rulings only)
```

The row is the instrument reading. The class is the finding. The executor is the fix.
Do not skip from row to fix.

## produce · judge · score — the mechanics

```bash
cd "<abs>/my-tutoring-app"
# produce — dev server on :3000. Fixed objectives skip the brief and a package NEEDS the brief: never pass `objectives`.
curl -s -m 120 -o /dev/null -w "%{http_code}" http://localhost:3000/api/lumina/topic-trace   # cold server >5s
curl -s "localhost:3000/api/lumina/topic-trace?topic=<t>&gradeLevel=<g>&package=true" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).package;require('fs').writeFileSync('qa/lesson-bench/packages/'+p.id+'.json',JSON.stringify(p,null,2))})"
# judge — stores `coverage` on the package and appends a row to evals.jsonl (--no-persist skips the row; --source tags it)
node scripts/lesson-coverage.mjs eval qa/lesson-bench/packages/<id>.json --write
# score — G1 G4 G6 Q3 Q6 Q7 Q8 Q9 by code + Q4 from `coverage`; a scoreboard row per check; the agreement table if labeled
node scripts/lesson-bench.mjs score qa/lesson-bench/packages/<id>.json      # --no-write = look only
```

Grade strings are the pipeline's lowercase set (`kindergarten`, `elementary`, …). To
rate: Dev → **Lesson Bench** → drop the package → play → rate → **Download labeled JSON**
→ `packages/<id>.labeled.json`; then `judge --write` and `score` that file.

Three rules the scorer keeps, and you must not relax:
1. **Absent = unknown, never a fail.** An untagged axis, or a package with no `coverage`,
   lands in `scores.unknowns`. Fill the tag (`/add-affordances`) or run the judge; never
   guess in the scorer.
2. **Score what the child plays.** Caregiver blocks are partitioned exactly as
   `exhibitAssembly.ts` places them (parent card after the final assessment), so Q8 and
   Q9 see the child's stream only.
3. **Every deduction cites `{instanceId, checkId}`.** Q4 cites the objective's first
   non-final block; lesson-level deductions cite `lesson`.

## report — read the data (mechanical)

```bash
node scripts/lesson-coverage.mjs report            # status mix, categories, constraints, by subject/grade/subskill/primitive
node scripts/lesson-coverage.mjs show <lessonId>   # one verdict, evidence ids, notes, constraints
```

What a field is evidence OF:

| Field | It tells you |
|---|---|
| `objectives[].category` | the loop state: `NOT_TAUGHT` · `TAUGHT_NOT_ASSESSED` · `ASSESSED_INSUFFICIENTLY` · `ASSESSED_INDIRECTLY` · `ASSESSED_SUFFICIENTLY` |
| `assessmentCount` / `assessmentEvidence` | VALIDATED items (`<instanceId>#<path>[i]`) — open the package at that pointer, do not trust the note alone |
| `notes` | which element of a named set is missing, which items were off-target — the seed of the class |
| `detectedConstraints[]` | `content_guard` · `generation_failure` · `primitive_limitation` · `off_target_assessment` · `insufficient_items`; `instanceId` names the block |
| `discardedEvidence` | ids the judge invented — an INSTRUMENT signal, not a lesson signal |
| `meta.schemaError`, `status: error`, `NOT_EVALUATED` | the instrument failed; fix it before reading anything else |
| `meta.source` | `build-stream` (real students' lessons) · `script` · `calibrate` · `live-test` (fixtures — exclude from prevalence) |

**Prevalence, not one row.** Group by `(subskillId or topic, primitiveTypes, constraint type)`.
A class is worth a slice when it repeats across lessons or sits on a curriculum-launched
subskill. `live-test` and `calibrate` rows are calibration, never prevalence.

## Trust before you act

1. **Instrument health first.** `error` rows, `schemaFallback`, `discardedEvidence` on
   most rows, or `NOT_EVALUATED` → the judge is the defect. Fix `digest.ts` / the prompt,
   add a fixture in `fixtures.ts`, re-run `LIVE_GEMINI=1 npx vitest run lessonCoverage.live`.
   Banked: `maxItems` in a `responseSchema` is a 400 on flash-latest; `maxOutputTokens`
   is shared with thinking (4096 truncated the JSON); the judge cites an item's own id,
   so the digest carries `evidenceAliases`.
2. **Calibration gate.** Until `calibrate` shows ≥80% agreement with the hand labels on
   Q4 across ~20 packages, a row justifies a PROBE, never a gate, a ban, or an automatic
   repair. The judge arguing with itself is a documented failure
   (`qa/topic-traces/order-audit-2026-08-08.md`).
3. **Do not tune the rules to the row.** `MIN_SUFFICIENT_ASSESSMENT_ITEMS`, the severity
   floors, the uncited-credit rule and `LENGTH_CAP_MINUTES` are the contract. Changing
   them to make rows pass is the same move as raising a learning rate to rescue a package.

## diagnose — classify by where the value ORIGINATES

Open the package (`qa/lesson-bench/packages/<id>.json` or a fresh `topic-trace?package=true`)
at every cited pointer. Then place the defect by the layer that PRODUCED the wrong value,
not the file you would touch (`feedback_value-origin-not-code-touch`). One table serves
every instrument: a judge row lands in the first column, a rail label in the second.

| Layer | Judge signal | Rail reason (`BLOCK_REASONS` / `LESSON_REASONS`) | Executor | Never |
|---|---|---|---|---|
| **CONTENT** — the generator's output for this topic | `NOT_TAUGHT` with blocks present but about something else · `TAUGHT_NOT_ASSESSED` with an assess block whose items miss the target · `ASSESSED_INSUFFICIENTLY` (named set sampled, `count` ignored) · `generation_failure` (block in MISSING BLOCKS) | `not-this-skill` · `answer-shown` · `too-few-problems` (single-mode pin) · `weak` | `/topic-fidelity <gen>` · `/eval-fix <gen>` ("N challenges = N problems"), then a live probe | a curator or manifest rule (user ruling ×N) · widening the objective text · padding with repeats · leaving a silent fallback |
| **SUPPLY** — no catalog primitive or mode assesses that verb at that grade | `TAUGHT_NOT_ASSESSED` with no `apply`/`assess`-role block · `primitive_limitation` | — (the rater sees a gap, not a block) | `/curriculum-fit`, then `/add-eval-modes` on the nearest primitive or `/primitive`; a K–2 production verb needs a SPOKEN mode → `/add-di-loop` | a manifest rule forcing a block · a ban |
| **MODE** — the pinned eval mode | `ASSESSED_INDIRECTLY` · `off_target_assessment` | `too-few-problems` (multi-mode pin) · `flat` · `no-evidence` | fix the catalog `evalModes[].description` (the resolver reads it) · `resolveLessonEvalModes.ts` (direct edit) · `/add-eval-modes` for the direct mode | grading the primitive down · a grade floor |
| **CONTRACT** — a guard withheld content on purpose | `content_guard` (`unaskableLetters`, any `*Reported` residual) | — | read `docs/contracts/<primitive>.md` (`/primitive-contract`); then `/add-eval-modes` for the withheld content, or re-scope the objective's evidence in the curriculum DRAFT, or a USER RULING | delete the guard · swap in out-of-set content |
| **SELECTION** — the curator's choice: catalog line, affordance tag, brief | `NOT_TAUGHT` with NO block for the objective (the brief dropped it) | `does-not-belong` · `wrong-grade` · `symbols-first` · `needs-earlier` · `repeats-block` · `wrong-opener` · `wrong-order` · `missing` · `too-long` | `/add-affordances <id>` (a demand is a FACT: reader, modality, audience, representation, minutes, maxPerLesson) · `/topic-trace` (brief order / coverage) | a grade floor, `minGrade`, catalog filtering (`feedback_make-age-friendly-not-band-floor`) |
| **COMPONENT** — the primitive's surface for this child | — | `too-much-reading` (child stream) · `should-be-spoken` · `broken` with no tutor note | `/reader-fit <id>` · `/add-di-loop <id>` · `/eval-test <id>` → `/eval-fix` | WRONG-BAND as the first move |
| **TUTOR** — the judged loop / commit path | — | `broken`, or ANY note naming the tutor, the mic, "said it, then had to tap" (`TUTOR_NOTE`) | `qa/di/BACKLOG.md` + `/add-di-loop <id>` contract check | a prompt fix before finding who else sent the tutor a turn |
| **ASSEMBLY** — where a block sits in the played lesson | — | `too-much-reading` on a parent card | `exhibitAssembly.ts` (direct edit) → `rerun` | |
| **INSTRUMENT** — the judge or the scorer | `discardedEvidence` on most objectives · `schemaError` · `status: error` · `NOT_EVALUATED` | machine ≠ human on a check AFTER reading the block | `service/qa/lessonCoverage/` + a fixture · `lessonBenchScorer.ts` + a test (say which side of the agreement table moved, and why) | reading the verdict as fact · tuning a threshold |

Two doctrine lines that decide most rows:
- **The manifest passes the objective; the generator does the work.** A missing element
  of a named set is the generator's, not the curator's.
- **Affordances are facts, not floors.** A tag or a guard never becomes a filter; the fix
  is a mode, a contract fork, or a ruling.

## route — the class becomes a queue entry

Rail labels route mechanically — `triageLabel()` applies the table above and the
runner writes paste-ready entries under `qa/lesson-bench/triage/`:

```bash
node scripts/lesson-bench.mjs triage qa/lesson-bench/packages/<id>.labeled.json
```

A label the router marks UNROUTED is a question for the rater, not a guess. Judge rows
you route by hand, one entry per CLASS in the owning register, executor named, evidence attached:

```text
### N. **<CLASS in one sentence> (YYYY-MM-DD).** Rows: <lessonId …> (source build-stream ×k).
Layer: <content | supply | mode | contract | selection | component | tutor | assembly | instrument>. Signal: <category + constraint + notes gist>.
Executor: `/<skill> <target>`. Gate: `/lesson-coverage confirm <pkg>` before/after + fresh ×3.
```

Registers: generator/primitive defects → `qa/EVAL_TRACKER.md` (issue id) or `qa/lesson-bench/BACKLOG.md`;
DI/spoken modality → `qa/di/BACKLOG.md`; reading demand → `qa/reader-fit/BACKLOG.md`;
a ruling only the user can make → `qa/HUMAN-CHECKS.md` (re-grep ids immediately before filing).
If the executor is in scope and needs no ruling, run it in the same push (build over ceremony).
Then update the `WORKSTREAMS.md` row.

## fix — the class, not the row

- **Contract-first.** Read `docs/contracts/<primitive>.md` before editing a generator or
  component; fork on conflict, never edit in place over one.
- **Pilot then sweep.** One generator, one runtime probe, then `confirm`; only then roll the
  pattern. Never a workflow before the pilot has been exercised.
- **Close the channel.** When the count comes right, ask what produced the miss (a hardcoded
  group, a cap below intent, an index fallback) and remove that.
- **Verification doctrine applies.** `tsc` is necessary, not sufficient. The affected flow
  runs — at minimum `confirm`, and a `build-stream` drive when the fix touches assembly.

## rerun · confirm — two questions, two runs

```bash
cd "<abs>/my-tutoring-app"
# 1. Same package: content frozen, so the JUDGE is the only variable. Expect the SAME verdict.
node scripts/lesson-coverage.mjs eval qa/lesson-bench/packages/<id>.json --no-persist
# 2. Fresh generation: did the FIX land? Three runs, because generators vary.
node scripts/lesson-bench.mjs rerun qa/lesson-bench/packages/<id>.labeled.json      # regenerate, score, diff by slot, carry keeps
node scripts/lesson-coverage.mjs eval qa/lesson-bench/packages/<new-id>.json --write \
  && node scripts/lesson-bench.mjs score qa/lesson-bench/packages/<new-id>.json
```

`rerun` aligns blocks by slot (objective index : position). A slot with the same primitive
+ mode and a **keep** carries the keep only if payload, objective, intent, title, grade and
configuration also match; everything else lands on the re-rate list in `<newId>.rerun.md`
beside a before/after table of machine scores. Same-topic runs differ as much as two arms
of an A/B — one rerun is a sample, not a verdict.

Report a before/after table per objective: category · assessmentCount · constraints ·
named-set coverage. `TAUGHT_NOT_ASSESSED` → `ASSESSED_INSUFFICIENTLY` is progress, not
closure; say which. The student-facing check is a `build-stream` drive (headless recipe:
`project_headless-chrome-drive-recipe`), which also appends a `source=build-stream` row —
the only source that counts for prevalence.

## calibrate — the trust gate

```bash
node scripts/lesson-coverage.mjs eval qa/lesson-bench/packages/<id>.labeled.json --write --source calibrate
node scripts/lesson-bench.mjs score qa/lesson-bench/packages/<id>.labeled.json
```

The agreement table now carries **Q4 as a scored row**: machine = the judge's verdict,
human = the rater's `missing` (lesson) or block reasons mapped to Q4. Read it as three
lists: agreements; disagreements (one side is wrong — decide which by opening the block,
then fix the instrument OR queue the block); unrouted labels (a note with no reason —
back to the rater). Under 80% on Q4: the judge is the slice — add the disagreeing lesson
as a fixture, change the digest or prompt, re-run the live suite, re-calibrate. Over 80%
on ~20 packages: Phase 2 (soft repair, one attempt, smallest patch, re-eval) may be
designed — as a queue item with the user, not started.

First row (2026-09-05, `…pgr5`): judge PASS 1.00 on all three objectives, rater holistic 5
with no `missing` → Q4 agrees; 8/9 overall (the one miss is the parent-card Q8, item 12).

## sweep — grow the dataset where the frontier is

Rows accumulate from real lessons; do not wait. `produce` + `judge` packages for the slice
you are about to touch (per topic, or a `/lesson-journey` campaign for a sequence). Pick
topics by demand — the LA K–2 demand map, the curriculum sequence in play — never a
random census (QA is a gate).

## bank

- Queue + `WORKSTREAMS.md` "As of" in the same slice as the fix.
- A NEW class → a fixture in `fixtures.ts` with its expected category, so the judge is
  regression-locked on it (`lessonCoverage.test.ts` mocked, `.live.test.ts` real).
- Memory only for rulings and non-derivable facts (the guard ruling, a model quirk).
  Evidence lives in `qa/lesson-coverage/` and `qa/lesson-bench/`, not in memory.

## Phase gates (do not advance on your own)

| Phase | Precondition | What changes |
|---|---|---|
| 1 Shadow (now) | — | persist, report, fix classes by hand |
| 2 Soft repair | calibrate ≥80% on ~20 packages; repair-success measured with `confirm` on ≥5 classes | defect spec → smallest patch → reassemble → re-eval, ONE attempt |
| 3 Hard gate | Phase 2 false-positive rate known and accepted by the user | objective coverage blocks publish; style never does |

## Anti-patterns

Adding a curator/manifest rule · deleting a guard · a grade floor or catalog ban · treating
one row as a class · fixing the symptom count · grading lesson quality · tuning thresholds
or caps to pass · a second LLM judge beside the coverage judge · trusting `live-test` rows
as prevalence · declaring "fixed" on `tsc` or on the same-package re-eval alone.

## Gates before you call anything done

```bash
node node_modules/vitest/vitest.mjs run src/components/lumina/service/qa/lessonBench src/components/lumina/service/qa/lessonCoverage/lessonCoverage.test.ts src/components/lumina/service/exhibitAssembly.test.ts
node node_modules/typescript/bin/tsc --noEmit | grep -c "error TS"      # baseline in qa/lesson-bench/BACKLOG.md
node scripts/lesson-bench.mjs score --no-write                          # the runtime probe of the scorer
LIVE_GEMINI=1 node node_modules/vitest/vitest.mjs run src/components/lumina/service/qa/lessonCoverage/lessonCoverage.live.test.ts   # when the digest / prompt / evaluator changed
```

A scorer or judge change that flips a check on a labeled package must say which side of
the agreement table it moved and why. A placement or render change (parent card, K stage)
needs a browser sitting — file it in `qa/HUMAN-CHECKS.md`, never call it verified.

Implementation + row shape: `my-tutoring-app/qa/lesson-coverage/README.md`. Rubric, package
shape and the human rail: `service/qa/lessonBench/lessonPackage.ts`. Scorer + label router:
`service/qa/lessonBench/lessonBenchScorer.ts`. Judge: `service/qa/lessonCoverage/`.
Queue: `qa/lesson-bench/BACKLOG.md` (item 19 = the judge).
