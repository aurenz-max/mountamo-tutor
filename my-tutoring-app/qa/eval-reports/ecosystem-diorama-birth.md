# Birth Certificate — ecosystem-diorama (2026-10-17)

**Lifecycle layer: L0 (born).** The primitive is pedagogically sound and measurable, with one core mode, bound to the teaching workspace.

A 3D island in a glass tank (three.js, built in code), on a wooden table. The island has sand, a meadow, a leafy tree and a pine, flowers, rocks and a shade hut. The water holds fish, weed and bubbles. A crab walks the beach and a bird circles overhead. The sun travels an arc over the tank and is the light that casts every shadow.

The world model (`ecosystemModel.ts`) is pure code and owns every number the learner observes:
- the sun's height and strength over the day;
- a heat balance per thing (how much light it absorbs, how much of it is in the sun, how much heat it takes to warm).

Source: the Science K design review (`qa/curriculum-design-review/science-k-2026-10-17`). This primitive replaces review briefs 1, 2 and 6 with modes of one world.

- **Core task identity:** `sun_test` (SCI001-03-G, K-PS3-1). A fair test of two things that differ in one way: colour, place (sun or shade hut) or material (sand or water). Each test has three steps:
  1. The learner taps the thing they guess will get warmer. The guess is recorded and compared, never graded.
  2. The learner drags the sun across the sky, or presses Let the day go by.
  3. The learner taps the thing that got warmer, read from picture thermometers (five marks, a snowflake and a sun, no numbers). This tap is the check.
- **Generator fork:** A. Gemini writes the title, the description and the island name. `pickSunTests` picks 5 tests:
  - colour, place and material each appear once before any repeat;
  - no pair repeats;
  - the warmer thing is on each side at least once.

  The key comes from the heat model.
- **Workspace binding:** `ecosystemWorkspace.ts`, response `gesture`, miss `picked_cooler`.
  - The scene carries the step, the guess, the time of day and the marks each red line reached (what is drawn), never the key.
  - Guidance: 1,180 characters.
  - Checks: `EcosystemDiorama.workspace.test.tsx` 4/4, `workspaceContract` passes with the saved payload, and the journey sweep is baselined J1 by design (WebGL, as for construction-site).
  - Tutor replay (text model, 5 samples): 0/5 misses. Every opening names the one difference, asks for a guess and does not give the result.
- **Answer-leak audit.** Walked the prompt, the step line, the guess badge, the 3D labels, the thermometers, the shimmer and the feedback.
  - Before the sun moves, both red lines sit below the first mark.
  - The ask names the difference, never the result.
  - A wrong reading sends the learner back to the thermometers without naming the warmer thing.
  - The title and description are filtered for result hints ("dark … warm").
- **Design gate:**
  - Manipulation: pass. The learner drags the sun, the cause itself.
  - Simulation: pass. The heat model drives the thermometers and the shimmer, and the sun is the shadow-casting light.
  - Production: partial. The learner produces a guess and a reading by tap; "why" is the tutor's spoken follow-up. A spoken reason mode is a ladder candidate.
  - Timer: pass. No timer.
  - Layout leak: pass.
- **Pip:** classic workspace. Pip outlines the whole tank, never one thing on test. Surface test 1/1.
- **Curriculum home:** `/curriculum-fit` not run. Expected home is SCI001-03-G. Owed.

## Runtime verification

Headless Chromium, real WebGL (SwiftShader), Biology tester, offline bench. Script and screenshots: `ecosystem-diorama-drive-2026-10-17/`.

Result: K, 32/33. The one failure is pre-existing page noise from `PipCharacter.tsx` (`<ellipse rx="undefined">`, framer-motion), present before the tank mounts.

The drive covered:
- real generation;
- WebGL mount;
- the guess by canvas tap;
- a sun drag along the arc;
- the step change to reading;
- a wrong reading, Try again (the finished day is kept), then the right reading;
- tests 2-5 by Let the day go by, with all 5 credited;
- the finale.

Visual fixes made from the screenshots:
- the camera eases close on the test and pulls back to the sky while the sun moves;
- the things and thermometers are drawn at 1.35×;
- the hut was moved behind the sand row, so its shadow never reaches a "sun" spot;
- the near rim of the tank fades.

