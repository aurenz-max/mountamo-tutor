# Curriculum-Fit: di-word-problem-setup — 2026-09-10

**Domain → Subject (live):** di → **LANGUAGE_ARTS**. There is no `_PRIMITIVE_TO_SUBJECT`
override for this pack (`backend/app/services/curriculum_retrieval_service.py:74-78` lists only
`di-dice-roll`, `di-math-facts`, `di-shapes`), so the `di` family default wins. Every math
verdict below was obtained with the `--domain math` workaround and is labeled as such.
**Query (embedded):** verbatim catalog `description` (`catalog/di.ts:1360-1369`).
**Artifact:** `di-word-problem-setup-2026-09-10.json` (every probe's full top-k, every regime,
the three generated draws).
**Scope:** MATHEMATICS G1–G4 (the catalog claims G1–G4); K probed once as a side check.
Retrieval never widened grade: every probe's `scoped_to` equalled the requested grade.
**Not done:** no source, catalog or curriculum edit; no commit. The shared coverage atlas has
no G1–G3 Mathematics scope (`scripts/lib/curriculum-coverage-scopes.mjs` declares `la-k` and
`math-k` only), so no atlas edge was written — a G1/G2 scope needs its own reviewed edges.

## Verdict per mode

Regimes: **omnibus** = CLI probe, verbatim description (the FALLBACK query);
**P** = catalog eval-mode description only, no lesson context (the FOCUSED query);
**S** = P plus one real drawn story as challenge text. Which regime production actually runs
for this pack is settled in the next section (it is **omnibus**).

| Mode | Grade | Verdict (MATH-scoped) | Best | Coherence | Top-1 subskill |
|---|---|---|---|---|---|
| `find_big_number` | 1 | **MATCH** | 0.818 omnibus · 0.768 P · 0.803 S | 5/5 all regimes | `OPS001-07-b` *Solve for the larger value given one value and the comparison amount* (omnibus, S); `OPS001-06-b` *Find an unknown addend when the total and one group are provided* (P) |
| `find_big_number` | 2 | **ABSTAIN** (diffuse) | 0.747 P · 0.761 S | 1/5 | `MEAS002-03-b` number line (P); `NBT002-06-c` jumps of 10/100 (S) — nothing word-problem shaped on top |
| `build_family` | 2 | **WRONG-FIT** for attribution; honest home exists | 0.738 P (abstain) · 0.757 S (match 5/5) | — | S top-1/2 are `OPS002-03-c`/`-b` **two-step** problems, which `constraints` excludes; the honest homes `OPS002-01-c` / `OPS002-02-c` (one-step within 100) rank 3–4 |
| `build_family` | 3 | **WRONG-FIT** (false positive) | 0.755 P (match 4/5) · 0.742 S (abstain) | — | P lands on `OPS003-04-a` *Construct all four related facts in a fact family* — **multiplication/division** fact families, pulled in by the words "family" and "unknown" |
| `classify_and_build` | 3 | **ABSTAIN → curriculum gap** | 0.748 P (abstain) · 0.751 S (match 3/5 on the same mult/div fact family) | — | No published G3 subskill is a one-step addition/subtraction word problem; the nearest are three-digit solve problems (`NBT003-03-e`, `-04-e`, within 1000) and two-step mult/div (`OPS003-07-*`) |
| `classify_and_build` | 4 | **WRONG-FIT** (partial at best) | 0.778 omnibus · 0.771 P (match 3/5) · 0.749 S (abstain) | — | `OPS004-01-d` *Distinguish 'times as many' … and 'more than' situations* — a classify surface, but half of it is multiplicative stories this pack cannot produce |

G2 omnibus (the regime production runs, once the subject is fixed) also returns MATCH 0.777 3/5
on `OPS002-03-c` two-step compare — a false positive against the pack's own "no two-step"
constraint.

**Kindergarten (out of stated scope, one look):** omnibus MATCH 0.765 5/5 on `OPS001-01-E`
*Solve addition word problems within 10*, `OPS001-02-C` *… within 5*. The pool's gates (every
quantity ≥ 2, sums up to 20, first story has the big number unknown) overshoot K's within-5/
within-10 windows, so this is a partial, not a home; the P regime lands on counting subskills.

## The live attribution defect

