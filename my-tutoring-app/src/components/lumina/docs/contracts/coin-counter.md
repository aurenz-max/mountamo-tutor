# Contract: coin-counter

- **Derived:** 2026-07-25 · evidence window: live census 2026-07-25 (`--census`), QA reports
  2026-04-04 → 2026-07-07, git log to `1c3e774`
- **Component:** `primitives/visual-primitives/math/CoinCounter.tsx` ·
  **Generator:** `service/math/gemini-coin-counter.ts` ·
  **Oracle:** `service/qa/oracles/coin-counter.ts` ·
  **Catalog:** `service/manifest/catalog/math.ts:3574`
- **Status:** ACTIVE (C1 RESOLVED 2026-07-25 via eval-mode split + band gate)

## Consumers (blast radius)

**7 eval modes**, not 6 — `identify` · `count-like` · `count-mixed` · `compare` · `make-amount` ·
`make-change` · `fewest-coins`. Two of them (`count-like` β1.5, `count-mixed` β2.5) collapse onto
the SAME component challenge type `'count'`, which is the single most important fact about
editing this primitive.

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| **G1 `MEAS001-07-c`** "Count collections of identical coins to determine the total value. Focus: **Skip counting and summation**… only single-denomination sets" → **`count-like`** | authored map [3] + live census [1] | `primitive-mappings/mathematics` is a 1-row map and this is the row; topic-trace routes `coin-counter` @ `targetEvalMode=count-like`, `difficulty=medium`, gradeLevel **Grade 1** | 2026-07-25 |
| **G2 `MEAS002-05-a`** mixed-coin totals under 100¢ → **`count-mixed`** | authored map + census | topic-trace routes `count-mixed`, `difficulty=medium` | 2026-07-25 |
| **G2 `MEAS002-05-b`** dollar-sign / decimal money notation | authored map | `target_primitive: coin-counter` | 2026-07-25 |
| **G2 `MEAS002-05-c`** build target amounts + make change → `make-amount` / `make-change` | authored map | `target_primitive: coin-counter` | 2026-07-25 |
| **K topic-driven money lessons** (NOT curriculum-routed — see G6) → `identify` + `count-like` | census [1] | K probe "counting pennies and nickels": both objectives routed `identify`(easy) → `count-like`(**hard**) | 2026-07-25 |
| Content oracle (CI) | code | `service/qa/oracles/coin-counter.ts` — re-derives every ¢ key independently | 2026-07-07 |

**Not consumers (checked):** `MEAS001-07-a` (coin appearance) and `MEAS001-07-b` (coin→value
matching) both target **`knowledge-check`**, not this primitive. `PRIMITIVE_GAPS.md` GAP-007 is
**stale on grade** — it files these under "MATHEMATICS (K)", but the lowercase `MEAS001-07-a/-c`
IDs live at **Grade 1**. The uppercase K `MEAS001-07-A…F` is an unrelated "Time Durations" skill
that merely shares the stem. A session trusting GAP-007's grade label will look for K money
content that does not exist.

**Channel [4] (calibration/real usage) UNAVAILABLE** — `/api/calibration/items` returns
`{"detail":"Not authenticated"}`. Item history for the β1.5/β2.5 modes was not readable this run;
treat "how many real attempts exist" as unknown, not zero.

## Requirements

### R1 — count keys derive from the displayed coins · OBSERVED
- **Property:** `correctTotal` equals Σ value(type)×count over `displayedCoins`; the generator
  never ships an LLM-authored total.
- **Demanded by:** every count consumer; the oracle enforces it as `answer-key-desync`.
- **Evidence:** `gemini-coin-counter.ts` `correctTotal: coinDefTotal(displayed)`; oracle
  `sumCoinDefs`; `qa/eval-reports/coin-counter-2026-07-07.md`.
- **Probe:** eval-test `count-like` + `count-mixed`, recompute every card. **Ran 2026-07-25 —
  18/18 cards across 3 runs, 0 desyncs.**

### R2 — `count-like` ships single-denomination sets ONLY · OBSERVED
- **Property:** every `count-like` card's `displayedCoins` contains exactly one `CoinType`.
- **Demanded by:** G1 `MEAS001-07-c` ("use only single-denomination sets for this level").
- **Evidence:** generator post-filter rejects multi-type sets when `targetEvalMode==='count-like'`;
  EVAL_TRACKER CC-4 (2026-04-04).
