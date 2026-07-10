# Add Number Pool Service to a Generator

## What you're building toward (the outcome)

A generator wired to the number pool service produces **different numbers every time it runs** — across the instances in a single session, and across re-generations of the same lesson. That is the whole point, and it matters pedagogically:

- A student practicing one skill should get *varied* problems, not `8 − 3` four times in a row.
- When the adaptive engine re-serves a skill, it should feel like a fresh problem, not one the student already memorized.
- Clustered values make a primitive feel broken — the canonical tell is every "hard" word problem resolving to `answer = 5`.

You reach that outcome by moving the number-*choosing* out of the LLM and into code: **we own the randomness, Gemini owns the pedagogy.** The service pre-rolls a pool of candidate values and tells Gemini to pick from them instead of inventing its own.

## Why the LLM can't do this itself (the failure it fixes)

Gemini's structured-output mode is **convergent for numeric values regardless of temperature.** Asked to choose a target/operand/answer, it returns the same clean value run after run — and for *answers* it often chooses the answer first and back-solves the operands to fit it (that is why every "hard" `graph_word_problem` landed on `expected = 5`). Turning temperature up does not fix it; the convergence is in how constrained decoding resolves a free numeric field, not in the sampler.

So don't ask the model to be random. Roll the numbers in code, inject them, and let the LLM do what it is actually good at: reading the topic and writing pedagogy *around* the numbers you handed it. **The entropy lives in the prompt (a pre-rolled pool the LLM selects from), never in post-LLM rewriting** of the value it returned.

**When you do NOT need it:** if the numbers already vary call-to-call, stop — there's nothing to fix. Confirm the clustering symptom first (run the mode 2–3× and look at the spread, especially of *answers*). The service earns its keep only where independent generations collapse onto the same values.

## The one decision that makes it safe (this is the design — read before wiring)

The mechanics are trivial (an import, a pool call, a prompt edit). The judgment is one question, asked of the number you're about to pool:

> **Is this number the learning TARGET, or is it incidental DATA?**

This single distinction decides whether a pool is safe and which tool to use. Getting it wrong is how the pool service once **broke "Counting to 10"** — it injected numbers past 10 into a primitive whose *target* was the count itself. That failure is the reason this section exists.

- **Incidental data** — the student reads or operates on the magnitude, but the pedagogy is the *operation or structure*, not the number (bar-graph magnitudes, word-problem operands, the values in a "which is bigger" pair). → **Safe.** Draw freely from the mode's display band; there is no scope to violate because the number isn't what's being taught.

- **The learning target** — the number *is* the objective (counting to 10, plotting a point on a 0–20 line, a place-value quantity, the skip interval in skip-counting). → **Safe only if the pool == the scope.** A pool drawn from anything *wider* than the objective (a grade band, a difficulty band) teaches past the objective — exactly what broke "Counting to 10." The right tool then depends on the target's shape:
  - **Continuous target** (a magnitude on a line, a place-value quantity) → the pool range MUST be the scope-bound range (`config.numberRange` / the objective ceiling), never a grade or difficulty band. Compose with `scopeContext.ts`.
  - **Discrete target from a curated legal SET** (skip interval ∈ {2,3,4,5,10}, a denominator, a base) → a contiguous range is *wrong* (it invents illegal in-between values — 6/7/8/9 are not legal skip intervals). Shuffle the *fixed set* instead, and make the topic authoritative so a named value ("by 5s") still wins.

**Two corollaries that keep the axes clean:**
1. **Pool range ← scope, NEVER ← difficulty tier.** Magnitude is owned by scope / the mode band. *Structural* difficulty (operation depth, gaps, steps) is owned by support tiers (see `/add-support-tiers`). A harder tier changes the problem's *shape*, not the size of the pooled numbers. Mixing them is the retired numeric-difficulty path ([[structural-difficulty-not-numeric]]).
2. **The pool is not `scopeContext`.** `scopeContext` is a prompt-text *ceiling* ("stay within 'to 10'"); the pool is *actual code-generated numbers*. They compose — for a target-number primitive, `scopeContext` sets the range the pool then draws from. Don't substitute one for the other.

## Generalizes beyond numbers

The core insight — *constrained decoding converges on a free choice, so own the choice in code and hand the LLM a pre-rolled candidate set* — is not specific to numbers. Any **enumerable field the LLM picks freely and convergently** is a candidate: a scenario template, a category, which item is the target, a name. `createDiscretePool` already works on any `number[]` legal set; the same shuffle-and-suggest-with-an-authoritative-source pattern applies to a `string[]` of templates. When you hit convergence on a non-numeric field, reach for the discrete-pool *pattern* (shuffle in code, inject as the entropy, keep the topic authoritative) even if you write a small bespoke builder for it. The service today ships number helpers because math generators are where the symptom showed up first — not because the idea is numeric.

