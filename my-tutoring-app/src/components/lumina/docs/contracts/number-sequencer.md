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
checked by the oracle's `answer-leak` rule, which is scoped to `order-cards` alone.

For the null-fill modes and `count-from` the visible SEQUENCE terms are the intended
stimulus, so the oracle's pool check does not apply to them. That exemption covers
the sequence only, never the instruction text: a `count-from` instruction must not
state every value in `correctAnswers`. One modelled step is easy-tier scaffolding;
the whole continuation is the answer key written out, and the student is left with
nothing to produce. Enforced in `gemini-number-sequencer.ts` by the post-parse
`instructionLeaksAnswers` filter, which runs after the support-tier reshape (so it
sees the final run) and drops offending challenges into the deterministic backfill.

### R10 — one window is one problem, and code owns the blank slot · OBSERVED

For `fill-missing` and `decade-fill` the missing SLOT is chosen in code on every path
(model output, support-tier reshape, deterministic backfill), never by the model and
never from a fixed stride: a single blank may sit in any slot including the edges, two
or three blanks stay non-adjacent, `decade-fill` keeps its blanks on the decade seam
(…9 / …0) so the child still crosses, and a session spreads its blanks across slots
rather than repeating one. The instruction is written before the slot is known, so it
must be position-neutral; one that names a value the placement just blanked is
replaced with the neutral wording (the count-from leak channel, entered from the other
end). No two challenges in a session may work the same number WINDOW — the mode plus
the values involved, presentation aside — and a rejected duplicate is replaced by a
distinct in-range window rather than shortening the session.

Enforced in `gemini-number-sequencer.ts` (`chooseBlankIndices` / `placeBlanks` /
`windowSignature`). Demanded by K `COUNT001-01-H` (atlas finding NS-4: the blank sat
in slot two on 10/10 items and `1, _, 3, 4` was served two or three times per
session). Probe: two `/api/lumina/eval-test?componentId=number-sequencer&evalMode=fill_missing`
draws — every window distinct, blanks covering at least three slots.

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
- 2026-09-08 — R10 added for atlas NS-4 (session variety). The support tier keeps the
  blank COUNT and loses the blank POSITION, which it used to take from a hardcoded
  `pos = 1` stride — half of why every K item blanked its second slot. Assessed
  COMPATIBLE: R5 alignment and R6 derivability hold at every slot (the visible terms
  still fix the step), R7 magnitudes are untouched (placement only re-cuts values the
  challenge already carried), R9 order-cards is out of scope. Focused 17/17, full
  Vitest 5356 passed / 1 failed (another lane's uncommitted story-ribbon catalog
  row), Lumina typecheck 0. The 14h test's `max answer === 119` assertion was
  pinning the mock's blank slot, not a scope rule; it now asserts the window instead.
- 2026-09-08 — R9 extended after a P0 leak: the easy-tier `count-from` prompt told
  Gemini to model the first step with `"Start at 3, then say 4, 5, 6…"`, so the
  instruction enumerated the entire continuation. Prompt now models exactly one
  step; a post-parse `instructionLeaksAnswers` filter rejects any `count-from`
  challenge whose instruction states every `correctAnswers` value.


## DI modality amendment ? 2026-09-11

The existing six task identities and calibration values remain. R1?R3, R6,
R7 and R9?R10 still apply; the current generator also supports explicit K counting
scope through 100 (the earlier K ceiling in this document predates that extension).

- **R4:** the local window now bounds the number train and its optional reference
  line. Spoken answers replace numeric inputs. No sorted reference is shown for
  order-cards or spot-error, because it would solve the arrangement/detection task.
- **R5:** count-from produces one judged number per continuation step; fill-missing
  and decade-fill produce one per blank. Before-after produces one adjacent number.
  Spot-error asks for the printed wrong number; `correctAnswers[0]` remains the
  repair in the data contract, and the script derives the spoken target from
  `sequence[wrongIndex]`. Order-cards preserves actual arrangement and submits on
  three seconds of stillness, including wrong and incomplete arrangements.
- **R8:** `useJudgedScriptRunner` supplies the exact current question and private
  judging target. The general context carries only `challengeType` and an
  answer-free `stimulus`; generated instructions, answers, and wrongIndex are not
  general tutor context. The tutor verdict is the only progression authority.
- Each continuation/blank has a stable source-and-slot item ID. Evaluation records
  those tutor outcomes with the source challenge ID and voice/gesture modality;
  scores are per judged item. Complete problems are selected, never truncated
  midway, within an 18-item session cap; duplicate windows/IDs are dropped.
- Answer digits and dot counts appear only after affirmation; the train is held
  through that affirmation. Support tiers retain their original numerical scope
  and blank/card load. Missing or invalid content is rejected instead of graded.
- Positive spoken numbers through twenty use the benched class. Numbers 21?120
  use the standing accepted-build-ahead class; microphone acceptance remains owed
  with the existing #63 sitting. Zero is outside both spoken response contracts.

Verification and remaining human acceptance: `qa/number-sequencer-di/REPORT.md`.