- **Probe:** eval-test `count-like`; assert `len(set(types))==1` per card. **Ran 2026-07-25 —
  6/6 @ K, 6/6 @ G1.**

### R3 — `count-mixed` is a TYPED total behind Check · OBSERVED
- **Property:** the Grade-2 mixed-coin task presents inert coins and takes the total as a typed
  number confirmed by Check. Mental skip-counting across denominations IS the assessed skill, so
  the coins must NOT become a tap-to-count aid.
- **Demanded by:** G2 `MEAS002-05-a`.
- **Evidence:** census 2026-07-25; catalog β2.5 vs count-like β1.5.
- **Probe:** render a `countMode:'mixed'` card at any band — number input + Check present, coins
  `disabled`. **Ran 2026-07-25 — jsdom `CoinCounter.reader-fit.test.tsx`, incl. the adversarial
  "mixed AT K" case.**

### R4 — `identify` never shows coin values · OBSERVED
- **Property:** in `identify` the ¢ label is hidden at every support tier — printing the value
  reveals the answer.
- **Evidence:** component passes `showValue={false}` (`:624`); generator forces
  `showCoinValues=false` for identify; `tierRevealClause` bars the tutor from naming the coin.
- **Probe:** eval-test `identify`; no `label` text rendered on option coins.

### R5 — count instructions must NOT enumerate the coins · OBSERVED
- **Property:** the instruction stays generic ("How much money is shown here?"). Naming coins in
  prose desyncs from `displayedCoins` and marks a correct student wrong.
- **Demanded by:** all count consumers. This is a REGRESSION THAT ALREADY HAPPENED.
- **Evidence:** `qa/eval-reports/coin-counter-2026-07-07.md`; generator "INSTRUCTION RULE (critical)".
- **Probe:** eval-test count modes; no card names a denomination + count in the instruction.

### R6 — no duplicate cards · OBSERVED
- **Property:** no two cards share a task signature (same coin set / amount / pair).
- **Evidence:** `challengeSignature` dedup mirroring the oracle's `clustering` key.

### R7 — `make-amount` targets must be reachable · OBSERVED
- **Property:** `targetAmount` is constructible from `availableCoins` (unlimited supply), else the
  student can never satisfy `placedSum === target`.
- **Evidence:** oracle DP `isReachable`.

### R8 — support tiers withdraw scaffolds, never magnitude · OBSERVED
- **Property:** `hard` hides `showCoinValues` (and `showRunningTotal` for make-amount); tiers change
  scaffolding + structure only, never the ¢ range.
- **Evidence:** `resolveSupportStructure` + `TIER_GUARDRAIL`; memory
  `[[support-tiers-natural-levers]]`.

### R9 — K `count-like` ENACTS the count · OBSERVED (NEW 2026-07-25)
- **Property:** at `gradeBand==='K'` AND `countMode==='like'`, the coins are the answer surface:
  each coin is tappable, a tap stamps the running skip-count total (5 → 10 → 15) in tap order,
  the deck auto-judges when every coin is counted exactly once, and there is NO number input and
  NO Check button. Re-tapping a counted coin is a rejected double-count (shake on the object) that
  does not advance the total.
- **Demanded by:** the K topic-driven consumer + the systemic `direct-manipulation-first` ruling.
  Pre-fix this was compute-then-type over inert coins — the item-11/12 proxy shape.
- **Evidence:** `qa/reader-fit/coin-counter-task3-2026-07-25.md`; real-Chrome probe (3 mouse
  clicks → 5¢/10¢/15¢, double-tap held at 10¢, badges `["5","10","15"]`, 0 inputs, 0 Check).
- **Probe:** jsdom band suite (9 tests) + a real click in Chrome. **Both ran 2026-07-25.**

