# Handoff — `di-deduction`: the second "DI for Older Learners" pack (if-then reasoning, judged aloud)

**For:** a fresh session birthing a judged-loop pack from the design brief
(artifact `8e67009d-865c-4528-a4c1-9d9a86136696`, concept 3).
**Opened:** 2026-09-07, routed from `qa/di/BACKLOG.md` item 37 residual (e).
**Why this one, now:** the brief ranked it second because `deduction` is the ONE class in the
roster that spans science, social studies and ELA inference (G3–5), and item 37 just proved the
tier's mechanics: the runner carries a multi-step pack unchanged, a new class benches in one
sitting, and "the screen only follows" holds when the page writes what the child said. Nothing
in this handoff is a new mechanism — it is the same shape with a different unit of judgment.

## Paste-ready prompt

> Build `di-deduction`, the second "DI for Older Learners" pack, per
> `my-tutoring-app/qa/HANDOFF-di-deduction-2026-09-07.md`. Copy the skeleton of
> `di-worked-procedure` (shipped 2026-09-07, `qa/di/BACKLOG.md` item 37) file for file; copy the
> meaning-judged contract shape of `di-spoken-practice`'s `explain_concept`. Code builds the four
> case shapes from a generated rule; the LLM never emits a verdict. Register `deduction` as
> accepted-build-ahead, ship the bench fixture with the pack, and close with the same seven gates
> item 37 ran: typecheck, pack tests, live generation probe, `--di`, `--di-wrong signature`,
> `--di-cap`, `--di-bench`. File the mic row and the queue item in the same slice.

## The pack, precisely

