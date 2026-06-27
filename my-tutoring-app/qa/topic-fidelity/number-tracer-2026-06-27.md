# Topic Fidelity: number-tracer — 2026-06-27

Scope/theme intended: student-facing digits & sequence runs stay within the
range the topic/intent implies; grade is the ceiling.

Context: first generator on the harmonized `GenerationContext` contract. Intent
now reaches the generator via the production `resolveGenerationContext` boundary
(`registerContextGenerator`), not just the eval-test `&intent=` shortcut — so this
probe tests the real contract, not a masked one.

| Probe | topic | intent | result (max value) | verdict |
|-------|-------|--------|--------------------|---------|
| honored        | Writing numbers 0 to 5 | Write the numbers | digits [0,1,2,3,5], max 5 | HONORED |
| honored (scope)| Counting to 5 (sequence) | — | runs 1–5, max 5 | HONORED |
| discrimination | Numbers (broad) | Write the numbers from 0 to 3 | [0,0,1,2,3], max 3 | tracks |
| discrimination | Numbers (broad) | Write two-digit numbers 10 to 20 | [10,12,15,18,20], max 20 | tracks |
| discrimination | Numbers (broad, sequence) | Count within 5 | runs 1–5, max 5 | tracks |
| discrimination | Numbers (broad, sequence) | Count from 10 to 20 | runs 10–17 | tracks |
| no-regression  | Number writing practice | Write a number | [4,9,12,15,20], max 20 | grade-1 default (0–20) |

**Verdict:** HONORED. Both topic and the per-component intent shape the output, and
a generic prompt falls back to the grade-band ceiling (no regression).

**Mechanism:** topic + intent reach the generator as `ctx.scope`, rendered by
`buildScopePromptSection` into the digit-selection and sequence-window prompts.
Intent is threaded by the registry boundary (`resolveGenerationContext`), so the
old "intent dropped at the registry handler" failure mode is structurally gone for
this generator.

**Change:** migration only — no fidelity fix needed. tsc: 1419 (baseline).
