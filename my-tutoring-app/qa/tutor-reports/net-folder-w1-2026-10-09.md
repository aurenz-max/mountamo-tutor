# net-folder — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C18. `withWorkspaceController`: the scripted path is kept (retry until correct, Next). Not committed.

## Modes and what code checks
All five catalog modes are gesture items checked by the activity's own Check (`netCorrect`, `netFolderWorkspace.ts`). No `expectedAnswer`, no key in the scene facts.

| Mode | Learner input | Checked against | Misses (`netFolderMiss`) |
|---|---|---|---|
| count_faces_edges_vertices | type Faces, Edges, Vertices, Check | counts from the drawn solid's vertices | swapped_counts, faces_off, edges_off, vertices_off, several_off |
| identify_solid | tap a solid name, Check | the item's solid id | prism_pyramid, base_shape, curved_solid |
| match_faces | tap a face name, Check | the face the yellow square folds to (code fold of the drawn net) | opposite_face, adjacent_face |
| valid_net | tap Valid net / Invalid net, Check | whether the drawn net folds (code fold) | missed_overlap, missed_count, rejected_valid |
| surface_area | type the total, Check | sum of the item's face areas | half_the_faces, missed_a_face, extra_face, one_face, volume, other_total |

## Fixed on both paths (the binding could not be honest without these)
- **Solids were drawn wrong.** The CSS box drew a triangular prism and a triangular pyramid as a cube and a square pyramid as tilted rectangles, and every non-box net as the cube's cross. Solids are now projected from their own vertices (`netFolderGeometry.ts`, SVG) and each solid has its own net. The default `l_shape` cube net put both flaps on one side: it did not fold into a cube.
- **match_faces was trivial or impossible.** The net labelled every square with its face, the yellow square's own label was the answer, and the yellow was never drawn. Now code-built: a cube net from the eleven, two squares labelled (front and one beside it), one square yellow with "?"; the fold decides the answer.
- **valid_net could not be answered.** The net was described in words that were never shown; the screen always drew the solid's own (valid) net. Now code-built from the eleven cube nets and ten arrangements that do not fold; the fold decides the verdict.
- **identify printed its answer** in the header badge and the title; and five items on one solid had one answer five times (count too). Each identify and count item now has its own solid; the model's words are dropped when they name or describe the solid.
- **count's wrong-answer feedback printed the right counts** ("you said 5, it's 6"); it now names only which counts are off.
- **surface_area showed L/W/H of the drawn solid's pixel size** (80, 100) beside face sizes from another box. Each item's box, net (with unit squares) and L/W/H now come from its own faces; faces that are not a box are rebuilt by code.
- **Workspace only:** Next hidden; scripted tutor messages muted; face-match taps off on match/valid (the correspondence is the answer).

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `NetFolder.workspace.test.tsx` 12/12; `MathWorkspaces.surface`, `gemini-grade-band-sweep` pass.
- `components/live-activity` + `misses.test.ts`: 36 files, 3543 passed, 3 failed — all three `transformation-lab.*` sweep payloads (a sibling's binding in progress, not this one).
- Sweep `net-folder`: 5 payloads, 25 items, 0 findings (J1-J13). J10 clean 100/100, J11 recover 67/0 on every mode.
- Harness fix (class, journeySweep J3): the shared gesture host message "The board checked it: not right." counted as the key "right" on a direction answer. The verdict sentence is now stripped before the key count, as JSON booleans already were. 0 other baselines touched.

## Tutor replay (5 payloads x 5 samples)
- Run 1 (`replay/net-folder-2026-10-09.json`): 4 misses, all surface_area `no_fix_before_try` ("try adding all six faces" after half the total). Fix: guidance's "Surface area adds the area of every face" removed; "or which faces a wrong total left out" added to the never-list.
- Run 2 (`-r2.json`): 3 misses in 125 checks per moment class: surface_area `no_fix_before_try` 2/50 (miss, lever), valid_net stuck `no_protocol_leak` 1/25 ("pulling the guide lever").
- Read by hand: no reply states a count, the solid, the yellow square's face, a verdict or the total. One match "stuck" reply asked "Which face is opposite the top?" on an item whose answer is bottom: a leading question, not the key.

## Undriven modes
None.

## Open findings
1. Needs a browser check on the projected solids (drag to turn, the five shapes) and the nets. Everything ran in JSDOM.
2. Replay: "add all six faces" after a half total, 2/50 after the one guidance fix; tool name voiced ("lever") 1/25, a class issue for the shared doctrine.
3. The scripted tutoring block (`tutoring.scaffoldingLevels.level3`) names `{{solidName}}` and `{{faces}}`; it reaches only the scripted path and goes when that fallback is retired.
