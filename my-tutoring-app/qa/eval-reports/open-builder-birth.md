# Birth Certificate — open-builder (2026-10-06)

**Lifecycle layer: L0 (born)**: pedagogically sound, measurable, single core mode, bound to the teaching workspace.
New domain `creation`, with its own tester (Developer Tools → Creation Primitives). Successor in intent to
construction-sequence-planner, which is untouched.

- Core task identity: `build_to_goal` (β 0.0). The child builds freely from a hopper to meet an open goal. The build log (step order) is the sequence. Many builds pass.
- Model: `openBuilderModel.ts`. Code owns physics only: `solid` drops and stacks, `cap` is a roof (nothing stacks on it), `fixture` attaches to a placed piece. A preset is a skin. `construction` is the first preset, with 16 pieces.
- Check: the inspector, `service/creation/gemini-open-builder-judge.ts` on gemini-flash-latest, reached through the `/api/lumina` action `judgeOpenBuild`. It reads the raw build JSON (pieces in step order and what each rests on) and returns met, a miss, offPieces (shown as a glow), noticed and a nudge question.
  - Feasibility: `qa/open-build/judge-*.json` scored 81/81 on raw JSON. Flash-lite told the child the fix, so it is not used.
  - On generated projects: 20/20 in substance. Reference builds and shifted variants were met. Missing roofs were `missing_part`. Fixtures moved after the roof were `wrong_order`. The single "fail" was a mislabeled case whose order still held.
  - Child-facing text had no ids, rows or columns after one prompt fix.
- Generator fork: B orchestrator. It asks 4 projects from shuffled code seeds and ships 3. Each project needs a goal, judgeRules, a hopper and a referenceBuild. The reference build is run through the real physics and hopper (one repair round), and the inspector must pass it. A goal that names a column or row is rejected. The hopper always holds at least one kind of piece the build does not need.
  - eval-test: K, G2 and G4 each passed 3/3. Generation takes 20-29 s (two flash-latest calls per project).
- Fairness rule: any order that matters is stated in the goal the child hears. The judge ignores a rule the goal does not ask for (one generated K rule had added "an opening to crawl inside").
- Workspace binding: `openBuilderWorkspace.ts`. Response is `gesture`. Misses: `missing_part`, `wrong_order`, `does_not_belong`, `not_usable`. The scene carries the build in words, the pieces left and what the inspector said, never the reference build.
  - Checks: `OpenBuilder.workspace.test.tsx` 5/5. live-activity plus catalog: 37 files, 2320 tests green. `typecheck:lumina` 0.
  - Journey sweep: J1-drivable is baselined. The sweep has no model for the inspector, the same limit as number-tracer's drawn modes.
  - **Tutor replay: NOT RUN.** It records 0 moments because the sweep cannot drive an inspector-judged item. It needs a judge stand-in in `journeySweep.test.tsx`.
- Browser: driven headless in Chrome through the real tester (offline lever bench). The run was: generate, build the reference minus its last piece, Check (miss with a nudge question), Try again, finish, Check (passed), Next challenge.
  - Fixed from the drive: tapping the selected piece again deselected it; the board was about 220 px beside the hopper (the hopper now sits under a full-width site); names and counts overlapped on hopper cards.
- Answer-leak audit: walked the goal, hopper cards (name, picture, count), ghost landing preview, step badges, feedback card and scene. Nothing has a key except the reference build, which is never rendered or published. Hopper cards never say what a piece is for in this goal. Distractor pieces are always present. The glow appears only after a checked miss, on pieces the inspector named, and is evidence the same way TrainYard's crossed-out cars are.
- Design gate:
  - manipulation: pass. The child places every piece on the site.
  - simulation: pass. Gravity is real, and a roof blocks stacking.
  - production: pass. Free construction with no options to choose between.
  - timer: pass. No clock.
  - layout leak: pass (see audit).
- Curriculum home: **not run** (`/curriculum-fit open-builder` owed). The domain maps to SCIENCE in `curriculum_retrieval_service.py`.
- Pip surface: classic workspace hook. It outlines the whole site and receives the build while the inspector judges. It never points at a piece or column (where to build is the task). There is no separate surface test; `useWorkspacePipSurface` is shared and tested.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 0 | presets | breadth | Add skins on the same physics: `garden` (soil, seeds, water, sun; order is a growing sequence), `undersea` (habitat fit), `city` (roads, bridges, buildings), `playground`. Each preset needs seeds, art looks and a judge probe. |
| 1 | `/add-eval-modes` | L1 | Ladder candidates: `fix_the_build` (a pre-built build with one problem to repair; good for K), `build_to_goal` (born), `plan_then_build` (order the steps first, then build; the old planner's skill), `crew_schedule` (two crews per day, a deadline; parallel and critical path for grades 3-5). |
| 3 | `/add-support-tiers` | L3 | Why children fail: unaware a roof needs walls at both ends (help: a ghost outline of "something holds each end"); order rules (help: replay the build log step by step; simplify: a project without an order rule); too many pieces (simplify: a smaller hopper with no distractor). |
| 5 | `/add-sound` | L5 | Thunk on landing, pitch by piece size; a crane whir while dropping; a stamp on "passed inspection". |
| ✓ | `/eval-test open-builder` | QA | Born 3/3 runs PASS. Re-run after every layer. |
| — | harness | W1 | Inspector stand-in in the journey sweep so tutor replay can record moments; then `tutor_replay.py --primitive open-builder --samples 5`. |