Also: the Biology tester now hosts workspace-bound families in the offline `TesterWorkspace`, as the Engineering tester does. Before this, habitat-diorama could only show its needs-the-tutor card there.

## L1 — eval-dense (same day, 2026-10-17)

Six modes in one world. All are Fork A: code builds every item and computes every key; each mode commits through its own check.

| Mode | β | Objective | What the learner does | Check · misses |
|---|---|---|---|---|
| `plant_needs` | -1.5 | SCI002-02-B | Sets the pot (sunny sand or hut), the fill (soil or pebbles), water, and optional animal things (den, berries); Watch it grow | grows and nothing extra · `no_sun` `no_water` `no_soil` `gave_animal_things` |
| `sun_test` | -1.0 | SCI001-03-G | Guess, run the sun, read the thermometers | reading · `picked_cooler` |
| `season_behavior` | -0.5 | SCI002-02-E | Bring winter (leaves turn and fall, snow on land), move each animal to the den, south, the tree hollow or the meadow; Done | every animal placed · `wrong_place` |
| `season_from_log` | 0.0 | SCI003-01-D | Play the month (the weather happens in the tank, a picture log fills), pick a season, tap the weather row that shows it | season and most-common weather · `wrong_season` `present_not_most` |
| `compare_logs` | 0.5 | SCI003-01-G | Play two months or places into two logs; which had more of a weather, or which was warmer | the log the counts give · `picked_fewer` `picked_colder` |
| `keep_it_cool` | 1.0 | K-PS3-2 | Pick a cover (umbrella, leaf roof, move into the hut, clear sheet), run the sun; the ice pop melts or stays | red below the cool line at the end of the day (many designs pass) · `no_shade` `clear_cover` |

Design decisions:
- **Weather records:** 20 school days, drawn per season so the season's weather is the most common by 3 or more (winter snowy, spring rainy, summer sunny, fall windy). This answers the review's spring-versus-fall question.
- **The log is the evidence in the log modes:** the tree and the animals do not change there.
- **Mixed sessions:** one item of each mode, easiest first.
- **Framing filter:** title and description words that would give an answer are filtered per task (a plant title that named "Sunlight" now falls back to code-written words).

Verification:
- **Model and component tests:** `ecosystemLife.test.ts` and `EcosystemDiorama.modes.workspace.test.tsx` each pass, along with all 367 biology tests. Lumina typecheck is 0.
- **Payloads and journeys:** a saved payload per mode, and each journey sweep baselined J1 (WebGL). Tutor replay over the 6 payloads: 0/18 misses.
- **Browser drives** (Biology tester, now with a Task picker):

  | Drive | Result |
  |---|---|
  | `plant_needs` | 10/10 |
  | `season_behavior` (canvas taps) | 10/10 |
  | `season_from_log` | 15/15 |
  | `compare_logs` | 7/9 (the 2 failures are timing under two parallel browsers; the answers were credited) |
  | `keep_it_cool` | 10/10 |
  | `sun_test` | 32/33 (the 1 failure is Pip page noise) |
  | mixed (6 tasks in one world) | 13/13 |

- **Fixed from the drives:**
  - the snow blanket covered the water;
  - the meadow and the tree hollow could not be tapped (invisible hit volumes added);
  - the season-log answer layout;
  - picture-graph label emoji read as an extra count.

## Follow-up queue

| # | Skill | Layer | Input |
|---|-------|-------|-------|
| 0 | `/ship` | — | Commit the ecosystem slice: the files under `biology/ecosystem*`, the registrations, the Biology tester host and Task picker, and the catalog. |
| 1b | `/curriculum-fit ecosystem-diorama` | — | Expected homes: SCI001-03-G, SCI002-02-B/E, SCI003-01-D/G, plus unsampled K-ESS2-1, K-LS1-1, K-PS3-2 |
| 3 | `/add-support-tiers` | L3 | Likely misses: reading the taller red line as "less" (an inverted scale), and picking the thing guessed rather than the thing read. Help lever: tick-by-tick counting of the marks, or the two red lines drawn side by side. Simplify lever: a pair with a bigger gap (paper-colour or sand-place). |
| 5 | `/add-sound` | L5 | The sun drag (a rising tone), the thermometer passing a mark, the guess flag going in, and the reading. |
| ✓ | `/eval-test ecosystem-diorama` | QA | Run after each layer. |
