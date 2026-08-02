# Topic Trace: "Count collections of identical coins to determine the total value" (Grade 1) — 2026-08-01

Published subskill: `MEAS001-07-c` (target primitive: `coin-counter`).
Scope intended by the subskill: skip-count and sum single-denomination coin sets.
Part of the 2026-08-01 EMERGING demand census.

## Components

| Component | In scope? | Generated evidence / issue | Broken link | Fix target |
|---|---:|---|---|---|
| concept-card-grid | yes | penny/nickel/dime/quarter values and skip-count intervals | — | — |
| coin-counter (`identify`) | yes | Grade-1 coin identification | — | — |
| hundreds-chart (`highlight_sequence`) | partial | Grade-2 stamp; one by-2 challenge injected into the requested nickel/dime 5/10 focus | GENERATOR | hundreds-chart G1 item |
| coin-counter (`count-like`) | **reader-fit fail** | `gradeBand: 1`, `countMode: like`, but `showRunningTotal: false`; Grade 1 still uses the compute-then-type proxy | COMPONENT / band+mode | existing 14b |
| annotated-example | **no** | requested 6 nickels = 30c; generated 4x5 = 20 dimes = 200c using multiplication | GENERATOR | annotated-example scope/grade |
| knowledge-check (`recall|apply`) | yes | small identical-coin totals through 30c | — | EMERGING knowledge-check audit |

## Scope drops

### annotated-example — replaces six nickels with a 20-dime multiplication problem

- **Chain:** objective "count a collection of identical coins" -> intent pins six nickels and skip counting to 30 -> data chooses 4 rows x 5 dimes, asks multiplication, then totals 200 cents.
- **Broken link:** GENERATOR.
- **Fix target:** annotated-example problem author/solver; pin the manifest's worked example and Grade-1 operation ceiling.

## Reader-fit signal

The real Grade-1 consumer confirms backlog 14b directly. The manifest even asks for tap-each-coin running totals, but `count-like` data stamps `showRunningTotal: false`; the component's Grade-1 branch remains inert coins plus typed number and Check.
