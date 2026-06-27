# Eval Report: number-tracer — 2026-06-27

Context: first generator migrated to the harmonized `GenerationContext` contract
(PRD_GENERATION_CONTEXT_HARMONIZATION). This run validates the migration is
behavior-preserving and that intent/scope/support-tier thread through the new
`resolveGenerationContext` boundary (the production path, not the eval-test shortcut).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| trace     | PASS   | —      |
| copy      | PASS   | —      |
| write     | PASS   | —      |
| sequence  | PASS   | —      |

## Contract checks (the point of this PR)

- **Behavior-preserving:** all 4 modes generate valid in-scope challenges via the
  registry → `registerContextGenerator` → `resolveGenerationContext` path.
  sequence digit == `sequenceNumbers[missingIndex]` in every case (no desync).
- **Axis 3 (support tier) centralized:** trace `difficulty=easy` → ghost/arrows/dot
  all `true`; `difficulty=hard` → all `false`; `supportTier` stamped. Null-tier
  baseline → scaffold fields `undefined`, `supportTier` undefined (byte-identical
  no-op, PRD invariant #3).
- **Axis 1 (scope) threads:** topic "Counting to 5" / sequence → max value 5, no breach.
- **Intent threads (the new guarantee):** fixed topic "Numbers", varied intent —
  write mode: "0 to 3" → digits [0,0,1,2,3]; "10 to 20" → [10,12,15,18,20].
  sequence: "Count within 5" → ranges 1–5; "Count from 10 to 20" → ranges 10–17.
  Intent now reaches the generator on the production resolver, not just via the
  eval-test `&intent=` shortcut.

All modes pass; no CRITICAL/HIGH issues.
