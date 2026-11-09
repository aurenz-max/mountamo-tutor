# Workshop worlds: machine-workshop and body-workshop as canvases (design, 2026-11-07)

**User 11-07:** "we made a fancy agent pipeline to do 1 set of work, not a canvas to build a scalable set of lessons. its
not ambitious enough." The workshops must cover their domains from K to grade 5, starting at K-2. They should be built
the way wonder-walk's math world is (`/agent-primitive`, I1-I11), not as one task per mode.

## 0. Update 11-07: biology spec confirmed

The user confirmed a broader biology spec on a working prototype (https://claude.ai/artifact/Dn1btqTi53pkSSpiis3nak). The agent composes places + conditions, living things (atlas ids, traits, populations), rule kinds (`needs`, `part_enables`, `inherits`, `stages`, `spots`, `flows`; next `responds`, `eats`), child moves (`condition`, `move`, `trait`, `order`, `choose`, `predict`) and a goal. Code holds the facts, runs the rules, solves every move, and names the mode. Sections 3-4 below are superseded for biology by that spec; the prototype engine is the reference for the build.

## 1. Audit before (from the code)

| Invariant | machine-workshop | body-workshop |
|---|---|---|
| I1 agent owns decisions | FAIL: the agent picks machines from 8 names and writes the job text; code picks the task, the missing slot, the tray and all sizes (`machine-author.ts`, `buildItem`) | FAIL: the agent picks animals from the tier's names and writes the job text; code picks the goal, the bench and the contrast animal (`body-author.ts`) |
| I2 breadth | 1 task; 3-5 only (spin_to_push, β 1.4); catalog lists grades 2-8 | 2 tasks, both internal paths; claims K-LS1-1 and 1-LS1-1 but builds windpipe → lungs (4-LS1-1 content) |
| I3 world + goal | FAIL: one fixed task: fill the converter slot | FAIL: one fixed task: build the row |
| I4 code derives answer | PASS: the `MOTION` table and `judgeBuild` | PASS: `FLOW` and `traceBuild`, plus atlas fidelity |
| I5 solver | partial: `machineFair` (exactly the right pairs work) | partial: the same bench for every animal; leak audit |
| I6 computed difficulty | FAIL: the tier is a preset (sizes on or off) | FAIL: the tier is an animal list |
| I7 variety | none | the tier contrast only |
| I9 code names the mode | FAIL: the mode is the request | FAIL: the mode is the request |
| I11 production | FAIL: tap only, judged by the activity | FAIL: tap only, judged by the activity |

Kept: the pure models are already the right core. `MOTION` (spin/push in → out) and `FLOW` (token in → token out) are
transform tables, and each atlas is a fidelity oracle. The rebuild gives the agent a world over these tables. It does
not replace them.

## 2. The canvas idea

Both primitives are **a system with a source, parts that change what passes through them, and a goal on what reaches
the end.** Wonder-walk's world is places + contents + events + answer. The workshop world is:

- **things**: parts with an in → out row in the domain's table; outside structures with what they can do;
- **where**: the setting (an oil field, a pond, a windy hill), which fixes the source (spin from wind, air vs water);
- **state per part**: `shown | missing | broken | loose (on the tray) | hidden`;
- **events**: run, breathe, eat, a stimulus, a change of setting (the pond dries up, the wind stops);
- **answer**: `tap` (a rule over parts or builds: the broken one, the one that goes farther, what moves next),
  `move` (change the world until the goal holds), `say` (a value code derives: "up and down", "gills", "pull").

Code reads the task from the structure. The agent never picks a task, and each new standard is a new composition.
Shared code goes in one kernel (`service/science/system-world/`): the draft types, the run-the-table tracer, the goal
check, the move solver and the difficulty terms. Each workshop supplies its table, atlas, renderer and words. Two
primitives remain, because the renders and the curriculum homes differ.

## 3. Objective family (the acceptance test, written first)

Each row needs a hand-built composition in `*.coverage.test.ts` that passes every check, plus one real generation
(the breadth verdict). **Bold** = K-2 entry.

### machine-workshop: how machines move things (K-5)

| Standard | Composition (what the agent builds) | Mode code names |
|---|---|---|
| **K-PS2-1** pushes and pulls of different strength/direction | a cart, wagon or swing; the child taps push or pull, harder or softer, to reach the goal | `push_or_pull` |
| **K-PS2-2** design to change speed or direction | a ball or cart and a goal spot; ramp, wall or bumper parts on the tray; move until it arrives | `change_direction` |
| **K-2-ETS1-1** define the problem | a machine that does not do its job; the child says or taps what is wrong ("the bucket doesn't go up") | `whats_the_problem` |
| **K-2-ETS1-3** compare two solutions | two builds run side by side; tap the one that meets the goal (farther, higher, faster) | `which_works_better` |
| **K-2** order of power (no standard number; feeds 3-5-ETS1) | all stages loose; place them in the order power moves | `follow_the_power` |
| **2-PS1-2** materials suited to a purpose | a belt or rope stage whose material matters (string vs paper vs chain) | `pick_the_material` |
| **simple machines** (state standards, e.g. TEKS 3.6, 4.6; Gr 2-4) | a lever, wheel and axle, pulley or ramp stage; goal = lift the load with the push you have | `lift_it` |
| **3-PS2-2** predict a motion pattern | a running machine is paused; tap what the working end will do next | `predict_the_motion` |
| **3-5-ETS1-3** fair test / failure point | one stage broken among working ones; run, find it, replace it | `fix_the_machine` |
| **4-PS3-4** device converts energy | spin_to_push (today's mode, kept), plus gears that trade speed for force | `spin_to_push`, `gear_for_the_job` |
| **4-PS3-4 / engines** | the reverse chain (push → spin): piston → rod → crank → flywheel; time the spark | `time_the_spark` |

Out of scope (other primitives own these): circuits (circuit workbench), ramp and ball runs as a whole lesson
(marble-run-park; the K-PS2 compositions here are single-machine items), floating (sink/float harbor), sound
devices (sound-studio).

### body-workshop: how living things meet their needs (K-5)

The world gains an **outside layer** (structures matched against the setting and the need) beside the existing
**inside layer** (paths through the flow table).

| Standard | Composition | Mode code names |
|---|---|---|
| **K-LS1-1** animals and plants need food, water, air | a living thing and a setting with one need not met; tap or say what it needs | `what_it_needs` |
| **K-ESS3-1** living things live where their needs are met | two or three settings; move the animal to the one that fits | `where_it_lives` |
| **1-LS1-1** outside parts help survive | an animal, a job (crack a seed, swim, stay warm, catch a fish); tap or say the part that does it (beak, flippers, fur, claws) | `part_for_the_job` |
| **1-LS1-1** design from nature | a person's problem (stay warm, grip ice); pick the animal part to copy | `copy_nature` |
| **1-LS3-1** young are like their parents | a baby and three grown-ups; tap the parent by shared parts, not by size (solver rule) | `whose_baby` |
| **2-LS2-1** plants need water and light | a plant in a setting; change the setting until it grows | `help_it_grow` |
| **2-LS4-1** different life in different habitats | sort animals into settings by their parts | `sort_by_habitat` |
| **3-LS1-1** life cycles | stages loose; order them (frog, butterfly, bean) | `life_cycle` |
| **3-LS4-3** some survive in a habitat, some do not | the setting changes (the pond dries); tap who can still live there | `habitat_change` |
| **4-LS1-1** internal structures | today's `deliver_oxygen` and `fuel_the_body`, kept | `deliver_oxygen`, `fuel_the_body` |
| **4-LS1-2** senses → brain → response | stimulus → sense organ → nerve → brain → muscle path (K-2 stops at the sense organ) | `sense_and_respond` |
| **5-LS1-1** plants get material from air and water | root → stem → leaf path in the plant table | `plant_transport` |

Out of scope: cells (cell-builder), food webs and decomposers (food-web-builder, the ecosystem island).

## 4. Tool surface (one write tool per primitive)

```ts
// shared kernel shape; each workshop narrows the kinds
interface WorkshopWorldDraft {
  subject: string;                 // atlas id: 'pump_jack', 'frog', or 'other' when the atlas lacks it (judged review)
  setting: string;                 // where it is: 'pond', 'oil field' (code maps it to the source token)
  parts: Array<{ id: string; kind: string; size?: string; state: 'shown'|'missing'|'broken'|'loose'|'hidden' }>;
  tray?: string[];                 // distractor kinds the agent adds; code checks them against the shortcut rules
  compare?: WorkshopWorldDraft[];  // a second build to run beside the first (which_works_better)
  events?: Array<{ kind: 'run'|'pause'|'change_setting'|'stimulus'; to?: string }>;
  answer: { kind: 'tap'|'move'|'say'; rule?: string; goal?: GoalDraft[] };
  respond: 'show'|'say'|'say-any'|'explain';   // I11; code refuses one that does not fit
}
```

There is no task field and no key field. A write returns `{ checks, difficulty, mode, standards, key, answeredBy }`.
Plan, remove, finish and decline follow wonder-walk's agent loop (`agent-wonder-walk.ts`), so the agent builds a
session of 3-5 items with variety (I7) and aims at `config.difficulty` (I6).

## 5. Code-owned checks

- **Key (I4):** the table runs the world. A broken part is the first place the trace stops; "which works better" runs
  both builds; `say` keys come from the table's words.
- **Fidelity:** atlas paths stay the oracle. `subject: 'other'` goes to an independent review round, the way
  wonder-walk's story items do.
- **Shortcut rules (I5), new ones:** the only part with a peg (match the shape); a baby matched to its parent by size or
  colour alone; the setting's picture shows the answer (a fish drawn underwater beside its gills); the broken part
  drawn differently; the narration naming the part ("the bird uses its beak to..."); an ordering whose loose parts are
  laid out in order.
- **Difficulty (I6):** number of parts, number of loose parts, distractor distance (lungs vs gills is near, stomach
  vs gills is far), a misleading setting (whale), production vs recognition, an inside layer vs an outside one.
- **K-2 bounds (I10, from the lesson's grade):** at most 3 parts; outside layer or paths of 1-2 parts; words from the
  word library with reviewed pictures; `reader: none` (the tutor voices every label); nothing depends on the child's
  own reading.

## 6. What the child produces (I11)

| Production | Machine | Body | Built in slice |
|---|---|---|---|
| Say the value | "up and down", "pull", "the belt" | "gills", "its beak", "water" | 1 |
| Make any that fits | a part that turns things (gear, wheel, crank) | an animal that lives in a pond | 2 |
| Say the parts in order | the power order, aloud | a life cycle, aloud | 2 |
| Show | builds, orders, moves | rows, sorts, moving to a setting | 1 (today's) |
| Explain | "why did it stop?" | "why can't the fish live there now?" | 2 (needs `meaning` keys) |

The workshops move from a bespoke `defineBoss` to `spokenBoss` (`wonderWalkSpoken.ts` pattern).

## 7. Build order

1. **Kernel + body-workshop K-2 outside layer** (`what_it_needs`, `part_for_the_job`, `where_it_lives`,
   `whose_baby`) on the shared world tool, say + show. This slice makes body-workshop K-2 for the first time. The
   existing two modes move onto the same tool, and their behaviour must not change (contract check).
2. **machine-workshop on the kernel** (`push_or_pull`, `follow_the_power`, `which_works_better`, `fix_the_machine`),
   then `lift_it` and `gear_for_the_job`. `spin_to_push` is kept.
3. Then the grade 3-5 rows, the levers for each new block (`/add-support-tiers`), and the remaining productions.

Each slice: coverage test per standard row, scripted-model loop test, `test:primitive`, a real generation per mode
(spend reported), browser check by the user, one Live sample command handed to the user. `/curriculum-fit` for both
runs before slice 1 to confirm which published K-2 subskills route here.
