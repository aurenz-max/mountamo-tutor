# 3d-shape-explorer levers (2026-10-08 class sweep)

`/add-support-tiers` on all five modes. Every answer is spoken; misses already existed (`threeDShapeSpokenMisses`).

## Failure inventory

Evidence: no real-learner data (no demonstrations, tutor or misconception reports for this id). Sources: catalog
`commonStruggles` (documented), the pack's scripted signature wrongs in `threeDShapeExplorerHarnessAnswers`
(observed-synthetic), and the miss lists.

| Mode | Misses (class) |
|---|---|
| identify_3d | flat_look_alike (documented), similar_solid (synthetic), other_solid (inferred) |
| match_real_world | said_object (documented), flat_look_alike, similar_solid, other_solid (inferred) |
| 2d_vs_3d | opposite_dimension (synthetic), said_shape_name (inferred) |
| faces_properties | off-by counts (documented), said_other_surface / said_all_surfaces (inferred), opposite_verdict (documented: roll/slide/stack), said_solid (documented), side_view_shape / other_flat_shape (inferred) |
| shape_riddle | similar_solid (documented: fits only some clues), flat_look_alike, other_solid (inferred) |

## Lever table (built)

| Mode / item | Lever | Kind | Carrier | Answers | Leak rule |
|---|---|---|---|---|---|
| identify | `see_through`: dashed back edges/curves on the learner's solid | help | shown | flat_look_alike, other_solid | names nothing |
| identify (not sphere) | `face_prints`: each flat face drawn flat once | help | shown | similar_solid, other_solid | no number, no name |
| match | `solid_shelf`: five solids, unlabeled, fixed order | help | shown | all four | none marked, no names |
| match | `model_object`: different object + its solid | help | both | said_object, other_solid | never the item's solid, its nearest solid, or a later item's solid/object |
| 2d_vs_3d | `edge_view`: same shape turned (flat -> thin line) | help | shown | both | fact never says flat/solid |
| faces: counts, can-it-move, face shape | `tint_surfaces`: flat amber, curved blue | help | shown | surface-kind misses; curved counts also off-by; opposite_verdict; said_solid | not on "does it have any ..." (untinted kind is the answer) |
| faces: flat counts | `face_prints` | help | shown | off-by | no number |
| faces: yes/no, face shape | `model_property`: different solid rolling/stacked/sliding/tinted/one face printed | help | both | opposite_verdict; said_solid, side_view_shape, other_flat_shape | model face never the item's face or its near names |
| faces: flat counts 2+ | `fewer_faces`: count on a solid with fewer flat faces (cube->cylinder->cone) | simplify | both | off-by | never a solid a later item is about |
| riddle | `solid_shelf` | help | shown | all three | as above |

Code leak rule: `leverLeak` drops any lever fact that states the answer or an accepted form; `does` texts are tested
against it per item. Easy tier: count items start with `tint_surfaces` (not recorded as a pull).

No simplify on identify, match, riddle, 2d_vs_3d, yes/no or face-shape items: one solid and one spoken word is the
plainest shape; a name menu is the retired lower mode (catalog beta notes); a riddle with a clue dropped is no longer
unique. `solid_shelf` on match/riddle is pictures only, never names, so it is not the retired 1-of-4 name menu.

## Modes left without levers

None. Every catalog miss has a lever on every saved payload item (unit test over all five payloads plus every
solid x item kind), so no `unanswered` entry. Per-item gap that can occur off the payloads: `model_property` is the
only lever for "does it have any ..." items and for side_view_shape / other_flat_shape; it exists whenever some
solid outside {item, its nearest solid, later items' solids} has the property, which holds for every single-solid
property session but could fail in a mixed session naming four or more solids after it.

## Built

- `threeDShapeExplorerLevers.ts` (new): declarations, models, `simplerFaces`, `simplerFromId`, facts, `leverLeak`.
- `ThreeDShapeExplorer.tsx`: lever state + practice item, `pullLever`/`endPractice`, tint/see-through in `Shape3DSVG`,
  face prints, edge view, shelf, model cards.
- Catalog: `levers: true`; guidance sentence on levers. Journey row rebuilds `~simpler` items.

## Tests

- `threeDShapeExplorerLevers.test.ts` 151 pass; `ThreeDShapeExplorer.levers.workspace.test.tsx` 8 pass (pull = screen +
  fact in one commit, next attempt records the lever, refused pull changes nothing, practice keeps on retry, full item
  back blank and credited, easy start not recorded).
- Existing: `ThreeDShapeExplorer.workspace.test.tsx`, `shapeFamiliesSpokenMisses.test.ts`, di-script test,
  `activityContract.test.ts`, `lessonWorkspacePlan.test.ts` all pass. `typecheck:lumina` 0.
- Not run (batch step): journey sweep, tutor replay. Needs a browser look at the drawings (dashed lines, tint, prints).
