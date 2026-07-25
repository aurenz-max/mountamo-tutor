# reader-fit Task 3 — coin-counter `count-like` @ K

**Date:** 2026-07-25 · **Verdict: PROXY — CLEARED = false. Fixed.**
**Handoff:** `qa/HANDOFF-reader-fit-coin-counter-2026-07-25.md`
**Contract:** `src/components/lumina/docs/contracts/coin-counter.md` (derived this session)
**Edit guard:** `qa/primitive-contracts/coin-counter-check-2026-07-25.md` — **COMPATIBLE**

This closes the last un-swept candidate from the 2026-07-16 direct-manipulation census.

---

## Step 1 — verdict confirmed

The handoff's line-exact read holds at every pointer:

| Claim | Confirmed |
|---|---|
| coins are inert | `renderCountChallenge` → `renderCoinGroup` → `<CoinVisual … disabled />` (`:599`), no `onClick` — while `renderIdentifyChallenge` (`:617`) and `renderMakeAmountChallenge` (`:674`) DO pass one |
| answer is typed | `LuminaInput type="number"` bound to `countInput` (`:640`) |
| Check gates it | `handleCheckAnswer` (`:928`), disabled unless `countInput` (`:931`) |
| no band fork anywhere | `gradeBand` used at exactly `:321` (tutor `gradeLevel`) and `:844` (badge) — both cosmetic; no `isK` in the file |

So the K interaction was: look at disabled coins → compute the total mentally → key digits into a
number field. Nothing about counting was enacted. **PROXY**, the item-11/12 shape.

**One handoff caveat did NOT apply.** `CoinVisual` renders a real HTML `<button>` (`:138`), not an
SVG `<g>` — so the `svg-g-unclickable-jsdom-blind` blindness does not affect this primitive and
jsdom is authoritative for its clicks. A real-Chrome check was run anyway (below), and it earned
its keep for reasons jsdom could not have surfaced.

---

## The finding that reframes this item: **`count-like` is a GRADE 1 skill, not a K one**

The `--census` was decisive, and it corrects a premise that both the 07-16 and 07-25 handoffs
inherited.

- The **only** authored consumer of coin-counter is **`MEAS001-07-c` @ Grade 1** — *"Count
  collections of identical coins to determine the total value. Focus: **Skip counting and
  summation**… use only single-denomination sets"*. That is `count-like`, verbatim.
- Live routing agrees: topic-tracing that subskill routes `coin-counter` at
  `targetEvalMode=count-like`, `difficulty=medium`, **Grade 1**.
- **There is no K money subskill anywhere in the curriculum.** The money strand is G1
  `MEAS001-07` + G2 `MEAS002-05`. The K `MEAS001-07-A…F` that shares the ID stem is an unrelated
  **"Time Durations"** skill.
- `PRIMITIVE_GAPS.md` GAP-007 files these subskills under "MATHEMATICS (K)" — **stale on grade**;
  the lowercase IDs it names live at Grade 1. That mislabel is the likely origin of the K framing.

**Is K reachable at all? Yes** — so the work was not vacuous. A K-graded topic-driven money lesson
("counting pennies and nickels") routes `coin-counter` on both objectives: `identify` (easy) then
`count-like` (**hard**). K reaches this primitive through topic-driven lessons, just not through a
curriculum subskill. The K fork is live code, not dead code.

**What I did with that.** I built exactly the K scope the task specified, and did **not**
unilaterally widen the fix to Grade 1. Grade 1 is a live consumer with β1.5 item history, and
changing its interaction is a pedagogical decision that deserves its own slice and its own
eval-test — not a rider on a K fix. It is filed as contract gap **G1** and queued, and it is the
highest-value follow-up this session produced.

---

## Step 2 — contract first

No contract existed. Derived one before editing (`--census`, all channels except calibration,
which returned `Not authenticated`). Two things it surfaced that changed the edit:

1. **7 eval modes, not 6** — `fewest-coins` also exists (β5.0, riding `make-amount`).
2. **The real blast radius is the shared `'count'` render path**, and the Grade-2 consumer
   `MEAS002-05-a` sits directly on it.

---

## The two rulings

### Ruling 1 — the count-like / count-mixed split: **thread the eval mode; do NOT inspect `displayedCoins`**

The component cannot tell the modes apart by `challenge.type` (both are `'count'`). Of the two
options, I chose threading the mode through, and the reason is not stylistic:

> The generator rejects multi-type sets when `count-like`, but has **no converse rule** rejecting
> single-type sets when `count-mixed`.

So "all one denomination ⇒ this is count-like" is a heuristic with a **real false-positive path**:
a Grade-2 `count-mixed` card that happened to draw three dimes would silently flip into K's
enacted mode and ablate a live consumer. The mode is only reliably knowable at its origin, so the
generator now stamps `countMode: 'like' | 'mixed'` from `targetEvalMode` and the component forks on
that — `[[value-origin-not-code-touch]]`, and the same Fork-A stamping pattern the DI packs use.

### Ruling 2 — `showCoinValues` on LIKE coins: **legitimate recognition aid, NOT a rule-#1 leak**

The count-like objective is *skip counting and summation*. The denomination is the skip-count
**interval** — an INPUT to the task, not its answer. Coin-value recall is a *different* subskill
(`MEAS001-07-b`, routed to knowledge-check), so this mode is not assessing "what is a nickel
worth". The answer — the total — is never printed.

