# spatial-scene — containment (`in`) + two-reference (`between`) served

**Date:** 2026-08-05 (late) · **Lane:** LA K-2 Grammar density · **Queue item:** BACKLOG item 1 (split)
**Contract:** `docs/contracts/spatial-scene.md` — **C2 partially resolved**, new **R13/R14/R15**
**Prior slices:** `spatial-scene-prepositions-2026-08-05.md` (`96533cb`, `bd1c535`),
`spatial-scene-c3-exclusivity-2026-08-05.md` (`28ae4ad`)

## Verdict

The two halves of C2 that a 3×3 grid *can* express now ship as their own eval modes:
**`place_in`** (β 1.5) and **`place_between`** (β 3.5). `in_front_of`/`behind` were left
out deliberately — they still need the design ruling. 27 real-Gemini challenges judged
independently: **27/27 clean**. The math K.G.1 consumer is unchanged on both R11 and R1.

## The scope decision: a FORK, not an edit

The queue item flagged this as the dangerous edit, and it was right. Contract **R11**
says `place` targets an **EMPTY** cell, and `GridScene` gated the tap affordance on
`interactive && !obj` — so a containment answer was, literally, unclickable.

Containment inverts that: "Put the ball IN the box" is answered by tapping the cell the
**box occupies**. Serving it inside `place` would have made R11 conditional on content
the checker never sees, ablating the guarantee the math K.G.1 consumer relies on. Per
the contract's fork ladder that is rung 1 — **eval-mode split** — so `place` is untouched
and containment is a new task identity. `between` forked for a different reason: it needs
a SECOND reference, and `positionHolds` takes one.

Neither word joins the relative position WINDOW. `composePositionWindow` filters them out
by construction, which is what keeps R1 true: a lesson that asks only for containment
leaves the K math vocabulary byte-for-byte intact and gets a *mode* instead of a word.

## What shipped

**`spatial-scene/resolvePrepositionScope.ts`**
- `RELATIVE_POSITIONS` (the 8 single-reference words, judged by `positionHolds`) split
  from `MODE_POSITIONS` (`in`, `between` — served by a mode). `SUPPORTED_POSITIONS` is
  their union, so the resolver reports both as **requested**, not as unsupported.
- `positionHolds` gains `in` (same cell). `between` stays `null` there — it is judged by
  the new **`betweenHolds(target, a, b)`**, the two-reference twin.
- **`resolveBetweenCell(a, b)`** — code derives the answer cell; a pair with no single
  answer (not collinear, adjacent, over-wide) returns null and the challenge is dropped.
- **`resolveRequestedModes`** — turns a request for `in`/`between` into `place_in` /
  `place_between` for a blended session. This is the log line from the last slice
  (*"position words this 3x3 grid cannot express"*) becoming served content.
- **R12 hardened**: an option whose truth is `null` is now dropped as out-of-window and
  can never be backfilled. Previously only *out-of-window* options were dropped, so a
  word with no single-reference semantics could have survived as a distractor that was
  in fact TRUE.

**`gemini-spatial-scene.ts`** — two sub-generators, both **code-owned answers** (no
`correctCell` in either schema):
- `generatePlaceIn` — answer = the container's own cell, derived from `containerName`.
  Rejects a container that cannot hold anything (`NON_CONTAINERS`), an unresolvable
  container, and a target already drawn on the grid.
- `generatePlaceBetween` — answer = `resolveBetweenCell(refA, refB)`. Rejects a
  non-collinear/adjacent pair, an occupied between-cell (**R11 holds here**), and a
  pre-placed target.

**`SpatialScene.tsx`** — `GridScene` gains `nestPlaced` (a placed object renders INSIDE
the object already in the cell rather than replacing it) and `allowOccupiedTaps` (the
affordance inversion). Both default off, so every existing mode renders as before.

**Catalog + backend** — 2 eval modes, description/constraints re-projected (containment
and two-reference moved from "do not route these here" to served), and matching β priors
in `problem_type_registry.py`.

## Evidence

### Real Gemini, judged independently (`qa/.../judge.py`-style recomputation)

The judge recomputes every property from the **shipped content** — container cell,
between-geometry, occupancy, target-not-preplaced, instruction wording — transcribed by
hand from the contract, so it judges the content and not the code that made it.