## The service API

`service/math/numberPoolService.ts` — reuse these; all four exist:

| Function | Use for | Returns |
|---|---|---|
| `createNumberPool(range, { count, integers, sorted, minNonZeroDigits })` | flat list of candidates from a **contiguous range** | `NumberPool \| null` |
| `createSubRangePool(range, { maxSpan, spanFraction })` | number-line / sequence — narrows to a random **display window** inside the full range | `SubRangePool \| null` |
| `createDiscretePool(legalSet, { count? })` | a TARGET drawn from a **fixed curated set** — shuffles the set, never invents in-between values | `DiscretePool \| null` |
| `createOperandPairs(range, '+' \| '-' \| '×', count)` | arithmetic primitives needing consistent `{a, b, result}` triples | `OperandPair[] \| null` |

Each pool exposes `pool.toPromptSection(opts)` → the prompt block to inject (it tells Gemini *"do NOT invent your own numbers — select from this pool only"*). Each returns `null` when its input is absent, so the generator falls back to its own grade-band logic cleanly.

- `createNumberPool` / `createSubRangePool` `toPromptSection` options: `label`, `usePrimaryInstruction` (set `false` when there's no single "primary" value), `extraInstructions` (per-primitive assignment rules + the answer-derivation instruction).
- `createDiscretePool` `toPromptSection` options: `label`, `noun` (e.g. `'skip value'`), `authoritativeSource` (e.g. `'the topic'` — emits "the topic is AUTHORITATIVE: if it names a {noun} use THAT, else use the first candidate; don't go outside this list"), `extraInstructions`. The shuffle reorders the set each call (a different suggested first value) — that reordering *is* the entropy; `pool.suggested` is `values[0]` if code ever needs it.

> **Pilot-then-sweep gate (mandatory):** never roll this pattern across multiple generators until ONE pilot has been re-generated 2–3× **at runtime** and the numeric spread verified (step 7) with the user seeing before/after. This exact pattern was once swept onto 17+ generators off a type-checked pilot and fully retracted — the concept, not the code, was wrong, and only runtime output revealed it (CLAUDE.md Verification Doctrine).

## Workflow

1. **Confirm the symptom.** Generate the mode a couple of times (or read a multi-instance session) and show the user the clustered numerics — especially the **answers**. No clustering → don't add it.

2. **Classify the pooled number** (target vs. incidental, above). This picks the tool and the range source:
   - incidental → `createNumberPool` over the mode's display band (a literal `{ min, max }` matching the post-process clamp).
   - continuous target → `createSubRangePool` (display-window primitives like number lines) or `createNumberPool` over the scope-bound `config.numberRange`, **+ `scopeContext`**.
   - discrete target from a legal set → `createDiscretePool(legalSet)` with `authoritativeSource: 'the topic'`.

3. **Build the pool inside the per-call function** (the sub-generator, not the orchestrator) so each independent call rolls its own — that divergence across calls is the entire point.

   Incidental range pool:
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

   Discrete target pool. Skip it entirely when a structured `config` field already pins the value — an explicit pin needs no entropy:
   ```typescript
   const skipPool = config?.skipValue === undefined
     ? createDiscretePool(GRADE_BAND_SKIP_VALUES[band]) // legal set == scope
     : null;
   const skipPoolSection = skipPool ? '\n\n' + skipPool.toPromptSection({
     label: 'SKIP VALUE POOL',
     noun: 'skip value',
     authoritativeSource: 'the topic', // topic wins; pool is the fallback
   }) : '';
   ```

4. **Edit the prompt:** replace any "invent / choose your own values" rule with "use values from the POOL below — do NOT invent your own," and append `${poolSection}`. Keep the post-process clamp as a guard.

5. **Derive the answer in code wherever the answer is arithmetic on the pooled values.** Clustering on *answers* is usually the LLM choosing the answer first. Once the operands come from the pool, recompute the answer from them rather than trusting the LLM's claimed value (eval-test Rule G4). Where the answer is just "read a labelled bar," it's already code-derived — nothing to do.

6. **Keep the pool tier-independent.** If the primitive has support tiers, the tier changes problem *structure*; the pool range/set stays the same. (Two systems, two axes.)

7. **Verify:**
   - Project-local tsc, not bare `npx tsc` ([[tsc-verification-integrity]]): `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — zero new errors vs. the current baseline (don't trust hardcoded counts; measure before editing).
   - Re-run the generator 2–3× and assert the numerics (especially **answers**) now spread — report distinct-count before/after.
   - For a **target-number** primitive, also run the `/eval-test` scope-conflict case (a "to 5"/"to 10" topic, or "by 5s" for a discrete target) and confirm **every** pooled value still respects the ceiling / stays in the legal set, and that a topic-named value still wins. This is the "Counting to 10" regression.

## Reference call sites (one per branch — read the branch that matches your case)

| The pooled number is… | Tool | Range/set source | Live call site |
|---|---|---|---|
| **incidental data** (graph magnitudes) | `createNumberPool` (flat band) | a literal mode band, no scope ceiling needed | `gemini-bar-model.ts` → `graph_word_problem` |
| **continuous target** on a display window (number line / sequence) | `createSubRangePool` | `config.numberRange` + a `maxSpan` | `gemini-number-line.ts` |
| **continuous target** = the quantity itself (place value, base-ten) | `createNumberPool` (scope-bound) | the per-mode scope range / `config.numberRange` | `gemini-place-value.ts` (per-mode `numberRange` profile), `gemini-base-ten-blocks.ts` (`minNonZeroDigits: 2` to avoid round-number boredom) |
| **discrete target** from a legal set | `createDiscretePool` | the curated legal set (== scope) | `gemini-skip-counting-runner.ts` → `skipValue` |

Two of these carry the load-bearing lessons:

- **bar-model (`graph_word_problem`)** — *the answer-derivation lesson.* Answers clustered at 5 because the sub-generator let Gemini pick the bars *and* the answer. One `createNumberPool({min:2,max:40},{count:8})` per sub-generator call moved answers from 1/4 distinct to 3–4/4. Safe with no scope ceiling because the bar magnitudes are **incidental** — the pedagogy is the two-step operation, which the support tier owns. The other bar-model reading modes never needed a pool: they already derive `expectedValue` from the targeted bar (`bars[targetIdx].value`), so the answer was always code-derived.

- **skip-counting-runner (`skipValue`)** — *the entropy-belongs-in-the-prompt lesson.* Every open objective collapsed onto `+2`/`+5`. The target is the skip interval, so a contiguous pool is wrong (emits illegal 6/7/8/9); `createDiscretePool` shuffles the grade-band legal set and the prompt keeps the topic authoritative. **The first attempt was the cautionary tale:** it regex-parsed the topic ("by Ns") and pinned the value *after* the LLM ran — brittle (misses "by fives"), and it put entropy in code *fighting* the model instead of in the prompt *seeding* it. See [[schema-over-regex-and-prompt]].

## Pitfalls (the "do not" list — now that you have the model)

- **No regex topic-parsing for the value.** A regex misses word-numbers ("by fives", "in threes"); the LLM reads the topic natively far better. Make the pool topic-authoritative instead ([[schema-over-regex-and-prompt]]).
- **No post-LLM value pin.** Don't overwrite the generated field with a code-chosen value. The only legitimate post-LLM pins are an explicit *structured* `config` field (not parsed text) and a cheap validity guard/clamp. Entropy goes in the prompt, seeding the model — not in code, rewriting its output.
- **Don't pool a target from a wider-than-scope range.** The "Counting to 10" break. For a target, pool == scope, always.
- **Don't pool by tier.** Magnitude is scope's; structure is the tier's.
- **Don't confuse the pool with `scopeContext`.** Compose them for continuous targets; never substitute one for the other.

## Checklist

- [ ] Confirmed the **clustering symptom** (don't add it if numerics already vary)
- [ ] Classified the pooled number (**target vs. incidental**) and picked the matching tool: incidental → `createNumberPool` (mode band); continuous target → `createSubRangePool` / scope-bound `createNumberPool` (+ `scopeContext`); discrete target → `createDiscretePool` (the set == scope)
- [ ] Built the pool **inside the per-call sub-generator** so independent calls diverge
- [ ] Entropy is **in the prompt**: injected `pool.toPromptSection(...)`, removed the "invent your own numbers" rule — **no regex topic-parse, no post-LLM value pin** (only a structured `config` field may skip/pin)
- [ ] For a discrete target, made the **topic authoritative** (`authoritativeSource`) so a named value still wins
- [ ] Where the answer is arithmetic on pooled values: **derived it in code** (G4)
- [ ] Pool is **tier-independent** (difficulty changes structure, not pool magnitude/set)
- [ ] Did NOT confuse the pool with `scopeContext`; composed them for continuous targets
- [ ] tsc clean vs. baseline; re-ran 2–3× and confirmed numerics/answers spread; ran the scope-conflict case (incl. a topic-named value still winning) for target-number primitives
---
name: add-number-pool-service
description: >-
  Wire an existing Lumina generator to the shared number-pool service. Use when generated numeric content repeats, lacks within-session variety, or needs controlled magnitude bands across difficulty and evaluation modes.
---
