# Contract: spatial-path

- **Born:** 2026-09-09
- **Component:** `primitives/visual-primitives/math/SpatialPath.tsx`
- **Generator:** `service/math/gemini-spatial-path.ts`
- **Catalog:** `service/manifest/catalog/literacy.ts`
- **Status:** ACTIVE — L0 `choose_route`

## Curriculum consumer

Kindergarten Language Arts `LA004-05-H`: create and follow multi-step instructions
using directional prepositions (`through`, `around`, `across`). The implementation also
contrasts `over` and `under` because the requested presentation contract names them.

## Requirements

### R1 — route geometry owns correctness · OBSERVED

Every candidate route has a unique `geometrySignature`. `correctRouteId` resolves to a
route whose `relation` equals `requestedRelation`; the checker compares route IDs and
never coordinates of the final stop.

### R2 — all candidates share one start and finish · OBSERVED

Every route in a challenge starts at `(60,160)` and ends at `(540,160)`. Therefore two
different movement relations cannot be satisfied merely by reaching the same final cell.

### R3 — obstacle and candidates remain visible; the key stays hidden · OBSERVED

Before submission the scene shows the landmark and all candidate paths. The correct path
has no green highlight and no relation label. After submission the correct geometry turns
green, the chosen route is replayed, and the requested/selected relations are contrasted.

### R4 — the selected geometry is animated · OBSERVED

Submitting a route creates an SVG `animateMotion` whose `path` is the selected route's
exact `d` value. Animation is evidence replay, not the scoring mechanism.

### R5 — multi-instance evaluation is canonical · OBSERVED

The generator builds 3–6 challenges (five by default) and covers `through`, `around`,
`across`, `over`, and `under` in the default run. Completion submits the canonical nine
metrics plus per-attempt route identity/relation evidence.

## Generation boundary

Route geometry, relations, correct IDs, and challenge density are code-owned. Gemini may
write answer-free title/description wrapper copy only. Invalid wrapper output falls back
to local copy without changing the challenges.

## Deferred ladder

- `draw_route`: child-created path geometry rather than route selection.
- `follow_multi_route`: sequence two or more directional-preposition legs.
- Tutoring, visible support tiers, structural difficulty, and procedural sound remain
  later lifecycle layers.

