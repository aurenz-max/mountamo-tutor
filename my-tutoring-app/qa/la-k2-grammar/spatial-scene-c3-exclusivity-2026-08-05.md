# spatial-scene — C3 `above`/`on` ambiguity closed (identify + describe)

**Date:** 2026-08-05 (evening) · **Lane:** LA K-2 Grammar density · **Queue item:** BACKLOG item 2
**Contract:** `docs/contracts/spatial-scene.md` (C3 → **R12**)
**Prior slice:** `spatial-scene-prepositions-2026-08-05.md` (`96533cb`, `bd1c535`)

## Verdict

C3 was opened as *"unverified territory, not a measured failure"* — every `on`/`under`
probe in the 08-05 slice was `place` mode, which is cell-judged and immune. Pinning the
mode combination that slice never exercised **measured it: 4 of 18 challenges shipped two
defensible options.** Fixed, re-probed at 0 of 36, and promoted to contract **R12**.

## The defect, measured (Probe F — pre-fix)

`identify`/`describe` pinned at the published K LA preposition objective
(**LA004-01-F**, *"Apply prepositions (in, on, under, between) to describe object
locations during hands-on activities"*), kindergarten, with the manifest curator's own
intent for this objective (captured by a `manifestOnly` trace: *"Focus on 'on' (on the
slide), 'under' (under the bench), and 'beside'…"*). 3 runs × 2 modes = 18 challenges.

The probe recomputes the grid truth of **every option** from the shipped
`sceneObjects` + `targetObject`, using `SUPPORTED_POSITION_SEMANTICS` transcribed by hand
— so it judges the content, not the code that made it.

| | pre-fix |
|---|---|
| **Two defensible options in one list** | **4 / 18 (22%)** |
| `correctPosition` false for the arrangement | 0 / 18 |
| Unresolvable reference/target | 0 / 18 |
| **Answer at `options[0]`** | **18 / 18** |

The four failures are exactly the three predicted pairs, and they run in both directions:

```
describe c2  key=below  tgt(2,1) ref(1,1)  opts=[below, above, under, on]   true=[below, under]
identify c1  key=above  tgt(0,1) ref(1,1)  opts=[above, below, beside, on]  true=[above, on]
identify c2  key=on     tgt(0,1) ref(1,1)  opts=[on, under, above, below]   true=[on, above]
identify c3  key=beside tgt(1,2) ref(1,1)  opts=[beside, above, under, next_to]  true=[beside, next_to]
```

A child answering **"above"** on the second row is marked wrong for an answer the
generator's own semantics make true. Pedagogy rule #1, live at K.

### The second finding: the answer was always the first button

Not in the queue item, but it lives in the same options list and the same post-process:
`correctPosition` was `option0` in **18 of 18** challenges, and
`SpatialScene.tsx:663-664` renders `options` in array order with no shuffle. *"Tap the
first one"* solved every `identify`/`describe` item without reading the grid. Fixed in
the same pass.

## What shipped

**`spatial-scene/resolvePrepositionScope.ts`**

- **`positionHolds(word, target, reference)`** — `SUPPORTED_POSITION_SEMANTICS` in
  executable form, placed directly beneath the prose so the two cannot drift. Returns
  `null` (never a silent `false`) for a word with no grid semantics.
- **`enforceSingleDefensibleOption(...)`** — the R12 guard. It is **geometry-driven, not
  a synonym table**, so it also covers the pairs nobody listed: `beside` ⊂
  `left_of`/`right_of` becomes live the moment a Grade-1 lesson runs. It
  - drops any option that is ALSO true of the arrangement,
  - repairs `correctPosition` when the LLM's key is false for the scene it drew, **or is
    true but outside the lesson's window** (R1 enforcement moves from prompt to code),
  - backfills distractors from the lesson's own window, only with words that are FALSE,
  - reports `unjudgeable` when no window word describes the arrangement.
- **`placeAnswerSlot(options, key, seed)`** — seeded by challenge id, so a given challenge
  always renders the same order and no `Math.random` enters the content path.

**`gemini-spatial-scene.ts`** — the guard runs in the `identify`/`describe`
post-process, where the reference object has already been resolved/injected (R6). An
`unjudgeable` challenge is **rejected**, the same treatment SS-1 gives an empty grid: an
item with no defensible answer is worse than one fewer item. Each intervention logs.
The prompt also now names the overlapping pairs and asks for varied answer slots — but
the code owns correctness; the prompt only reduces how often the guard has to fire.
The `identify`/`describe` fallbacks were re-ordered off slot 0.

## Verification

| Gate | Result |
|---|---|
| **Probe G** — post-fix replay, real Gemini, 3 runs × 2 modes | **0 / 18 ambiguous** |
| **Probe G control** — math K.G.1, no preposition request, 3 × 2 | **0 / 18 ambiguous, 0 out-of-band words** |
| Answer-slot distribution (36 challenges) | `{0: 9, 1: 10, 2: 9, 3: 8}` (pre-fix: 18/18 at slot 0) |
| `correctPosition` false for the arrangement | 0 / 36 |
| Focused suite `resolvePrepositionScope.test.ts` | **34 / 34** (was 15; +19) |
| Revert-bite (guard computed but not applied) | **2 of 34 fail** — both end-to-end R12 tests |
| Full Vitest | **1,647 / 1,647** (145 files) |
| `typecheck:lumina` | **0** |
| `tsc --noEmit` (project-local, abs path) | **803 = HEAD baseline, 0 new** |

**Probe G, the pre-fix failures replayed:**

```
la/identify  key=on     slot=2  tgt(0,1) ref(chair)(1,1)  opts=[under, beside, on, next_to]  true=[on]
la/describe  key=below  slot=1  tgt(1,1) ref(tree)(0,1)   opts=[beside, below, on, above]    true=[below]
la/identify  key=beside slot=1  tgt(1,2) ref(house)(1,1)  opts=[under, beside, above, on]    true=[beside]
```

`on` and `above` no longer appear together; `below`/`under` and `beside`/`next_to` the
same. The math control still emits only `{above, below, beside, next_to}` — **R1 held**
byte-for-byte while R12 was added.

Some math-control lists come back with **3** options rather than 4 (e.g.
`[next_to, above, below]`): the K math window is only four words, and when the true word
has a synonym in that window the guard removes it and has nothing false left to backfill.
That is R7-legal (≥2 options, answer present) and is the correct trade — a third honest
option beats a fourth that is also right.

## Honest residuals

- **No browser check.** Verified through the real generator pipeline and unit tests. The
  component was not modified, but the answer is now at a varying index — worth one hand
  drive of an `identify` challenge in Chrome to confirm the option buttons still
  highlight/score correctly against a non-zero slot.
- **`unjudgeable` rejection is untriggered in the wild** — 0 of 36 real challenges hit it;
  it is covered by unit tests only. If it ever fires often, the scene prompt is drawing
  diagonals and the fix belongs upstream.
- **C2 is untouched.** `in`, `between`, `in_front_of`/`behind`, and the path class remain
  inexpressible on a 3×3 grid. BACKLOG items 1 and 3.
- **The lane's demand number still has not moved** — all 138 subskills still carry
  `target_primitive: ai-tutor-session`. Converting demand is the draft-first curriculum
  re-target (BACKLOG item 6); `curriculum_published` was read-only throughout.
