# race-track-lab: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/race-track-lab-w1-2026-10-15.md`). Not committed.

## Failure inventory
No real-learner evidence: no demonstrations, misconception, remediation or earlier eval-report files exist for
race-track-lab. Documented failures are the catalog's two commonStruggles (speed judged by appearance, a
position-time graph not read). Synthetic failures are the journey's scripted wrong taps. The rest are inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| observe | picks the car in front, which had a head start (`ahead_not_fastest`) | documented (struggle 1), synthetic |
| observe, graph, predict | picks a slower car (`slower_racer`) | synthetic |
| predict | picks the fastest car when a head start wins (`fastest_not_winner`) | inferred, synthetic |
| predict | picks the head-start car when it is caught (`head_start_not_winner`) | inferred, synthetic |
| measure | gives the stop square, not the squares moved (`read_position`) | inferred, synthetic |
| measure | one car's whole distance, the other's, or the sum, for "how many more" (`farther_total`, `shorter_total`, `added`) | inferred, synthetic |
| measure | the other car, one too many, the seconds (`other_racer`, `off_by_one`, `time_as_distance`) | inferred |
| calculate | the faster-looking (farther) car's speed (`farther_racer`) | inferred, synthetic |
| calculate, graph | stop square divided by seconds (`ignored_start`); the distance as the speed (`distance_as_speed`); multiplied (`multiplied`) | inferred |
| graph | the line that ends highest (`highest_line`) | documented (struggle 2), synthetic |

## Lever table (built, `raceTrackLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| observe | trail_count | help | every miss | numbers the squares along every trail from its start; marks no car as most; refused before Run the race |
| predict | step_marks | help | every miss | where each car is after 1 and 2 seconds; `stepMarksLeak`: no mark at or past the finish |
| predict | squares_to_go | help | fastest_not_winner, head_start_not_winner | each car's squares to the finish; head-start items only |
| measure | trail_ticks | help | every miss ("how far") | unnumbered tick per square on the asked car's trail; refused before the run |
| measure | gap_bracket | help | every miss ("how many more") | unnumbered bracket between the two stop squares; refused before the run |
| calculate | second_marks | help | every miss | unnumbered mark on each trail at every whole second |
| graph | one_second_step | help | every miss | a step one second across and up to the line, unnumbered |
| all | simpler_race / simpler_numbers / simpler_graph | simplify | every miss | a fresh race with other cars in the mode's easy shape; own id `<id>~simpler`, ungraded; its key differs from the item's (other cars, another number); null when the item is already that simple |

`numberLeak` checks that no numbered lever draws the key's number on a numeric item. Every lever starts released;
`config.difficulty` picks the item structure, not the levers.

## Gates
- `RaceTrackLab.workspace.test.tsx`: for every item at every tier, every miss its choices can show gets a help lever
  first from `nextLever`; levers commit the screen and the scene fact together and ride the next attempt; run-gated
  levers are refused before the run; the simpler race keeps the mode, uses other cars, has another key, and never
  shrinks twice.
- Sweep lever inventory: J9, J12, J13 pass on all five payloads.
- Replay r2: miss and stuck replies pull the mode's help lever (calculate second_marks, graph one_second_step,
  measure gap_bracket, observe trail_count, predict step_marks or squares_to_go) and a few pull the simpler race,
  describing each correctly.

## Failures with no lever
- None by miss. A learner who cannot count squares at all (K observe) gets trail_count, which counts for them; the
  prerequisite after that is counting, a lesson-level finding, not a lever.
