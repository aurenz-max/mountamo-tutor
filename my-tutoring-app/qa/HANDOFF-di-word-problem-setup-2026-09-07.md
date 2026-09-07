# Handoff — `di-word-problem-setup`: name the problem, build the family, then work it (judged aloud)

**For:** a fresh session birthing a judged-loop pack from the design brief
(artifact `8e67009d-865c-4528-a4c1-9d9a86136696`, concept 4).
**Opened:** 2026-09-07, routed from `qa/di/BACKLOG.md` item 37 residual (e). Independent of the
`di-deduction` handoff (different files, different class) — the two can run in parallel sessions.
**Why this one:** word-problem SETUP is where G1–4 word problems actually break — children compute
the two numbers they see with whatever operation feels right. Connecting Math Concepts' answer is
the NUMBER FAMILY: every addition/subtraction story has two small numbers and a big number, the
story gives two of the three, and the child must say WHICH is the big number BEFORE touching the
arithmetic. That decision is a MOVE, which is exactly what item 37's `procedure_step` machinery
judges; this pack mostly REUSES classes and adds one.

## Paste-ready prompt

> Build `di-word-problem-setup`, the "name the problem, build the family" pack from the "DI for
> Older Learners" brief, per `my-tutoring-app/qa/HANDOFF-di-word-problem-setup-2026-09-07.md`.
> Copy the skeleton of `di-worked-procedure` (shipped 2026-09-07, `qa/di/BACKLOG.md` item 37)
> file for file. Code owns the story frames, the numbers, the unknown, the family and the answer;
> the LLM supplies only the theme words. Reuse `procedure_step`, `closed_set_choice` and the
> number-word classes; register `equation_statement` as accepted-build-ahead and ship its bench
> fixture with the pack. Close with the seven gates item 37 ran: typecheck, pack tests, live
> generation probe, `--di`, `--di-wrong signature`, `--di-cap`, `--di-bench`. File the mic row and
> the queue item in the same slice.

## The pack, precisely

**What the child does.** The story is printed; the tutor reads it aloud once. Then, one step at a
time, out loud:

