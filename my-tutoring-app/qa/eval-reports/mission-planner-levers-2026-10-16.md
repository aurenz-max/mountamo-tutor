# mission-planner levers and eval-test, 2026-10-16

Built with the W1 binding (`../tutor-reports/mission-planner-w1-2026-10-16.md`). Code: `missionLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers. K-1 is the ungraded story: no levers.

## Failure inventory
No real-learner evidence: no demonstrations, misconception or remediation files exist for this id. The old catalog
block's `commonStruggles` (documented) named "thinks the trip is instant" and "flies in a straight line to where the
planet is now"; the rest is inferred from the tasks. The misses are what the check sees.

| Mode | Failure (class) | Miss |
|---|---|---|
| farther_closer | answers the opposite end of the question (inferred) | `other_end` |
| farther_closer | does not know the order of the places (inferred; hard is built on neighbours) | `next_in_line`, `in_between` |
| pick_window | picks the month with the planets farthest apart / closest when asked the other (documented: timing) | `far_apart`, `close_together` |
| pick_window | cannot compare the pictures (inferred) | `in_between_window` |
| pack_days | packs only for the way there (inferred; the drawing invites it) | `forgot_home` |
| pack_days | counts the stay twice, or leaves it out (inferred) | `stay_twice`, `forgot_stay` |
| pack_days | packs for one astronaut, or adds the crew (inferred) | `forgot_crew`, `added_crew` |
| assist_tradeoff | ignores the year limit (inferred) | `too_slow` |
| assist_tradeoff | does not use flybys to judge fuel (inferred) | `picked_direct`, `fewer_flybys` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| farther_closer | `ask_arrow` | help | an arrow out from Earth, the asked end marked | no place is put on the arrow |
| pick_window | `distance_lines` | help | a dashed Earth-target line in every month's picture | every month the same; no length written |
| pick_window | `fuel_card` | help | the rule: least fuel when close, most on the far side | names no month |
| pack_days | `home_leg` | help | the trip home drawn with its day squares; the stay once | no total written |
| pack_days | `crew_rows` (crew > 1) | help | each astronaut with a pack, "1 pack every day" | no total written |
| assist_tradeoff | `assist_card` | help | the flyby rule: free push, less fuel, longer trip | names no route |
| assist_tradeoff | `limit_line` | help | the year limit as a red line on every route's row | every route the same |
| 3-4 choice items | `drop_one` | simplify, on the item | greys out the choice easiest to rule out | two untried choices remain |

farther_closer is recall: any card that puts places in order is the key. The first build had an `order_card` (the Moon
is closest, then Mars, the belt, the giants); the r1 replay read it aloud and named the key on 19/80 replies (the Moon,
Mars). Removed. `next_in_line` and `in_between` have no help lever by decision and go to `drop_one`; every other miss
is answered by a help lever first (tested over every tier, 5 seeds per mode). No practice items: the simplify lever acts
on the item (user ruling 09-27).

## Measured
- Workspace test: each lever changes the screen and the scene fact in one commit; the next attempt records it
  (`assisted`); `drop_one` greys a choice that then takes no tap.
- Sweep J1-J15 on the four payloads: 0 findings. Replay r1-r4 in the W1 report.

## No fixed strategy wins a mode (test `no fixed strategy wins a mode at any tier`, 160 items per tier, limit 75%)

| Mode / tier | strategies (win rate) |
|---|---|
| farther_closer easy | first 51, last 49, biggest planet 56, always farthest 57 |
| farther_closer medium | first 26, last 35, biggest planet 16, always farthest 53 |
| farther_closer hard | first 28, last 26, biggest planet 3, always farthest 51 |
| pick_window easy | first 48, last 53, always closest 49, always far apart 51 |
| pick_window medium | first 38, last 33, always closest 39, always far apart 61 |
| pick_window hard | first 29, last 22, always closest 52, always far apart 48 |
| pack_days easy | first 43, biggest 50, smallest 50 |
| pack_days medium | first 31, biggest 50, second biggest 50, smallest 0, second smallest 50 |
| pack_days hard | first 28, biggest 43, second biggest 57, smallest 0, second smallest 0 |
| assist_tradeoff easy | first 42, most flybys 65, fastest 69, slowest 31, slowest in time 66 |
| assist_tradeoff medium | first 31, most flybys 30, second most flybys 70, fastest 14, slowest 15, slowest in time 68 |
| assist_tradeoff hard | first 31, most flybys 48, second most flybys 53, fastest 0, slowest 0, slowest in time 50 |

Two changes came from the probe before the test was written: pick_window hard asked "least fuel" only, so "always the
closest planets" won 100%; it now asks least or most at every tier. assist_tradeoff easy let "the slowest route that
still arrives in time" win 100%; easy now also draws a `fewer` foil that is slower than the key.

## Eval-test (`/api/lumina/eval-test`, `&grade=` canonical, `&difficulty=`, 4 items each)
Content checked by code with the live modules (adapter `validate`, `missionItems`, keys, every miss answered by a lever,
facts under 500 characters); rendering by the browser drive in the W1 report.

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| farther_closer (G2) | PASS: 2 places, gap ≥3, far/near both asked | PASS: 3 places, gaps ≥2 | PASS: 4, key's neighbour present |
| pick_window (G3) | PASS: 2 months, ≤35° vs ≥140° | PASS: 3 months | PASS: 4, near miss 45-75° |
| pack_days (G4) | PASS: 1 astronaut, 2 choices | PASS: 3 choices | PASS: crew 3-4, 4 choices, all foils named slips |
| assist_tradeoff (G5) | PASS: 2 routes | PASS: 3 routes | PASS: 4 routes, key 2-3 flybys |

K (story): `fail` by design ("Generated items array is empty"): the story has no items and submits nothing.

## Failures without a lever
farther_closer `next_in_line`, `in_between`: no help lever (recall item; see above). Answered by `drop_one` only.
