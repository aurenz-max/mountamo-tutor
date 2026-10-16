# Handoff: 4.2 construction-site diorama — commit the birth, then L1 modes — 2026-10-16

Executor: `/add-eval-modes construction-site-diorama`, then `/eval-test`, `/curriculum-fit`.
Queue: the follow-up table in `my-tutoring-app/qa/eval-reports/construction-site-diorama-birth.md`
(authority over this file). Phase 4.2 in `WORKSTREAMS.md`. Branch `ship/2026-08-10-judged-loop`.
Commit by path, never `git add -A`: the tree also holds the pulse backend work (C15/C18) and FrontierContextCard.

## Step 0: commit what is on disk (do first)

The component, scene and `load_truck` mode are committed (cf15c810). Uncommitted:
- `qa/eval-reports/construction-site-diorama-birth.md` (the birth report)
- `engineering/construction3d.ts`: the camera view (`SITE_VIEW`) and a larger plate on the truck bed
- `components/live-activity/runtime/testing/w1-payloads/airplane-diorama.flight_plan.json` (airplane W1 payload)

Look at each diff, then commit them as one `chore(dioramas)` slice. `my-tutoring-app/sizes.txt` is scratch:
ask before deleting it.

## Step 1: `/add-eval-modes` — the ladder from the birth report

Build in this order; each is a distinct task, not a harder `load_truck`:
1. **`limit_with_remainder`**: a weight limit that is not a multiple of the scoop weight; load as full as it can
   go without going over (floor division). Smallest change from `load_truck`, so first.
2. **`plan_trips`**: a pile of N tons and a C-ton truck; how many trips (division with a remainder); the truck
   drives each trip.
3. **`which_limit`**: bed volume against a weight limit; sand hits the weight first, debris fills the bed first
   (the density idea from the 2D DumpTruckLoader).
4. **`find_part`**: boom, stick, bucket, tracks, cab, dump bed, hoist cylinder; copy the airplane's `find_part`.
5. **`operate`**: real swing/boom/stick/bucket controls to dig a trench to a marked depth, judged by geometry.
   Largest; ask the user whether it belongs here or in a separate excavator diorama before building.

Code computes every key and every miss (`one_short`, over the limit, wrong trip count); Gemini writes the job text.
Nothing on screen may give the count away while loading (the birth's layout-leak check: no counter, no weight).
Each mode gets the workspace binding the birth set up (domain + lever hooks) and an IRT beta prior.

## Verification

- Per mode: real generation in the Engineering tester, headless WebGL drive (recipe: memory
  `project_headless-chrome-drive-recipe`; the birth's drive script is in that session's scratchpad, so rebuild it
  from the report's checklist), K and 3-5 bands where the mode applies. A drive that reads feedback after the
  finale replaced it is a drive artifact; accept the finale.
- `/eval-test construction-site-diorama` across all modes x tiers; Easy/Medium/Hard table.
- `/curriculum-fit construction-site-diorama` once the modes exist.
- Tablet frame rate stays a HUMAN-CHECKS row (headless gives 9-13 fps under software GL; that is not evidence).
- Gates: `typecheck:lumina` 0, full tsc not above 770, the primitive's tests.

## Close-out

Update the birth report's follow-up table and the phase 4.2 row of `WORKSTREAMS.md` in the same commit.
Next after L1: `/add-support-tiers` (K-2 lose count while loading; 3-5 count tons as scoops) and `/add-sound`.
The airplane diorama's next mode (`preflight`) is a separate slice in `airplane-diorama-birth.md`.
