"""Authored build briefs for the Science K design review (imported by build.py)."""

BRIEFS = {
 '1-weather-records-to-seasons.md': ('Weather records: from a month of weather to a season', ['SCI003-01-D', 'SCI003-01-G'], """
## Learning goal and gap

Kindergarten scientists (SCIENCE, unit SCI003 Earth and Space Sciences, skill SCI003-01 Weather and Climate) learn that weather recorded over time shows a pattern, and that the pattern tells you the season or the place.

- **SCI003-01-D:** "Recognize and describe characteristics of the four seasons using evidence from weather patterns"
- **SCI003-01-G:** "Compare weather patterns between different locations and times using simple graphs and charts"

What exists now:
- **bar-model** already has K picture-graph modes, and a tutor that judges a spoken comparison against facts computed in code. But:
  - The counts are random, so snowy days can win in July.
  - `make_graph` uses a fixed weather theme with invented counts.
  - `compare_two_graphs` is hardcoded to "Morning" vs "Afternoon" surveys (gemini-bar-model.ts:1743-1750). The K probe of compare_two_graphs for SCI003-01-G returned toys and snacks.
- **knowledge-check and media-player** can ask "which season has snow?". That is recall of a season fact, not a conclusion drawn from recorded weather.
- **No primitive** shows a child a record of daily weather and asks what it tells us.

**Recommendation:** extend bar-model with weather records. The extension needs:
- counts that follow a season or place (a winter month is mostly snowy and cloudy);
- graphs labelled with the month or place;
- two question types: "which season was this?" and "how are these two places or months different?".

A calendar-style front end, where the child tallies a month grid of daily weather pictures into the graph, would match the daily weather chart kindergarten classrooms keep. The implementing session can decide whether that belongs in bar-model, in calendar-explorer, or in a new primitive.

## Essential behavior

- The record looks like real weather for its place and time, so the data supports the conclusion and the label does not give it away.
- **Season from a record:** the child reads one month's graph (or calendar), names the season, and says which weather showed it ("lots of snowy days").
- **Compare two records:** two graphs labelled with places or months; the child says one way they differ ("more sunny days in July").
- For the season question, the label must not reveal the answer: show "Month 1", or ask before naming the month.

## Worked example

- **Season:** a graph of 14 snowy, 8 cloudy, 3 sunny days.
  - Success: "Winter, because it snowed a lot."
  - Misconception: "Summer, because there are sunny days." The child picks a kind of weather that is present, not the one that is most common.
- **Compare:** "Our town in January" vs "Our town in July".
  - Success: "July has more sunny days."
  - Misconception: "They both have days." True, but not a comparison of the weather.

## Evidence of success

- **Independent evidence:** names the season for fresh records and gives the weather that shows it; makes a true comparison between two labelled records.
- **Should not earn credit:**
  - a season named from the label;
  - a comparison of two rows inside one graph (bar-model already rejects this as `rows_not_graphs`);
  - an answer that ignores the data.
- **Uncertain cases:** spring and fall records can look alike. Decide whether those count, or keep the season question to records that clearly differ.

## Constraints and open questions

- K counts stay small enough to see (no more than about 15 per row), and the K rules against reading numbers aloud still hold.
- Weather depends on where the child lives. Pick climates where the four seasons differ clearly, and say in the item where it is.
- Keep bar-model's existing K modes unchanged for math objectives (contract-first: fork by content source, not in place).

## Handoff

Read the repository's current guidance (/add-eval-modes, the bar-model contract if one exists, calendar-explorer). Decide the owner, the data source and the scoring, then build and verify with your own process.
"""),
 '2-sun-warming-test-bench.md': ('A sun-warming test bench for kindergarten', ['SCI001-03-G'], """
## Learning goal and gap

Kindergarten scientists (SCIENCE, unit SCI001 Physical Sciences, skill SCI001-03 Energy) learn that sunlight warms the Earth's surface, and that some surfaces warm more than others (NGSS K-PS3-1).

- **SCI001-03-G:** "Conduct basic heat energy experiments using sunlight and different colored surfaces"

Nothing in Lumina models sunlight warming a surface:
- light-shadow-lab is shadows only.
- day-night-seasons shows only day and night at K, and its K score counts actions, not answers.
- The only thermometer (energy-of-reactions) is for chemical reactions at grade 5+.

The K probes produced:
- a how-it-works procedure that never shows the result;
- a knowledge-check question whose answer the child has to recall rather than observe.

take-home-activity can send the experiment home, but it is written for the caregiver and records nothing.

**Recommendation:** a new primitive. No existing primitive has a surface, a sun and a temperature to read.

## Essential behavior

- **Fair test:** two (later three) things side by side that differ in one way: colour (black vs white paper), material (sand vs water), or place (in the sun vs in the shade). Everything else stays the same.
- **Predict, then watch:** the child says which will be warmer before time passes.
- **Read the result** on a picture scale a kindergartner can read (a thermometer with a coloured fill, or warm/hot faces), not numbers.
- **Say what the sun did:** "the sun made it warm" and "the dark one got warmer".
- **Later items:** change the setup to keep something cool (put it in the shade, cover it), which is the K-PS3-2 design idea.

## Worked example

- **Black paper and white paper** in the same sun for an hour.
  - Success: the child predicts "The black one will be hotter", and after the wait the black thermometer fills further.
  - Misconception: "The white one, because it is brighter." The result corrects it.
- **Sand in the sun vs sand in the shade.**
  - Success: "The sand in the sun got warmer."
  - Misconception: "They are the same, because it is the same sand." The child has missed that the place changed.

## Evidence of success

- **Independent evidence:** reads the warmer one correctly from the result on fresh pairs, and predicts correctly once taught.
- **Should not earn credit:** a correct prediction alone, since it can be a guess. The reading of the result and the reason are the evidence.
- **Supported practice:** the first test, where the tutor shows how to read the scale.

## Constraints and open questions

- Accurate content: dark surfaces absorb more sunlight, and water warms more slowly than sand. Code should own which one gets warmer.
- The result stays hidden until the test runs.
- Safety line for any real-life follow-up: never look at the sun.

## Handoff

Read the repository's current guidance (/primitive and its lifecycle, and the related primitives light-shadow-lab and energy-of-reactions). Design, build and verify the primitive with your own process; schema, naming and visuals are yours to choose.
"""),
 '3-make-it-go-energy-devices.md': ('Make-it-go devices: wind and battery energy', ['SCI001-03-H'], """
## Learning goal and gap

Kindergarten scientists (SCIENCE, unit SCI001 Physical Sciences, skill SCI001-03 Energy) learn that something has to give a device energy to make it work: moving air turns a pinwheel, and a battery in a closed loop lights a bulb.

- **SCI001-03-H:** "Create simple energy-based devices (pinwheels, circuits with batteries) to demonstrate energy conversion"

What exists now:
- There is no circuit, battery or pinwheel primitive. circuit-builder and energy-converter appear only as idea comments in catalog physics.ts:396-398.
- The K probes of how-it-works produced a 3-step pinwheel craft (cut, pin, blow) with no battery content.
- knowledge-check can only ask what makes a pictured device go.

**Recommendation:** a new primitive, at lower priority than the sun bench (brief 2). First confirm the curriculum choice: NGSS puts circuits at grade 4, and this K objective may be better served by the pinwheel half alone.

## Essential behavior

- **Make it work:** the child connects or places parts so the device works.
  - Closing the loop lights the bulb; an open loop leaves it dark.
  - Wind pointed at the pinwheel turns it; with no wind, it does not turn.
- **Find what is missing:** shown a device that does not work, the child finds the missing piece (the gap in the loop, the missing wind).
- **Say what made it go:** "the battery", "the wind".

## Worked example

- **Battery, two wires and a bulb,** with one wire not touching.
  - Success: the child closes the gap and the bulb lights. "The battery makes the light."
  - Misconception: adding a second bulb instead of closing the loop.
- **A pinwheel indoors** that does not spin.
  - Success: "It needs wind," and the child adds a fan or blows.

## Evidence of success

- **Independent evidence:** gets a fresh device working without being told the missing part, and names the energy source.
- **Should not earn credit:** trying every part until it works (watch the attempts), or naming the source with no working device.

## Constraints and open questions

- Circuit scope at K (see above); a ruling may drop the battery half.
- Keep it to the closed-loop idea: no series or parallel circuits, no symbols, no voltage.

## Handoff

Read the current guidance (/primitive, the open-build modality notes) and decide whether this is a new primitive or a scene in an existing build primitive. Build and verify with your own process.
"""),
 '4-two-design-test.md': ('Two-design test: predict, test, record, compare', ['SCI004-01-F', 'SCI004-01-G'], """
## Learning goal and gap

Kindergarten engineers (SCIENCE, unit SCI004 Engineering Design, skill SCI004-01 Design Process) learn to predict how a design will do, test it, record what happened, and compare two designs to decide which works better (NGSS K-2-ETS1-3).

- **SCI004-01-F:** "Make predictions and test simple design solutions, recording observations through pictures and basic words"
- **SCI004-01-G:** "Evaluate design outcomes by comparing two solutions and explaining which works better using evidence"

What exists now:
- **Building and testing one design:**
  - tower-stacker (K-1 builds to heights 4/5/6, with a code statics check)
  - open-builder (K builds judged from a picture of the build)
  - bridge-builder
- **Predict-then-watch on given objects:**
  - gravity-drop-tower predict
  - ramp-lab compare_conditions: adult text and one confounded pair (tracker RL-C1)
  - push-pull-arena predict: K gets the grade 1 configuration (tracker PPA-G1)
- **Missing everywhere:** no primitive asks a child to predict how their own design will do, records an observation that is checked, or puts two of the child's designs side by side and asks which worked better.

**Recommendation:** add a two-design mode to an existing build primitive. tower-stacker is the closest fit, because its test result (stands or falls, how high) is computed in code and easy to show twice. open-builder is the alternative if builds judged from a picture are preferred.

## Essential behavior

- **Two designs for one job:** the child builds design A and design B, or changes one thing between them.
- **Predict** which one will work better before testing.
- **Test both and record each result** by choosing a picture or word (stood / fell; held 3 blocks / held 1).
- **Decide and give the evidence:** which worked better, and what in the test showed it.

## Worked example

- **Job:** a tower that stays up in the wind. A is tall and thin; B is short and wide.
  - The child predicts "B". In the test, A falls and B stands, and the child records that A fell and B stood.
  - Success: "B is better because it did not fall."
  - Misconception: "A is better because it is taller." The child judges by a feature, not by the test result.

## Evidence of success

- **Independent evidence:** the recorded result matches what happened, and the choice of the better design follows from the recorded results. Mark these two separately.
- **Should not earn credit:** a correct "better" choice that contradicts the child's own record, or a prediction counted as evidence.
- **Not a failure:** a wrong prediction. Predicting is practice; the record and the decision are the evidence.

## Constraints and open questions

- Both designs must be visible together when the child decides.
- Recording uses pictures and one or two words, read aloud.
- Keep the existing single-tower modes unchanged.

## Handoff

Read the current guidance (/add-eval-modes, the tower-stacker and open-builder contracts, the open-build modality notes) and choose the owner, the record form and the scoring. Build and verify with your own process.
"""),
 '5-everyday-mixes-reaction-lab.md': ('Everyday mixes: a kindergarten mode for reaction-lab', ['SCI001-02-H'], """
## Learning goal and gap

Kindergarten scientists (SCIENCE, unit SCI001 Physical Sciences, skill SCI001-02 Matter) learn that mixing materials can make something with different properties: sand and water make mud that holds a shape, flour and water make sticky dough, and blue and yellow paint make green.

- **SCI001-02-H:** "Explore simple combinations of materials and their resulting properties"

What exists now:
- **reaction-lab** is the only mixing primitive a kindergartner can reach, and its K content is whatever the model writes.
  - Both K probes drew classic reactions (baking soda volcano, magic milk).
  - The observe probe ended with a typed "physical or chemical change?" item (tracker RXL-K1).
  - The predict probe's title gave away the answer.
- **mixing-and-dissolving** has sand, flour and food colouring, but its lowest grade is 3.

**Recommendation:** a K mode in reaction-lab, which is a smaller change than a new primitive. Build it on a code-owned list of everyday mixes, each with its result and the property that changed.

## Essential behavior

- **The sequence:** two everyday materials; the child predicts what the mix will be like, mixes, and chooses what the result is like (sticky, holds a shape, new colour, disappears, still separate).
- **Answers** are pictures read aloud. No typed answers and no physical/chemical vocabulary at K.
- **Not every mix changes:** sand and pebbles stay separate, so "nothing new" is sometimes right.

## Worked example

- **Sand + water.**
  - Success: "It makes mud that I can shape."
  - Misconception: "It makes water." The child names an input, not the new property.
- **Oil + water.**
  - Success: "They stay apart."

## Evidence of success

- **Independent evidence:** for a fresh pair, chooses the property of the result correctly, including mixes where the parts stay separate.
- **Should not earn credit:** an answer given away by the title or picture.

## Handoff

Read the current guidance (/add-eval-modes, the reaction-lab contract, reader-fit notes for K) and choose the content list, response form and scoring. Build and verify with your own process.
"""),
 '6-habitat-diorama-seasons-and-plants.md': ('habitat-diorama: seasons and plant needs', ['SCI002-02-E', 'SCI002-02-B'], """
## Learning goal and gap

Kindergarten scientists (SCIENCE, unit SCI002 Life Sciences, skill SCI002-02 Living Things and Their Needs) learn what plants and animals need, and how they change what they do when the season changes.

- **SCI002-02-E:** "Explain how seasonal and weather changes affect plant and animal behavior using examples"
- **SCI002-02-B:** "Identify the three basic needs (food, water, shelter) of plants and animals through sorting activities"

What exists now:
- **habitat-diorama `build_habitat`** already serves the animal half of SCI002-02-B well. The probe drew a penguin, squirrel, deer and frog.
  - The child builds a habitat with food, water and shelter for a named animal.
  - Code checks the needs, and the needs are not named on screen.
  - It has no plants and no season.
- **No primitive has a season state.** Hibernation, migration and leaf-fall appear only in model-written text: media-player, knowledge-check, and di-spoken-practice explain_concept (which gave good why-questions in the probe).

**Recommendation:** two modes in habitat-diorama, which already draws a living scene and checks needs in code:
- **Plant needs** in the habitat build: a plant needs sunlight, water, air and soil. A pot in a dark cupboard is a misconception item.
- **Season change:** the same scene in summer and then in winter. The child shows what each animal or plant does (the bear goes to its den, birds leave, leaves fall, the squirrel stores nuts) and says why.

## Essential behavior

- **Plants:** the child gives a plant what it needs. Animal-only pieces (a den, meat) are wrong for a plant.
- **Seasons:** after the scene changes to winter, the child moves or chooses each organism's winter behavior, then answers one "why" (too cold, no food).
- **No early answer:** the winter scene starts with every animal still in its summer place, so the answer is not visible before the child acts.

## Worked example

- **Plant: a sunflower.**
  - Success: sun, water, soil.
  - Misconception: a den and berries ("it needs a home and food like animals").
- **Season: winter comes.**
  - Success: the bear goes to the den. "There is no food, so it sleeps."
  - Misconception: "The bear goes swimming."

## Evidence of success

- **Independent evidence:** for a fresh plant, meets its needs; for a fresh animal, chooses the right winter behavior and gives a reason about cold or food.
- **Should not earn credit:** a behavior chosen because its picture repeats the animal. Tracker MP-LL1 shows this in media-player.
- **Uncertain cases:** animals that change little in winter (deer). Decide whether "stays and finds food" is an option.

## Constraints and open questions

- Keep the existing build_habitat animal behaviour and the food-web modes unchanged (contract-first).
- Seasonal behaviour depends on climate. Pick familiar temperate examples and say so.

## Handoff

Read the current guidance (/add-eval-modes, the habitat-diorama contract, habitatBuild.ts) and choose the scene, response forms and scoring. Build and verify with your own process.
"""),
}
