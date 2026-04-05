# Eval Report: shape-composer — 2026-04-04

## Results
| Eval Mode       | API Status | Challenges | G1  | G2  | G3  | G4  | G5  | Verdict |
|-----------------|-----------|------------|-----|-----|-----|-----|-----|---------|
| free-create     | pass      | 4          | OK  | N/A | OK  | N/A | OK  | PASS    |
| compose-match   | pass      | 6          | OK  | N/A | OK  | OK  | OK  | PASS    |
| compose-picture | pass      | 5          | OK  | N/A | OK  | OK  | OK  | PASS    |
| decompose       | pass      | 6          | OK  | OK  | OK  | OK  | OK  | PASS    |
| how-many-ways   | pass      | 5          | OK  | OK  | OK  | OK  | OK  | PASS    |

## G1-G5 Sync Check: ALL PASS

### G1 — Required Fields
All eval modes return challenges with every required field populated per the contract.

### G2 — Flat-field Reconstruction
- `decompose`: flat `component0Shape`/`component0Count` fields correctly reconstructed into `expectedComponents[]` via `collectFlatComponents()`.
- `how-many-ways`: flat `allowedPiece0`/`allowedPiece1`/`allowedPiece2` fields correctly reconstructed into `allowedPieces[]` via `collectFlatStrings()`.
- Other modes use deterministic template libraries (no flat-field reconstruction needed).

### G3 — Eval Mode Semantic Differentiation
Each eval mode maps to a unique `allowedChallengeTypes` value. No overlap between modes. Output challenge types are distinct and semantically different.

### G4 — Answer Derivability
- `compose-match`: All piece targetX/targetY values within canvas bounds (400x350). Pieces have valid shapes, colors, and dimensions.
- `compose-picture`: All pictureSlots have shapes that match entries in availableShapes. Slot positions within canvas.
- `decompose`: expectedComponents match compositeDescription in all challenges. Division line hints are geometrically valid.
- `how-many-ways`: minimumPiecesNeeded values are all >0 and come from a verified KNOWN_ANSWERS lookup table (overrides Gemini output).

### G5 — Fallback Quality
Generator uses a "Gemini picks concepts, code generates geometry" architecture. Fallbacks include:
- Hint defaults (5 instances): fire only if Gemini omits hint despite schema requiring it. All produce valid hints.
- Full-type fallbacks (FALLBACKS record): fire only if Gemini returns zero valid challenges. All are correct by construction.
- No fallback fires >30% of the time in normal operation.

### Notes
- Decompose mode showed some content repetition (3 of 6 challenges resolved to "square split into 2 triangles") due to Gemini selecting similar compositeDescription values. This is a content diversity concern, not a structural failure — the template library correctly generates distinct geometry for distinct descriptions, but only 5 description templates exist. Could be improved by expanding the template library.
