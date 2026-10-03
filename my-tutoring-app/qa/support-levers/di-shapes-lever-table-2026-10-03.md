# di-shapes: failure inventory and lever table (2026-10-03)

**BUILT 2026-10-03** (rulings R1-R10 as recommended): `qa/eval-reports/di-shapes-levers-2026-10-03.md`. `/add-support-tiers` Phases 1-2, DI family 3 of 10.
Rulings carried over (2026-10-02): DI gets in-item levers; DI's correction is a parallel-item model (a different
shape, solved, beside the child's; "My turn" on the model, then back to the child's shape). The child answers out
loud; no lever turns the answer into a tap.

## Phase 1: failure inventory

Evidence: **no observed-real.** `logs/demonstrations` has no di-shapes entries; `qa/misconception` has none.
Synthetic = the `spoken_miss` ids from `shapesSpokenMisses` (`diShapesWorkspace.ts`, shape-sorter's
`SpokenShapeMiss` ids), named 5/5 on both saved payloads in the 09-29 sweep (`sweep-inventory-2026-09-29.json`).
Documented = catalog `commonStruggles` (seven patterns). There is no `docs/contracts/di-shapes.md` yet (Phase 3
derives it). Saved payloads exist for **name_shape and count_sides only**; shape_review, find_real_object and
count_corners have none.

Every mode has a miss list in the catalog (`missLists<SpokenShapeMiss>`, di.ts:596).

| Mode (β) | Failure | Class |
|---|---|---|
| name_shape (1.5), shape_review (2.5) | names the look-alike shape: square for rectangle, circle for oval, pentagon for hexagon (`near_name`) | synthetic + documented |
| name_shape, shape_review | names another shape (`other_shape_name`) | synthetic + documented |
| name_shape, shape_review | describes instead of naming ("it's round", "the pointy one", a colour) | documented; **no miss id** (lands as no match) |
| name_shape, shape_review | fails a variant drawing (scalene triangle, tall rectangle) that it names as a prototype | inferred (the L4 exemplar axis exists for this; no run has shown it) |
| find_real_object (3.0) | names the object, not its shape (`said_object`) | synthetic |
| find_real_object | `near_name`, `other_shape_name` | synthetic + documented |
| count_sides (3.0), count_corners (3.5) | off by one: double-counts the start, or skips the side it started on (`one_short`, `one_over`) | synthetic + documented |
| count_sides, count_corners | off by more (`short_by_more`, `over_by_more`) | synthetic |
| count_sides, count_corners | says the shape's name instead of a number (`said_shape_name`) | synthetic + documented |
| count_corners | skips or double-counts a corner more often than a side (a point, not an edge) | documented in the β rationale; same miss ids |
| all | stays silent after the ask | documented; no lever (the tutor waits; the model is there if they do not know how to start) |
| all | young-child pronunciation ("twiangle") | documented; a judging rule, not a failure |

