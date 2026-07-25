# `/primitive-contract coin-counter --check` — 2026-07-25

**Edit under guard:** reader-fit Task 3 — K `count-like` enacted count (band+mode fork).
**Contract:** `src/components/lumina/docs/contracts/coin-counter.md` (derived same session).
**Verdict: COMPATIBLE.**

## What the edit serves

The K topic-driven `count-like` consumer (R9). Its own verification is the Verification Doctrine
run in `qa/reader-fit/coin-counter-task3-2026-07-25.md` — not repeated here.

## Probes run for OTHER consumers

Every OBSERVED requirement whose consumer is NOT the one the edit serves:

| Req | Consumer | Probe | Result |
|---|---|---|---|
| R1 | all count consumers | eval-test `count-like` @K, `count-like` @G1, `count-mixed` @G2 — recompute every key | **PASS** 18/18 cards, 0 desyncs |
| R2 | G1 `MEAS001-07-c` | eval-test `count-like`, assert one denomination per card | **PASS** 6/6 @K, 6/6 @G1 |
| R3 | **G2 `MEAS002-05-a`** | render `countMode:'mixed'` — number input + Check present, coins `disabled`. Run at **K** as well, the adversarial case | **PASS** — jsdom "count-mixed is unchanged EVEN AT K"; eval-test @G2 stamps all 6 cards `mixed` |
| R4 | identify consumers | untouched code path | **PASS** — `renderIdentifyChallenge` byte-identical (0 deletions in diff) |
| R5 | all count consumers | eval-test count modes — no instruction enumerates coins | **PASS** 12/12 count cards generic |
| R6 | all | dedup untouched | **PASS** — no duplicate signature in any run |
| R7 | G2 `MEAS002-05-c` | make-amount path untouched | **PASS** — no code change reaches it |
| R8 | tier consumers | `showCoinValues` still honored in the enacted path | **PASS** — the fork passes `showValue={showCoinValues}` through, so `hard` still hides labels (and K routes `hard` per census) |
| R10 | G1/G2 band consumers | eval-test at each band, read back `gradeBand` | **PASS for the edit** — `Kindergarten`→`K`, `elementary`→`1`. Pre-existing defect recorded as G2, NOT introduced here |

## Why the Grade-1 consumer cannot be caught by the K fork

`MEAS001-07-c` is the primary curriculum consumer and it routes at **Grade 1**, so it must keep the
typed path. Two independent guards, both tested:

1. `gradeBand === 'K'` — production prose for grades 1–5 is the `elementary` string, which
   contains no "k", so `resolveGradeBand` returns `'1'`. **Checked empirically** against the real
   `getGradeLevelContext` table rather than assumed, because the resolver is a prose parse
   (`gl.includes('k')`) that returns 'K' for any string containing the letter — `middle-school`
   prose does exactly that via "thinking". Coin-counter is never routed above Grade 3, so the
   misfire is unreachable for this primitive; it is recorded as gap G2.
2. `countMode === 'like'` — count-mixed is stamped `'mixed'` at the origin, so even a mis-resolved
   band cannot enact a Grade-2 card.

Non-vacuity of guard 2 was proved by deleting it: the "count-mixed at K" and "unstamped card"
tests both fail immediately (2 failures), i.e. the guard is load-bearing, not decorative.

## Structural evidence

`git diff --stat` for the slice: **160 insertions, 0 deletions.** Nothing in the existing
`renderCountChallenge` typed path, the Check-button predicate, or any other mode's render was
removed or rewritten — the fork is a new branch in front of an untouched path. That is the
cheapest possible proof of non-ablation for a shared-render-path edit.

## Conflict handling

C1 (K enacted vs G2 typed) was a **pre-detected conflict**: both consumers are right for their own
skill. Resolved down the fork ladder at rung 1 (eval-mode split, via the `countMode` stamp) plus
rung 2 (band gate) — not by relaxing R3. Ruling written into the contract.

## Follow-ups opened (not fixed here — each names its executor)

- **G1** Grade-1 `count-like` still a proxy → `/reader-fit --fix` (the highest-value gap)
- **G2** grade resolution parses prose; G2/G3 unreachable → `/topic-fidelity`
- **G3** K chrome + read-aloud not band-gated → `/reader-fit --fix`
- **G4** single-coin count-like prints its own answer → `/oracle-test`
- **G5** count fallback is a mixed set → generator fix
- **G6** catalog claims a K band the curriculum lacks → `/curriculum-author` or projection
