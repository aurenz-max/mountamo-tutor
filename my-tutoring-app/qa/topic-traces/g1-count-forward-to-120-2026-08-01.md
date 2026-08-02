# Topic Trace: "Identify missing numbers when counting forward from a specific starting point within 120" (Grade 1) — 2026-08-01

Published subskill: `NBT001-01-a` (target primitive: `number-line`).
Scope intended by the subskill: count forward by ones from non-zero starts, including decade transitions and values through 120.
Part of the 2026-08-01 EMERGING demand census.

## Components

| Component | In scope? | Largest / off-scope issue | Broken link | Fix target |
|---|---:|---|---|---|
| number-sequencer (`count_from|before_after`) | partial | reaches 116, but leaks `fill-missing`, `decade-fill`, and `order-cards` outside the pinned blend | GENERATOR | eval-mode constraint |
| di-math-facts (`counting_next`) | **no** | generated values only through 12 for a 1–120 intent | GENERATOR | DI intent/scope fidelity |
| number-line (`between`) | **no** | defaults to values <= 38 and accepts any interior point, not the one missing adjacent number near 90–120 | GENERATOR | range + task binding |
| annotated-example | yes | exact 108, 109, ?, 111 worked example | — | — |
| hundreds-chart (`complete_sequence`) | **no** | switches to skip-counting by 2/5/10, ends at 100, stamps `gradeBand: 2` | GENERATOR | Grade-1 band + 120 capability |
| number-sequencer (`decade_fill`) | **no** | intent asks for 101, 102, _, 104; generator hard-stops at decade 100 | GENERATOR | intrinsic ceiling (currently Grade 1 -> 100) |
| knowledge-check (`mixed`) | yes | values through 115 and aligned next/missing-number questions | — | EMERGING knowledge-check audit |

## Scope drops

### di-math-facts — collapses a 1–120 task to early counting

- **Chain:** objective and intent both retain 1–120 -> data uses only 6, 7, 8, and 12-class values.
- **Broken link:** GENERATOR.
- **Fix target:** DI math-facts content generation, coordinated with the active DI workstream.

### hundreds-chart — substitutes a Grade-2 skip-count-to-100 activity

- **Chain:** objective says fill missing numbers while counting forward -> intent specifically targets 100–120 -> data says "skip-counting-by-2s/5s/10s ... to 100" and stamps Grade 2.
- **Broken link:** GENERATOR.
- **Fix target:** `gemini-hundreds-chart.ts`; it currently defaults `gradeBand` to `2`.

### number-sequencer — its Grade-1 contract cannot represent 101–120

- The generator prompt and sanitizer hard-code the Grade-1 ceiling to 100, so the real `NBT001-01-a` consumer cannot be served even when the intent carries 120.
- **Broken link:** GENERATOR capability/contract.

### number-line — loses both the high range and the exact-missing-number task

- **Chain:** intent requests a hidden point around 90–110 -> generated challenges use 19–38 and accept any number strictly between wide endpoints.
- **Broken link:** GENERATOR.
