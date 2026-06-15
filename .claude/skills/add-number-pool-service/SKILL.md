# Add Number Pool Service to a Generator

Wire a generator to the **number pool service** (`service/math/numberPoolService.ts`) so it stops emitting the *same* numbers on every call. Gemini's structured-output mode is **convergent for numeric values regardless of temperature** — left to itself it picks the same target/operands/answer every time. The pool service fixes this by moving the randomness into code: *we own the randomness, Gemini owns the pedagogy.*

This is a small, surgical skill — usually one import + one `createNumberPool(...)` call + a prompt edit. It is **not** a difficulty system and **not** scope-binding (`scopeContext.ts`). It is purely an entropy source.

## The symptom it fixes

Run a multi-instance generator (or any N parallel sub-generator calls) and inspect the numbers across instances:

- Bar values, targets, or **answers cluster** on a few values (the canonical tell: every "hard" `graph_word_problem` resolved to `expected=5` — the LLM back-solves to one clean answer, then fits operands to it).
- Re-running the same prompt yields near-identical numerics.

If the numbers already vary call-to-call, you don't need this. The pool service earns its keep specifically where **independent generations collapse onto the same values**.

## The safety rule — read before you wire it (this is the whole skill)

The pool service was once removed from value-only primitives because it **broke "Counting to 10"** (it injected numbers past 10). That failure is the most important lesson here, and it has a precise cause. Ask one question:

> **Is the pooled number the learning TARGET, or is it incidental DATA?**

- **Incidental data** — the magnitude is something the student *reads/operates on*, but the pedagogy is the operation/structure, not the number itself (bar-graph magnitudes, word-problem operands, the values in a "which is bigger" pair). → **Safe.** Draw the pool freely from the mode's display band. There is no scope to violate because the number isn't the thing being taught.

- **The learning target** — the number *is* the objective (counting to 10, plotting a point on a 0–20 line, a place-value quantity). → **Dangerous unless the pool range == the scope window.** A pool drawn from anything wider than the objective (a grade band, a difficulty band) will teach past the objective — that is exactly what broke "Counting to 10." For these primitives the pool range MUST be the scope-bound range (use `config.numberRange` / the objective ceiling), never a grade or difficulty band. Reach for `createSubRangePool` (it narrows to a display window) and pair with `scopeContext.ts`.

**Two corollaries that keep it clean:**
1. **Pool range ← scope, NEVER ← difficulty tier.** Magnitude is owned by scope/the mode band; *structural* difficulty (operation depth, gaps, steps) is owned by the tier (see `/add-support-tiers`). The pool range is **tier-independent** — a harder tier changes the *shape* of the problem, not the size of the pooled numbers. Mixing these is the retired numeric-difficulty path ([[structural-difficulty-not-numeric]]).
2. **The pool is not `scopeContext`.** `scopeContext` is a *prompt-text ceiling* ("stay within 'to 10'"); the pool is *actual code-generated numbers*. They compose: for a target-number primitive, `scopeContext` sets the range that the pool then draws from. Don't substitute one for the other.

## The service API

`service/math/numberPoolService.ts` (no new code needed — reuse it):

| Function | Use for | Returns |
|---|---|---|
| `createNumberPool(range, { count, integers, sorted, minNonZeroDigits })` | flat list of candidate values | `NumberPool \| null` |
| `createSubRangePool(range, { maxSpan, spanFraction })` | number-line / sequence — narrows to a random **display window** inside the full range | `SubRangePool \| null` |
| `createOperandPairs(range, '+' \| '-' \| '×', count)` | arithmetic primitives that need consistent `{a, b, result}` triples | `OperandPair[] \| null` |

Each pool exposes `pool.toPromptSection(opts)` → the prompt block to inject. It already tells Gemini *"do NOT invent your own numbers — select from this pool only."* Returns `null` when `range` is absent, so the generator falls back to its own grade-band logic cleanly.

