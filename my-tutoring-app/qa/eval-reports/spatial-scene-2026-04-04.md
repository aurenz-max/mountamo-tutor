# Eval Report: spatial-scene — 2026-04-04

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify | PASS | — |
| place | PASS | — |
| describe | PASS | — |
| follow_directions | PASS | — |

## Notes — Resolved Issues

### SS-1: Nullable scene object fields cause empty grids (SP-14) — FIXED
- **Was:** All `sceneObj*` fields were `nullable: true`. Gemini Flash Lite frequently omitted them, causing empty grids with missing reference objects.
- **Fix:** Removed `nullable: true` from all sceneObjFields. Added all scene object fields to schema `required` arrays. Added post-process rejection of challenges with 0 scene objects.

### SS-2: Only 2 scene object slots — grid always 78%+ empty — FIXED
- **Was:** `sceneObjFields(2)` created max 2 object slots for a 9-cell grid, making scenes look barren.
- **Fix:** Increased to 4 scene object slots (all required). Updated prompts to request 2 key objects + 2 backdrop objects. Updated fallbacks with 4 objects each. All modes now generate 4 objects per challenge consistently.

### SS-3: No guarantee targetObject is in sceneObjects — FIXED
- **Was:** `targetObject` and `sceneObjects` were independent — target could highlight an empty cell. Reference object could also be missing from the grid.
- **Fix:** Post-process derivation: after reconstruction, check if targetObject exists in sceneObjects by position match; inject if missing. Also check referenceObjectName against scene objects; inject with unused grid cell if missing.
