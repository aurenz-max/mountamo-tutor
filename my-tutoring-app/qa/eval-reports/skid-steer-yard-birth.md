# Birth Certificate — skid-steer-yard (2026-11-04)

**Lifecycle layer: L1 (born, then eval-dense in the same push)** — two modes, both bound to the teaching workspace.

Trigger: a user's K-5 "skid steer" lesson was much worse than excavator / dump truck / freight train lessons.
Topic-trace showed why: those topics each get a dedicated sim (`excavator-arm-simulator`, `dump-truck-loader`,
`hydraulics-lab`, `train-yard`); skid steer had none, so its hands-on slots went to `wheel-axle-explorer` (a winch),
`push-pull-arena`, `construction-site-diorama` (an excavator) and an empty `di-spoken-practice`.
After this birth, two manifest-only traces both select `skid-steer-yard[set_levers]` for "how it turns" and
`skid-steer-yard[match_attachment|mixed]` for the attachments objective. No curator or manifest rule was added.

- Modes: `match_attachment` (β −1.5) — pick the attachment a job needs; `set_levers` (β −0.5) — set the left and
  right wheel levers to turn to face a thing. Mixed: 2 jobs, then 3 turns.
- Generator fork: **C (code-only)** — `service/engineering/skid-steer-yard-generator.ts`; `resolveEvalModes` only
  when no mode is pinned. Difficulty = `config.difficulty` (K-2 default easy, 3-5 medium):
  - match_attachment: easy 3 tools without the near miss; medium 3 with it; hard 4 with it.
  - set_levers: room ramp open → wall in front/behind (one pivot bumps) → boxed (only the spin fits);
    `roomHolds` checks every item.
- Model: `skidSteerModel.ts` — exact differential-drive arcs (`poseAt`), SAT collision, the checks, the feedback.
  The 3D scene animates the same `poseAt` the check judges.
- Workspace binding: `skidSteerWorkspace.ts` + `skidSteerYard.card.ts` + `skidSteerYard.boss.ts` (bespoke);
  response gesture for both; misses `near_tool`, `wrong_tool` / `wrong_way`, `drove_straight`, `bumped`; no key
  reaches the tutor. `boss-card.mjs` printed; journey sweep drives both modes through the real DOM buttons.
- Checks: typecheck:lumina 0; full tsc 771 (no error in or naming these files); `test:primitive skid-steer-yard`
  737 + 11 sweep rows pass; model tests 17 pass; `/eval-test` pass for both modes at K-2 and 3-5.
- Browser (headless Chrome, swiftshader): set_levers 22/23 and match_attachment 20/21. The only failures were
  console noise: Pip `<ellipse rx>` (pre-existing, also in the 10-14 airplane logs) and the not-signed-in evaluation
  submit.
- Answer-leak audit: asks name the thing or the job, never the side, lever setting or tool (tested). Levers show arrows
  only; no ghost path; skid marks appear only during a move. Jobs start with a bare plate. Wrong-tool feedback
  describes the wrong tool, never the right one (tested). The right tool's slot is random (tested).
- Design gate: manipulation pass (levers ARE the steering; tools click on the plate) · simulation pass (real
  kinematics, collisions, the tool does or fails the job) · production pass for set_levers, recognition by design for
  match_attachment (choosing a tool is the skill) · timer pass (none) · layout-leak pass (above).
- Pip: framework (PipDock + PipWorkspace); WorkspacePip.surface.test passes.
- Curriculum home: **not run** — `/curriculum-fit skid-steer-yard` is queued below.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/curriculum-fit skid-steer-yard` | home | Confirm a K-5 engineering/machines skill routes here; topic-trace already selects it for "skid steer" |
| 2 | `/add-eval-modes` | L1 | `predict_turn` (levers preset, say/tap which way it goes: β ≈ −1.0) and `drive_course` (plan 2-4 moves through a yard, fewest moves: β ≈ +0.5) |
| 3 | `/add-support-tiers` | L3 | set_levers help: replay the last move slowly with the moving side's wheels lit; simplify: open the yard one room step. match_attachment help: show each offered tool doing its own job in a thumbnail; simplify: drop one wrong tool |
| 4 | `/add-sound` | L5 | lever clunk, tool click-on, engine rev on Go, bump thud |
| ✓ | `/eval-test skid-steer-yard` | QA | after every layer |

Known visual nits (browser): the auger job's hole is partly hidden behind the machine from the start camera; the
camera is fixed behind the machine (drag to orbit works).