| Probe | Runs | Challenges | Result |
|---|---|---|---|
| A — `place_in` pinned, K LA intent | 5 | 15 | **15/15 clean** |
| B — `place_between` pinned, K LA intent | 3 | 9 | **9/9 clean** |
| C — **math K.G.1 control** (`place`, `identify`, `describe`) | 3 | 9 | **9/9 clean** — R11 empty-cell intact, 0 out-of-window keys/options (R1) |
| D — curator's real blend pin for LA004-01-F | 1 | 9 | **9/9 clean**, exactly the 3 pinned modes |

### Routing re-probe (the check `bd1c535` established as mandatory after a projection)

`POST /api/lumina/topic-trace`, manifestOnly, with the published objectives:

| Subskill | Curator's eval-mode pin | Verdict |
|---|---|---|
| **LA004-05-B** *"Put the pencil in the box"* | **`place_in`** | the containment demand routes to the containment mode, unprompted |
| **LA004-01-F** *"in, on, under, between"* | **`place_in\|place\|place_between`** | a blend covering all three |

This is the demand actually converting: LA004-05-B's *"in the box"* was logged as
unserveable before this slice.

### A defect the routing probe found — blend pins were being dropped

LA004-01-F's pin is a **blend string**, and `resolveEvalModeConstraint` matches one key
exactly, so it resolved to null and the generator fell through to "generate every mode".
Harmless-ish at 4 modes; at 6 it is a **17-challenge** session instead of the 3 the
curator chose. Fixed **locally in this generator** (parsing `a|b|c` the way
`resolveEvalModes` does) rather than in the shared helper, which ~60 other generators
depend on and which would change their behavior too. Re-probed: 9 challenges, exactly
`place_in` + `place` + `place_between`.

### Entropy — a finding the first probe round produced

`place_in` returned **box / house / car with ball / star / flower on 5 of 5 runs**. A
shuffled container *menu* did not move it (flash-lite anchors on the shared object
vocabulary, not on list order). Fixed by having the **code assign** the container per
challenge and the LLM write the scene around it. Re-probed: basket/box/house →
backpack/house/box → bowl/cup/basket. Target objects still cluster on ball/star/car —
noted, not chased; the container is the taught concept.

### Gates

- Focused suite `resolvePrepositionScope.test.ts`: **49/49** (was 34), with a
  **3-of-49 revert-bite** (window filter ×2, unjudgeable-option guard ×1).
- New component drive `SpatialScene.containment.test.tsx` (jsdom, real component):
  **8/8**, with a **2-of-8 revert-bite** on the affordance inversion and the nested
  render. This exists because the failure mode — a correct answer that cannot be
  clicked — is invisible to both `tsc` and the generator suite.
- Full Vitest **1670/1670** · `tsc --noEmit` **803 = baseline**.

## Honest residuals

1. **No real-browser drive.** The interaction is exercised in jsdom against the real
   component (tap → check → feedback → nested render present in the DOM), but the
   *visual* nesting — the contained emoji reading as inside the container rather than as
   two objects sharing a square — has not been seen in Chrome. The dev panel sits behind
   the Lumina app shell and auth. → `qa/HUMAN-CHECKS.md`.
2. **`hint` is a dead field.** Confirmed while checking whether the new modes leak
   answers through hints: `SpatialScene.tsx` never renders `currentChallenge.hint` and
   the tutor context does not carry it. So **SS-5 (BACKLOG item 2b) is a leak in a field
   nobody displays** — that changes the item from "fix the leak" to "decide whether hints
   should render at all". Recorded, not acted on; it is item 2b's call.
3. **Demand not yet converted.** As with the pilot: the primitive can now *serve*
   LA004-05-B / LA004-01-F / LA004-05-F, but `target_primitive` is a stored curriculum
   field. Converting the count needs the draft-first re-target (BACKLOG item 6).
   `curriculum_published` was not touched.
4. **`in_front_of` / `behind` still open** — deliberately. C2 remains open for them and
   for the path class. Carried as BACKLOG item 1b.
5. **eval-test harness reports `challengeCount: 0` for a blend pin** — its validator
   looks up a single mode definition. Cosmetic, pre-existing, and only on an input the
   route never documented; the content was judged directly.
