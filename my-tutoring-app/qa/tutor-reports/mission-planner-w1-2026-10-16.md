# mission-planner W1 binding (R2 batch B1), 2026-10-16

**Shape P, rebuilt under the 10-15 ruling and the 10-16 ruling for this primitive (graded 2-5, ungraded story at K-1),
four modes, all bound.** Levers in `../eval-reports/mission-planner-levers-2026-10-16.md`. Not committed.

## What the old screen did, and what changed
The old planner was a four-step wizard (destination, launch window, supplies, launch) that always called
`submitResult(true, ...)` with a score that rose per step. A "Best!" badge sat on the optimal window, the window
descriptions stated the answer ("Earth and Mars are closest!"), the supply rows showed packed/needed days with a check
mark, every destination's travel time was printed, and travel days, the optimal flag and the fuel multipliers all came
from Gemini unchecked. The tutor block said "There is NO wrong destination".

Rebuilt (`missionWorkspace.ts`). Code builds every item and key; Gemini writes the title only (the first payloads showed
a Gemini overview stating "the launch month that needs the least fuel" on a session that also asks for the most, and
"the trip there, the stay, and the journey home" over the forgot-the-way-home item, so the overview is now code's).
Nothing that answers the question is drawn before the answer.
- **farther_closer** (β 1.5): 2-4 places (Moon, Mars, asteroid belt, Jupiter, Saturn, Uranus, Neptune) as same-size
  pictures with names; farthest or closest from Earth. Key from the real order of distances. No map until the answer,
  then a log-scale strip. easy 2 places 3+ steps apart; medium 3, 2+ apart; hard 4 including the key's neighbour.
- **pick_window** (β 2.5): 2-4 launch months, each a picture of the Sun and two orbits (not to scale) with Earth and the
  target (Venus, Mars or Jupiter) where they are that month, from one start and real orbit speeds; least or most fuel.
  Key = smallest (largest) Earth-target distance. easy same side vs far side; hard four months, one a near miss
  (45-75° vs the key's ≤30°). No badge, no description, no path until the answer.
- **pack_days** (β 3.5): a Moon trip drawn as day squares for the way there and the stay, then an arrow home marked
  "home the same way" with no squares; one pack per astronaut per day. Key = crew × (2 × days there + days staying).
  Every foil is a named slip (forgot home, stay twice, forgot stay, forgot crew, added crew). easy 1 astronaut / 2
  choices; medium 3 choices; hard crew 2-4, 4 choices.
- **assist_tradeoff** (β 5.0): 2-4 routes to Jupiter or Saturn, each a path with its flyby planets marked and its years
  as squares and a number; the route with the least fuel (most flybys) that arrives within the limit. Fuel is never drawn.
- Default modes by grade (no pin): 2 farther_closer + pick_window; 3 adds pack_days; 4-5 all four.
- Scripted path (tester): two tries then a reveal (one try on two-choice items); only first-try answers score.

## K-1: how the ungraded story is served
`teachingWorkspace.ungraded` is a catalog-level flag (the whole family binds as `mixed` with no eval modes), so one
catalog entry cannot be both graded and ungraded on the workspace. I did not add framework. The precedent that already
exists is solar-system-explorer's exploration orrery: a payload the adapter refuses renders outside the workspace.
- Generator: K or Grade 1 (canonical grade) returns a story payload (`items: []`, `challengeTypes: []`,
  `story.places`) whatever the pin; the log says the pin is not served at K-1.
- Component: `MissionPlanner` renders `MissionStory` when the grade is K/1 (even if items were stored), else the
  workspace-bound surface. The story: pick the Moon or Mars (Grade 1 adds Jupiter), tap food/water/air into the ship,
  Fly, then how long the trip takes in words, no numbers. No Check, no score, no `submitResult`. The scripted tutor
  gets silent ORIENT / DESTINATION_SELECTED / ARRIVED / READ_ALOUD beats ("nothing is right or wrong").
- Adapter: `validateMissionPlannerData` throws on a K-1 payload, so `workspaceBinding` returns null and a lesson never
  binds it; catalog `teachingWorkspace.grades` is Grade 2-5 (the dev host refuses K-1).
- Catalog `constraints`: "K and Grade 1 MAY be routed here only as an ungraded story (no score is submitted): use it there
  for exposure, never as an assessment."
- Consequence to note: a K-1 lesson section routed here submits no evaluation (same as the solar orrery). `/eval-test`
  at grade K reports `fail` ("Generated items array is empty"), by design.

Misses (`missionMiss`, spoken ids the same): farther `other_end`, `next_in_line`, `in_between`; window `far_apart`,
`close_together`, `in_between_window`; pack `forgot_home`, `stay_twice`, `forgot_stay`, `forgot_crew`, `added_crew`;
assist `too_slow`, `picked_direct`, `fewer_flybys`.

Production lines: missionWorkspace.ts 639, missionLevers.ts 135, MissionPlanner.tsx 758 (was 1251, includes the K-1
story), generator 131 (was 641), adapter 32, catalog entry ~70. Tests: workspace 309, reader-fit 101 + 86. Tests and
report outweigh nothing here except the test file, which carries the strategy table the brief asked for.

## Gates
- `typecheck:lumina`: 0 in this primitive's files. The final run shows 2 errors in
  `service/qa/oracles/__tests__/percent-bar.test.ts` (another session's work in progress, not touched here); the run
  before that change landed was 0.
- Full `tsc`: 771 (baseline 771); none in these files (the `.next/types/.../eval-test/route.ts` error is pre-existing).
- `MissionPlanner.workspace.test.tsx` 19/19, both reader-fit files rewritten (6 + 8 pass). live-activity + astronomy +
  service/astronomy + catalog + pip: 140 files, 2 fail, both `fraction-bar.compare` (known WIP). Pip surface test passes
  on the legacy grade-3 fixture (it now builds code items by grade).
- Payloads `w1-payloads/mission-planner.{farther_closer (G2 medium), pick_window (G3 hard), pack_days (G4 hard),
  assist_tradeoff (G5 hard)}.json` from `save_payload.py`, regenerated after the overview change. W1 contract passes.
  Sweep J1-J15: 0 findings on all four; advisories are "the scene facts contain the key", i.e. the option list (as
  rocket and orbit).
- J8: the journey row answers by tap; spoken misses are covered by the unit test of the assignment's misses.
  Not run: `spoken-miss-probe.mjs`.

## Replay (gemini-3.8-flash, 16 items x 5 samples, `--observe`, `TUTOR_REPLAY_ITEMS=all`)
Saved `qa/tutor-reports/replay/mission-planner-2026-10-16{,-r2,-r3,-r4}.json`. Every non-credit reply read by hand.
- **r1.** Automatic: 19/240 `no_key_before_try`, all farther_closer, all the `order_card` lever read aloud ("the Moon is
  our closest neighbour", "out past Earth comes Mars"): on a recall item the card was the key. **Fix 1 (lever):**
  order_card removed; `ask_arrow` (marks which end the question asks for, places no choice) in its place;
  next_in_line / in_between go to `drop_one`.
- **r2.** 0 automatic misses. Reading found steering the checks scored 0: pick_window "See which month has the longest
  line between them, and give that one a try", "Which picture shows Mars on the far side of the Sun?", "see which
  picture has the shortest dashed line" (about 15/60 stuck+lever); assist_tradeoff "Which route fits within the 7-year
  limit and has the most flybys?" (about 10/60), and one "while making the most flybys" with no card on screen;
  pack_days "Try counting all the days on the path for both astronauts" (2/60). **Fix 2 (guidance):** never tell the
  learner to count every square or multiply by the crew; even with a card on screen, never send the learner to look
  for the one choice that fits it.
- **r3.** 0 automatic; reading found 3/60 "Which route ... has the most flybys?" and 2/60 "Which picture shows them
  closest together?". **Fix 3 (guidance):** "and never ask which choice fits it", with those two questions quoted.
- **r4.** 0 automatic; read all 240 non-credit replies: no key, no order, no "closest together / most flybys" pointer.
  Residual 1/80: assist stuck with only the limit line pulled, "see which one swings past planets to save fuel" (the
  flyby rule without its card). Lever turns read the fuel card's rule aloud in full on most turns (the card is on
  screen; allowed).

## Browser
Headless Chromium on the Astronomy tester (scripted path, :3000), real clicks: farther_closer G2 medium and easy,
pick_window G3 hard, pack_days G4 hard, assist_tradeoff G5 hard, 2 items each; then K. 76/76 (`drive-mission.log`):
nothing that answers the item drawn before the answer (no strip, path, line, home squares), no badge or readout text, a
wrong answer checks wrong and draws nothing (two-choice items reveal), the key credits, the strip / ship path / reveal
text appear after. K: story payload, no Check or counter, the ship moves (x 548 → 834), "many, many months", no
number. Phone 390: no horizontal scroll; the tester keeps its control column at 390, so the primitive was also checked
with that column hidden: the 4-route grid at 260 px fits with 0 overflowing elements. Two fixes from the screenshots:
the "home" arrow pointed toward the Moon (marker reversed) and the distance-strip labels overlapped (now alternate in
distance order, width capped). Console: the same `<circle>/<ellipse> ... "undefined"` errors per Generate that the
rocket and orbit reports trace to the tester's loading state.
Not driven in a browser: the workspace path (tutor) and the lever pictures (covered in jsdom).

## Undriven modes
None (every mode answers by `choose` on its button label, then Check).

## Open findings / rulings
- **Ruling to ratify: K-1 handling.** The story renders outside the workspace and submits nothing (solar orrery
  precedent). If K-1 should get a tutor-taught ungraded surface (`useTeachingSurface`), that needs per-payload
  ungraded binding in the framework, which does not exist today.
- **Ruling to ratify: modes reshaped from the triage proposal.** farther_closer asks "from Earth" over the Moon, Mars,
  the belt and the giants (it was "order or pick"), so it does not duplicate solar-system-explorer's order_from_sun
  (Sun-centred, live model). pick_window asks least OR most fuel at every tier. assist_tradeoff is a two-rule choice
  (least fuel AND within the year limit); fuel is never drawn, so the flyby rule is the work.
- farther_closer is recall: no help lever can order the places without stating the key (r1). Its only help lever
  (`ask_arrow`) answers `other_end`; `next_in_line` / `in_between` are answered by `drop_one` (simplify) only.
- Titles: Gemini's titles follow the request topic, not the item ("Red Planet Voyage Planning" over Jupiter/Saturn
  routes). Harmless, noted.
- No `docs/contracts/mission-planner.md`; the requirements live here and in the tests. `/primitive-contract`.
- `replay_checks.no_key_before_try` cannot see a pointer phrased as a property ("the longest line", "the most
  flybys"); same class as rocket's open finding, shared harness, not edited here.
- Human check: phone width at real device size (the tester's own layout squeezes every primitive at 390), K-1 with
  the voice, readability of the 9 px flyby labels.
