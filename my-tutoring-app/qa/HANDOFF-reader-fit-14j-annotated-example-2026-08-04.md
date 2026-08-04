# Reader-fit 14j — annotated-example scope/grade binding

**Queue item:** reader-fit BACKLOG §14j.

**Executors:** `/topic-fidelity` → `/primitive-contract` → `/eval-fix` →
`/oracle-test`.

**Goal:** a Grade-1 manifest that pins an exact worked example keeps that
scenario, quantities, units, and operation family through problem authoring and
solution hydration.

## Failure to reproduce first

Use the published `MEAS001-07-c` trace shape from
`qa/topic-traces/g1-identical-coins-2026-08-01.md`:

- Objective: count a collection of identical coins.
- Manifest intent: six nickels, skip-count to **30¢**.
- Current bad result: the authored problem replaces it with **4 × 5 = 20
  dimes = 200¢**, introducing multiplication, a different denomination, and a
  much larger value.

Re-run the exact case through `/topic-fidelity` before editing. Save the full
input intent, authored `problem.statement`, solver echo, final answer, and all
step operations. If the stochastic failure no longer reproduces, run enough
draws to establish whether the authoring boundary is now reliably faithful;
do not close from one lucky draw.

Healthy control from the same census:
`g1-count-forward-to-120-2026-08-01.md` produced the exact
`108, 109, ?, 111` worked example. Preserve that behavior.

## Ground-truth mechanism — premise correction

Do **not** begin by editing the solver. The solver is already pinned.

The current chain is:

1. `registry/generators/coreGenerators.ts:221-226` forwards `ctx.topic`,
   `ctx.gradeContext`, and `ctx.intent`.
2. `annotated-example/gemini-annotated-example.ts:232-251` forwards the intent
   to `runAnnotatedExampleOrchestrator` as generic `context`.
3. `annotated-example/orchestrator.ts:77-131` asks Flash Lite to author the
   actual problem. The exact manifest intent appears only under **Additional
   context**; no rule says named quantities, units, or operation identity are
   binding, and there is no Grade-1 operation ceiling.
4. Only after that drift has happened,
   `gemini-annotated-example.ts:248-251` passes the authored statement as
   `pinnedProblem`.
5. `annotated-example/solver.ts:69-84` and
   `gemini-annotated-example.ts:142-174` correctly require the solver to echo
   and solve that already-authored problem verbatim.

Therefore the owning defect is the **problem-authoring boundary**. Solver and
step-renderer changes are justified only if a post-authoring probe shows a
second, independent drift.

## Contract-first gate

There is no
`src/components/lumina/docs/contracts/annotated-example.md`. Derive it before
editing. At minimum preserve:

- the orchestrator may author a representative problem when the manifest did
  not specify one;
- an exact manifest scenario outranks creative variation;
- the solver solves one pinned problem exactly once and downstream stages
  render rather than re-solve it;
- upper-grade algebra/calculus operation families remain available;
- the healthy Grade-1 108–111 counting example remains in scope;
- advanced inset selection and the `practice-problem` sibling consumer of
  `runAnnotatedExampleOrchestrator` are not ablated.

If exact scenario binding conflicts with representative-problem variation,
fork on **constraint presence**: strict when the intent names concrete values,
entities, units, or an exact problem; legacy authoring when it does not. Never
globally freeze all annotated examples to their topic string.

## Implementation target

Use the lightest mechanism that makes the invariants code-checkable:

1. Promote manifest steering from untyped `context` to an explicit authoring
   contract at the orchestrator boundary. Exact named quantities/entities/units
   are requirements, not inspiration.
2. Add a narrow Grade-1 operation policy to the authored-problem validator.
   For this case, skip counting/repeated addition is legal; multiplication as a
   replacement task is not. Do not ban multiplication globally or infer grade
   from arbitrary prose substring matches.
3. Validate the authored `problemStatement` before hydration. A rejected plan
   may take one bounded repair attempt carrying explicit violations. If it still
   fails, use a safe intent-faithful fallback rather than silently widening the
   task. Do not hardcode nickels or this one sentence.
4. Keep `pinnedProblem` as the single downstream source. Do not allow the
   solver, planner, or step generators to swap denominations, values, or
   operation identity after validation.
5. Add structured diagnostics for authoring rejection/repair without logging
   student identity or private misconception text.

Watch the shared consumer at
`service/math/gemini-practice-problem.ts:441-445`: it also calls
`runAnnotatedExampleOrchestrator`. Any signature or validation change must
either preserve its legacy path or deliberately thread the same structured
constraints through it.

## Required tests and runtime gates

### Focused tests

- Exact six-nickel intent survives authoring: six, nickels, and 30¢ remain;
  no dimes, 200¢, multiplication symbol, `times`, or array task appears.
- Grade-1 operation-policy rejection bites on the recorded 4×5 dime plan.
- A repair/fallback remains within the same intent rather than dropping the
  session.
- Generic Grade-1 authoring without concrete constraints remains varied.
- Healthy 108–111 missing-number control remains exact.
- Upper-grade multiplication/algebra/calculus controls remain legal.
- `gemini-practice-problem` keeps its expected orchestrator behavior.
- Non-vacuity: reverting/bypassing the validator must fail the recorded case.

### Oracle

Add an annotated-example Grade-1 scope/operation oracle that checks the final
serialized problem and step chain, not just the prompt. It must distinguish an
explicit multiplication objective from multiplication introduced by the
generator; Grade 1 does not justify a universal token ban.

### Runtime

- `/topic-fidelity` on the exact `MEAS001-07-c` trace, multiple draws.
- `/eval-test annotated-example` on the coin case, the 108–111 control, and at
  least one advanced control.
- Recompute/inspect the final answer and confirm the solver's `PROBLEM` echo is
  byte-faithful to the validated authored statement.
- `/primitive-contract --check` must report COMPATIBLE or document the required
  constraint-presence fork.
- `npm run typecheck:lumina` and full `npm test` green.

No browser/pixel row is expected if this remains generator-only. If component
or interaction code changes, stop and queue the real browser residual in
`qa/HUMAN-CHECKS.md` rather than burying it in the report.

## Explicit non-goals

- Do not fix the April AE-1–AE-4 redundant-step campaign unless the 14j probe
  proves it is the same causal mechanism.
- Do not redesign annotated-example UI, challenges, or inset rendering.
- Do not replace the code-executing solver or relax its pinned-problem rule.
- Do not solve this by prompt wording alone without a post-authoring validator
  and a final-payload oracle.

## Close-out

Write `qa/reader-fit/annotated-example-14j-2026-08-04.md` (or the actual run
date), strike §14j in `qa/reader-fit/BACKLOG.md`, update the annotated-example
row/issues in `qa/EVAL_TRACKER.md`, run the contract check, and move
`WORKSTREAMS.md` to 14k/14l in the same slice. Record any new finding once in
its owning queue with an executor skill.