`toPromptSection` options: `label`, `usePrimaryInstruction` (set `false` when there's no single "primary" value), `extraInstructions` (per-primitive assignment rules + the answer-derivation instruction).

## Workflow

1. **Confirm the symptom.** Generate the mode a couple of times (or read a multi-instance session) and show the user the clustered numerics. No clustering → don't add it.

2. **Classify the pooled number** with the safety rule above (target vs. incidental). This decides the range source:
   - incidental → the mode's display band (a literal `{ min, max }` matching the post-process clamp).
   - target → `config.numberRange` / the scope window; use `createSubRangePool` + `scopeContext`.

3. **Build the pool inside the per-call function** (the sub-generator, not the orchestrator) so each independent call rolls its own — that divergence across calls is the entire point:
   ```typescript
   const pool = createNumberPool({ min: 2, max: 40 }, { count: 8, integers: true });
   const poolSection = pool ? '\n\n' + pool.toPromptSection({
     label: 'BAR VALUE POOL',
     usePrimaryInstruction: false,
     extraInstructions:
       '- Assign FOUR DIFFERENT numbers from this pool to the bars.\n' +
       '- Compute the answer as the EXACT arithmetic on the values you assigned.',
   }) : '';
   ```

4. **Edit the prompt:** replace any "invent / choose your own values 2–40" rule with "use values from the POOL below — do NOT invent your own," and append `${poolSection}`. Keep the post-process clamp as a guard.

5. **Derive the answer in code where the answer is arithmetic on the pooled values (G4 win).** Clustering on *answers* is often the LLM choosing the answer first; once the operands come from the pool the answer falls out of them. If the mode lets you recompute the answer from the bars/operands, do so instead of trusting the LLM's claimed value (eval-test Rule G4). Where the answer is just "read a labelled bar," it's already code-derived — nothing to do.

6. **Do NOT vary the pool by tier.** If the primitive has support tiers, the tier changes problem *structure*; the pool range stays the same. (Keep the two systems on separate axes.)

7. **Verify:**
   - Project-local tsc, not bare `npx tsc` ([[tsc-verification-integrity]]):
     `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — zero new errors vs. baseline (~1444).
   - Re-run the generator 2–3× and assert the numerics (and especially the **answers**) now spread — report distinct-count before/after.
   - For a **target-number** primitive, also run the `/eval-test` scope-conflict case (e.g. a "to 5"/"to 10" topic) and confirm **every** pooled value still respects the ceiling — this is the regression that the counting-to-N removal was about.

## Worked reference

**bar-model → `graph_word_problem`** (`service/math/gemini-bar-model.ts`): the answers clustered at 5 because the sub-generator let Gemini pick bars *and* the answer. Fix was one `createNumberPool({min:2,max:40}, {count:8})` injected per sub-generator call. Safe without a scope ceiling because bar magnitudes are **incidental graph data**, not the learning target — the pedagogy is the two-step operation, which the support tier owns. Answers went from 1/4 distinct to 3–4/4; operation depth and scope both unchanged. The other bar-model reading modes never needed it: they already derive `expectedValue` from the targeted bar (`bars[targetIdx].value`).

## Checklist

- [ ] Confirmed the **clustering symptom** (don't add it if numerics already vary)
- [ ] Classified the pooled number: **incidental data** (safe, mode band) vs. **learning target** (pool range MUST be the scope window — never a grade/difficulty band)
- [ ] Built the pool **inside the per-call sub-generator** (so independent calls diverge), not in the orchestrator
- [ ] Injected `pool.toPromptSection(...)` and removed the "invent your own numbers" rule
- [ ] Where the answer is arithmetic on pooled values: **derived it in code** (G4), not trusted from the LLM
- [ ] Pool range is **tier-independent** (difficulty changes structure, not pool magnitude)
- [ ] Did NOT confuse the pool with `scopeContext` (text ceiling) — composed them for target-number primitives
- [ ] tsc clean vs. baseline; re-ran 2–3× and confirmed numerics/answers spread; ran the scope-conflict case for target-number primitives
