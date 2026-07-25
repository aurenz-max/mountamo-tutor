# Handoff — reader-fit Task 3: coin-counter `count-like` @ K

**Created:** 2026-07-25 by `/pm` reconcile. **Stream:** Reader-fit K queue (ACTIVE, TOP PRIORITY,
5 days idle). **Queue:** `qa/reader-fit/BACKLOG.md` systemic direct-manipulation item.
**Supersedes:** `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md` Task 3 — that prompt was
written blind ("likely not a fix"); this one carries the actual source read.

## Why this item matters

This is the **last un-swept candidate** from the 2026-07-16 direct-manipulation census (~60 math
primitives). Tasks 1 (ten-frame item 12) and 2 (counting-board item 13) both closed as real fixes.
Closing this one **drains the demand-side K queue** and triggers the stream milestone: re-run the
topic-trace census at grade 1 (EMERGING) to re-seed the band.

## What the 07-16 prompt got wrong (read before pasting)

The original Task 3 said "read `CoinCounter.tsx`'s K `count-like` interaction." A session doing
that literally finds **nothing** — there is no `count-like` in the component. The naming splits
across two layers:

- **Catalog eval mode** `count-like` (β1.5) — `catalog/math.ts:3613` — maps to
  `challengeTypes: ['count']`.
- **Component challenge type** `'count'` — `CoinCounter.tsx:39`. `count-like` (β1.5) AND
  `count-mixed` (β2.5) BOTH resolve to this single type.

**Fork-design consequence:** the component cannot tell count-like from count-mixed by
`challenge.type`. Distinguishing them means either inspecting `displayedCoins` (all one
`CoinType` = "like") or threading the eval mode through. Decide this deliberately — it's the
main design question in the task.

## The read (already done — confirm, don't re-derive)

**Verdict indicated: PROXY, and a stronger one than Task 1's ten-frame.**

| Finding | Evidence |
|---|---|
| The coins are **inert** — not tappable at all | `renderCountChallenge` (`CoinCounter.tsx:632`) renders via `renderCoinGroup`, which emits `<CoinVisual ... disabled showValue={showCoinValues} />` (`:599`). No `onClick` is passed. Contrast `renderIdentifyChallenge` (`:606`) and `renderMakeAmountChallenge` (`:656`), which DO pass `onClick`. |
| The answer is a **typed number** | `LuminaInput type="number" inputMode="numeric"` bound to `countInput` (`:640`). At K this asks a pre-reader to key digits into a text field. |
| A **Check button** gates submission | `:928` `handleCheckAnswer`, disabled unless `countInput` is non-empty (`:931`). |
| **No band fork exists anywhere** | `gradeBand` (`:72`, default `'1'` at `:224`) is used at exactly two places, both cosmetic labels: `:321` `gradeLevel` for the tutor and `:844` the on-screen badge. There is no `isK` anywhere in the file. |

So the K `count-like` interaction is: look at disabled coins → compute the total in your head →
type the digits. Nothing is enacted. This is the item-11 / item-12 shape, not a clear.

**Open question for the auditor (do NOT assume):** `showCoinValues` defaults `true` (`:77`), so
each coin renders its ¢ label. For *like* coins is that a legitimate recognition aid (the skill is
skip-counting by 1s/5s/10s) or does printing "10¢" on each of 3 dimes turn counting into
read-and-multiply? Rule #1 calls this either way — make an explicit ruling and record it.

## Contract-first — REQUIRED before any edit

**There is no `docs/contracts/coin-counter.md`.** Blast radius is real: 6 eval modes spanning K–3,
and `count-mixed` / `compare` / `make-amount` / `make-change` are Grade 2–3 skills that ride the
same component. An unguarded K edit to `renderCountChallenge` hits `count-mixed` too — they share
the render path.

Run `/primitive-contract coin-counter --census` FIRST, then `--check` on the finished edit.

---

## Paste this

