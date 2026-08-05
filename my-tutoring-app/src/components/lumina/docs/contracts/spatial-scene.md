# Contract: spatial-scene

- **Derived:** 2026-08-05 · evidence window: eval report 2026-04-04 → LA K-2 census 2026-08-05
- **Component:** `primitives/visual-primitives/math/SpatialScene.tsx` ·
  **Generator:** `service/math/gemini-spatial-scene.ts` ·
  **Catalog:** `service/manifest/catalog/math.ts:3743`
- **Status:** ACTIVE (C1 RESOLVED 2026-08-05 via the config-axis rung)

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| Math K.G.1 positional language (K/G1 geometry) | census [1] + eval report [2] | `qa/eval-reports/spatial-scene-2026-04-04.md`; probe C/E 2026-08-05 | 2026-08-05 |
| **K LA prepositions — LA004-05-B, LA004-01-F** | census [1] | `qa/la-k2-grammar/census-2026-08-05.md`; probe A/B/D 2026-08-05 | 2026-08-05 |
| Curriculum-fit sweep (description quality) | QA register [2] | `qa/curriculum-fit/_sweep-math-2026-06-07.md` — 0.766 "diffuse", flagged "inspect spatial-scene" | 2026-06-07 |

**Authored map [3]: ZERO.** `GET /api/curriculum/primitive-mappings/Mathematics`
at grades K/1/2 returns no subskill targeting `spatial-scene`. Every consumer is
**manifest-emergent** — there is no dormant authored long-tail to protect, and no
curriculum row to break. Channel [4] (calibration) requires auth and was not read.

## Requirements

### R1 — grade-band position window · OBSERVED
- **Property:** With no lesson-specific request, a Kindergarten scene uses **only**
  {above, below, beside, next_to}; Grade 1 adds {left_of, right_of}. No other
  position word may appear in `correctPosition` or in `options`.
- **Demanded by:** Math K.G.1 consumer.
- **Evidence:** `gemini-spatial-scene.ts` band lines (pre-2026-08-05 `SHARED_CONTEXT`);
  probe C 2026-08-05 (11 challenges, 0 out-of-window); probe E post-edit (same).
- **Probe:** POST `/api/lumina/topic-trace` with objective *"Describe the relative
  positions of objects using above, below, beside, and next to"*, grade kindergarten,
  `componentId=spatial-scene`. Every `correctPosition` and every `options[]` entry
  must be in the K set.

### R2 — lesson intent may WIDEN the window, never narrow it · OBSERVED
- **Property:** When the lesson explicitly names supported position words, those words
  are added to the band window. The band words remain available. A resolver outage or
  an empty request leaves the band window exactly as R1 specifies.
- **Demanded by:** K LA prepositions consumer (LA004-05-B/-01-F); guarded for math.
- **Evidence:** probe B (pre-fix: intent said "under", generator emitted above/below/
  beside); probe D (post-fix: "on"/"under"/"beside" served); focused suite
  `resolvePrepositionScope.test.ts` 15/15 with 2-of-15 revert-bite.
- **Probe:** the focused suite, plus probe D replay.

### R3 — every emitted position word has deterministic grid semantics · OBSERVED
- **Property:** The prompt states an exact row/col rule for **every** word in the
  window and for **no** word outside it, so the LLM is never invited to emit a
  relation the checker cannot judge. `on`/`under` are CONTACT-scoped (adjacent, same
  column); `above`/`below` allow any vertical distance.
- **Demanded by:** both consumers (correctness ownership).
- **Evidence:** `SUPPORTED_POSITION_SEMANTICS`; probe D — all 3 placements matched
  the injected rule exactly (`on` → ref row−1 same col; `under` → ref row+1 same col;
  `beside` → same row adjacent col).
- **Probe:** for each generated `place` challenge, recompute the target cell from the
  reference object's position under the stated rule; it must equal `correctCell`.

### R4 — no empty grids · OBSERVED
- **Property:** A challenge with zero scene objects is rejected, never rendered.
- **Demanded by:** Math consumer (SS-1).
- **Evidence:** `qa/eval-reports/spatial-scene-2026-04-04.md` SS-1; post-process
  rejection in all three sub-generators.
- **Probe:** generate with a stub returning no `sceneObj*` fields → challenge dropped.

### R5 — populated scene: 4 object slots, all required · OBSERVED
- **Property:** `identify`/`describe`/`place` fill all 4 `sceneObj*` slots (2 key +
  2 backdrop) on the 9-cell grid; fields are non-nullable in the schema.
- **Demanded by:** Math consumer (SS-2 — a 2-object grid is 78% empty).
- **Evidence:** eval report SS-2; probes C/E — `nObj=4` on every non-`follow_directions`
  challenge.
- **Probe:** probes C/E; assert `sceneObjects.length === 4`.

### R6 — target and reference objects exist on the grid · OBSERVED
- **Property:** `targetObject` and `referenceObjectName` are present in
  `sceneObjects`; missing ones are injected into an unused cell.
- **Demanded by:** Math consumer (SS-3 — target could otherwise highlight an empty cell).
- **Evidence:** eval report SS-3; post-process derivation in `generateIdentifyDescribe`.
- **Probe:** for each `identify`/`describe` challenge, both names resolve in `sceneObjects`.

### R7 — options carry the answer plus valid distractors · OBSERVED
- **Property:** `identify`/`describe` emit ≥2 options, always including
  `correctPosition`; all options are valid position words.