Content is not broken on the two saved payloads (J sweep clean 09-29), so nothing blocks measuring.

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| name_shape, shape_review | near_name, other_shape_name (+ the proposed `described_shape`) | `model_shape`: a small card beside the stage with a DIFFERENT shape drawn at a rotation like the item's, solved. The tutor says "My turn: this shape is a hexagon", then asks about the child's shape | help | both (the drawing is shown; the name is voiced, a printed name is optional and carries nothing at K) | Model shape is not the item's shape, not `NEAR_SHAPE[item]`, and none of its names (with `SHAPE_ALTERNATES`) is an accepted answer for the item (rhombus/diamond). Not the shape of a session item still to come. `does` forbids saying what the model means for the child's shape | no (stage draws the item only) | picker + leak check, model card render (reuse `ShapeStage` small) |
| find_real_object | said_object, near_name, other_shape_name | `model_object`: a card with a DIFFERENT code-drawn object, its outline traced, solved: "My turn: the clock face is a circle" | help | both | Model object is not the item's object; its shape is not the item's shape, not `NEAR_SHAPE[item]`, and not an accepted alternate (kite = diamond = rhombus). Not an object of a session item still to come (six objects exist; a five-item session leaves at least one, plus the credited ones) | no | picker + leak check, card (reuse `RealWorldShapeObject` small) |
| count_sides | said_shape_name, one_short, one_over, short_by_more, over_by_more | `model_count`: a card with a DIFFERENT polygon, its sides marked one at a time from a start dot (a tick on each side, no numerals); the tutor says the total only: "My turn: this shape has five sides" | help | both | Model count is not within 1 of the item's count (3 → 5 or 6; 4 → 6; 5 → 3; 6 → 3 or 4); model shape not the item's shape; no numeral drawn; the tutor does not count the model aloud (a walk past the item's count says the answer), and never says the model's or the item's shape name | no | picker + leak check, model card with side ticks |
| count_corners | same as count_sides | `model_count` on corners: a dot on each corner of the model, from a start corner | help | both | Same as count_sides, on corners | no | same module, corner variant |
| count_sides, count_corners | one_over, one_short | `start_mark`: one dot on one side (or corner) of the child's own shape: "start here, stop when you are back" | help | shown | One mark only; no number, no order, no second mark | no | render (one mark inside the rotated/scaled `<g>`) |
| count_sides, count_corners | one_short, one_over, short_by_more, over_by_more | `touch_marks`: each side (count_sides) or corner (count_corners) of the child's shape can be tapped; a tapped side gets a thicker stroke, a tapped corner a ring. No numbers, no order | help | shown | Marks only what the child taps; never counts, numbers or orders the marks; the scene fact gives no count of marks | no (the shape is one `<polygon>`) | new capability: per-side `<line>` and per-corner hit targets under the same transform |
| name_shape, shape_review | near_name, other_shape_name | `plain_drawing`: an ungraded practice item, a DIFFERENT shape drawn as the prototype, upright, full size; then the full item returns | simplify | both | Practice shape is not the item's shape, not `NEAR_SHAPE[item]`, not an accepted alternate, not a shape of a session item still to come. Offered only when the item is a variant, rotated past the gentle band, or scaled below 100 (otherwise there is no step to drop) | builder exists at generation only (tier → exemplar/rotation/scale) | runtime builder (`buildChallenge` with prototype/0°/100) |
| count_sides, count_corners | one_short, one_over, short_by_more, over_by_more | `fewer_sides`: an ungraded polygon with fewer sides, prototype, upright, full size (item 4 or 5 → triangle; item 6 → square) | simplify | both | Practice count is not the item's count; practice shape not the item's shape; refused on a triangle (nothing smaller) | no | runtime builder |

### Rejected and no-lever rows

- **In-item help on the naming modes** (side ticks, corner dots, an outline trace on the child's shape). Naming
  is recognition: the relation between the drawing and its name is the answer. Ticks also turn naming into
  counting (three ticks → triangle). name_shape and shape_review get only the model (outside the item) and
  `plain_drawing`.
- **A contrast model with the look-alike shape** (a rectangle modelled beside a square). Square/rectangle and
  circle/oval are two-shape confusion sets, so naming the other one answers the item by elimination. The leak
  rule excludes `NEAR_SHAPE[item]` from every model and every practice item.
- **A simpler drawing of the same shape** (the item's triangle redrawn upright and plain). Its answer is the
  item's answer, so the child would repeat it on the full item.
- **find_real_object simplify: no lever.** The one structural step down is the bare outline, which is
  name_shape, a different mode. The six objects are each drawn one canonical way, so no object is simpler in
  shape than another. The model is the only lever.
- **Outline traced on the child's object** (find_real_object help). It does the mode's defining work (finding
  the shape in the object) and leaves name_shape. Rejected.
- **Describing words, silence:** the model answers "does not know how to start". No other lever.

### Miss list change (build work)

`described_shape` for name_shape, shape_review and find_real_object: "The learner's answer describes the drawing
(round, pointy, a colour or a size word) and names no shape." It is the documented struggle the current misses do
not name, and the model answers it. Add it to `shapesSpokenMisses` and the catalog list in the same change.

## Phase 6: starting positions

The generator already stamps `supportTier` per challenge (`gemini-di-shapes.ts`, `normalizeSupportTier`).
Same rule as di-math-facts and di-dice-roll:

| Tier | Starts on screen (not a pull, never recorded) |
|---|---|
| easy, or no tier | `model_shape` / `model_object` / `model_count` for the item's mode |
| medium | none |
| hard | none |

The L4 structural shape per tier (exemplar, rotation band, scale) stays as it is. `start_mark` and `touch_marks`
start released at every tier; they are pulls.

**Finding: the tier's meaning conflicts with ruling 2.** `diShapesScript.ts` composes easy as "model + guide"
and medium as "model" of the child's OWN shape ("Listen: this shape is a triangle"), and the catalog tutoring
block says "Model the answer once yourself" (level2) and "Say the answer together once" (silent struggle). On the
bound path the tutor gets `tutoring: null` (`components/live-activity/adapters/adapterContract.ts`), so these do
not reach it today, but the scene still publishes a bare `supportTier` fact with no meaning attached. The slice
adds the di-math-facts guidance sentences ("Never model this shape; your model is the model lever, a different
shape solved beside it. The support fact says where levers start.") and `levers: true` to the catalog entry.

## Build notes

- **Shared stage:** nothing new. `DiTeachingStage` already takes `levers` and owns pull state and the practice
  item. The "not a session item still to come" rule needs the session's items: build the `levers` object in a
  `useMemo` over `items` in `DiShapes.tsx` instead of a module constant (dice uses a constant `LEVERS`).
- **Tap targets:** per-side and per-corner targets must sit inside the same rotate/scale transform as the
  polygon, with a hit stroke wide enough for a child's finger after scaling. Put the click handler on the
  `<line>`/`<circle>` elements, not on the `<g>` (jsdom does not dispatch clicks to `<g>`; see the SVG memory).
- **Model geometry:** the model card reuses `geometryFor`; side ticks and corner dots read `points` directly,
  so the invariant "point count = corners" (`diShapesGeometry.test.ts`) already protects them.
- **Missing payloads:** make `w1-payloads/di-shapes.shape_review.json`, `di-shapes.find_real_object.json`
  and `di-shapes.count_corners.json` (one Flash generation each) so J1-J9 and the replay cover every mode.
- **Unit tests to write:** every drawable shape × mode has a non-leaking model; `NEAR_SHAPE` and alternates
  never appear in a model or practice item; builders never return the item's shape or count; miss → `nextLever`
  table, including `described_shape`.
- **Class gate:** no Live run for this family; the DI class Live pair waits until all DI modes have levers.