**What the child does.** Two cards: a RULE ("All insects have six legs.") and a CASE ("A beetle is
an insect."). The tutor asks; the child SAYS the conclusion — "So a beetle has six legs." — or, on
the harder shapes, a three-way verdict with a reason: *yes / no / can't tell, because…*. Nothing
is tapped. The real-life test passes trivially: a teacher at a table asks "so what do you know
about the beetle?" and the child answers out loud.

**Four case shapes, built in CODE from one rule** (this is the LLM-window / code-structure rule —
the model emits a rule and a handful of entity facts; code assembles the items and the answers):

| shape | case | ask | expected | logic |
|---|---|---|---|---|
| `conclude` | X is an A | "What do you know about X?" | "X has P" | affirm the antecedent |
| `deny` | X does not have P | "Is X an A? How do you know?" | "no, because all A have P and X doesn't" | deny the consequent |
| `cannot_tell` | X has P | "Is X an A? How do you know?" | "can't tell — having P doesn't make it an A" | affirming the consequent is the SIGNATURE ERROR |
| `unrelated` | a fact the rule says nothing about | "Does the rule tell you whether X is an A?" | "no / can't tell" | scope of a rule |

`conclude` is the G3 floor (β ≈ 2.5); `deny` β ≈ 3.5; `cannot_tell` β ≈ 4.5 (the G4–5 reasoning
standard, and the bucket the class exists for). Ship the first three as eval modes; `unrelated`
can ride inside `cannot_tell` as a second case source. Mixed = a rule worked through all its
shapes, which is the DI format (Corrective Reading Comprehension "deductions").

**The response class: `deduction`** (new, accepted-build-ahead on the item-37 precedent). What
the judge scores: a VERDICT (a conclusion sentence, or yes/no/can't-tell) plus a REASON that
cites the rule, judged on MEANING like `concept_statement` — "it's got eight legs so it's not
one" is a full answer to `deny`. Four things the pack must hold that the class cannot:

1. **The signature error is a confident YES.** "Yes, because it has six legs" on a `cannot_tell`
   case is fluent, cites the rule, and is wrong. The contract names it; the bench bucket
   `affirmed-consequent` must be zero-false-affirm.
2. **A verdict with no reason is half an answer** on `deny` / `cannot_tell` — same as
   item 37's `no-move`. Decide up front whether the contract refuses it or the correction asks
   "how do you know?" — pick ONE (two-branch law), and make the accept clause explicit about the
   short forms a child actually uses ("nope, eight legs").
3. **The echo is the rule read back.** "All insects have six legs" answers nothing; bucket `echo`.
4. **Correction cap is load-bearing** (open class). Never raise `maxCorrections`.

**Stage.** Rule card, case card, and — only after the affirmation — the conclusion written under
them (`revealHeld`), with the three verdict pills lighting on affirm for the verdict shapes. The
screen never shows a verdict before the child says it. No timer, no buttons, `JudgedMicPanel`.

**Generator (Fork B with code rails, the spoken-practice shape).** Gemini emits, per objective:
`rule` (All A have P / If A then P), `category` (A), `property` (P), 2–3 `members` (things that ARE
A), 2–3 `nonMembers` that LACK P, 2–3 `lookalikes` that HAVE P but are not A. Code builds the
items and their answers; keep-or-drop gates: the rule must be a universal (refuse "some" / "most"),
every entity must be sayable in ≤ 3 words, no entity may appear in two lists, and the rule text
must not contain any entity name (leak). Refuse generalizations that are false in the world (the
review-model precedent in `spokenPracticePlan.ts`) — a child must never be affirmed on a wrong
fact. Flash-lite rules: one bounded flat array, `maxOutputTokens` set, arrays bounded.

## What to copy, file for file

- `diWorkedProcedurePlan.ts` → `diDeductionPlan.ts` (case-shape builder; pure, tested).
- `diWorkedProcedureScript.ts` → `diDeductionScript.ts` (cues, contracts in the family order:
  ask / affirm / specific corrections / general LAST; `contextFor` stimulus-side only — the rule
  and the case, never the verdict; `leakTokensFor` + `leakExemptSpansFor`; `packBase`).
- `DiWorkedProcedure.tsx` → `DiDeduction.tsx` (runner-era component; ~300 lines).
- `gemini-di-worked-procedure.ts` → `gemini-di-deduction.ts` (but Fork B: see above).
- `workedProcedureBench.ts` → `deductionBench.ts` (hand-authored key; buckets to add to
  `OpenSetBucket`: `affirmed-consequent`, `wrong-verdict`, `verdict-no-reason`; reuse
  `valid-canonical` / `valid-paraphrase` / `valid-childlike` / `echo` / `off-task`).
- The ten registration sites item 37 touched: `judgedScriptContract.ts` (class), `types.ts`,
  `evaluation/types.ts`, `catalog/di.ts`, `diGenerators.ts`, `primitiveRegistry.tsx`,
  `DirectInstructionPrimitivesTester.tsx`, `diDrivePlan.ts` (`DI_PORTS` adapter + `benchBuild`),
  `openSetWordBench.ts` (buckets), `backend/.../problem_type_registry.py`.
- Tests: the two suites item 37 wrote, same shape — `checkPackGates` on a REAL session (several
  same-action items back to back), `checkDiCatalogEntry`, the leak scan over every ask, the span
  order pin, the bench fixture built through the shipped gates with every probe id resolving.

## Gates (all of them, in order — none is optional)

1. `npm run typecheck:lumina` → 0; the two suites green; `scripts/affordance-coverage.mjs` still
   fully tagged (add `affordances` on the catalog entry).
2. Live generation through `/api/lumina/tutor-test?componentId=di-deduction&probe=1&di=1&…` —
   read every cue by eye before a child hears one (item 37's `wp-probe.json` step).
3. `run_tutor_live.py --component di-deduction --di` plain, then `--di-wrong signature`
   (the confident yes), then `--di-cap` (the move-on must STATE the conclusion so the page can
   carry it — copy item 37's carry line), then `--di-bench`. Bench bar: zero false affirmations in
   every refuse bucket. Name the filler sound ("um", "hmm") in every fallback clause from the
   start — item 37 lost six probes to it before the clause existed.
4. `/curriculum-fit di-deduction` — expected homes: G3–5 science classification generalizations,
   social studies rules, ELA RI.3.1 / RI.4.1 inference. A MATCH is not an assessability signal;
   look for the solve surface.
5. File: HUMAN-CHECKS row (next free id — read the header; #141 as of this writing), the
   `qa/di/BACKLOG.md` item, the WORKSTREAMS lane row, a memory note. Same slice.

## Explicitly NOT in scope

- Written justification (that is `di-sentence-craft`, concept 5).
- Two-rule chains / syllogisms with a middle term — a later structural tier on this pack.
- `di-error-hunt` (concept 6) — it REUSES `deduction`; build it after this class has evidence.
- Fixing `di-correction-verbatim-repeat` — family-wide item 30, a doctrine call, not a pack edit.

## The cheap alternative, if the session would rather widen than deepen

Addition with carrying as two new eval modes on `di-worked-procedure` (`add_no_carry`,
`add_carry`): extend `diWorkedProcedurePlan.ts` with an `operation` axis and a `carry` step
grammar ("three plus eight is eleven, write one, carry one"), reuse `procedure_step`, add carry
probes to the bench fixture, same stage with the carry mark above the next column. About half of
item 37's cost, and it doubles the pack's curriculum reach (G1–3 NBT addition). Executor:
`/add-eval-modes di-worked-procedure`, contract-first against the pack's tests.
