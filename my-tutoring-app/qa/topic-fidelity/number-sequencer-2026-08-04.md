# Topic Fidelity: number-sequencer — 2026-08-04

Scope intended: Grade-1 sequencing defaults to ≤100, may reach 120 only when
topic/intent requires it, and honors narrower bounds.

| Probe | Topic / intent | Runtime result | Verdict |
|---|---|---|---|
| honored ×3 | within 120 / values 101–120 | min 101, max 120 in every run | HONORED |
| discrimination ×3 | within 20 / values 1–20 | maxima 20, 20, 20 | tracks |
| no-regression ×3 | generic Grade-1 sequence practice | max 100 in every run | grade default |
| intent-only ×2 | fixed broad topic / values 101–120 | 101–120 and 107–120 | intent tracks |
| intent-only ×2 | fixed broad topic / values 1–20 | maxima 20 and 14 | intent tracks |
| exact census replay | `101, 102, _, 104` | five local 101–104 cards; answer 103 rendered | HONORED |

**Verdict:** FIDELITY BUG → fixed at Tier 2.

**Mechanism:** Prompt-only Tier 1 allowed 120 correctly but let generic practice
drift to 120 in 1/2 runs. A tiny structured resolver now distinguishes explicit
numeric scope from generic practice; code enforces its range and falls back to
1–100 on absent/failed resolution. It adds one Flash Lite call per Grade-1 render
only when `config.numberRange` is absent.

**Intent contract:** `ctx.intent` reaches both the resolver and main generator;
the fixed-topic discrimination probes prove it shapes student-facing values.

**No answer leak:** topic/intent guide the numeric window only; neither is rendered
as answer text, and correct answers remain derived from the visible sequence.

**Gates:** focused 24/24 · full Vitest 1406/1406 · Lumina typecheck 0 · full tsc
803 baseline before/after.
