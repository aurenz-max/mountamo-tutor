# Topic Fidelity: hundreds-chart — 2026-06-27

First `/topic-fidelity` pass under the context-native generator API (PRD_GENERATION_CONTEXT_HARMONIZATION).

Scope/theme intended: the per-instance objective (`ctx.intent`) should bias the
skip-counting interval — e.g. "Skip count by 5s" → most challenges use skipValue 5
(grid is fixed 1–100 by design; the skip interval is the honorable lever).

| Probe | topic | intent | result (skipValues) | verdict |
|-------|-------|--------|---------------------|---------|
| intent-disc (before) | Skip counting on the hundreds chart | Skip count by 5s | `[2,5,10,2,5]` | BUG (ignored) |
| intent-disc (before) | Skip counting on the hundreds chart | Skip count by 10s | `[2,5,10,2,5]` | BUG (identical) |
| intent-disc (after) | Skip counting on the hundreds chart | Skip count by 5s | `[5,5,5,2,10]` / highlight `[5,5,5,5,5,10,2]` | HONORED |
| intent-disc (after) | Skip counting on the hundreds chart | Skip count by 10s | `[10,5,2,10,5]` | tracks |
| no-regression (after) | Skip counting practice | (none) | `[2,5,10,2,5]` | grade default (varied) |

**Verdict:** FIDELITY BUG → fixed at Tier 1.
**Mechanism:** dead field. The context-native migration delivers `ctx.intent` to the
registry boundary, but `generateHundredsChart` never interpolated it — the config type
declared `intent?` while the prompt used only `${topic}`. So the per-instance objective
was silently discarded (the post-migration analog of a "Category D dead thread").
**Change:** `gemini-hundreds-chart.ts` — read `ctx.intent`; add a PRIMARY OBJECTIVE
prompt section that biases skip choice toward a named in-pool interval (LLM decides from
prose, no regex per [[schema-over-regex-and-prompt]]); gated the "vary across the pool"
rule behind "unless the objective names a specific interval". Interval is never shown to
the student (instructions/hints stay generic) → no find_skip_value answer leak.
**tsc:** 1417 (baseline 1419).
</content>
