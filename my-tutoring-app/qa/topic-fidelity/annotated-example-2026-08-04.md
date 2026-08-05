# Topic Fidelity: annotated-example — 2026-08-04

Scope intended: exact Grade-1 scenario and operation identity for six nickels,
5-cent skip-counting, and a 30-cent target.

| Probe | Topic / intent | Result | Verdict |
|---|---|---|---|
| before ×3 | identical-coin total / exact six-nickel intent | author and/or hydration dropped the 30-cent anchor or introduced `6 × 5` | FIDELITY BUG |
| exact after | same fixed input | six nickels, 5-cent increments, 30 cents; byte-faithful echo; no replacement operation | HONORED |
| oracle after ×3 | same fixed input | 3/3 final payloads clean; 0 generation failures/violations | RELIABLE |
| exact control | `108, 109, ?, 111` | exact statement retained; answer 110 | HONORED |
| advanced control | area between `y=x²` and `y=x` | graph/algebra/calculus legal; answer `1/6` | NO REGRESSION |
| generic control | Grade-1 counting without concrete anchors | representative scenario accepted with one authoring call | VARIATION PRESERVED |

**Verdict:** FIDELITY BUG → fixed with structured intent/grade wiring,
post-authoring validation, bounded repair, and final-payload enforcement. No Tier-2
scope-resolver call was added; repair calls occur only after a rejected generation.

**Mechanism:** generic prose-only steering at the authoring boundary plus dropped
canonical grade; runtime also proved independent post-authoring operation drift.

**Verification:** focused 227/227; full Vitest 1,542/1,542; real final oracle 3/3.
Lumina typecheck has 0 new 14j errors and remains blocked by two unrelated
`gemini-story-map.ts` baseline errors.