A real student's attempt is attributed through `SubmissionService` →
`subject_for_primitive('di-word-problem-setup', 'di')` → **LANGUAGE_ARTS**. Reproduced with the
probe in the live regime (`--domain di`, verbatim description):

| Grade | Live verdict | Best | Coherence | Top-1 |
|---|---|---|---|---|
| 1 | ABSTAIN (diffuse) | 0.709 | 1/5 | `LA007-04-a` Following Directions |
| 2 | ABSTAIN (diffuse) | 0.715 | 1/5 | `LA001-02-b` Digraphs and Blends |
| 3 | **MATCH** | 0.708 | 3/5 | `LA001-02-b` *Character Analysis — link characters on a web while noting what motivates their actions* |

So a G3 word-problem session today writes mastery to a Grade 3 Language Arts character-analysis
subskill. G1/G2 abstain, which is silent loss rather than misattribution. The per-mode LA
replays (regime P and S, all six mode/grade pairs) abstain except `classify_and_build` P at G3,
which matches `LA001-03-b` Story Structure at 0.689 — the same class of error.

This is the di-shapes finding of 2026-08-07 recurring: the override table was fixed for three
packs and the fourth math pack was born without an entry. **Fix (not applied here):** add
`"di-word-problem-setup": "MATHEMATICS"` to `_PRIMITIVE_TO_SUBJECT` and a case to
`backend/tests/test_curriculum_retrieval_subject_scope.py` (which today pins only `di-dice-roll`
and `di-letter-sounds`).

**Which query regime production runs for this pack.** `evaluationApi.ts:194-197` derives
`evalModeDescription` from `result.metrics.evalMode`, and `:241` sends `eval_mode` from the same
field. This pack's metrics carry `challengeType`, not `evalMode`
(`DiWordProblemSetup.tsx:221-238`; `usePrimitiveEvaluation.ts:277` reads `challengeType` only to
build the remediation identity and does not inject it into the metrics). So the backend receives
no `evalModeDescription` and `eval_mode: 'default'`, and `_build_retrieval_query` takes the
omnibus branch. The live verdicts above are therefore the omnibus rows. The backend does not
recover: `submission_service.py:396` reads `primitive_response.eval_mode` (the literal
`'default'`) and never looks at `challengeType`, so the β priors registered for the three modes
in `problem_type_registry.py:719-722` are not reached either. This is code-traced, not
exercised by a real submission. It is local, not family-wide: `DiShapes.tsx:405` and
`DiMathFacts.tsx:389` set `evalMode: data.challengeType` in their metrics; this pack,
`DiWorkedProcedure.tsx` and `DiDeduction.tsx` (the three "DI for Older Learners" packs) omit it.

## Does any matched subskill have SETUP as its solve surface?

Verbatim published text, with what the subskill actually scores.