| step | ask | expected | class | signature error |
|---|---|---|---|---|
| `classify` (mode-gated) | "Is this a comparison problem, a change problem, or a part-whole problem?" | one of the three, the menu read aloud | `closed_set_choice` (benched via decodable-reader / compare_choice) | the type of the LAST sentence rather than the story |
| `big_number` | "Which is the big number?" | the WHOLE quantity by name ("Jen's stickers", "all the fish"), even when it is the unknown | `procedure_step` (a decision, not a number) | **"the biggest number I see"** — picks 20 in "Tom has 20. Jen has 8 more. How many does Jen have?" |
| `family` | "Say the family." | "twelve plus box equals twenty" / "twelve plus eight equals box" | **`equation_statement`** (NEW) | the big number in a small slot ("twenty plus twelve equals box") — the error the whole method exists to catch |
| `operation` | "Do you add or subtract?" | "add" when the box is the big number, else "subtract" | `closed_set_choice` | the operation from the story's verb ("gave away" → subtract) instead of from the family |
| `solve` | "Now work it. How many?" | the number word | `number_word_to_20` (benched) / `number_word_to_120` (build-ahead, gate on #63) | the two given numbers combined the wrong way |

The screen SCRIBES, item 37's rule: the bar model and the family arrow draw themselves as each
step is affirmed — the big-number slot fills first, then the small numbers and the box, then the
operation sign, then the answer in the box. Nothing is drawn before it is said. A move-on STATES
the step ("The big number is Jen's stickers.") so the page can carry it in dim amber.

**Eval modes** (β mirrors backend `problem_type_registry.py`):
`find_big_number` (big_number + solve; β 2.5, G1–2) · `build_family` (big_number + family +
operation + solve; β 3.5, G2–3) · `classify_and_build` (adds classify; β 4.5, G3–4). A session is
2–3 problems; `challengeCount` counts PROBLEMS and steps expand from it (item 37's shape).

**The three story shapes, all code-built** (CMC's taxonomy, one frame each per unknown):

- **comparison** — "A has n. B has m more/fewer than A. How many does B have?" / "…How many more
  does A have than B?" Big number = the larger quantity, which may be the unknown.
- **change (start → end)** — "A had n. A got m more / gave away m. How many now?" / "A had n. A
  gave away some. Now A has k. How many did A give away?" Big number = the larger of start/end.
- **part-whole (classification)** — "There are n red and m blue. How many in all?" / "There are
  k fish. n are red. How many are blue?" Big number = the whole.

**Generator (Fork A, the di-math-facts discipline — the LLM never emits a number).** Code picks
the shape, the numbers (a number pool: answers ≤ 20 unless the objective says within 100), and
which quantity is unknown; Gemini emits only a THEME for the objective's context — two names,
an object noun (singular + plural), a verb pair for change stories ("found / lost", "picked /
ate") — as one flat bounded array of theme records. Code fills the frames, builds the family and
the answer, and gates keep-or-drop: the answer word must not appear anywhere in the story; the
two given numbers must be distinct and neither may equal the answer; a change verb pair must be
a real gain/loss pair (refuse-list the ambiguous ones: "shared", "traded"); names must be one
sayable word; theme nouns must not name a number or a size ("dozen", "pair", "half"). Refuse a
theme rather than degrade it.

**The response class: `equation_statement`** (new, accepted-build-ahead on the item-37 precedent).
A spoken number sentence with a slot: 5–7 tokens from a CLOSED vocabulary — number words,
`plus / and / minus / take away`, `box / blank / something / what`, `equals / is / makes`. What
the judge scores: the RIGHT numbers in the RIGHT slots, not the tokens — "twelve and something
makes twenty" is the canonical family. Four things the pack must hold:

1. **The big number belongs at the end** (after `equals`). "Twenty plus twelve equals box" has
   every right number and is the signature error; bucket `big-number-misplaced`, zero-false-affirm.
2. **The subtraction form is NOT a family.** "Twenty minus twelve equals box" is arithmetic, not
   setup — it skips the decision the step exists to make. Bucket `operation-not-family`; the
   correction re-models the family and asks again.
3. **Both small numbers must be present** (one may be the box). "Box equals twenty" is incomplete;
   bucket `family-incomplete`.
4. **The story read back is an echo.** Bucket `echo`. Plus `off-task` — and name the filler sound
   ("um", "hmm") in every fallback clause from the start (item 37 lost six probes to it).

Valid buckets: `valid-canonical`, `valid-paraphrase` ("and" / "makes" / "what"), `valid-childlike`
("twelve… and then something… is twenty").

## What to copy, file for file

- `diWorkedProcedurePlan.ts` → `diWordProblemPlan.ts` (frames, number pool, family builder;
  pure, tested — pin every shape × unknown, and the leak/answer gates).
- `diWorkedProcedureScript.ts` → `diWordProblemScript.ts` (step items, cues, contracts in the
  family order — ask / affirm / specific corrections / general LAST; `contextFor` = the story and
  the open step, never the big number, family or answer; `leakExemptSpansFor` = the story text on
  the opening ask and the `classify` menu).
- `DiWorkedProcedure.tsx` → `DiWordProblemSetup.tsx` (runner-era; the stage is a bar model + the
  CMC arrow — small numbers above the shaft, big number at the arrowhead — drawn from affirmed ids).
- `gemini-di-worked-procedure.ts` → `gemini-di-word-problem-setup.ts` (theme-only schema).
- `workedProcedureBench.ts` → `wordProblemBench.ts` (fixture = one story per shape × unknown,
  probes on `family` items first, `big_number` items second).
- The ten registration sites item 37 touched, plus the new `OpenSetBucket`s
  (`big-number-misplaced`, `operation-not-family`, `family-incomplete`).
- Tests: item 37's two suites, same shape (`checkPackGates` on a real multi-problem session,
  `checkDiCatalogEntry`, the leak scan over every ask, span order, the fixture through the gates).

## Gates (all of them, in order — none is optional)

1. `npm run typecheck:lumina` → 0; suites green; `scripts/affordance-coverage.mjs` fully tagged
   (`affordances`: `reader: 'developing'` — the story is printed AND read aloud; say so honestly).
2. Live generation through `/api/lumina/tutor-test?componentId=di-word-problem-setup&probe=1&di=1`
   for each mode — read every story and cue by eye; a theme the gates should have refused is a
   generator finding, fix the gate not the draw.
3. `run_tutor_live.py --component di-word-problem-setup --di` plain → `--di-wrong signature`
   (the biggest-number-I-see and the misplaced big number) → `--di-cap` (the carry line) →
   `--di-bench` (zero false affirms in every refuse bucket).
4. `/curriculum-fit di-word-problem-setup` — expected homes: G1 OA.1, G2 OA.1 (within 100), G3
   OA.8 setup; a MATCH is not an assessability signal — check the solve surface.
5. File: HUMAN-CHECKS row (next free id — read the header), the `qa/di/BACKLOG.md` item, the
   WORKSTREAMS lane row, a memory note. Same slice.

## Explicitly NOT in scope

- Multiplication / division families (a later structural tier on this pack).
- Two-step problems and problems with three or more quantities.
- Typing or dragging the equation — the family is SAID; the page draws it.
- The answer past 120, and any `zero` answer (unbenched; the pool floors at 1).
- Fixing `di-correction-verbatim-repeat` — family-wide item 30, a doctrine call.
