# Contract: analog-clock

- **Derived:** 2026-10-09 (W1 workspace binding, C10). Not a full `/primitive-contract` census: it records what the
  binding relies on and the requirements already in the code.
- **Component:** `primitives/visual-primitives/math/AnalogClock.tsx` · **Domain:** `analogClockWorkspace.ts` ·
  **Generator:** `service/math/gemini-analog-clock.ts` · **Oracle:** `service/qa/oracles/analog-clock.ts` ·
  **Adapter:** `components/live-activity/adapters/analogClockLive.ts`
- **Modes (7):** `hand_name`, `count_face`, `hear_time` (K clock parts), `read`, `set_time`, `match`, `elapsed`.

## Requirements

### R1 — the answer is never on screen before the check · OBSERVED
- `read`/`match`/`elapsed`: the digital readout shows only on `elapsed` (the duration is the answer, not the clock
  time) or after a correct check; `showDigitalEcho` is honoured on `set_time` only, where the target is given.
- `hand_name`: the hand legend is off at every tier (generator `resolveSupportStructure`), and the instruction never
  names short or long.
- `hear_time`: no reference dial; the four faces are the whole surface (2026-09-09 Chrome drive).

### R2 — `count_face` never scores a wrong count · OBSERVED
- A number out of order restarts the count; Check opens only at 1-12 in order, so the mode has no miss.

### R3 — shared teaching workspace (W1, plain shape) · OBSERVED (NEW 2026-10-09)
- `withWorkspaceController('analog-clock', ...)`; every Check is `commitCheck(describeClockWork, correct, clockMiss)`.
  The tutor gets the task, the options on screen and the learner's work; never the dial's time, the right option,
  the asked-for hand or the duration (a spoken mode's key goes to the observer only, R5). Untiered sessions state no
  reading aid as hidden.
- On the workspace path: no Next, no scripted `sendText`, `useLuminaAI` disabled, no generated hint on screen after a
  miss (read/match hints can name where the hands point), and Try again opens the challenge blank (hands back at
  12:00 on `set_time`, the stopwatch reset on `elapsed`).
- Misses: `other_hand`; `hands_swapped`, `next_hour`, `previous_hour`, `wrong_hour`, `minute_as_number`,
  `wrong_minute`, `other_time`; `hour_off`, `too_short`, `too_long` (catalog `teachingWorkspace.misses`).
- **Probe:** `AnalogClock.workspace.test.tsx`; journey sweep on `w1-payloads/analog-clock.*.json`.

### R4 — levers never draw or say the answer · OBSERVED (NEW 2026-10-09)
- Every mode declares levers (`analogClockLevers.ts`, catalog `levers: true`); each starts released, and a tier aid
  already on screen is declared pulled. Leak rules in code, unit-tested (`analogClockLevers.test.ts`):
  `running_model` is a second clock whose hours stay two or more from the item's (`modelLeaks`), labels no hand, and
  is the only help on `hand_name` (where which hand tells the hour IS the answer); the legend never on `hand_name`;
  the digital echo only on `set_time` (`echoOffered`); `start_and_sweep` draws only the learner's own run; lever facts
  carry no digit.
- Simplify (`simpler_item`) stays in the mode and never shows the item's time, duration or right option
  (`practiceLeaks`): read/match a whole hour with two far choices, hear_time two faces, set_time a whole hour (none on
  the hour), elapsed whole hours (none on whole hours). hand_name and count_face have none. Practice is ungraded; the
  full item comes back blank; Try again on a practice item keeps it.
- Every pull is recorded on the next attempt (`assisted`, `levers`). **Probe:** `AnalogClock.levers.workspace.test.tsx`.

### R5 — read, match, elapsed and hand_name take a spoken answer beside the tap · OBSERVED (NEW 2026-10-13)
- `response: 'speech'`, `acceptsGesture: true` (ROLLOUT.md VB-1): JEV judges the spoken time, duration or hand from
  the tutor's feedback against `expectedAnswer` (`clockExpectedAnswer`, every natural form: "three o'clock", "3:00",
  "quarter past three", "three fifteen", "quarter to four"); the pick and Check stays the activity's check. Spoken
  misses use the tap's catalog ids (`clockSpokenMisses`): the next/previous hour, the hands swapped, the long hand's
  number as the minutes; an hour off on elapsed; the other hand. "The hour hand" alone is not credited on hand_name.
- A spoken credit records the result a correct tap records and shows the credited choice (`onSolved`); a correct tap
  is never recorded twice. set_time, count_face and hear_time stay gesture (hands moved, numbers touched, a face with
  no name). **Probe:** `AnalogClock.spoken.workspace.test.tsx`; `scripts/tutor-verdict-probe.mjs --clock`.

### R6 — with a tier, code picks the times; the tier still sets the reading aids · OBSERVED (NEW 2026-10-13)
- `read`, `set_time`, `match`: times from the `clock-time` item space, `elapsed`: intervals from `elapsed-time`
  (`service/itemSpace/time.ts`, adapter `service/math/analogClockItemSpace.ts`). Easy = o'clock and half past, medium =
  quarters and five-minute marks before :40, hard = :40-:55 (the short hand near the next number) and, on a one-minute
  grid, minutes between the marks. Elapsed hard = crossing an hour mark with hours and minutes.
- Drawable: times on the lesson's minute grid (`clockGrid`: what the objective says, else 1.MD.3 halves, 2.MD.7 fives,
  3.MD.1 minutes); `set_time` on a grid of five or coarser (the hands snap); elapsed start, duration and end on the grid.
- The gradeBand is the one whose snap reaches every set_time target (`bandFittingTargets`, also on the untiered path,
  which drew 2:25 on a quarter-hour snap). Code writes every instruction, hint and option; an elapsed instruction names
  the end time (the dial shows only the start) and never the duration (`elapsedTextFits`; the untiered path rewrites
  one that misses, as "finished at the target time shown" had no answer).
- No tier, K modes (`hand_name`, `count_face`, `hear_time`), or no space fits: the generated path, unchanged.
- **Supersedes** the generator docblock's "the tier NEVER changes the time value": the grid (scope) is still the
  grade's; the tier picks the structure inside it. R1 holds: options and the echo rule are unchanged.

## Gaps

### G1 — generated read/match hints name the hand positions · OPEN
- The 2026-10-09 payloads carry hints like "The short hour hand is pointing straight at the 3" and "The minute hand
  is past the 9, so it is 45". The scripted path shows the hint after a second wrong check: the answer. Path:
  generator hint rule + oracle leak check → `/eval-fix`.

### G2 — `set_time` is not drivable by the dry journey · OPEN
- The hands move by dial drag or the time bar (a Radix slider); the driver has no drag or key input. Baselined as
  J1 in `journey-sweep-baseline.json`; the workspace test drives it through the slider's keys.

## Changelog

- 2026-10-09 — created with the W1 workspace binding (R3).
- 2026-10-09 — R4 levers on every mode (`/add-support-tiers`; qa/eval-reports/analog-clock-levers-2026-10-09.md).
- 2026-10-13 — R5 spoken answers on read, match, elapsed and hand_name (VB-1); R3 re-based (the key reaches the observer only).
- 2026-10-13 — R6 item-space path (`/add-item-space`; qa/difficulty-demo/2026-10-13/time-money/). Untiered path: set_time
  band fits its targets, elapsed instruction names the end time.