> **Reader-fit Task 3 — coin-counter `count-like` @ K.** Close the last gap from the 2026-07-16
> direct-manipulation census. Read `qa/HANDOFF-reader-fit-coin-counter-2026-07-25.md` first — it
> carries a completed source read with line-exact pointers, and corrects the 07-16 prompt's naming
> error (`count-like` is a CATALOG eval mode; the component challenge type is `'count'`, shared with
> `count-mixed`).
>
> **Step 1 — confirm the verdict (fast, pointers are exact).** In
> `primitives/visual-primitives/math/CoinCounter.tsx`: `renderCountChallenge` (:632) renders coins
> through `renderCoinGroup` → `<CoinVisual disabled />` (:599, no `onClick`), and the answer is a
> typed `LuminaInput type="number"` (:640) behind a Check button (:928/:931). `gradeBand` is used
> only for cosmetic labels (:321, :844) — there is no `isK` fork in the file. If that holds, the K
> interaction is a PROXY (compute-then-type over an inert coin set): record CLEARED=false and
> proceed. If you find it enacts, record CLEARED and stop — no source edit.
>
> **Step 2 — contract FIRST.** There is no `docs/contracts/coin-counter.md` and the component spans
> 6 eval modes K–3. Run `/primitive-contract coin-counter --census` before editing. `count-mixed`
> (β2.5), `compare`, `make-amount`, `make-change` are Grade 2–3 and share `renderCountChallenge` —
> they must not be ablated. Fork by **band + mode**, the item-12 ten-frame template.
>
> **Step 3 — the fix direction (item-11/12 template).** At K only: make the coins the answer
> surface. Tap each coin to count it (running enacted count, ordinal badges in tap order like
> addition-subtraction-scene's `solve_story` aid), auto-judge on the enacted total, drop the number
> input and the Check button at K. Grade 1+ keeps the input + Check exactly as-is. Resolve the
> count-like vs count-mixed split deliberately — the component can't distinguish them by
> `challenge.type`, so either inspect `displayedCoins` for a single `CoinType` or thread the eval
> mode through; say which you chose and why.
>
> **Also rule on this explicitly:** `showCoinValues` defaults true, printing "1¢/5¢/10¢" on every
> coin. For like coins, decide whether that's a legitimate recognition aid or a rule-#1 leak that
> converts counting into read-and-multiply. Record the ruling either way.
>
> **Verify per doctrine — tsc is not verification.** `cd "<abs>/my-tutoring-app" &&
> ./node_modules/.bin/tsc --noEmit` (0 new vs baseline) + `npm run typecheck:lumina` 0 + jsdom band
> tests (coins tappable @ K / input+Check absent @ K / present at grade 1 control / count-mixed
> unchanged) + `/eval-test coin-counter` @ K + `/primitive-contract coin-counter --check`
> COMPATIBLE. **SVG/click caveat:** if the coin hit area turns out to be an SVG `<g>`, jsdom is
> blind to it — verify a real click in Chrome (memory `svg-g-unclickable-jsdom-blind`).
>
> **Close in the same slice:** the reader-fit BACKLOG systemic direct-manipulation entry (record the
> verdict + the two rulings), `WORKSTREAMS.md` stream 1 "Now" + last-touched, a pixel/real-click row
> in `qa/HUMAN-CHECKS.md` (next free ID **50**), and a report at
> `qa/reader-fit/coin-counter-task3-2026-07-25.md`. Then note the milestone: with Task 3 closed the
> demand-side K queue is DRAINED — the next stream move is re-running the topic-trace census at
> grade 1 (EMERGING) to re-seed the band.

---

## Scope guards

- **Out of band — do not touch:** `make-amount` / `make-change` / `compare` (Grade 2–3), and
  `count-mixed` beyond leaving it byte-identical.
- **`identify` @ K is already fine** — naming a coin is LEGIT-ABSTRACTION, not a proxy, and it
  already passes `onClick` (`:617`). Don't "improve" it.
- **No generator work unless the audit demands it.** If the ruling is that K `count-like` must
  guarantee same-type coin sets and the generator doesn't enforce it, that's a SEPARATE queued item
  — name it, don't fold it in.