Contrast the leaks that WERE fixed: comparison-builder printed "Left: 3 / Right: 5", i.e. the
answer itself; and `identify` already hides values because there the value IS the answer. Nor does
it degrade into read-and-multiply at K/G1, where multiplication isn't available — the label
supports the intended skip-count strategy rather than bypassing it. The `hard` support tier
already withdraws labels for consumers wanting denomination recall under load, and the K census
actually routes count-like at `difficulty=hard`, so that label-free variant is live; the enacted
path renders correctly either way, because the running total teaches the interval by
demonstration.

**Kept default-true.** One narrow exception found and queued (**G4**): if a count-like card ever
displays exactly ONE coin, the printed label *equals* `correctTotal` — a literal leak. The schema
requires two coin slots, but `collectCoinDefs` drops a slot whose count is 0, so it is reachable.
Not observed in the 12 count cards drawn this run. Per the handoff's scope guard, generator work
beyond the fix is a separate named item rather than folded in.

---

## Step 3 — the fix (band + mode fork)

At `gradeBand === 'K'` **and** `countMode === 'like'`, the coins become the answer surface:

- every coin is tappable; a tap stamps the **running skip-count total** (5 → 10 → 15) as a badge in
  tap order, and a large readout climbs with it, built from 0 — it never pre-states the answer;
- **auto-judges** when every coin has been counted exactly once — no Check button at K;
- re-tapping a counted coin is the classic K **double-count**: rejected, shakes the touched object
  (Audit-C rule 5, the comparison-builder 07-20 treatment), and does not advance the total. The
  enacted path is failable, not a walk-through;
- the badge carries the *running total* rather than a plain ordinal — for a skip-counting skill,
  "5, 10, 15" is the pedagogy in a way "1, 2, 3" is not.

**Grade 1+ and every `count-mixed` card keep the number input and Check exactly as before.**
`git diff --stat`: **160 insertions, 0 deletions** — the existing typed path was not touched.

Files: `CoinCounter.tsx` (fork + `countMode` on the challenge type),
`gemini-coin-counter.ts` (+5 lines, the stamp).

---

## Verification (per doctrine — tsc is not verification)

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | **0 new** — 803 pre-existing, **all** in the legacy graveyard (`components/tutoring`, `lib`, `practice`, …); **0 inside `components/lumina/`**, where every change lives |
| `npm run typecheck:lumina` | **0 errors** |
| jsdom band suite (new, 9 tests) | **9/9** — coins tappable @K, input+Check absent @K, running badges, auto-judge, double-count rejected, Grade-1 control, **count-mixed unchanged at K**, unstamped-card fallback, count-mixed still grades typed |
| **non-vacuity probe A** (disable the fork) | **4 K tests fail** — they are load-bearing |
| **non-vacuity probe B** (drop the `countMode` guard) | **2 guard tests fail** — the contract guard is real |
| full vitest | **930/930** (was 921 + the 9 new) |
| real-Gemini eval-test `count-like` @ K | **PASS 6/6** — all `countMode:"like"`, all single-denomination, all within the K pool (penny/nickel/dime), all keys recomputed correct, `gradeBand: "K"` |
| eval-test `count-like` @ Grade 1 | **PASS 6/6** — `gradeBand: "1"` → typed path retained |
| eval-test `count-mixed` @ Grade 2 | **PASS 6/6** — all stamped `mixed`, 0 desyncs |
| **real Chrome (playwright-core + Chrome, real mouse clicks)** | **PASS** — see below |
| `/primitive-contract --check` | **COMPATIBLE** |

### Real-browser probe

Driven on a temporary route (created, driven, deleted in-session), real mouse clicks:

```
kCoinCount 3 · kInputs 0 · kCheckButtons 0 · kTotalBefore "0¢"
click → "5¢"  ·  click → "10¢"  ·  double-tap same coin → "10¢" (held)  ·  click → "15¢"
kBadges ["5","10","15"] · kFeedback "You counted 15¢!" · kNextButton 1
kBadgePointerEvents "none" (badge cannot swallow a tap) · kFirstCoinBox 44×44 px
g1Inputs 1 · g1CheckButtons 1 · g1RunningTotal 0 · g1CoinsDisabled true · pageErrors []
```

**The pixel check earned its keep** — it surfaced two things jsdom cannot see, both filed as gaps
rather than fixed here (neither is caused by this edit):

- **G3** the K screen still shows adult chrome — a "Kindergarten" grade badge, a "1/2" challenge
  counter, a "🔢 Count" phase badge — the same class comparison-builder band-gated away at K in
  #2b; and the instruction is English prose with no 🔊 read-aloud, so a pre-reader cannot read the
  task. **The counting act is now K-appropriate; the framing around it is not yet.**
- Coin tap targets measure 44×44 px — at the accepted minimum, fine but worth a human eye at K.

---

## Follow-ups queued (each names its executor)

| Gap | What | Executor |
|---|---|---|
| **G1** | **Grade-1 `count-like` is still a proxy — the PRIMARY curriculum consumer** | `/reader-fit --fix` |
| G2 | grade resolution parses `gradeContext` prose (contract-forbidden); Grades 2–3 unreachable, so G2 money runs as Grade 1 | `/topic-fidelity` |
| G3 | K chrome band-gate + 🔊 read-aloud | `/reader-fit --fix` |
| G4 | single-coin count-like prints its own answer | `/oracle-test` |
| G5 | count fallback is a mixed set (violates R2, unstamped) | generator fix |
| G6 | catalog claims a K band the curriculum lacks | `/curriculum-author` or projection |

Human/pixel residual → **HUMAN-CHECKS #52**.

---

## Milestone

With Task 3 closed, the **demand-side K queue is DRAINED**. The next stream move is re-running the
topic-trace census at **grade 1 (EMERGING)** to re-seed the band — and this session hands that
census its first item already identified: **G1**, the Grade-1 `count-like` proxy.
