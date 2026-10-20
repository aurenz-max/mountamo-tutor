# Contract: spatial-path

- **Born:** 2026-09-09
- **Component:** `primitives/visual-primitives/math/SpatialPath.tsx`
- **Generator:** `service/math/gemini-spatial-path.ts`
- **Catalog:** `service/manifest/catalog/literacy.ts`
- **Status:** ACTIVE — L1 `choose_route` (one eval mode, beta 2.5), boss (tap preset + commit) + lever set (2026-10-20)

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
has no green highlight and no relation label. A correct check turns the key green and labels
it; a wrong one replays and labels the chosen route only, contrasting the requested and
selected relations, since Try again reopens the same map. Probe: `SpatialPath.workspace.test.tsx`
(R3, R4).

### R4 — the selected geometry is animated · OBSERVED

Submitting a route creates an SVG `animateMotion` whose `path` is the selected route's
exact `d` value. Animation is evidence replay, not the scoring mechanism.

### R5 — multi-instance evaluation is canonical · OBSERVED

The generator builds 3–6 challenges (five by default) and covers `through`, `around`,
`across`, `over`, and `under` in the default run. Completion submits the canonical nine
metrics plus per-attempt route identity/relation evidence.

### R6 — workspace binding (boss, tap preset) · OBSERVED

Taught only on the workspace (`withWorkspaceOnly`; wiring `spatialPath.card.ts` +
`spatialPath.boss.ts`, `tapBoss` with `commit: 'Animate this route'`). The map commits each
check through `progress.commitCheck` with the named miss `went_<relation>`
(`spatialPathWorkspace.ts`); no route number, correct id or unchecked route's movement reaches
the tutor; the shell owns Try again and Next; there is no scripted path. Probe:
`SpatialPath.workspace.test.tsx`.

### R7 — levers never single out a route of the item · OBSERVED

One lever set (`ROUTE_LEVERS`). `word_picture` (model; when it comes is the lesson's
support tier, medium by default) draws a model outside the map (no route `d`, no number);
`watch_each` (marks) walks every route the same way; `three_routes` is an ungraded three-route map in another
scene asking the confused-with word, never drawing the item's asked route
(`practiceLeaks`). Probes: `spatialPathLevers.test.ts`, `SpatialPath.levers.workspace.test.tsx`.

## Generation boundary

Route geometry, relations, correct IDs, and challenge density are code-owned. Gemini may
write answer-free title/description wrapper copy only. Invalid wrapper output falls back
to local copy without changing the challenges.

## Deferred ladder

- `draw_route`: child-created path geometry rather than route selection.
- `follow_multi_route`: sequence two or more directional-preposition legs.
- Starting positions from `config.difficulty` and procedural sound remain later layers.

## Log

- 2026-10-20: moved onto the boss framework. The scripted path (useLuminaAI cues, own Next and
  Try another route, scripted completion) and the hand-wired Pip surface are deleted. R3 and
  R6 re-based onto the workspace (the scripted path showed the key after any check; the
  workspace shows it only after a right one). R4's probe moved from the deleted
  `SpatialPath.test.tsx` (unbound mount) to a bound mount. The generator passes the lesson's
  `supportTier` through for the word picture's support fact.