### R10 — the grade band gates the coin pool · OBSERVED **but the resolver is DEFECTIVE**
- **Property:** K sees penny/nickel/dime only; G1 adds quarter; G2+ adds half-dollar/dollar.
- **Evidence:** `gradeCoinPool` / `gradeCoinsPrompt`.
- **DEFECT (see G2):** `resolveGradeBand` parses the grade out of `ctx.gradeContext` PROSE, which
  `GenerationContext` explicitly forbids ("NEVER parse grade out of `gradeContext` prose"). In
  production `elementary` prose covers grades 1–5, so **Grades 2 and 3 can never reach bands
  '2'/'3'** — the G2 consumers silently run as Grade 1. Verified: eval-test at "Grade 2" returned
  `gradeBand: "1"`. Worse, the test is `gl.includes('k')`, so ANY prose containing the letter k
  returns 'K' (`middle-school` prose → 'K', via "thinking").

## Conflicts

### C1 — R9 (K count-like enacted) vs R3 (count-mixed typed) — **RESOLVED 2026-07-25 via fork rung 1 (eval-mode split) + rung 2 (band gate)**
Both consumers are right. For G1's `count-like` the coins are a *manipulative for skip-counting*;
for G2's `count-mixed` mental summation across denominations IS the assessed skill and a
tap-to-count aid would ablate it. They collide because both render as challenge type `'count'`.

**Ruling — thread the eval mode, do NOT re-inspect `displayedCoins`.** The generator stamps
`countMode: 'like' | 'mixed'` from `targetEvalMode` at the point of origin, and the component forks
on that. Inspecting the coin set for "all one type" was rejected as a *heuristic with a real
false-positive path*: the generator rejects multi-type sets when count-like but has **no converse
rule** rejecting single-type sets when count-mixed, so a G2 mixed card that happened to draw three
dimes would silently flip into K's enacted mode — ablating a live Grade-2 consumer by accident.
`[[value-origin-not-code-touch]]`: classify by where the value ORIGINATES.

The K enacted path additionally requires `gradeBand==='K'`, so the Grade-1 `count-like` consumer
(`MEAS001-07-c`) is untouched. Both guards are independently tested.

## Gap requirements (close matches — the improvement queue)

### G1 — Grade-1 `count-like` is still a compute-then-type proxy · OPEN (**highest-value gap**)
- **Near-consumer:** G1 `MEAS001-07-c` — the PRIMARY, curriculum-routed consumer of count-like
  (census 2026-07-25: routed at Grade 1, `difficulty=medium`).
- **Shortfall:** the subskill's stated focus is "**Skip counting and summation**", and at Grade 1
  the coins are still inert with the total typed into a number field. The enacted fix shipped at
  K only, because the task scoped it to K and Grade 1 is a live consumer with β1.5 item history —
  widening it is a pedagogical call, not a rider on a K fix.
- **Path:** band-gate widening (fork rung 2) → `/reader-fit --fix` + `/eval-test`. One-line change
  to the `isEnactedCount` predicate; the render path already exists and is tested.
- **Relation to R-series:** would supersede part of R3's sibling behavior at G1 ONLY; no conflict
  with R3 itself (count-mixed stays typed at every band).

### G2 — grade resolution parses prose; Grades 2–3 are unreachable · OPEN
- **Near-consumer:** G2 `MEAS002-05-a/-b/-c` — three authored consumers that never see band '2'.
- **Shortfall:** R10's defect. `resolveGradeBand(ctx.gradeContext)` must read `ctx.grade` (the
  canonical curriculum grade the boundary already normalizes) and fall back to prose only when
  absent. Consequence today: G2 money lessons get the Grade-1 coin pool (no half-dollar/dollar)
  and an on-screen "Grade 1" badge.
- **Path:** generator fix → `/topic-fidelity` + `/eval-test`. **Deliberately NOT folded into the
  Task-3 slice** — it changes content for three live G2 consumers and deserves its own verification.
