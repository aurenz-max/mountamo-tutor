# Birth Certificate — life-lab (2026-11-07)

**Lifecycle layer: L0 born, with ten modes and voice.** The K-5 biology canvas the user confirmed on 2026-11-07
("yes! this is exactly what i am looking for"; prototype https://claude.ai/artifact/Dn1btqTi53pkSSpiis3nak). It replaces
body-workshop's one-task pipeline. Design and SB-16: `qa/science-build/workshop-worlds-design.md`.

## What it is

An author agent (`service/biology/life-lab/agent-life-lab.ts`, gemini-flash-latest, wonder-walk's tool loop) composes
3-5 small living worlds per lesson from five blocks: places with conditions, living things (atlas ids, traits, a
population), one rule kind (`needs`, `part_enables`, `inherits`, `stages`, `spots`, `flows`), one thing the child changes
(`condition`, `move`, `trait`, `order`, `choose`, `predict`), a goal, and `respond` (show | say). The agent never states
a task, a skill or an answer.

Code (`primitives/visual-primitives/biology/life-lab/`):
- **Facts** (`lifeLabAtlas.ts`): 31 organisms (needs, life cycles, real breathing paths, the parts they really have,
  who hunts whom), part jobs, words that give a part away.
- **Engine** (`lifeLabWorld.ts`): runs the rules, solves every setting the child could make, names the mode and
  standards from the structure, scores difficulty, and blocks shortcuts and leaks.
- **Voice** (`lifeLabSpoken.ts`): a part, a coloring or a prediction is said or tapped (SAY_OR_SHOW, key and misses
  derived); moves, settings, orders and paths are shown.
- **Renderer** (`LifeLab.tsx`): one 2D component for every world.

## Modes (code names them; one real generation each)

| Mode | Standards | β | Answer | Real run |
|---|---|---|---|---|
| where_it_lives | K-ESS3-1, K-LS1-1 | -0.5 | shown | yes (polar bear, camel, penguin, lizard, duck) |
| what_it_needs | K-LS1-1, 2-LS2-1 | -0.3 | shown | yes (bean, fern, cactus, two plants in two pots) |
| part_for_the_job | 1-LS1-1, 4-LS1-1 | 0.0 | said or tapped | yes (hummingbird, heron, duck feet, snow feet) |
| hide_from_the_hunter | 1-LS1-1, 3-LS4-3 | 0.3 | said or tapped | yes (beetle on sand, moth on moss, grasshopper on soil) |
| whose_baby | 1-LS3-1, 3-LS3-1 | 0.6 | shown | yes (cats, dogs; failed once before passing) |
| spread_the_seeds | 2-LS2-2 | 0.8 | said or tapped | yes (wind, dog fur, stream) |
| life_cycle | 3-LS1-1 | 1.0 | shown | yes (butterfly, then chicken and frog to compare) |
| follow_the_path | 4-LS1-1 | 1.5 | shown | yes (person, tadpole, frog's skin) |
| survive_and_change | 3-LS4-2, 3-LS4-3 | 2.0 | said or tapped | yes (beetles, grasshoppers, moths on four barks) |
| fair_test | 2-LS2-1, 3-5-ETS1-3 | 2.3 | shown | yes (water and light tests, pots start unfair) |

## Rules from reading the real generations

Each became a check with a test (`lifeLabWorld.test.ts`):
- An ask that says what the working part does ("push water like paddles", "glide") or names it by a synonym ("moist
  skin").
- An ask that contradicts its own place ("in the dark" in bright light), or says what is missing ("needs more light").
- A place that is not what its kind says (a wet desert).
- A real animal given a part it does not have (a hawk with a spear beak), or a hunter that does not hunt the prey (a
  fox and moths).
- One dial only: when the child can change only the thing being tested, any change "works".
- Camouflage with two answers only: widened to six colorings and three prey.
- A carrier named differently from the scene ("fox" when a dog is drawn).
- A life-cycle ask that names the first stage.

Declines that were signals, each fixed: a camouflage world too narrow; a prompt that hid who hunts what; a
copy-of-example rule that refused every butterfly; a monarch lesson that the agent thought forbade comparison.

## Checks

- `typecheck:lumina` 0. Full tsc: 770 errors repo-wide, none in life-lab files.
- Own tests: 53 (engine and coverage 37, spoken 4, workspace 6, author loop 4).
- `test:primitive life-lab`: 808 + 51. The journey sweep ran over all 10 saved real payloads; J14 is clear after voice.
- Browser drive (`life-lab-drive-2026-11-07/`, headless, Biology tester): all 10 modes mount, run and check. The
  400s are the tester's unsigned JEV observer endpoints (`observe-learner` and others), the same for every
  primitive.
- Gemini: about $0.80 automated today, over roughly 20 agent runs.

## Not done

- Live sample (user). Life-lab is new on the spoken path, so this changes what the tutor receives. The moments are
  recorded (free, 10 records: `qa/tutor-reports/life-lab-moments-2026-11-07.json`). Command:
  `cd backend/tests/tutor_live && ../../venv/Scripts/python tutor_replay.py ../../../my-tutoring-app/qa/tutor-reports/life-lab-moments-2026-11-07.json --primitive life-lab --samples 1 --observe`
  (the script prints the request count before it spends). It answers two questions: does the tutor teach a shown
  world without naming the answer, and on a said world does it credit "the thick one" and name `wrong_part`?
- `/curriculum-fit life-lab` (homes for the 11 standards).
- `/review-live-wiring life-lab`.

## Follow-up queue

| # | Skill | Input |
|---|---|---|
| 1 | `/add-support-tiers` | Levers per rule kind: show the place's conditions as gauges (needs), a picture of the part doing its job (part_enables), traits lined up beside each parent (inherits), the first stage placed (stages), the hunter's view (spots), the breath slowed with labels (flows). Every miss is `unanswered` until then. |
| 2 | Canvas growth (this skill's own I3) | `inherits` beyond cats and dogs (plants, birds, insects: a "Monarch Butterfly" × whose_baby pin declined for this); rule kinds `responds` (stimulus → response, 4-LS1-2) and `eats` (energy along a chain, 5-PS3-1); plant transport in `flows` (5-LS1-1). |
| 3 | body-workshop retirement | Once life-lab passes `/curriculum-fit`, move body-workshop's homes here (its two modes are `follow_the_path` compositions), then remove it from the catalog. |
| 4 | Why-card policy | Some why-cards hint by function after a miss ("which feathery organ"). Decide whether after-miss hints may describe the function; the ask may not. |
| ✓ | `/eval-test life-lab` | After each layer. |

## 11-07 revision: the agent writes the content (USER: "we make the schema and instructions, the agent makes the content")

The first build kept biology facts in code as gates: 31 organisms, traits for dogs and cats only, beak/seed/feet part
tables, fixed cycles and breathing paths. A "Monarch Butterfly" lesson pinned to whose_baby was declined. Now every
world declares its own content and code checks only structure and fairness (`/agent-primitive` I12; no reviewer, by
user choice: the model's facts are trusted):
- Living things: any organism (name, emoji, needs, traits); `subject` is optional shorthand that the atlas fills.
- Traits: any names and values (wing color, vein thickness, antennae); inheritance is pure structure.
- Parts: the options and what each one `works` on, for any feature of the place (spines vs deer, taproots vs deep
  water).
- Stages: any life cycle, declared in order, with `extras` from another life. Flows: any parts with
  in → out (digestion, not only breathing).
- The "only the working option has this word" rule replaces the per-part giveaway lists; the old fidelity gates (real
  part, who hunts whom, beak on a bird) are gone.
- Drawing comes from what was declared: emoji, colour swatches and chips for traits, the agent's option and stage
  pictures. The atlas drawings stay as richer pictures where they apply.

Checks: own tests 54, including 5 I12 worlds no list contains (monarch inheritance, a sunflower cycle, cactus spines,
digestion, a cave salamander). Gate 809 + 51 (the old shorthand payloads still load through normalization). Real runs
on topics that failed or could not exist before: monarch whose_baby, sunflower life cycle, desert plants, digestion,
all shipped. Browser drive: monarch inheritance, declared cycles and parts mount and check. About $0.90 today.

Still open: trait chips are words beside colour swatches. A pre-reader needs pictures, so trait drawings from declared
values are a rendering slice. Word level in declared names was tightened in the prompt after "chyme" and "bolus".

## 11-08 revision: the full agent framework (USER: tools that generalize across most any concept, plus biology's own capabilities and displays)

A mitochondria session was three ordering and choice items with one microscope emoji on every card. Life-lab's only tool was a world. Now:
- `write_item` (kit surfaces over displays and the agent's own drawings) beside `write_world`; the agent picks by concept. Writes land in the order the agent called them.
- A kit teach step (`teach.ts`, `TeachPanel.tsx`): frames of a sentence and a drawing before an item. The first item must teach.
- Biology displays in the registry (`cell`, `zoom`, `food_web`); `svg` on the menu, and the author is shown every drawing.
- Blind solve against the author's key on kit items. New blocks: words-only items, token card drawings, shared pictures on choices, a right card alone using a taught word, a hint written about the child.
- `plan.idea` is no longer shown to the child (queue item 2). Raw keys with underscores no longer reach the screen.

Real runs (3): mitochondria G3 $0.10, digestion G4 $0.11, plant parts G1 $0.13; 87-128 s; 4 items each. Browser: all three played in the tester with saved payloads, teach frames, cards, feedback.
Owed: reader advisories that shipped (a `?` on the part drawn on only one card, cards told apart by a count), agent SVG quality varies (the digestion mouth drawing is poor), `/eval-test`, and one Live sample on a teach frame.

## 11-08 /review-agent-primitive queue (executor: `/agent-primitive life-lab`, top first)

Mode as an input also failed (USER 11-08). Done the same day (WORKSTREAMS row 16): one catalog mode `world`, skill names
are labels, item 1 below is closed, and the kit half of item 7 that re-reads a late rewrite is closed. Real runs: default
topic $0.065; beaks hard $0.059 then $0.083 (4.4); camouflage medium $0.065, then hard $0.081 (a prediction whose starting
majority loses scores 3.0). Two reads changed code: a duplicate coloring value (now refused), and "freezing cold" padded
as a beak demand (prompt rule; the later run had none, but no code check stops it, and option `works` lists are still
unread: item 7). 8 pre-lever payloads are baselined until regenerated. Why-card leaks recurred in the real runs (item 3).
Declines (USER 11-08): a topic above the grade is no reason to decline, and the kit refuses a decline while passing items
are held. "mitochondria" at K now ships ($0.055) but is weak: light, water and warmth dials stood in for cell biology
("Lots of mitochondria" as a warm place), and the why-card named the answer.

1. Tier failure: part_for_the_job, spread_the_seeds and hide_from_the_hunter score at most 0.9 (always easy), so a
   medium or hard request throws after 10 turns. whose_baby tops out at 2.1 (no hard); survive_and_change is always 2.0
   (medium only). Add structural difficulty terms; refuse a tier a mode cannot reach before the first turn.
2. `plan.idea` is shown to the child and checked by nothing (desert session: "thick stems ... sharp spines ... deep or
   wide roots" names all three answers). Run it through the same leak rules, or stop rendering it.
3. Why-card word leak: the "only the working option has" rule reads the ask only, and matches one way ("spear" and
   "gnaw" shipped). Read ask + why + displays; match stems both ways.
4. Options keep the author's order (`settleBench` shuffles only order controls): the right answer was first in all 3
   items of one run and second in 3 of 4 of another. Shuffle options and `among`, per-item seed, same order on a help.
5. The start value is pre-selected and always wrong, so a 2-option world or simplify has one real choice (3 of 4
   simplifies in the 11-08 run). Block it, or start with nothing picked.
6. Look view: seed per item (only item 0 matches what ships), Try it only when `canRun`, the real run label, the
   picked option, and the session description.
7. Kit: a rewrite after the last look round ships unread (life-3 on 11-08). Kit: readers never compare with the key
   and never see `works`/`needs`.
8. Helps: all four on 11-08 only added a place emoji. Take `emoji` out of `drawn`, and rewrite `LEVER_EXAMPLES`.
9. `flows` caps slots at 4 while parts go to 6 and stage rows draw 6. Add tests for: no option works, no setting
   reaches the goal, prediction names only the answer. Rows at grade for 3-LS3-1 and 3-5-ETS1-3.

## 11-08 teaching sections and an authored objective (USER: not just 4 problems; sections with pictures; a click-to-paint picture; an objective in the manifest's shape)

Kit: `write_section` (`teach.ts`) places sections anywhere in the lesson (`insertAt`), each frame a sentence plus `show`, `picture` (prompt only, painted on a click) or `cards`. A section ships as the `teach` of the next question, so the runtime and score count questions only. `planWithObjective` asks for `objectiveText` and `objectiveVerb` when the lesson has no objective. The look reader now reports what a question needs and was never taught, and re-reads a question when the section before it changes. "Look back at the lesson" reopens a section.

Run: monarch butterfly, elementary, $0.144, 132 s, 13 turns, 4 questions, 2 sections. The reader caught warning coloration as untaught and the agent added a section. Browser: `life-lab-sections-2026-11-08/`, section, picture (one image, about $0.05), cards, task and Look back all played. Gate 876 + 131, typecheck:lumina 0, tsc 770 (baseline).

Open (executor `/agent-primitive life-lab`):
1. Teaching shows the answer: the first section draws the life cycle in order, then question 1 asks for that order, and Look back lets the child copy it. Question 4 repeats a section sentence that names its wrong cards. The reader did not flag either.
2. The body-parts sort still has no section of its own; its labels describe the parts, so the reader passed it.
3. Not wired or run: the tutor reopening a section as a lever, a Live sample on a section, other agent primitives adopting `write_section`.
