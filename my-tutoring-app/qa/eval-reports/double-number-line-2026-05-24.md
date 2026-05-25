# Eval Report: double-number-line — 2026-05-24

## Results

| Eval Mode          | Status | Issues |
|--------------------|--------|--------|
| equivalent_ratios  | PASS   | —      |
| find_missing       | FAIL   | 1      |
| unit_rate          | PASS   | —      |

## Issues

### find_missing — contextQuestion leaks unit rate
- **Severity:** HIGH
- **What's broken:** The umbrella `contextQuestion` verbally states the unit rate ("1 can of paint covers 5 feet of wood", "Every 1 packet of flower seeds grows 5 beautiful flowers") in every sampled generation. In `find_missing` mode the student is supposed to derive the rate from the labeled non-unit given pair (e.g., `2 → 10`); having the rate spelled out in the umbrella defeats that skill. Reproduced in 2 of 2 samples — the schema's example (`'1 cup of flour makes 3 cookies'`) trains Gemini to follow the same `"1 X = N Y"` pattern regardless of `challengeType`. `equivalent_ratios` and `unit_rate` were sampled and behave correctly (`equivalent_ratios` is supposed to state the rate; `unit_rate` correctly avoids it).
- **Data:** `contextQuestion = "1 can of paint covers 5 feet of wood. Use this rate to find the missing lengths..."`, `unitRate = 5`, `givenPoints[1] = {topValue: 2, bottomValue: 10, label: "Given"}`
- **Fix in:** GENERATOR (tighten the `contextQuestion` schema description and prompt so it explicitly forbids stating the unit rate when `challengeType ∈ {find_missing, unit_rate}` — only `equivalent_ratios` should state it)
