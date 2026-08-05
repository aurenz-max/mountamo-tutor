# spatial-scene — intent-driven preposition window (LA K-2 grammar pilot)

**Date:** 2026-08-05 · **Lane:** LA K-2 Grammar density, Phase 2 pilot
**Handoff:** `qa/HANDOFF-la-k2-grammar-density-2026-08-05.md`
**Census:** `qa/la-k2-grammar/census-2026-08-05.md` · **Contract:** `docs/contracts/spatial-scene.md`

## Verdict

**The handoff's headline predicted BIRTH was a duplicate.** Phase 1's fit-first gate
caught it before any code was written, and the pilot became a bounded extension of an
existing L3 primitive instead of a new L0 birth.

## What the fit-first gate found

The handoff named "**Preposition/Spatial Scene** (~7 subskills): the child ENACTS 'the
bear is UNDER the table' by dragging the bear" as the expected true birth.

`spatial-scene` already exists — `catalog/math.ts:3743`, component
`primitives/visual-primitives/math/SpatialScene.tsx`, generator
`service/math/gemini-spatial-scene.ts`, registered in `primitiveRegistry.tsx`,
`evaluation/index.ts` and `mathGenerators.ts`. Not a phantom, and not L0: 4 eval modes
(`identify` β1.0 / `place` β2.0 / `describe` β3.0 / `follow_directions` β4.0), support
tiers with an answer-leak guard, ctx-native scope threading. Its `place` mode already
has the child tap the grid to **enact** the relation — the exact direct-manipulation
interaction the handoff wanted a birth for.

It was invisible to the 2026-07-04 demand map because it is filed under **math**
(K.G.1), not literacy. `UNIVERSAL_CATALOG` (`catalog/index.ts:62`) is a flat
concatenation with **no subject partition**, so an LA objective can reach it.

## The measured defect

Reachability was confirmed by trace, not assumed.

**Probe A** (`manifestOnly`, published LA004-05-B objective, kindergarten) — the curator
selects it:

```
-> spatial-scene | mode=place | difficulty=easy
   intent: "…place items … (e.g., 'Put the ball under the table')"
```

**Probe B** (full pipeline, same objective) — and the generator refused to serve it:

```
place | "Put the ball directly above the box."    correctPosition=above
place | "Put the cat below the chair."            correctPosition=below
place | "Put the dog beside the house."           correctPosition=beside
```

The lesson intent said **under**; the output contained no containment or support
preposition at all. Cause: `gemini-spatial-scene.ts` hardcoded the window in the prompt —
*"Position words for K grade: ONLY above, below, beside, next_to"* — the math K.G.1
vocabulary, applied as a global cap. A cap below what the lesson asked for is a bug, not
a safety rail ([[trust-intent-over-hardcoded-caps]]).

Second layer: `VALID_POSITIONS` admitted 11 words, but the prompt defined grid semantics
for only 6. `between`, `on`, `under`, `in_front_of`, `behind` could be emitted with **no
correctness owner** — the LLM was never told how to place them.

## What shipped

**`service/math/spatial-scene/resolvePrepositionScope.ts`** (new) — the `resolveDeckRequest`
(14l) template applied to a vocabulary axis. ONE `gemini-flash-lite-latest` call,
temperature 0, schema-bound, returning `{requested, unsupported}`. Never a regex over
intent prose ([[schema-over-regex-and-prompt]]).

- **Fires only** when the scope carries intent/objective text — no call, no cost otherwise.
- **Widens only.** The resolved set is UNIONed with the grade-band default and can never
  remove a band word.
- **Fails safe.** Parse failure / outage → `null` → the caller keeps the band window, i.e.
  exactly today's behavior.
- **Honest saturation.** Words the grid cannot express come back as `unsupported` and the
  generator **logs the gap** rather than pretending it was served (the di-sentence-reading
  precedent). That log is the demand signal for BACKLOG item 1.

**`gemini-spatial-scene.ts`** — `SHARED_CONTEXT` (a fixed const) became
`buildSharedContext(window)`. The window is composed per lesson, and **only in-window
words get their grid semantics stated**, so the LLM is never invited to emit a relation
the checker cannot judge. `gradeBand` moved above dispatch (it seeds the window).