| Grade · id | Verbatim requirement (trimmed to the surface) | Surface |
|---|---|---|
| 1 · `OPS001-05-b` | *Identify the missing change in add-to problems where the starting and final amounts are given … Use number bonds to represent the total, start, and unknown parts.* | Unknown POSITION is named (change unknown). Scored act: find the unknown. The number bond is a whole/part model, so "which is the whole" is implied by the constraint, never asked. |
| 1 · `OPS001-05-d` | *Determine the amount taken away in take-from problems where the initial and final quantities are known … visualize the relationship between total, part removed, and part remaining.* | Same: position named, solve surface. |
| 1 · `OPS001-06-b` | *Find an unknown addend when the total and one group are provided. Focus: Partitioning a known total.* | Addend unknown; solve surface. |
| 1 · `OPS001-07-b` / `-c` | *Solve for the larger value given one value and the comparison amount* / *Solve for the smaller value given the larger value and the comparative difference.* | Comparison with bigger/smaller unknown; solve surface. |
| 1 · `OPS001-10-a` / `-b` | *Solve for an unknown subtrahend or minuend by treating the equation as an addition problem* / *Write related addition facts for given subtraction equations. Focus: fact families.* | The family idea — but on bare equations, no story. Adjacent to the `family` step, not a word-problem home. |
| 2 · `OPS002-01-c` | *Solve one-step addition word problems within 100 **by selecting the correct operation** and calculating the total. Focus: **Translating real-world scenarios into addition equations**.* | **Setup surface.** The only G1–G4 subskill whose stated act is operation choice + equation from a story. Honest home for `build_family` at G2. |
| 2 · `OPS002-02-c` | *Solve one-step subtraction word problems within 100 representing take-away or comparison situations … **clearly distinguish between take-away and compare prompts**.* | **Setup surface** (story-kind discrimination = the `classify` step, two of the three kinds). Honest home for `classify_and_build` at G2 — a grade below the mode's stated G3–4. |
| 2 · `OPS002-03-b` | *Model and solve two-step word problems … Focus: **Determining when to add and when to subtract** based on the context of the story.* | Setup surface, but two-step — outside `constraints`. This is why G2 retrieval keeps landing on two-step: the two-step subskills carry the setup vocabulary. |
| 3 · `OPS003-07-c` | *Translate two-step word problems into algebraic equations using variables for unknowns.* | Setup surface, but two-step and multiplication/division. |
| 3 · `NBT003-03-e` / `-04-e` | *Solve real-world word problems requiring the addition/subtraction of … three-digit numbers … Single-step.* | Solve surface only; within 1000, the pack caps at 100. |
| 4 · `OPS004-01-d` | *Distinguish between 'times as many' situations requiring multiplication and 'more than' situations requiring addition.* | A classify surface the pack cannot serve — it has no multiplicative stories. |
| 4 · `OPS004-02-f` · `NBT004-05-e` | *Represent multi-step word problems with equations containing letters* / *Solve addition and subtraction word problems by translating text to mathematical operations … Include multi-step.* | Setup surface, multi-step. |

**Answer to the question asked:** at G1 every matched subskill names the unknown's position
(the CCSS 1.OA.1 table) but scores solving it; the pack's `big_number` and `family` steps are a
sharper act than any G1 subskill requires, so G1 is an honest home where the primitive
over-serves. The only subskills whose stated surface *is* setup — operation choice, story-kind
discrimination, equation with an unknown — are `OPS002-01-c` and `OPS002-02-c` at G2, and
retrieval never returns them top-1. G3 has no one-step addition/subtraction word-problem
subskill of any kind, so the expected "G3 OA.8 setup" home does not exist in the published
curriculum. G4 has no home.

## Generated tasks (the S-regime challenge text)

Three draws through the running frontend (`/api/lumina/eval-test`, one per mode), specs rendered
through the real `planWordProblem` (vite module runner, no copy of the templates). All 9 stories
passed the code gates: distinct printed numbers, answer ≥ 2, answer word absent from the story.

| Mode · grade | Story (printed) | Big number | Family | Op | Answer |
|---|---|---|---|---|---|
| `find_big_number` · 1 | Sam had 2 marbles. Then Sam bought 8 more. How many marbles does Sam have now? | what Sam has now (unknown) | two plus eight equals box | add | 10 |
| | Max has 16 apples. Lily has 6 apples. How many more apples does Max have than Lily? | Max's apples (16) | six plus box equals sixteen | subtract | 10 |
| | There are 20 shells. 5 of them are red. The rest are blue. How many shells are blue? | all the shells (20) | five plus box equals twenty | subtract | 15 |
| `build_family` · 2 ("within 100") | There are 72 striped stickers and 27 spotted stickers. How many stickers are there in all? | all the stickers (unknown) | seventy-two plus twenty-seven equals box | add | 99 |
| | Max had 9 apples. Then Max bought some more. Now Max has 21 apples. How many apples did Max buy? | what Max has now (21) | nine plus box equals twenty-one | subtract | 12 |
| | Sam has 36 marbles. Zoe has 53 more marbles than Sam. How many marbles does Zoe have? | Zoe's marbles (unknown) | thirty-six plus fifty-three equals box | add | 89 |
| `classify_and_build` · 3 ("two-digit") | Ben had 72 shells. Then Ben dropped some of them. Now Ben has 65 shells. How many shells did Ben drop? | what Ben started with (72) | sixty-five plus box equals seventy-two | subtract | 7 |
| | Leo has 14 stickers. Mia has 4 fewer stickers than Leo. How many stickers does Mia have? | Leo's stickers (14) | four plus box equals fourteen | subtract | 10 |
| | There are 75 striped apples and 25 spotted apples. How many apples are there in all? | all the apples (unknown) | seventy-five plus twenty-five equals box | add | 100 |

