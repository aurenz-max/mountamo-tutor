# Eval Report: number-line — 2026-06-27

Focus: verifying the topic+intent → number-range resolver (gemini-number-line.ts).
Previously the numeric range was driven solely by `config.numberRange`, which the
manifest never emits → all non-identify modes defaulted to 0–20 regardless of the
objective ("counting to 10" rendered a 0–20 line).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify  | PASS   | — |
| plot      | PASS   | — |
| jump      | PASS   | — |
| order     | PASS   | — |
| between   | PASS   | — |

## Topic-range verification (the change under test)

Topic="Counting to 10", intent="Visualize the order of numbers 1 to 10", grade=K:

| Mode    | Resolved range | All targets ≤ ceiling? |
|---------|----------------|------------------------|
| plot    | 0–10 | yes (max 6) |
| jump    | 0–10 | yes (max 10) |
| order   | 0–10 | yes (max 6) |
| between | 0–10 | yes (max 8) |

Discrimination controls (resolver is not just clamping everything to 10):

| Topic / grade | Resolved range | Verdict |
|---------------|----------------|---------|
| "Counting to 20" / K | 0–20 | reads explicit bound |
| "Counting to 5" / K  | 0–5  | scope wins (tighter than old default) |
| generic "Number line" / grade 3 | 0–20 | grade-band default |
| generic "Number line" / K (no bound) | 0–20 | grade-band default (= pre-change behavior) |

`identify` stays hardcoded 0–10 (unchanged path) — verified still 0–10.

## Notes
- No crashes, all modes return populated challenges with targets inside range.
- Null/absent-bound topics fall back to grade-band defaults → no regression for
  lessons whose topic carries no numeric ceiling.
- Cost: one extra flash-lite call per number-line render when `numberRange` is
  absent (always, since the manifest doesn't emit it).

All modes PASS. The "counting to 10 → 0–20" scope bug is resolved.
