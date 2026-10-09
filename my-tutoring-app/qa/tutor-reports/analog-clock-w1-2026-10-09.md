# analog-clock W1 (plain shape), 2026-10-09

ROLLOUT C10. Not committed (sibling bindings in the same tree).

## What shipped
- `analogClockWorkspace.ts`: assignment (instruction, gesture), scene, `describeClockWork`, `clockMiss` / `ClockMiss`.
- `AnalogClock.tsx` → `AnalogClockSurface` + `withWorkspaceController`. Workspace path: runtime progression,
  `commitCheck` on every Check, `learnerBlocked()` on hands, numbers, options, slider, drag, stopwatch and Check;
  Next hidden; scripted `sendText` muted; `useLuminaAI({ enabled: !tutorOwned })`; scene in `useLayoutEffect`;
  submit from `onFinished` only under an evaluation provider. No generated hint on screen with the tutor (G1).
  SVG targets gained `data-pip-object` ids (`hand-short`, `hand-long`, `number-1..12`) for the driver.
- `adapters/analogClockLive.ts` + `activityContract.ts`; catalog `teachingWorkspace` (guidance + misses);
  `liveJourneySpec.ts` row; `lessonWorkspacePlan.test.ts`; sweep baseline row for set_time J1;
  `docs/contracts/analog-clock.md` (new).

## Checked by code
Every mode is the activity's own check. Misses: hand_name `other_hand`; read/match/set_time `hands_swapped`,
`next_hour`, `previous_hour`, `wrong_hour`, `minute_as_number`, `wrong_minute`, `other_time`; hear_time the three hour
misses; elapsed `hour_off`, `too_short`, `too_long`; count_face none (out of order restarts; Check only at 12).

## Gates
- `typecheck:lumina`: 0.
- `AnalogClock.workspace.test.tsx` 13/13; oracle, misses, lessonWorkspacePlan, activityContract: 237/237 together.
- workspaceContract + journeySweep filtered to analog-clock: 36/36. Sweep, 7 payloads: 0 findings except set_time
  J1 (baselined, G2); misses named 23/23 checked (hand_name 4/4, hear_time 4/4, read 5/5, match 5/5, elapsed 5/5);
  J10/J11 records correct on every driven payload. One elapsed J3 hit was the row's choice ("2 hours 45 minutes"
  contains "45 minutes"); the row now picks a wrong option that does not contain the right one.
- Undriven: set_time (drag/slider; driven in the workspace test instead).

## Tutor replay (text, gemini-3.8-flash, 7 payloads x 5)
- Run 1 (`replay/analog-clock-2026-10-09.json`): 0 code misses, but read by hand: hand_name miss/stuck said "touch
  the other hand" 5/10 (a two-choice item: that is the answer), and read/match said "the short hand tells the hour"
  where the scene called the legend hidden on an untiered session.
- Fix: guidance forbids "the other hand" on hand_name; reading-aid facts only when a support tier sets them.
- Run 2 (`-r2.json`): 0 code misses; "other hand" 0/10. Some hand_name replies still pair "short" with "moves
  slowly" and "the slow one tells the hour", the generator's own hint; left as is.

## Open
- G1 (contract): generated read/match hints name hand positions; scripted path shows them on the 2nd wrong → `/eval-fix`.
- Elapsed payload at "Grade 3" came back `gradeBand: '1-2'` (generator grade resolution; not checked further).
- Browser check owed on set_time drag and the hand_name hit areas (HUMAN-CHECKS #167).