The second story in each draw sets the trap the pack exists for: "more" cues add, but the family
says subtract. This is content evidence for the catalog claim, not a live-interaction verdict.
Live interaction so far: `qa/tutor-reports/di-word-problem-setup-live-di-plain-2026-09-10.md`
drove one headless `build_family` session at G2 (PASS, 12 items, text answers, no microphone).

## Why the mode regime misses (for when the metrics fix lands)

The three eval-mode descriptions never say "addition", "subtraction", "word problem" or
"one-step"; they say "big number", "family", "box", "story kind". Under regime P that embeds
toward number-line and place-value at G2 and toward multiplication fact families at G3. A
reworded-description diagnostic (regime R, hypothetical text, not a source edit):

| Mode · grade | R verdict | Top-1 | Note |
|---|---|---|---|
| `find_big_number` · 2 | MATCH 0.806 4/5 | `OPS002-02-c` one-step subtraction word problems within 100 | The honest G2 home surfaces; `OPS002-01-c` rank 3 |
| `build_family` · 2 | MATCH 0.800 4/5 | `OPS002-03-c` two-step compare | Still two-step on top; the one-step homes rank 3–4 |
| `build_family` · 3 | ABSTAIN diffuse | three-digit solve problems | Correct: no G3 home |
| `classify_and_build` · 3 | ABSTAIN diffuse | three-digit solve problems | Correct: no G3 home |

Wording lifts `find_big_number` to its G2 home. `build_family` stays ambiguous against G2
two-step because the published two-step subskills carry the setup words ("unknown quantity",
"when to add and when to subtract") and the one-step ones do not. That is a curriculum-side
ambiguity a description edit cannot resolve; in a real lesson the objective text (itself a
subskill) dominates the query, so the exposure is remediation/free-form sessions, not planned
lessons.

## Recommendations (queue candidates, executor named; none applied here)

1. **Subject override + regression case** — `_PRIMITIVE_TO_SUBJECT["di-word-problem-setup"] =
   "MATHEMATICS"` and a case in `tests/test_curriculum_retrieval_subject_scope.py`. Backend edit
   in the pack's ship slice (`qa/di/BACKLOG.md`, item 37 residual (e) is where this pack lives).
   Until it lands, a G3 session attributes to `LA001-02-b`. Consider making the probe and the
   birth checklist refuse a `di-*` math pack with no override, since this is the second time.
2. **`metrics.evalMode` on the three newer packs** — add `evalMode: data.challengeType` to the
   metrics object in `DiWordProblemSetup.tsx`, `DiWorkedProcedure.tsx` and `DiDeduction.tsx`,
   matching `DiShapes.tsx:405`; then confirm with one real submission that `eval_mode` arrives
   as the mode (β prior reached, `evalModeDescription` present). Executor: `/eval-fix`. Without
   it every attempt on these packs is calibrated under the default prior and retrieved on the
   omnibus query.
3. **Eval-mode descriptions** — prefix each with "one-step addition or subtraction word
   problem". Executor: `/add-eval-modes` (owns catalog eval-mode text). Only effective after (2).
4. **G3 and G4 claims** — the catalog says "ESSENTIAL for G1-G4" and `classify_and_build` says
   G3–4, but the published G3/G4 curriculum has no one-step addition/subtraction word-problem
   subskill. Either author one at G3 (`/curriculum-author`; CCSS 3.OA.8 covers one-step-in-
   context with a letter for the unknown) or trim the claim to G1–G2 and re-band
   `classify_and_build` to G2 where `OPS002-02-c` already asks for story-kind discrimination.
   User ruling.
5. **Atlas** — a `math-1`/`math-2` coverage scope would let the shared atlas carry these edges
   (`OPS001-05/06/07` ↔ `find_big_number`, `OPS002-01-c`/`-02-c` ↔ `build_family`/
   `classify_and_build`). Not started; a scope needs its own review basis.

## Caveats

- A MATCH is a retrieval home, not assessability and not correct content.
- Per-mode replays passed no topic/objective; a planned lesson's objective text will pin its
  own subskill regardless of these results. The exposure is sessions without curriculum IDs.
- Microphone and live gesture interaction were not driven in this review.
