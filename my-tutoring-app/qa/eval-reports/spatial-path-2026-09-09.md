# Eval Report: spatial-path — 2026-09-09

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| choose_route (L0) | PASS | — |

The live registry generated five challenges covering through, around, across, over, and
under. Every challenge exposed five distinct path geometries with one shared start and
finish. Correct slots were `[1, 0, 4, 3, 2]`, preventing a stable number/color answer
pattern. Component runtime tests confirmed that the green key and relation labels stay
hidden until submission and that replay uses the selected SVG path.

`spatial-path` is intentionally L0 and has no `evalModes` catalog ladder yet, so the
dedicated endpoint returned `catalogMeta: null` and skipped its catalog-type validator;
the full payload was instead checked by the generator oracle and component drive.

