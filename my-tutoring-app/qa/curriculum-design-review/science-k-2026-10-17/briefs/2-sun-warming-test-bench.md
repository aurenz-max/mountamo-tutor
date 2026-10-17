# A sun-warming test bench for kindergarten

> **Status 2026-10-17:** built as modes of `ecosystem-diorama` (a 3D island tank) instead of the remedy below: `sun_test`, `keep_it_cool`. See `qa/eval-reports/ecosystem-diorama-birth.md`. Fixing bar-model's hardcoded "Morning vs Afternoon" stays a defect fix.

Curriculum IDs: SCI001-03-G (SCIENCE, grade K). Source: design review science-k-2026-10-17.

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
