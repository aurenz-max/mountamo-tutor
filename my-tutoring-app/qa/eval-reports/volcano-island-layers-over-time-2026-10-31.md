# volcano-island `layers_over_time` (2026-10-31, `/add-eval-modes`, SB-7, G4)

**Mode:** an SVG cutaway of the volcano's rock layers beside the 3D island. The learner guesses where the new layer
will go (top, middle, bottom; never graded), erupts the volcano (the island erupts; the new layer appears on top of
the cutaway), then taps the layers in order, oldest first, and presses Check. β 2.0, scaffoldingMode 2, answer `tap`.
Home: G4 `SCI004-03-c` (sequence geologic events from layers).

| Tier | Cutaway |
|---|---|
| easy | two old layers |
| medium | three old layers |
| hard | three old layers and a lava crack cutting through them (after the old layers, before the new one) |

Old layers are all different kinds (dark lava rock, grey ash, pale pumice, soil with old roots); the new layer is
lava, ash or pumice (soil forms over quiet years), never the same as the top old layer.

**Misses:** `top_is_oldest`, `crack_too_early`, `order_slip`. **Levers:** `new_layer_marked` (marks: the learner's
own new layer outlined, "your eruption made this"), `crack_marked` (marks: a zigzag where the crack cuts each layer),
`one_step_less` (two old layers, no crack).

**Verification:** `layersModel.test.ts` 6; mounted test (no new layer before the eruption, top-down is a named miss,
Try again and Start over, oldest first passes); `test:primitive volcano-island` 727/727; `typecheck:lumina` 0; full
tsc 770. Browser Grade 4 medium `drive-layers.mjs` 20/20 (screenshot `volcano-island-drive-2026-10-31/layers-g4/`).
$0 Gemini. Hard (the crack) in vitest only.

**Seen, not fixed:** the new layer can share a colour with a lower old layer (grey ash twice); the cutaway has no
words, so the learner goes by position. A texture per kind would help a K-2 learner tell them apart.
