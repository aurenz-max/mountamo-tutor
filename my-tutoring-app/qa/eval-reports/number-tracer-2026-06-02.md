# Eval Report: number-tracer — 2026-06-02

Triggered by a live-session crash report: prompt "counting 1-10", sequence mode rendered
"What number is missing 1000, 1001, 1002, 1003….." stretched across the screen, and the
browser tab crashed on finish.

**Resolved 2026-06-02** via orchestrator + deterministic sequence service (see Notes).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| trace     | PASS | — |
| copy      | PASS | — |
| write     | PASS | — |
| sequence  | PASS | — (was FAIL: 3 issues, all resolved) |

## Notes — Fix (2026-06-02)

**Root cause (architectural):** all three issues lived exclusively in `sequence` mode, and
all three traced to one decision — embedding a *counting* task (a bounded run of consecutive
integers with one blank) inside the shared *handwriting* schema and letting Flash-Lite emit
the `sequenceNumbers` array. A counting sequence's structure is pure arithmetic; the LLM can
only get it wrong.

**Fix:** split [gemini-number-tracer.ts](../../src/components/lumina/service/math/gemini-number-tracer.ts)
into an orchestrator + two sub-generators (SP-3 pattern, per tape-diagram / sorting-station):

- **`generateHandwriting`** (trace/copy/write) — clean 4-field schema; `sequenceNumbers` /
  `missingIndex` removed entirely. The simple handwriting primitive, back to bounded scalars.
- **`generateSequence`** — a *minimal* LLM call picks ONLY a scope-bound numeric window
  (`rangeMin`/`rangeMax` + title), bound by `buildScopePromptSection` ([scopeContext.ts](../../src/components/lumina/service/scopeContext.ts),
  the same service number-sequencer uses). `buildSequenceChallenges()` then builds the runs,
  blanks, answers, and hints **deterministically**. LLM picks the window; code builds the
  structure.

This replaces the report's proposed post-process guards with correctness *by construction*:

| Original issue | Severity | How it's now impossible |
|----------------|----------|--------------------------|
| Unbounded `sequenceNumbers` → tab OOM crash | CRITICAL | Code emits a fixed run length (4). Even a malformed LLM window is clamped to ≤ grade ceiling (≤20), so a runaway array cannot exist. Component also caps the render at 12 as belt-and-suspenders. |
| Scope bleed (topic "1-10" → values at 1000) | HIGH | Values are drawn from the clamped window, never raw LLM output. `scopeContext` narrows the window to the lesson range; the grade-ceiling clamp guarantees ≤20 regardless. |
| `digit` desyncs from `sequenceNumbers[missingIndex]` | HIGH | `digit = sequenceNumbers[missingIndex]` set in code — cannot disagree. |

**Verification (eval-test, 2026-06-02):** all 4 modes PASS. Sequence runs were length-4,
max value ≤8, `digit === sequenceNumbers[missingIndex]` on 5/5, instruction never names the
answer, missingIndex interior. Handwriting modes show correct `showArrows`/`showModel` per
type — no regression. `tsc --noEmit` clean for both changed files.
