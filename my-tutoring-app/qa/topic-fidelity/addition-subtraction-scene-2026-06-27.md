# Topic Fidelity: addition-subtraction-scene — 2026-06-27

Scope/theme intended: the generator must honor BOTH the broad lesson `topic` AND the
per-primitive `intent` the manifest intentionally assigns to this scene.

## Initial finding — intent was dropped before it reached the generator

The first pass on topic "Counting to 5" read HONORED *for topic scope*: the LLM reads
`topic` in the prompt and self-selects `gradeBand`+`maxNumber`+counts from it, so "to 5"
→ all values ≤ 5 (5 draws, all modes, clean). But that masked a deeper gap: **`intent`
never reached this generator at all**, dropped at TWO points —

1. **Registry** (`mathGenerators.ts`): the handler forwarded bare `item.config`, so the
   manifest's per-primitive `item.intent` was never injected into config (unlike
   `counting-board` / `number-sequencer` one block up, which spread it in).
2. **Generator**: config type didn't declare `intent`; the prompt never interpolated it.

`topic` is the BROAD lesson; `intent` is the SPECIFIC objective assigned to this scene.
With intent dropped, a lesson on broad topic "Addition & subtraction within 10" that
assigned this scene the intent "Take away within 5 — subtraction only" would have
produced generic mixed add/sub to 10. The topic test passed only because "Counting to 5"
happened to carry its own scope. **Latent FIDELITY BUG → fixed at Tier 1.**

## Fix (Tier 1 — establish the intent contract, then feed it into the prompt)

- `registry/generators/mathGenerators.ts` — inject `intent: (item.config?.intent as
  string | undefined) || item.intent || item.title` into config (mirrors counting-board).
- `math/gemini-addition-subtraction-scene.ts` — declare `intent?: string` on config;
  interpolate it into the prompt as the SPECIFIC focus ("broad lesson is ${topic}, but
  THIS scene must target: ${intent}") with scope-ceiling + no-answer-leak guardrail.

## Verification — intent now drives output (topic held BROAD & FIXED at "…within 10", grade 1)

| topic (fixed) | intent | result |
|---------------|--------|--------|
| within 10 | Take away within 5 — subtraction only | **all subtraction, max 5** (2 draws identical) |
| within 10 | Joining groups, sums up to 10 — addition only | **all addition, up to 10** |
| within 10 | (empty) | mixed add/sub, up to 7 — broad default, **no regression** |
| Counting to 5 | (empty) | max 5 — **original topic behavior preserved** |

Before the fix all four rows would have been indistinguishable (mixed add/sub to 10).
Now intent moves both the **operation** and the **scope**; the empty-intent and original
"Counting to 5" rows confirm no regression.

**Verdict:** FIDELITY BUG (intent silently dropped) → fixed at Tier 1.
**Mechanism:** intent dropped at registry handler + dead field in generator (two-point drop).
**Change:** `mathGenerators.ts` (inject intent into config) + `gemini-addition-subtraction-scene.ts` (declare + interpolate intent).
**tsc:** 1419 (baseline 1419, zero new errors).
**Leak check:** intent text describes the OBJECTIVE; the prompt explicitly forbids restating an answer; equations are code-recomputed from counts, so nothing leaks.

**Skill update:** `/topic-fidelity` now makes "establish the intent contract first" a
default Phase-0.5 step, lists the registry-drop as failure-mechanism #1, and adds an
intent-discrimination probe (vary intent under a fixed broad topic).
