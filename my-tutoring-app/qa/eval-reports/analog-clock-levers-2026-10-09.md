# analog-clock levers, all modes (2026-10-09)

`/add-support-tiers` on the 7 modes bound at W1 (C10). Batch run; the Phase 2 table stop is waived as in the 10-08 sweep.
Not committed (sibling primitives in the same tree).

## Failure inventory

Real-learner evidence: none (no demonstrations, misconception or tutor reports with a real learner on analog-clock).
Synthetic: the dry journey's scripted wrongs (the other hand, another option or face). Documented: catalog
commonStruggles (hands confused; the long hand's number read as the minutes; half-hour positions; dragging hands).
Inferred: losing one's place going round the face (count_face, from the component's own comment). Every miss below is
what `clockMiss` already names.

| Mode | Misses (class) |
|---|---|
| hand_name | other_hand (synthetic + documented) |
| count_face | none checked: an out-of-order touch restarts the count (inferred: losing place) |
| hear_time | next_hour, previous_hour, wrong_hour (synthetic) |
| read, match, set_time | hands_swapped, minute_as_number (documented); next_hour, previous_hour (documented: half-hour); wrong_hour, wrong_minute, other_time (synthetic) |
| elapsed | hour_off, too_short, too_long (synthetic) |

## Lever table (built)

| Mode | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|
| hand_name, read, match, set_time | `running_model`: a small second clock runs through one hour beside the item | help | both | its hour and the next stay ≥2 from the item's (`modelLeaks`); no hand labelled. The only help on hand_name, where which hand tells the hour is the answer |
| count_face | `round_arrow`: dashed arrow round the face from the 1 | help | shown | marks no number |
| hear_time | `short_hands`: every face's short hand thick and yellow, long hand faint | help | shown | the same on every face |
| read, match, set_time | `hand_legend` | help | both | never on hand_name (`legendOffered`); pulled already when the tier shows it |
| read, match, set_time, elapsed | `minute_numbers`: counts by fives outside the numbers | help | shown | pulled already when the tier shows it |
| set_time | `digital_echo` | help | shown | set_time only, where the target is given (`echoOffered`) |
| elapsed | `start_and_sweep`: faint start hands; the long hand's swept path, a ring per full turn | help | shown | drawn from the learner's own run only (`sweptMinutes`); no number |
| read, match | `simpler_item`: a whole hour, two choices six hours apart | simplify | shown | never the item's time or right option (`practiceLeaks`) |
| hear_time | `simpler_item`: two faces six hours apart, another spoken hour | simplify | both | same |
| set_time | `simpler_item`: set a whole hour (none when the item is on the hour) | simplify | shown | same |
| elapsed | `simpler_item`: whole hours from a whole-hour start (none when already whole hours) | simplify | shown | never the item's duration among the choices |

No simplify on hand_name (two hands and one touch is the plainest ask; a simpler one names the hand or asks about
length instead) or count_face (no miss; twelve numbers is the task). Tier starting positions are the generator's
existing aids, unchanged; every lever starts released.

## Built

- `analogClockLevers.ts` (new): declarations with `answers`, leak rules, practice builders, `practiceParent`, `leverFacts`.
- `AnalogClock.tsx`: lever state keyed by item, practice item in place of the session item (records nothing; Try again
  keeps it; the full item returns blank), `pullLever`/`endPractice`, `onScreen` scene fact, the six drawings, a
  "Practice" badge.
- Catalog: `levers: true`; hand_name guidance now forbids tying short or long to the hour or minutes (replay r1 finding).
- `liveJourneySpec.ts` row rebuilds a `~simpler` item from its parent. Contract R4.

## Gates

- `typecheck:lumina`: 0 in analog-clock files (1 sibling error, `liveJourneySpec.ts:764`, measure-lab row).
- `analogClockLevers.test.ts` 22/22, `AnalogClock.levers.workspace.test.tsx` 7/7, `AnalogClock.workspace.test.tsx` 13/13;
  with `service/qa` (oracles): 904/904.
- journeySweep + workspaceContract + misses, full run: 2629 passed. Filtered to analog-clock: 37/37. Sweep findings: 0 on
  6 payloads; set_time J1 only (baselined, G2: no drag input). Misses named 23/23; J9/J12: every catalog miss answered by
  an open lever on every saved item (lever inventory and the per-item unit test).
- Tutor replay (text, gemini-3.8-flash, 7 payloads x 5), r1 `replay/analog-clock-levers-2026-10-09.json`: 0 code misses,
  but read by hand: hand_name lever 1/5 "the shorter hand points to the hour numbers" (the answer); stuck before any
  try pulled `simpler_item` 4/15 on read/hear_time, twice together with a help lever in the same turn (the simplify
  `when` text "cannot do this one yet" matched "I'm stuck" word for word). Fixes: guidance (above); simplify `when` is now
  "a help lever is already on screen and the learner still cannot do this one". r2 (`-r2.json`): 0 code misses;
  hand_name 0/15 tie a hand to hour/minutes; `simpler_item` on stuck 0/25; one turn of 75 pulled two help levers.
  No narration before the receipt in either run.

## Open

- Two lever calls in one turn: the replay answers each from the recorded packet, so a refused second pull (after a
  simplify opens practice) is not measured. Shared layer, `/add-live-tutor-tools`.
- G1 (contract): generated read/match hints name hand positions; G2 set_time undrivable by the dry journey.
- Browser check owed: the running model's layout beside the dial at phone width, and the sweep drawing while the
  stopwatch runs (HUMAN-CHECKS with #167). No Live run (class gate waits for the whole class).
