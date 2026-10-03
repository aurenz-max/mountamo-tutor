# Eval Report: addition-fact-strategies — 2026-10-03 (L1, per mode)

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| plus_zero | PASS | AF-1 closed |
| plus_one | PASS | AF-1 closed |
| doubles | PASS | AF-1 closed |
| turnaround | PASS | AF-1 closed |
| plus_two | PASS | AF-1 closed |
| big_facts | PASS | AF-1 closed |

Content is correct in every run (9 runs: each mode on the conflicting topic "Addition within 20", big_facts on "Facts with 5 and 6" and "Facts with 3 and 4", doubles on "Adding zero"):
the mode always wins over the topic; big_facts picks the band from the topic (facts_mixed / facts_5_6 / facts_3_4);
sums correct, addends 0-9, no duplicates, no adjacent repeated pair, intro example never a session fact,
no fact in title/description, every turn-around knownFact is the flip. G1/G2/G4/G5 pass; G3 pass (each mode's
facts come from its own pool).

## Issues

### all modes — AF-1: challenge `type` does not match the catalog's `challengeTypes` — CLOSED 2026-10-03
- **Severity:** HIGH
- **What's broken:** the catalog declares each mode's challengeTypes as strategy values (`doubles`, `facts_5_6`, …), but every generated challenge carries `type: 'recall'`, so `/api/lumina/eval-test` validation rejects every mode ("Found disallowed types [recall]"). The mode's identity is not on the challenge, so any consumer keyed on challenge type (validation, per-type phase summaries) cannot tell the modes apart.
- **Data:** `evalMode=doubles` → `strategy: "doubles"`, `challenges[*].type: "recall"`, allowed `[doubles]`
- **Fix in:** GENERATOR + COMPONENT — stamp `challenge.type = strategy` (widen `AdditionFactChallenge.type` to `AdditionFactStrategy`), or move the catalog challengeTypes to `['recall']` and keep strategy at session level. The first keeps the six modes distinguishable.

- **Closed:** the concurrent session stamps `challenge.type = strategy` (type widened to `AdditionFactStrategy`; generator, smaller_fact builder, fixtures, W1 payloads). Re-run here on the live route: all 6 modes `pass`, `typesFound` = the mode's strategy (big_facts → `facts_mixed` on a mixed topic), counts 8/8/8/8/8/10, sums correct.
