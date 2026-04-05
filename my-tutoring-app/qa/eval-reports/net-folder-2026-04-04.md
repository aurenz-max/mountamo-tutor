# Eval Report: net-folder — 2026-04-04

## Results
| Eval Mode                   | Status | Challenges | Issues |
|-----------------------------|--------|------------|--------|
| identify_solid              | PASS   | 5          | —      |
| count_faces_edges_vertices  | PASS   | 4          | —      |
| match_faces                 | PASS   | 4          | —      |
| valid_net                   | PASS   | 4          | —      |
| surface_area                | PASS   | 4          | —      |

## G1-G5 Sync Check: ALL PASS

### G1 — Required fields per challenge type
All 5 eval modes produce challenges with every required field populated per the contract.

### G2 — Flat-field reconstruction audit
Flat indexed fields (option0-3, faceOption0-3, face0Width/Height through face5Width/Height) correctly reconstructed into arrays via `collectStrings` and `collectFaceDimensions`. All responses have populated arrays.

### G3 — Eval mode semantic differentiation
Each eval mode maps to a unique challenge type. No overlap.

### G4 — Answer derivability
- **identify_solid**: targetAnswer present in options[] for all challenges.
- **match_faces**: targetAnswer present in faceOptions[] for all challenges.
- **valid_net**: targetAnswer derived deterministically from isValidNet boolean.
- **surface_area**: targetAnswer computed server-side as sum of face areas (verified: 52, 94, 104, 202 all correct).
- **count_faces_edges_vertices**: Component checks against solid.faces/edges/vertices directly (always derivable).

### G5 — Fallback quality audit
All fallback paths produce correct data:
- Solid geometry lookups fall back to cube (valid geometry).
- Options/faceOptions fallbacks derive from grade pool or solid faceLabels.
- Surface area unitLabel defaults to "square units".
- Empty-challenge fallbacks use pre-validated FALLBACKS record (all fields correct, surface_area targetAnswer=96 matches 6x4x4).
