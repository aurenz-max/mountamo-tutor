# Contract: net-folder

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C18) for the workspace, content and lever requirements only. A full `/primitive-contract net-folder` derivation (consumers per geometry skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/NetFolder.tsx` · **Geometry:** `netFolderGeometry.ts` · **Workspace:** `netFolderWorkspace.ts` · **Levers:** `netFolderLevers.ts` · **Generator:** `service/math/gemini-net-folder.ts` · **Adapter:** `components/live-activity/adapters/netFolderLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`net-folder`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all five modes are gesture items checked by the activity's own Check (`netCorrect`): counts from the drawn solid's geometry, the solid id, the face the yellow square folds to, the fold's verdict, the sum of the face areas. Each wrong check names a `NetFolderMiss` from the catalog list. Scene facts name what is drawn and asked; never a count, an identify item's solid, the yellow square's face, the verdict, or the total. Try again clears the boxes and the tap and keeps the view; Next and the scripted tutor messages are off on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C18.
- **Evidence:** `NetFolder.workspace.test.tsx` 12; sweep J1-J13 on 5 payloads, 0 findings; replay 5 x 5 (`qa/tutor-reports/net-folder-w1-2026-10-09.md`).
- **Probe:** `NetFolder.workspace.test.tsx`; `journeySweep -t net-folder`.

### R2 — every item is drawn as itself and can be answered from the screen · OBSERVED (2026-10-09)
- **Property:** each solid is drawn from its own vertices (a triangular prism or pyramid was drawn as a cube, a square pyramid as tilted rectangles), and each net from its own faces. match_faces and valid_net draw the item's own cube net, built by code; the fold decides the answer. identify and count give each item its own solid (five items on one solid had one answer five times). Nothing prints an identify item's solid name (the header badge and title did), the count feedback never prints the right counts, and face-match taps are off on match_faces and valid_net. A surface-area item's box, net and L/W/H come from its own faces.
- **Probe:** `NetFolder.workspace.test.tsx` (geometry, header, match net); `gemini-grade-band-sweep.test.ts`.

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `netFolderLevers.ts` declares levers on every mode, and every catalog miss is answered by a lever on every item the generator builds. Leak rules in code (`leverTextLeaks`, `practiceLeaks`): no digit in lever words or facts; identify's never name the solid; match's never name the yellow square's face; valid's never say valid or invalid; model pictures are never the item's solid or net shape; a practice item keeps the mode, has its own `~simpler` id and never the item's answer, ungraded. fold_guides is not offered where the tier already draws the fold lines (the tier is the starting position).
- **Evidence:** `netFolderLevers.test.ts` 18, `NetFolder.levers.workspace.test.tsx` 6; sweep J9/J12/J13 0 findings (`qa/eval-reports/net-folder-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding, content repair and levers, C18).