- **Relation to R-series:** repairs R10. Does not affect R9 (verified: `elementary` prose contains
  no "k", so K's gate cannot misfire at G1 — checked empirically, not assumed).

### G3 — K chrome is not band-gated · OPEN
- **Near-consumer:** the K topic-driven consumer.
- **Shortfall:** the 2026-07-25 pixel check shows a "Kindergarten" grade badge, a "1/2" challenge
  counter, and a "🔢 Count" phase badge on the K screen — the same adult-chrome class
  comparison-builder band-gated away at K in #2b. Also: the instruction is English prose with no
  🔊 read-aloud, so a pre-reader cannot read the task.
- **Path:** band gate in the component + `ReadMeButton` (both patterns already exist) →
  `/reader-fit --fix`.
- **Relation to R-series:** none — additive.

### G4 — a single-coin `count-like` card prints its own answer · OPEN (narrow)
- **Near-consumer:** any count-like consumer.
- **Shortfall:** `showCoinValues` is a legitimate aid for a SET (see the ruling below), but when a
  card displays exactly ONE coin the printed label ("10¢") **is** `correctTotal` — a literal
  rule-#1 leak. Reachable: the schema requires two coin slots, but `collectCoinDefs` drops a slot
  whose count is 0, so a single-coin card can ship. Not observed in the 12 cards drawn this run.
- **Path:** generator post-filter rejecting count-like cards with total coin count < 2 (one line,
  mirrors the existing single-type filter) → `/oracle-test`.

### G5 — the count fallback is a MIXED set · OPEN (narrow)
- **Shortfall:** `FALLBACKS.count` is `penny×3 + nickel×1`. If count-like generation fails
  entirely, the fallback violates R2 and carries no `countMode`, so K silently degrades to the
  typed path.
- **Path:** mode-aware fallback in the generator.

### G6 — the catalog claims a K band the curriculum does not have · OPEN
- **Shortfall:** `constraints` says "K-1: identify coins and count like coins only", but there is
  **no K money subskill anywhere in the curriculum** — the whole money strand is G1 `MEAS001-07`
  + G2 `MEAS002-05` (verified across K/1/2/3 Mathematics). K reaches this primitive only through
  topic-driven lessons. The claim is not false (K routing works, and is now band-gated properly),
  but it advertises a curriculum home that does not exist.
- **Path:** either a catalog projection that says so honestly, or K money curriculum authoring —
  a `/curriculum-author` call, not a primitive change.

## Rulings recorded (2026-07-25)

**`showCoinValues` default-true on LIKE coins = a LEGITIMATE RECOGNITION AID, not a rule-#1 leak.**
The count-like objective is *skip counting and summation*; the denomination is the skip-count
INTERVAL, i.e. an INPUT to the task, not its answer. Coin-value recall is a different subskill
(`MEAS001-07-b`, routed to knowledge-check), so this mode is not assessing "what is a nickel
worth". The total — the actual answer — is never printed. Contrast the leaks that WERE fixed:
comparison-builder printed "Left: 3 / Right: 5" (the answer), and `identify` already hides values
because there the value IS the answer (R4). Nor does it collapse into read-and-multiply at K/G1,
where multiplication isn't available — the label supports the intended skip-count strategy rather
than bypassing it. The `hard` support tier already withdraws the labels for consumers who want
denomination recall under load, and the K census actually routed count-like at `difficulty=hard`,
so that label-free variant is live; the enacted path renders correctly either way (the running
total teaches the interval by demonstration). **Kept default-true.** Sole exception → G4.

## Catalog projection

- **description:** faithful as of 2026-07-25, with one caveat — it says "drag coins to make target
  amounts"; make-amount is TAP-to-add, not drag. Minor prose fix, no routing impact.
- **constraints:** current "Best for grades K-3. K-1: identify coins and count like coins only.
  Grades 2-3: mixed counting, make-amount, compare, and make-change." — **misleading on K** (G6).
  Proposed: keep the K-1/2-3 split (it correctly steers `count-mixed` away from K) and note that
  K coverage is topic-driven. NOT applied this run — catalog edits re-route lessons and this run's
  purpose was the fork, not projection.
- **evalModes:** `count-like` / `count-mixed` descriptions already discriminate well ("same coin
  type" vs "mixed coin sets"); no change needed.

## Changelog

- 2026-07-25 — derived (initial), `--census`. 10 requirements, 1 conflict (RESOLVED same run),
  6 gaps. Contract created during reader-fit Task 3; R9 is that task's product, C1 is its ruling.
- 2026-07-25 — `--check` after the Task-3 edit: **COMPATIBLE**
  (`qa/primitive-contracts/coin-counter-check-2026-07-25.md`).
