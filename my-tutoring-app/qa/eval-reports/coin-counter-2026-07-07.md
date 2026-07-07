# coin-counter — Oracle-Fix Report (2026-07-07)

**Source:** `/oracle-test` · **Severity:** HIGH — instruction↔data desync + duplicate cards (`count` modes).

## The bug

The `count` prompt encouraged enumerating coins in the instruction ("e.g., 2 dimes
+ 3 pennies"), but the free-text instruction drifts from the structured
`displayedCoin*` fields. Live examples:
- instruction "1 dime, **2 nickels, and 4 pennies**" but `displayedCoins` =
  dime:1 + nickel:2 (pennies dropped), `correctTotal` = 20¢.
- instruction "2 dimes, 1 nickel, **and 2 pennies** … too much!" but data =
  dime:2 + nickel:1 = 25¢.

`correctTotal` is derived from the displayed coins, so a student who counts what
they **read** gets a different total than the key and is marked wrong. When the
dropped coins made a card's data identical to another card, the oracle also caught
it as a duplicate-card (`clustering`).

## The fix (GENERATOR — prompt + dedup)

`gemini-coin-counter.ts`:
1. **Prompt (count):** the instruction MUST be generic ("How much money is shown
   here?") and MUST NOT enumerate coins or counts — the on-screen coins are the
   only source of truth. Closes the desync channel: the instruction can't
   contradict the data if it doesn't restate it. Also asks for distinct coin sets.
2. **Post-process dedup:** a `challengeSignature(c)` (order-insensitive, per type —
   mirrors the oracle's duplicate-card key) filters byte-identical cards across the
   combined set before ID assignment. Applies to every type, so no mode ships a dup.

## Verification

| Mode | Before | After |
|------|--------|-------|
| count-mixed | FAIL — desync + dup cards | **PASS** — 0 / 31 |
| count-like | (dup risk) | **PASS** — 0 / 32 |
| identify | — | PASS — 0 / 22 (no dedup regression) |
| make-amount | — | PASS — 0 / 22 |
| make-change | — | PASS — 0 / 20 |

`typecheck:lumina` 0 errors · oracle unit suite 115/115.

## Newly surfaced (separate, NOT fixed here)

`compare` mode fails the oracle independently of this fix (unchanged by it):
- `clustering` — "5/5 answers are B": the compare answer isn't varied across the set.
- `scope` — a group totalling 105¢ exceeds a "to 100" objective (group totals
  aren't clamped to the topic ceiling).

Same classes as bugs fixed elsewhere (answer variety, content-in-scope) but a
different mode. Recommend a follow-up `/eval-fix coin-counter` targeting `compare`.
