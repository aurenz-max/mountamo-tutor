# Topic Trace: "reading sentences with sight words" (first grade) — 2026-07-25

Run as the L1 verification for `di-sentence-reading`'s new eval-mode ladder —
specifically the routing path the Primitives Tester structurally cannot exercise
(it always pins `targetEvalMode`, and `/api/lumina/eval-test` does too).

Scope intended by the topic: short sentences whose vocabulary carries irregular
high-frequency (sight) words.

## Components

| Component | In scope? | Largest / off-scope value | Broken link | Fix target |
|-----------|-----------|---------------------------|-------------|------------|
| di-sentence-reading | ✓ | 4 words (ceiling 5) | — | — |

## Chain

| Link | Value |
|---|---|
| **topic** | "reading sentences with sight words" |
| **objectiveText** | *"Read short sentences containing sight words out loud."* — scope kept |
| **objectiveVerb** | `apply` |
| **intent** | *"The student reads 3-5 word sentences containing the target sight words… The system judges accuracy word-by-word as the student speaks."* — scope kept **and sharpened** (3-5 words) |
| **resolved mode** | **`sight_phrase_sentence` (explicit)** — the lesson-level resolver pinned the NEW mode |
| **word ceiling** | **5** — `resolveWordCeiling` narrowed 8 → 5 off the "short sentences" language, honouring the intent's own 3-5 word ask |
| **data** | `Here it is.` (3w) / `Look at me!` (3w) / `We can go up.` (4w) / `My ball is red.` (4w) — all sight-heavy, all ≤5 words |

**No scope drops.** Every link preserved the topic's scope, and the generator
tightened the length ceiling to match the intent rather than running to its own
8-word maximum.

## What this verifies for the L1 ladder

1. **The new mode is REACHABLE in production.** The manifest selected the
   primitive and the eval-mode resolver routed a sight-word objective to
   `sight_phrase_sentence` — not to the base `read_sentence`. Before this slice
   the pack had one mode, so `resolveEvalModes` short-circuited
   (`modes.length < 2` → mixed) and this path had never executed.
2. **The routing is `explicit`, not the intent fallback.** The generator logged
   `modes: 'sight_phrase_sentence (explicit)'`, meaning the pin arrived from the
   post-manifest lesson resolver (`resolveLessonEvalModes`) rather than from
   `resolveEvalModes`' own intent micro-call. That is the production path, so it
   is the one worth verifying — the intent micro-call is the fallback beneath it.
3. **The pool assertion holds through the real pipeline**, not just the pinned
   harness: all four sentences are from the sight-heavy pool.
