# net-folder — support levers, 2026-10-09

Built with the W1 binding (`qa/tutor-reports/net-folder-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for net-folder). Documented = the catalog's `commonStruggles`; synthetic = the journey's scripted wrong answers.

| Mode | Failure (miss) | Class |
|---|---|---|
| count | faces and edges (or edges and vertices) in each other's boxes (`swapped_counts`) | documented ("confuses faces and edges"), synthetic |
| count | one count or several wrong, the back of the solid not counted (`faces_off`, `edges_off`, `vertices_off`, `several_off`) | inferred |
| identify | a pyramid for a prism or back (`prism_pyramid`); the right family, wrong base (`base_shape`); a curved solid (`curved_solid`) | synthetic / inferred |
| match | the opposite face (`opposite_face`), a face beside it (`adjacent_face`) | documented ("cannot match net faces"), synthetic |
| valid | valid said of an overlapping net (`missed_overlap`) or a net not of six squares (`missed_count`); invalid said of a net that folds (`rejected_valid`) | documented ("thinks invalid net is valid"), synthetic |
| surface | half the faces (`half_the_faces`), a face left out or added twice, one face, the volume, anything else | documented ("miscounts surface area"), synthetic |

## Lever table (built)

| Mode | Lever | Kind | Answers | Carrier | Leak rule |
|---|---|---|---|---|---|
| count | see_through | help | faces/edges/vertices/several_off | shown | dashed back edges, ringed corners, no number |
| count | part_names | help | swapped_counts, several_off | both | a tile outside the item, words only |
| count | net_beside (not while the net is open) | help | faces_off, several_off | shown | the solid's own net, no number |
| count | smaller_solid (none for the triangular pyramid) | simplify | all | shown | fewer faces, edges and vertices than the item, each different |
| identify | base_outline | help | all three | shown | gold outline, nothing named |
| identify | turn_to_base | help | base_shape | shown | the view only |
| identify | family_model | help | prism_pyramid, curved_solid | both | a prism and a pyramid, never the item's solid |
| identify | two_choices | simplify | all three | shown | another solid, two names, neither the item's |
| match | fold_guides (where the tier did not draw them) | help | both | shown | dashed hinges only |
| match | opposite_rule | help | opposite_face | both | a row of three squares outside the net |
| match | third_label | help | both | shown | one more square named; never the yellow one or its face; three options stay unnamed |
| match | easier_net (none when the item is already the cross with the yellow beside front) | simplify | both | shown | the cross, a different answer face |
| valid | fold_guides | help | missed_overlap, rejected_valid | shown | dashed hinges only |
| valid | six_faces_model / wrap_model / valid_model | help | missed_count / missed_overlap / rejected_valid | both | pictures outside the item; the model net is never the item's shape; no "valid"/"invalid" |
| valid | easier_net | simplify | all three | shown | the cross or a strip of six, never the item's shape, chosen without the item's verdict |
| surface | match_list | help | half/missed/extra/one_face, other_total | shown | the net numbered to the face list, no area or total |
| surface | pair_colors (a box that is not a cube) | help | half_the_faces, missed_a_face | shown | colours only |
| surface | area_vs_volume | help | volume | both | a picture, no number |
| surface | smaller_box | simplify | all six | shown | a 2×2×2, 3×2×1 or 2×1×1 box with another total |

Leak rules in code: `leverTextLeaks` (no digit; identify not the solid; match not the yellow square's face; valid no verdict word) and `practiceLeaks`. Starting positions: the existing tier sets the fold lines (`showFoldGuides`); fold_guides is then not offered. No new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `netFolderLevers.test.ts` 18/18 (leak rules over 5 count, 5 identify, every buildable match item, 21 nets, 220 boxes; builders; the miss → first lever table per mode; J12 over every built item), `NetFolder.levers.workspace.test.tsx` 6/6, `NetFolder.workspace.test.tsx` 12/12.
- Sweep `net-folder`: 5 payloads, 0 findings J1-J13; lever inventory: every miss answered on every mode.
- Replay: see the W1 report (run 2: 3 misses in 5 x 5; `no_change_before_receipt` 0/25; no key stated).

## Failures with no lever
None.

## Open
- Browser check on the lever pictures, the see-through edges and the turned solid (JSDOM only).