- **Demanded by:** Math consumer.
- **Evidence:** probes C/E — 4 options per challenge, correct always present.
- **Probe:** probes C/E.

### R8 — support tier withdraws perception aids only · OBSERVED
- **Property:** `difficulty` easy/medium/hard toggles `showGrid` / `showObjectLabels` /
  `showPositionHints` only. It never changes the scene layout, the asked object, or
  which relation is the answer. The checker reads `correctPosition`/`correctCell` and
  never these flags, so withdrawing a scaffold cannot leak or invalidate an answer.
- **Demanded by:** both consumers (rule #1 guard).
- **Evidence:** `resolveSupportStructure` + component comment block
  (`SpatialScene.tsx:67-75`); commit `cbf0717`.
- **Probe:** generate the same pinned mode at easy and hard; `correctPosition`/
  `correctCell` distributions unchanged in kind; only the show-flags differ.

### R9 — eval mode pins the challenge type · OBSERVED
- **Property:** `targetEvalMode` restricts generation to that one challenge type;
  absent, all four run and blend.
- **Demanded by:** both consumers; the IRT ladder (β 1.0/2.0/3.0/4.0).
- **Evidence:** `resolveEvalModeConstraint`; probe B (`place` pinned → 3 `place`
  challenges) vs probe C (unpinned → all 4 types).
- **Probe:** probe B/C.

### R10 — grid cells are always in range · OBSERVED
- **Property:** Every row/col is clamped to `0..gridSize-1`.
- **Demanded by:** both consumers (component indexes `cellMap` by `row-col`).
- **Evidence:** `clampGrid` applied on every ingest path.
- **Probe:** stub out-of-range rows → clamped, never rendered off-grid.

### R11 — `place` targets an empty cell · INFERRED
- **Property:** `correctCell` for a `place` challenge is a cell no scene object
  occupies. The component's affordance (`interactive && !obj`) only invites taps on
  empty cells.
- **Demanded by:** Math consumer.
- **Evidence:** prompt line "must be an EMPTY cell"; `GridScene` hover gating
  (`SpatialScene.tsx:188`). Not independently probed.
- **Probe:** for each `place` challenge, `correctCell` ∉ `sceneObjects[].position`.
  **Upgrade or delete on first challenge** — this becomes load-bearing the moment a
  containment ("in") mode ships, which deliberately targets an OCCUPIED cell.

## Conflicts

### C1 — R1 vs the LA preposition consumer — **RESOLVED 2026-08-05 via rung 3 (config axis)**

The math K.G.1 consumer demands a *narrow* K window ({above, below, beside, next_to})
— that is the standard it teaches, and widening it unconditionally would let a math
lesson drift out of its own standard. The K LA consumer demands *containment/support*
prepositions (on, under, in, between) that the same band excludes. **Both are right
for their consumer**, which is what makes it a conflict rather than a bug in one of
them.

Resolved without forking the primitive: the window became a **per-lesson config axis**
resolved from what the lesson actually asked for (`resolvePrepositionScope`), UNIONed
with the band default. Math lessons name no prepositions, so they resolve to an empty
request and keep R1 byte-for-byte; LA lessons name them and get them. Neither consumer
sees the other's vocabulary. Rungs 1 (eval-mode split) and 2 (band gate) were both
rejected: the task identity is unchanged (still place/identify/describe), and the axis
is not the grade band — a Grade-1 math lesson and a Grade-1 LA lesson want different
windows at the *same* band.

### C2 — a 3×3 static grid cannot express part of the LA demand — **OPEN**

`in` (containment — same cell, nested render), `between` (needs two reference objects;
the schema carries one `referenceObjectName`), `in_front_of`/`behind` (viewer-relative;
ambiguous with above/below in a top-down view), and `through`/`around`/`across` (path,
not position) are all named by the published K LA curriculum and none are expressible
today. The resolver reports them as `unsupported` and the generator **logs the gap
rather than pretending it was served** (honest saturation, the di-sentence-reading
precedent). Queued in `qa/la-k2-grammar/BACKLOG.md`. **Any edit adding these must
re-read R11 first** — containment inverts it.

## Catalog projection

The 2026-06-07 curriculum-fit sweep scored this entry **0.766 "diffuse"** and flagged
"inspect `spatial-scene`" — and the description is what the manifest curator routes on
(`gemini-manifest.ts` catalogContext sees `id`/`description`/`constraints` only).

- **description:** current copy is math-only ("Grade-band K-1 geometry", "K.G.1"), yet
  the primitive demonstrably serves K Language Arts prepositions. **Proposed:** name
  the preposition/positional-language use explicitly and drop the K.G.1-exclusive
  framing, so an LA curator recognises it. Applied 2026-08-05.
- **constraints:** currently silent on vocabulary. **Proposed:** state that the window
  follows the lesson's named position words and that containment/path prepositions are
  not supported — so the curator does not route an "in the box" or "through the tunnel"
  lesson here. Applied 2026-08-05.
- **evalModes:** descriptions are faithful; `place` and `follow_directions` already read
  as enactment. No change.

## Changelog

- **2026-08-05** — derived (initial). 11 requirements (10 OBSERVED, 1 INFERRED),
  2 conflicts (C1 resolved same slice, C2 open). Edit guard run for the LA preposition
  window: **COMPATIBLE** — R1/R5/R7/R9 re-probed post-edit (probe E: 11 challenges,
  4 modes, 0 out-of-window, `nObj=4`), R2/R3 newly established.
