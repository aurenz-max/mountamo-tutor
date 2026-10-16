# race-track-lab W1 binding (ROLLOUT C28), 2026-10-15

**Shape P, five modes, all bound** (observe, predict, measure, calculate, graph). Levers in `../eval-reports/race-track-lab-levers-2026-10-15.md`. Not committed.

## What changed, and why
The old screen was weak in every mode. Gemini wrote every question and its answer string, and code only spot-checked
some keywords. The legend printed every car's speed ("(4 sq/s)"), so observe, predict and measure were "pick the
biggest number". Observe asked who won while the canvas drew medals and finish times. Predict let the learner guess
three times before the race. The racers were Rocket Rabbit, Speedy Snail, Cheetah and Turbo Turtle, whose names
hint the answer. Graph mode drew the graph after the race and asked which line is steepest, with the fastest
always ending highest. The scripted context sent `correctAnswer` to the tutor.

Rebuilt so that each mode is a task the learner does, with items and keys built in code (`raceTrackWorkspace.ts`):
- **Cars named by colour** (Red car, Blue car...), colours assigned at random, whole-number speeds, lanes shuffled.
- **observe**: the learner presses Run the race; a bell stops every car after 2 seconds, before the end of the track,
  and each lane keeps a trail. Which car is fastest? Same time, so the one that moved the most squares.
- **predict**: a card per car gives its speed and starting square; which car crosses the finish first? The race
  runs only after credit.
- **measure**: run a timed race, then count how many squares a car moved, or how many more than another car.
- **calculate**: a race log (start square, stop square, seconds, speed "?"); compute speed = distance ÷ time.
- **graph**: a position-time graph with a dot at every second; which car is fastest, or a car's speed from its line.
  The race plays on a track under the graph after credit.
- **Difficulty is structural** (`config.difficulty`). Easy: two cars from square 0 with a clear gap. Medium: three
  cars with a one-square gap (observe), distances in a few seconds (predict), a difference (measure), a start past
  square 0 (calculate), a head start on the graph. Hard: a slower car with a head start that ends in front or wins
  (observe, predict; the first item is always the one where it fools the eye, the second the one where it does not),
  counting from a head start (measure), two cars with different times where the slower one moved farther
  (calculate), a speed from a line that does not start at 0 (graph).
- **Generator**: Gemini writes only the title and a neutral description (not rendered). A legacy payload
  (`challenges` with types) is rebuilt from its modes.

Removed: the speed legend, medals, finish times, the animal racers, the "who won" question, three-guess predict.
No concept dropped: "who won the race" became "who is fastest in a timed race", which is the same concept without the
answer drawn. Graph mode no longer "generates" the graph from a race the learner runs; the old version did that
automatically with no learner action, so nothing taught was lost. The catalog description, constraints and mode
descriptions were rewritten to match. **Stale:** `backend/app/services/calibration/problem_type_registry.py` still
has the old mode descriptions ("Set speeds, predict winner"); ids and betas are unchanged. I did not edit it because
it has uncommitted changes from another session.

Every item is `speech` with `acceptsGesture` (J14). Misses (`raceMiss`, same ids as `raceSpokenMisses`): observe
`ahead_not_fastest`, `slower_racer`; predict `fastest_not_winner`, `head_start_not_winner`, `slower_racer`; measure
`read_position`, `farther_total`, `other_racer`, `off_by_one`, `shorter_total`, `added`, `time_as_distance`;
calculate `ignored_start`, `farther_racer`, `distance_as_speed`, `multiplied`; graph `highest_line`,
`ignored_start`, `read_position`, `distance_as_speed`, `slower_racer`. observe and measure report
`readyForResponse: false` until Run the race.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770), none in these files.
- `RaceTrackLab.workspace.test.tsx` 22/22: every mode on hand-built items; the item space over 5 modes x 3 tiers x 6
  seeds (valid, distinct choices, tiers structural, the head-start item first, keys spread over lanes); misses,
  levers, leak rules, simpler items; legacy data.
- live-activity + `misses.test.ts` + `sourceControlBytes` + Pip surface: 4195 passed; 1 failure,
  `workspaceContract` "saved payload" for `gravity-drop-tower` (another session's binding, no payload yet).
- Payloads `w1-payloads/race-track-lab.{observe,predict,measure,calculate,graph}.json` from `save_payload.py`:
  observe K hard, predict Grade 2 hard, measure Grade 3 medium, calculate Grade 5 hard, graph Grade 7 medium. All
  titles model-written, not the fallback.
- Sweep: 0 findings J1-J14 on all five; misses named 4/4, 4/4, 4/4, 3/3, 3/3; J10 100, J11 67. The advisories
  ("scene facts contain the key") come from the choice list, which is on screen.

## Replay (gemini-3.8-flash, 18 items x 5 samples, `--observe`, `TUTOR_REPLAY_ITEMS=all`; `replay/race-track-lab-2026-10-15{,-r2}.json`)
The automatic checks flagged nothing on either run (0/90 on every check). Reading the replies:
- **r1.** No reply stated a key before credit. On calculate (two cars, "the faster car's speed"), stuck and miss
  replies named the faster car to count: calculate-2 "Yellow car" 5/5 stuck, calculate-3 "Green car" 5/5 stuck,
  calculate-1 "Red car" 4/5 stuck and 2/5 miss. Which car is faster is half the answer. On predict, 1/5 stuck asked
  "Which car has fewer squares to travel?" (the head-start winner) and 2/5 asked "which car is moving fastest"
  on an item the fastest car wins.
- **Fix.** Guidance now says to ask about every car alike, never single one out by name on "the faster car's
  speed", and never ask a which-car question one look settles (it quotes the three questions above).
- **r2.** Every calculate reply asks "how many squares does each car move in one second?"; no predict reply asks
  a settling question. No reply points at a car by name before credit.

## Undriven modes
None. The sweep drives taps (Run the race first on observe and measure); the workspace test drives a spoken answer on observe.

## Open findings
- "I added marks..." narration in 17/450 r2 replies (0 in r1, so probably the shared doctrine edit running in
  parallel); 0 two-lever turns in both runs. Shared lever doctrine, `/add-live-tutor-tools`.
- Graph lever replies ask "which car takes the tallest step?", the task restated through the lever. Not counted as
  a leak; watch in the next replay. `/add-live-tutor-tools`.
- Backend registry descriptions stale (above). `/add-eval-modes` (or the next session that commits that file).
- The spoken path is not swept (the row taps). `/eval-test`.
- No `docs/contracts/race-track-lab.md`. `/primitive-contract`.
- Needs a browser check on the canvas: the track, trails, timer, lever overlays and the graph. Only JSDOM has run them.
