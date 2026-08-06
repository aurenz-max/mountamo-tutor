# Contract: number-sequencer

- **Derived:** 2026-08-04 · evidence window: Grade-1 census 2026-08-01, eval reports 2026-03-15 through 2026-06-14, generator/component/oracle source
- **Component:** `primitives/visual-primitives/math/NumberSequencer.tsx` · **Generator:** `service/math/gemini-number-sequencer.ts` · **Catalog:** `service/manifest/catalog/math.ts`
- **Status:** VERIFIED — reader-fit 14h compatible 2026-08-04

Derived before widening the Grade-1 ceiling for reader-fit **14h**. The census of
record is `qa/topic-traces/g1-count-forward-to-120-2026-08-01.md`.

## Consumers (blast radius)

| Consumer | Evidence | Demand |
|---|---|---|
| Published Grade-1 `NBT001-01-a` | Grade-1 census | Count forward from non-zero starts, including decade transitions, through 120 |
| Adaptive/eval sessions across five modes | `qa/eval-reports/number-sequencer-2026-06-11.md`, `number-sequencer-2026-06-14.md` | Exact task identity plus support-tier variation |
| K sequencing practice | catalog + generator/component | Values through 20, concrete supports, no decade-fill |
| Live tutor | catalog `tutoring` + component `aiPrimitiveData` | Current type, sequence, range, direction, attempts, and support tier stay synchronized |

## Requirements

### R1 — Exact single/blended eval-mode identity · OBSERVED, violated before 14h

- A single pin emits only its catalog challenge types.
- A curated pin such as `count_from|before_after` emits a mix drawn only from the
  union (`count-from`, `before-after`); it must never leak `fill-missing`,
  `order-cards`, or `decade-fill`.
- An absent/`mixed` pin keeps all five types available.

### R2 — Grade band precedence · OBSERVED

- Explicit `config.gradeBand` wins, then canonical `ctx.grade` (`K` → `K`, numeric
  grades → the primitive's top rung `1`), then the legacy grade-prose fallback.
- K remains capped at 20 and cannot emit decade-fill.

### R3 — Scope-conditioned Grade-1 ceiling · REQUIRED by published consumer

- Generic Grade-1 practice defaults to values at or below 100.
- When authoritative topic/objective/intent explicitly requires counting within
  120, Grade 1 may use 101–120. It must never exceed 120.
- Narrower topic/intent scope wins over both defaults; support tier may not widen it.

### R4 — Local render/input window · REQUIRED

- `rangeMin`/`rangeMax` equal the minimum/maximum values the child actually reads
  or produces (`sequence`, `correctAnswers`, and `startNumber`).
- This window—not the whole 1–120 grade span—drives numeric input bounds, the
  optional number line, and decade-fill grid cells. Every correct answer is rendered
  and reachable.

### R5 — Five mode semantics · OBSERVED

- `count-from`: continue uniformly from `startNumber` in the named direction.
- `before-after`: one adjacent missing value.
- `order-cards`: visible pool is shuffled (see R9); answer is the same set ascending.
- `fill-missing`: nulls and answers align left-to-right under one arithmetic rule.
- `decade-fill`: missing values cross a decade boundary and every answer lies in
  the rendered local window.

### R6 — Answer-key derivability · OBSERVED

The visible data independently determines every `correctAnswers` value. Null count,
answer count, direction, ordering, and rendered range obey the number-sequencer
oracle; a correct student action cannot be marked wrong or made unreachable.

### R7 — Support tier is structural, not magnitude · OBSERVED

Easy → hard withdraws dot/number-line support and increases blanks/cards/slots.
It does not change eval-mode identity or enlarge the topic/grade range. Missing or
unknown difficulty remains a no-op.

### R8 — Tutor/runtime synchronization · OBSERVED

The current challenge type, instruction, sequence, answers, direction, range,
start number, attempt count, grade band, and support tier reach `useLuminaAI`.

### R9 — order-cards presentation is genuinely unsolved · REQUIRED

For `order-cards` the ARRANGEMENT of the pool is the task, not the stimulus, so the
shipped `sequence` must not be assemblable from layout: no card sits in its answer
position, and no 3+ cards are already consecutive and adjacent in either direction.
Sorted pools and rotations of sorted pools (which leave every card but one already
beside its neighbour) are forbidden on every path — model output, support-tier
reshape, and the deterministic fallback. Code owns this presentation; the shuffle is
seeded from the card values so the same set always renders the same way. Enforced in
`gemini-number-sequencer.ts` (`shuffleOrderCards` + the post-generation guard) and
checked by the oracle's `answer-leak` rule, which is scoped to `order-cards` alone —
for the null-fill modes and `count-from` the visible terms ARE the intended stimulus.

## Conflict resolved by 14h

The prior catalog/generator ceiling (Grade 1 ≤100) was valid for generic practice
but contradicted published `NBT001-01-a` (≤120). Resolution is a scope-conditioned
capability extension plus a derived local display window—not a global 120 default
and not a 120-cell board.

## Catalog projection

The catalog must advertise Grade-1 support through 120 when scope requires it,
while retaining the generic ≤100 default and the five existing mode identities.

## Changelog

- 2026-08-04 — contract derived for reader-fit 14h; 8 requirements; Grade-1
  100-vs-120 conflict resolved structurally via scoped widening + local windows.
- 2026-08-04 — `--check` COMPATIBLE after implementation: R1–R8 verified;
  focused 24/24, full Vitest 1406/1406, Lumina typecheck 0, tsc 803 baseline,
  all five modes + blend + scope/intent discrimination PASS live.
- 2026-08-06 — R9 added after a field report: every hard-tier `order-cards` pool
  rendered as the sorted set rotated left by one (`[12,13,14,15,16,11]`). The
  support-tier reshaper rebuilt the pool as `[...set.slice(1), set[0]]`, so the
  task was solvable from layout and read as a rendering bug. Replaced with a
  seeded derangement search applied on every path; the oracle gained the
  `answer-leak` rule that would have caught it. Full Vitest 1709/1709.
