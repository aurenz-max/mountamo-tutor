# circuit-workbench: `magnet_distance` (2026-11-02)

The ninth circuit-workbench mode. Its curriculum home is G3 `SCI001-05-c`, magnet strength against distance. The generator is code-only, so it made no Gemini calls ($0).

## What the child does
A bar magnet sits at the near end of a ruler with marks 1 to 6, and a steel ball sits on a mark. The child taps a mark (or a mark chip) to put the ball there, then taps the magnet. If the magnet pulls the ball, the ball rolls to it and sticks; if not, the ball stays put. The ball starts on a random mark between 2 and 5, so the first try is a real guess. The child says the guess to the tutor; there are no guess chips. The question appears only after every magnet has been tried and the child has seen one pull and one miss.

| Tier | Task |
|---|---|
| easy | Name the farthest mark the magnet pulls the ball from (the magnet's reach is 2-5). |
| medium | Decide about another magnet without testing: "It pulled a ball on mark 4. Would it pull one on mark 2?" There is one pull call and one miss call, and each always falls on the side the rule decides. |
| hard | A small magnet and a big magnet, each on its own ruler: which is stronger? Half the time the small one is. |

Misses, in pairs by tier:
- easy: `reach_too_far` / `reach_too_near`
- medium: `farther_pulled` / `nearer_not_pulled`
- hard: `judged_by_size` / `picked_weaker`

Levers:
- `pull_marks` (legend): colours each tested mark green where the magnet pulled and grey where it did not.
- `one_step_less` (easier): medium goes to a reach item; hard goes to a pair where the big magnet is far stronger. Easy has no easier item.

The scene facts never contain the reach, a call's answer or the stronger magnet before a right check.

## Files
- New: `distanceModel.ts` and its test.
- Wired into `circuitModel`, `circuit3d` (rulers, mark plates, rolling ball, magnet jiggle on a try), `CircuitScene`, `CircuitWorkbench`, `circuitWorkspace` (`distanceScene`), `circuitLevers`, the card and boss, the catalog (β 1.7) and the generator (3 items, or 1 in a mixed session).
- The card went over the 4,000-character guidance cap. I shortened the wording of other modes to bring it under.

## Verification
- `typecheck:lumina` 0; full tsc 770 (baseline).
- Physics vitest 326/326; `test:primitive circuit-workbench` 734/734.
- The mounted test drives a reach miss and a `judged_by_size` miss, each followed by a right retry.
- Browser drive (`circuit-workbench-drive-2026-10-31/drive-distance.mjs`, Grade 3, medium): 29/29, no page errors. Item 1 tapped the 3D marks and magnet directly.
- Fixed during the drive: the bench was small on screen and the ball rendered almost black, so I enlarged the parts and lightened the steel. A miss call could say "did not pull from mark 1", so miss calls now start at mark 2.

## Not covered
- Easy and hard tiers in the browser: the tester has no difficulty setting, so they are covered by vitest only. The two-ruler hard layout has not been seen on screen.
- A pinned `/eval-test` run.
- A Live sample.