**The pedagogy, not decoration:** `on`/`under` are CONTACT-scoped — *"target row =
reference row ∓ 1, SAME column (rows must be adjacent)… if there is a gap, the word is
above/below"* — while `above`/`below` allow any vertical distance. That contrast **is**
the content of the LA preposition skill.

**Catalog projection** applied (the curator only sees `id`/`description`/`constraints`;
the 2026-06-07 curriculum-fit sweep had already scored this entry 0.766 "diffuse" and
flagged "inspect spatial-scene"): the description now names prepositions and the LA use;
`constraints` states that the window follows the lesson's named words **and lists what
must not be routed here** (in/inside, between, in front of/behind, through/around/across).

## Verification

| Gate | Result |
|---|---|
| Focused suite `resolvePrepositionScope.test.ts` | **15/15** |
| Revert-bite (window forced to band default) | **2 of 15 fail** — "WIDENS only" + "CENSUS FIX"; the R1 regression guards correctly still pass |
| Full Vitest | **1,628/1,628** (145 files) |
| `typecheck:lumina` | **0** |
| `tsc --noEmit` (project-local, abs path) | **803 = HEAD baseline, 0 new** |
| Probe D — census replay, real Gemini | **PASS** |
| Probe E — math K.G.1 no-regression, real Gemini | **PASS** |

**Probe D — the census failure, replayed post-fix:**

```
place | "Put the ball on the box."        box(2,1)   → cell(1,1)   ✓ on    = ref row-1, same col, adjacent
place | "Put the star under the chair."   chair(1,1) → cell(2,1)   ✓ under = ref row+1, same col, adjacent
place | "Put the car beside the house."   house(1,1) → cell(1,2)   ✓ beside= same row, adjacent col
```

Every placement matches the injected rule exactly — the semantics are not merely
permitted, they are honored.

**Probe E — math K.G.1 consumer, unchanged:** 11 challenges across all 4 modes,
`gradeBand=K`, 4 scene objects each, options always 4 with the answer included, and
**zero out-of-K-window words** (contract R1 preserved).

## Contract

`docs/contracts/spatial-scene.md` derived in this slice (none existed; contract-first is
required before editing an existing primitive). **11 requirements** (10 OBSERVED,
1 INFERRED), **2 conflicts**.

- **C1 RESOLVED** via fork-ladder rung 3 (**config axis**). Math wants a narrow K window
  (it is the standard it teaches); LA wants containment/support prepositions. Both right
  for their consumer. Resolved without forking the primitive: the window is a per-lesson
  axis, so math resolves to an empty request and keeps R1 byte-for-byte. Rungs 1 and 2
  were rejected — the task identity is unchanged, and the axis is not the grade band
  (a G1 math and a G1 LA lesson want different windows at the *same* band).
- **C2 OPEN** — containment `in`, two-reference `between`, viewer-relative
  `in_front_of`/`behind`, and the path class `through`/`around`/`across` remain
  inexpressible on a 3×3 static grid. Queued as BACKLOG items 1 and 2.

**Notable:** the authored map (`/api/curriculum/primitive-mappings/Mathematics`, grades
K/1/2) returns **zero** subskills targeting `spatial-scene` — every consumer is
manifest-emergent, so there was no dormant authored long-tail to protect.

## Honest residuals

- **The lane's demand number did not move.** All 138 subskills still carry
  `target_primitive: ai-tutor-session`. This slice made the primitive *able* to serve
  7 of them; converting demand requires the **draft-first** curriculum re-target
  (BACKLOG item 5), which was deliberately not entered — `curriculum_published` was
  read-only throughout.
- **`in` is still unserved**, and it is the canonical example in LA004-05-B's own text
  ("Put the pencil **in** the box"). The slice serves that subskill's *shape* via
  on/under, not its exact example word. BACKLOG item 1, flagged against contract R11.
- **No browser check.** Verified via real-Gemini pipeline traces and jsdom-free unit
  tests; no component change shipped, so no pixel risk was introduced — but the
  on/under scenes have not been driven by hand in Chrome.
- Contract R11 (`place` targets an empty cell) is **INFERRED, not probed** — it becomes
  load-bearing the moment containment ships.
