---
name: agent-primitive
description: >-
  Design, audit, test or revise an agent-authored primitive (a generator that runs a model in a tool loop under code
  checks: wonder-walk, deep-dive, annotated-example). Holds the invariants that make an agent primitive stronger than a
  schema primitive: the agent describes a world and a goal (no writer per mode, no task menu), code derives every
  answer and names the skill from the structure, solves every item for shortcuts, computes difficulty from what was
  built, and every part has a render, a tool and a tutor face, including how the child answers: the agent designs what
  the child produces (say the value, make any word that fits, show it) by the nature of the problem, and code derives
  the boss wiring, key, misses and harness from it (/add-live-tutor-tools does the mechanics). Also owns the kit's
  displays: which ones each agent primitive offers and how a new one is wired. Use when building a new
  agent primitive, when an agent primitive feels no stronger than an on-rails schema, to wire or rewire one to the
  tutor, or to audit one. Not for which primitive a lesson gets (the manifest owns that), a schema generator with no
  tool loop (/primitive, /add-eval-modes), or levers alone (/add-support-tiers).
---

# Agent Primitives

## The outcome

An agent primitive earns its cost (several model turns, a tool loop, a review) only if it can build items a schema
generator cannot. The manifest still picks the primitive for an objective, on rails. Inside the primitive, the agent
designs how the objective is taught and practised, and code makes everything the agent builds correct and fair.

**Why this exists (USER 2026-11-06, wonder-walk):** the first math modes gave the agent one writer per mode
(`write_count_stop`, `write_compare_stop`). Code picked every number, the task, the layout and the stop type; the agent
picked two emoji words and three sentences. That is the old Gemini schema split into a function call, plus a retry.
It covered two of the K counting standards and was no stronger than a schema.

The first fix (same day) swapped that for 4 tasks × 4 layouts and covered 5 of ~22 K math standards: still a menu,
one level down. The second (`service/core/wonder-walk/world.ts`) gave the agent a world and a goal: places, what is
in them, a story, and an answer condition. The same tool covers 15 standards (counting, operations within 10, teens,
sort and count) with no task list; the old tasks are compositions of it.

The roles that make it stronger: **the agent describes a world and a goal; code builds it, derives the answer, names
the skill, solves it for shortcuts and scores it.**

## General agent primitives (USER 2026-11-08)

An eval mode in an agent primitive is a capability the agent can use (an answer surface, a display, the boss schema),
not a task code pre-specified (life-lab's `whose_baby` was a task: it capped inheritance at one item shape). The kit
holds the capabilities: `surfaces.ts` (choose, categorize, order: scoring, shortcut checks, structural difficulty),
`displays.ts` (one registry entry per display: agent SVG, table, text, and code-drawn bar graph, number line, clock,
base ten, pattern blocks, ten frame, array, coins, picture graph, timeline, flow and map) and the write-look-revise loop
(`itemLoop.ts` + `look.ts`: screenshot, blind solve, code checks, revise per item). `practice-studio` is the first
primitive on it: one catalog entry, one mode. A new kind of item is a new surface or display in the kit. For keys
code cannot compute (which picture), the blind solve is the independent reader (I4): on 11-07 it agreed with the
author 18/18; its value is catching shortcuts (7 to 4 after revising). Agent-claimed tiers do not hold; difficulty
stays computed (I6). Evidence: `scripts/agent-surface-probe.mjs`, `qa/agent-surfaces/`.

**A subject primitive is the framework plus its subject's capabilities (USER 2026-11-08, life-lab).** It stays its own
entry, follows this framework and generalizes across most any concept in its subject: the agent decides what to show,
teach and ask. The kit gives it the teach step (`teach.ts`: frames of a sentence and a drawing), the answer surfaces and
displays through `write_item`, and its own drawings; the subject adds displays to the registry under a domain tag and may
keep a simulation (life-lab's `write_world`) as one more writer. Never answer a weak topic with a world or a rule for that
topic. A world is the right tool only when running it teaches.

**Teaching is a lesson piece, not a preamble (USER 2026-11-08, life-lab).** `write_section` (`teach.ts`) places sections where the agent wants them; a frame is a sentence plus any of a display or drawing, a click-to-paint `picture` (prompt only) and `cards`. A picture appears only in a section, because no reader sees it at authoring time, and the sentence must teach without it. A lesson with no objective gets one from the plan tool, in the manifest's fields (`planWithObjective`), and the look reader checks against it.

**Displays before drawings (USER 2026-11-08).** When the agent keeps hand-drawing the same kind of thing, build a kit
display: the agent writes a few values, code draws it and can check it. Hand-drawn SVG was 65-75% of the item text on
picture sessions, and clock items doubled the cost of the first write. Rules, evidence and the build order:
`my-tutoring-app/qa/agent-surfaces/DISPLAY_ROADMAP.md`. Judge each display with the tester's compare mode on one fixed
objective, before and after.

**Keep hand drawing for concept diagrams (USER 2026-11-08).** Displays are for pictures that recur and that a few
values describe. When the structure of the drawing is the idea being taught, the agent draws it: same frame on every
option, only the taught variable changes, plain lines, and at least one drawing that tests the rule. Exemplar and
rules: `DISPLAY_ROADMAP.md`, "When the agent should keep drawing".

## Displays: one registry, a menu per primitive (USER 2026-11-08)

Every agent primitive draws from one registry (`service/agent-kit/displays.ts`). What differs per primitive is the menu:
a biology primitive offers its author the science and data displays, and a general one offers all of them. A display
built for one domain is a registry entry with a domain tag, so every primitive that takes the domain gains it.

| Primitive | Menu (`DisplayCapability`) | Where a display goes |
|---|---|---|
| `practice-studio` | `ALL_DISPLAYS` | item stimulus, option cards, help levers |
| `deep-dive` | every domain, minus the ones a richer block already covers (chart, number line, table, timeline, process) | `write_figure` |
| `life-lab` | `science`, `biology` and `general`, no `text` | teach frames, item stimulus and cards, `world.show`, help levers |
| `wonder-walk`, `annotated-example` | none yet: reasons are in `NO_DISPLAYS` in the guard test | |

**Wiring a primitive (each step has one kit function):**

1. State the menu as a `DisplayCapability` beside the primitive's world or blocks.
2. Tell the author: `displayPrompt(cap)`, in a section that says when a display is worth adding. Most items need none.
3. Take it in the tool: `displayToolSchema(cap)` for a writer on `parametersJsonSchema`, or a JSON text field for one on
   the older `Schema` type. Read it with `readDisplays`, which accepts both.
4. Check it: `displayIssues(shown, cap)` joins the primitive's structure errors, so a display off the menu or one that
   cannot be drawn is blocked with a sentence.
5. Check it for leaks: put `displayText(d)` through the same rules as the ask. Life-lab adds it to the text every "names
   the answer" rule reads. A list that gives an order is checked one display at a time, or the ask's words hide it.
6. Draw it: `KitDisplay`, with `DISPLAY_CSS` once in the host.
7. Tell the tutor: `displayWords` in the scene, as a fact present only when something is shown.
8. Let a help use it: the display field is one of the writer's fields, so a lever's `change` can add one, and code
   counts it as changing the screen. Life-lab's helps were only emoji and labels until this (11-07 runs).

**`svg` is on a menu only where the author sees its drawing.** The item loop and deep-dive send back a screenshot, and
`runAuthor` does when a view sets `drawn` (11-08). A drawing no one looked at does not ship.

**Which picture, cheapest first:** a kit display (values) → an agent drawing (`svg`, for a concept diagram) → an
interactive template (`gen-display`, deep-dive only today) → a catalog drawer (`embed_primitive`) → the image model.

**Adding a display for a domain.** Same bar as any display (`DISPLAY_ROADMAP.md`: seen on more than one topic, measured
before and after). Add a `DEFS` entry, its `DOMAINS` tag and its sample in `displays.test.ts`; the types fail until
all three exist. Drawings already inside one primitive's component (life-lab's beaks, moths, feet and critters) are
candidates: port one to the registry when a second primitive needs it.

## The invariants

Each one has a check. An agent primitive that fails one is a schema with retries.

**I1. The agent owns teaching decisions.** List every decision in one item: task (what the child does), representation
(how it is drawn), numbers or content within bounds, distractors, sequence across items, wording. If code makes every
decision except wording and word choice, the agent adds nothing a schema could not.
*Check:* the decision table (audit step 1) has at least two non-wording rows owned by the agent.

**I2. Breadth: the tools can express the objective family.** List the standards or sub-objectives the primitive
claims (from the catalog description and the curriculum homes). For each, there is a composition of the tools that
builds a good item for it.
*Check:* a coverage test (`*.coverage.test.ts`) writes one hand-built composition per standard and asserts it passes
every check. A standard with no passing composition is a gap: build the block or drop the claim from the catalog.

**I3. A world and a goal, not a menu.** The tool describes state and a goal the final state must meet: things with
attributes, places that hold them, events that change them, and an answer (choose one, give a value, or change the
world until a condition holds). Not one writer per mode, and not an enum of tasks either: a task list is a menu one
level down, and every new standard costs a code path. Tasks are examples in the prompt; code tells them apart.
Goals are conditions, so an item can have many right answers (5 split onto two plates any way).
*Check:* the tool has no task enum; a standard the domain owns but the coverage table lacks is reached by a new
composition, not new code. When it needs new code, that code is a new kind of place, attribute, event or condition,
usable by every other composition.

**I4. Code derives the answer.** The agent declares structure (this group has 7, the ask is "more"); code computes the
key from it. The agent never states which option is right where code can compute it. For content code cannot compute
(which picture is alive), an independent reader solves it (the review round) and disagreement sends the item back.
*Check:* no tool field names the right option for a computable task. The validator re-derives the key from the
stored world and rejects a payload whose key disagrees.

**I5. A solver, not only a lint.** Checks for format and leaks are necessary. The solver asks how a child could get the
item right **without** the skill: by size or length instead of counting, by matching a shape instead of a count, by
position, by elimination, by the scene showing the answer. A shortcut blocks with a sentence the agent can act on
("the right group is the only scattered one; a child can match the arrangement, not the count").
Rules seen so far: pick by size (the answer far from every other choice), odd one out (only the answer drawn
differently), match the shape (only the answer drawn like the reference), the scene shows the answer, a goal true
before the child acts, a goal no actions reach (run a solver), the answer said aloud, and **the narration tells the
parts the child should count** ("ten stars and five more": the child adds two spoken numbers and counts nothing).
*Check:* every rule has a unit test that builds the shortcut and sees it blocked. The checks run on hand-built test
fixtures too: they caught a shortcut in this skill's own first coverage table.

**I6. Difficulty is computed from what was built.** Code scores each item from its structure (count size,
arrangement, distractor distance, number of choices, production vs recognition) and returns the score and its reasons
with every write. A requested tier (`config.difficulty`) is a target the agent must hit; code checks it. Never
pre-picked slots: the agent chooses how to reach the tier.
*Check:* the write result carries `difficulty: { band, score, reasons }`; a walk off its tier blocks; a test builds every
kind of item at easy, medium and hard, so no structure is capped at one band (life-lab's trait worlds stopped at 0.9 and
a hard request threw, 11-08). A tier miss blocks while the budget lasts and never stops a lesson once it runs out.

**I7. Variety is a walk-level check.** Agents repeat themselves (11-05 bench: agents reused the same primitive and
mode). Code blocks a set of items with the same task and representation throughout, and the same number twice.
*Check:* a walk-level rule names what must vary, with a test.

**I8. Every block has three faces.** Render and grade (the component draws it and the activity's own check judges it),
tool (the agent can build it), tutor (the workspace scene describes it in words with no key, and the tutor has a
lever on it).
*Check:* the block table (design step 2) has all three columns filled for every block.

**I13. The agent authors the levers; code checks them (USER 11-07).** The agent built the item and its traps, so it
knows why a child misses it. Each item carries its own help and simplify levers, written as edits to the item in the
same blocks (drop a card, add an example card, show the hidden group, split the story, say the sounds slower), plus the
line the tutor says. Code applies each edit, rebuilds, and refuses: a simplify that changes the mode or does not lower
the computed difficulty; a help that leaves the item solvable by a shortcut or shows the key; a lever that changes only
text and leaves the screen the same. No per-mode lever menu in app code: that is rails one level down, like the
`respond` channel menu. The lever capability is built once in `service/agent-kit/levers.ts` (authoring: `withLevers`,
`buildLevers`; playing: `authoredLeverSet` on the boss, `useAuthoredLevers` in the component). A primitive supplies
only `LeverCapability` (facts, leaks, word fields, `drawn`). `/add-support-tiers` is for schema primitives.

**I14. One kit, no copies (USER 11-07).** An agent primitive runs `runAuthor` from `service/agent-kit/authorLoop.ts`
and supplies only its own half (`AgentAuthor`: tools, read + check of a write, session checks, review, salvage, ship).
A capability two primitives need is added to the kit, not written twice. `agentKit.guard.test.ts` fails a new loop.
*Check:* every item in a real generation carries at least one help and one simplify lever that pass the rebuild checks.

**I16. The loop owns the stages; a lesson is closed when it is a stage or a guard (USER 11-08).** Write, code checks,
look, revise and ship are the kit's, with the trace, cost and run record (`agentDebug.run`) built in. A primitive gives
`look` (what the child sees first) and never its own blind reader or screenshot path. A new lesson about authoring goes
into a stage or a guard, so every author gains it. Primitive code or a paragraph here does not close it.
*Check:* `agentKit.guard.test.ts` fails an author with no look stage that is not in `NO_LOOK` (which only shrinks);
`/review-agent-primitive <id>` closes the work.

**I15. Displays come from the kit, chosen per primitive (USER 11-08).** The agent picks a display and writes its values;
code checks them, draws them, reads them for leaks and tells the tutor. A primitive states which displays fit it and
never writes its own display type, renderer or checker. A world or block keeps its own picture language (life-lab's
places and living things); a display sits beside it as evidence or an example.
*Check:* `agentKit.guard.test.ts` fails an agent primitive whose author is offered no displays and that is not in
`NO_DISPLAYS` (which only shrinks); `displays.test.ts` fails a display missing a face; a real generation shows the agent
choosing a display where one teaches, and leaving it out where the world is enough.

**I9. The input is the topic or objective; a skill is a label read off the finished item (USER 2026-11-08).** An agent
primitive takes a curriculum topic and/or learning objective and builds what fits it. An eval mode is too narrow an
input: a pin fixes the item's shape, so it caps difficulty and repeats one task. The catalog has one mode. The agent
does not declare a skill; code reads it from the world (a hidden group is count-on, a story is add-take) by fixed
precedence, returns it with every write, and uses it for the screen, standards and misses. A label never refuses an
item. What keeps a free agent on the lesson is the look stage's objective reader (`look.objective`), which sends back an
item that does not practise the objective. Wiring differs by item through `spokenBoss`: a keyless item in a
`SAY_OR_SHOW` mode is shown. Pulse, the planner and calibration are out of scope until they need it (USER 11-08).
*Check:* `agentKit.guard.test.ts` fails an author that calls `openModes` and is not in `MODE_INPUT` (which only
shrinks); a classifier test for every label; a scripted run keeps a world of any kind and sends back an off-objective one.

**I10. Scope and bounds come from the lesson, and a decline is a signal.** Ranges (count to 5, to 20) and limits come
from the lesson text, never a default that rules a kind of item out. A kind of item that needs a wider range widens it
(a teens lesson means 20). When the agent declines, read why: the 11-06 teens decline was right and exposed a default
range of 10.
*Check:* each kind of item generates at least once without a decline on a topic that names it.

**I12. Engineers write the schema and the instructions; the agent writes the content.** The same split a coding agent
works under: the schema is the shape of a world and the rules that run it; the content is everything that fills it
(which organisms, machines or words, their traits, stages, parts and what each part does). Code verifies content two
ways: what follows from structure it computes (a key, a solver, a mode, an inheritance check works for ANY organism and
ANY trait), and a fact it cannot compute (a monarch's life stages, what a cactus spine is for) goes to an independent
reader that can send the item back. A content list in code (an organism atlas, trait values, part jobs, a word library)
is a cache of reviewed facts and a source of examples, never a gate: an id the list lacks is declared by the agent and
reviewed, not refused. Rendering follows: draw from what was declared (a picture the agent names, traits drawn from
their values), never only what code pre-drew.
**Why (USER 2026-11-07, life-lab):** the canvas was built with code owning every biology fact as closed enums (31
organisms, ears/coat/color for dogs and cats). A "Monarch Butterfly" lesson pinned to whose_baby was declined although
"each trait comes from one parent" is pure structure. "We keep killing the flexibility of the agent to act the same way
you do from a coding standpoint: we make the schema and instructions, the agent makes the content."
*Check:* grep the engine and tool schema for enums of content (organism ids, trait values, part kinds, word lists). Each
one is either structure (a rule kind, a control type, a goal kind: allowed) or content (must be open, with a review
path). A test writes a world on an organism and trait set no list contains and sees it pass the structure checks and go
to review.

**I11. The agent designs what the child produces; code derives how it is judged.** The answer channel is part of
the problem, like the answer's kind (I3), not a menu of channels. Math and language have different spoken designs
(table in "How the child answers"): a number is said; a rhyme can be made; a sort is shown. The agent sets the
production per item, by the nature of the problem; code checks that it fits the answer, derives the boss wiring, the
spoken key, the misses and the harness play, and returns the key in words with every write. The agent never writes
a key, an `alsoAccept` list or a miss. Production is breadth (I2): some standards are reached only by voice (produce
a rhyme, name words that start with a sound, segment a word), so a walk-level rule (I7) requires it where the
objective asks for it.
*Check:* the item tool has the production field and no key or miss field; one pure module derives the key from the
stored world and the production (boss, author checks and tests share it); a production that does not fit the answer
blocks with a sentence the agent can act on; a real generation per production kind shows the agent choosing it.

The domain a world serves is stated with what it does not cover. Wonder Walk's math world does counting, operations
and sorting; shapes and measuring need a different world and stay with other primitives the manifest picks.

Unchanged from every primitive: pedagogy first, no answer on screen or in the ask, reader band, Kindergarten
pre-reader contract where it applies.

## Design (a new agent primitive, or a new block)

1. **Objective family.** Write the standards list (I2). This is the acceptance test, written first.
2. **Block table.** One row per block: what the child does, what the agent sets (and its code bounds), what code
   computes (key, layout, difficulty terms), shortcut rules, the render and grade, the tutor scene line and lever.
3. **Tool surface.** One tool per block family, with the block's parameters. Plan/remove/finish/decline stay as they
   are in the deep-dive pattern. The prompt says what the agent decides and what code owns, with one example per task
   and the difficulty terms, so the agent can aim at a tier.
4. **Write result.** Every write returns `{ checks: { blocking, advisory }, difficulty, key }` where `key` is what code
   derived (for the agent's information; it never reaches the child or the tutor).
5. **Component.** One renderer per kind of place, deterministic from the data (code stores positions; the component
   never randomises). Grading, the goal check and the move solver live in a pure module that the component, boss,
   author checks and tests share, so there is one definition of "right".
   State the child builds before committing (moves) is local to the component; the runtime re-opens the item around
   mount, so reset it only for a new item or a retry after a committed answer (wonder-walk 11-06: early moves vanished).
6. **Labels.** Accessible labels on tap targets are keys to the journey sweep (J3): make them distinct from words the
   narration, why-card and learner work use (`spot a`, `apple 3`, not `the plate`, `a star`).
7. **What the child produces** is designed with the block, not after ("How the child answers" below). A sayable
   answer is a J14 item: it needs voice beside the tap (USER 10-13).

## How the child answers (wiring to the tutor)

An agent primitive is wired once, at the family level, so every item the agent can build already has a channel; the
agent then chooses per item. The boss framework handles a per-item choice through `spokenBoss` (an item with a key is
said; an item with `key: null` is shown and checked by the activity, the di-shapes precedent), so this needs no new
framework code. `/add-live-tutor-tools` step 3 and `review-live-wiring/references/boss-framework.md` are the
mechanics; this section is the design. Reference implementation: wonder-walk (`wonderWalkSpoken.ts`, 2026-11-06).

**1. List the productions the domain has.** Before any schema, write what a child in this domain can produce, per
answer kind. The domains differ, so the list is the domain's, not a generic channel list:

| Production | Math | Language | Judged by | Key shape (`SpokenKey`) |
|---|---|---|---|---|
| Say the one value | "seven", "ten and three" | the word a blend or a changed sound makes; who or what in a story; a letter's name | tutor; the tap still counts | `answer` + `alsoAccept` (its other forms) |
| Make any that fits | two numbers that make five | a word that rhymes with cat, starts with /s/, is an animal | tutor; the one fitting card still counts | `answer` (the card) + `alsoAccept` (library examples) + `acceptRule` + `signatureError` |
| Say the parts in order | count on aloud from the hidden group | segment: /k/ /a/ /t/ | tutor | `answer` (the parts) + `acceptRule` |
| Choose aloud from named choices | the plate with more, when the plates hold different things | "hat, dog or sun?" | tutor | `menu` + `given` |
| Say while doing | count each one aloud as it moves | say each sound as its box is tapped | activity (the result); the saying is coaching | none |
| Show | a place, moves, a sort | a sort, a track, cards told apart by position or number | activity | none (`key: null`) |
| Explain | "how do you know there are more?" | "why did the bear go home?" | tutor | `meaning` |

Mark which rows the primitive builds and which are queued. A row is built when its render, its key derivation, its
checks and a coverage row exist. Wonder-walk 11-06 builds say-the-value (math and language), make-any (language:
rhymes, first or last sound, kind) and show; segment, choose-aloud and explain are queued.

**2. Give the agent one production field per item**, in the domain's terms, with a "How the child answers" prompt
section that says, per domain, when each fits (by the nature of the problem, not a rule per mode). Wonder-walk's field
is `respond: show | say | say-any`. Code defaults a sayable answer to `say` (USER 10-13: voice beside the tap) and
blocks `show` on it, so the agent's real choice is between productions, not whether to allow voice.

**3. Code derives everything else, in one pure module** beside the checks (`<x>Spoken.ts`), read by the boss, the
author's checks and the tests:

| Derived | From |
|---|---|
| Whether the answer can be said at all (a number, a picture's name, a letter; not a place, moves, a sort, a track, or cards that share one picture) | the stored world |
| `respondError(item)`: the production does not fit, as a sentence ("the answer is moves, which a child cannot say: respond show") | the world + the production |
| `speech.key(item)`: `null` when shown; otherwise the `SpokenKey` for the production (table above) | the world + the production |
| Examples for make-any: library words the rule holds for, minus the cards, the refs and words the child already heard; computed at build and stored on the item | the word library + the rule |
| `speech.misses(item)`: `KnownMiss[]` with distinct ids, most specific first (a part of the story, then one away; the near-sound card, the meaning card) | the world + the traps code computed (I5) |
| `speech.given(item)`: what the ask says by design (a letter-name ask names its letter) | the rule |
| `speech.say` and `speech.show`: the harness's spoken answers and its taps | the same solver the checks use |

The author's write result adds `answeredBy`: the production and the key text the tutor will judge
(`spokenKeyText`), so the agent sees what a child must say. `boss.validate` runs `respondError` too, so a stored item
whose production does not fit never launches.

**4. Wire the card from what each mode's items can be.** A mode whose answer can be said is `SAY_OR_SHOW`; a mode whose
answers are always shown is `TAP_ONE`; the card sets `audio: SPOKEN_AUDIO`; the catalog's `affordances.answers` gains
`spoken`. A production-only row (segment, explain) needs its own `SPOKEN` mode, or a stepped mode (`{ steps }` with
`stepOf`), with its own β: plan it as a new eval mode, not as a variant inside a `SAY_OR_SHOW` mode.

**5. A walk-level rule for production.** Agents pick recognition when it is allowed: on 11-06 three real walks set
`say` and `show` correctly and never `say-any`. Where the objective asks the child to produce (RF.K.2a produce rhymes;
name words by a sound), a walk of 3+ items whose rules allow it must include one, blocked with a sentence that shows
the ask ("Can you think of a word that rhymes with cat?"). With that rule, the next real walk chose `say-any` itself.

**Limits:**
- Wiring is per mode; the item narrows it. A said item in a `TAP_ONE` mode is a card bug. A keyless item in a
  `SAY_OR_SHOW` mode is a shown item (the shared doctrine says "a task with no key is shown only").
- No speech-only item inside a `SAY_OR_SHOW` mode: the tap stays (USER 10-13). Speech-only is its own mode.
- Difficulty: a production offered beside the tap scores as the tap, since the child may still tap. A
  production-only item scores as production.
- The guidance cap is 4000 characters (`OFFER_GUIDANCE_MAX`). Two wirings list every mode twice, so card words stay
  short.

**Checks before calling it wired:**
1. `node scripts/boss-card.mjs <id>`: each mode's wiring matches what its items can be; guidance under the cap.
2. The workspace test asserts the channel on every saved item: a said item publishes `response: 'speech'`,
   `acceptsGesture: true` and a key, and sits in a `SAY_OR_SHOW` mode; a shown item publishes a gesture with no key.
   The tap path still solves every item.
3. Author tests: each production fits where it should and is refused where it does not; the key, the examples and the
   misses are derived; the walk rule fires; the scripted loop fixes a refused production.
4. `npm run test:primitive -- <id>`: the boss guards, the journey sweep (J14 clears), `askLeaks` on every saved payload.
   Then JEV's spoken-miss observer on the real model (TypeSafe, no Gemini): the sweep with `SPOKEN_MISS_OUT=<f>` and
   `node scripts/spoken-miss-probe.mjs --requests <f>`; false positives must be 0. Miss patterns name the exact wrong
   answer on screen and why a child gives it: wonder-walk's first, generic patterns ("a card whose sound is close")
   scored under the fit gate on 7/188 cases; concrete ones on 2/188.
5. One real generation per production kind (`save_payload.py --name <x>`), read item by item: the production the
   agent chose, the ask, the derived examples. Report the spend.
6. Moving a primitive onto the spoken path, or adding a `words.special` sentence, changes what the tutor receives:
   hand the user ONE `--samples 1` Live command on a make-any item, with the question it answers.
7. `/review-live-wiring <id>` closes it.

## Testing

Free, every slice:
- **Unit:** block checks, shortcut rules (I5), difficulty scoring (I6), variety (I7), key derivation (I4).
- **Coverage:** one hand-built world per standard is checked end to end: it passes the checks, builds, passes the
  validator, carries the expected mode, and the harness's taps solve it (I2). A row per mode at least.
- **Scripted model:** the tool loop against a scripted model: a block write, a blocked write fixed in the next turn, a
  tier miss fixed, finish.
- **Workspace and boss:** the scene carries no key; the journey's taps solve each task; `npm run test:primitive -- <id>`.
- **Gates:** `typecheck:lumina` 0, full tsc at baseline.

Paid (content generation is allowed; it is metered, put the spend in the report):
- **Real generations per standard:** for each standard in the list, one generation with a topic that asks for it.
  Report per run: tasks and representations used, difficulty bands, turns, blocked writes and why, seconds. The
  question it answers is whether the agent reaches for the blocks, not only whether the output passes.
- **Breadth verdict:** a table of standard → covered by a real run (yes/no, which stop). This replaces "it passes".
  Read the real items as a teacher would: the 11-06 runs passed every check and still had narrations that counted
  for the child. Each such finding becomes a rule (I5) with a test, then the affected payloads are regenerated.
- `/eval-test <id>` closes the layer. Save one real payload per mode for the journey sweep (`save_payload.py`).

Live tutor journeys stay with the user (`backend/tests/tutor_live/LIVE_TESTING.md`): hand them the command.

## Revise (an existing agent primitive)

1. **Audit.** Fill the decision table (I1) and the standards list (I2) from the code, not the docs. Mark each
   invariant pass/fail with the file and line. If I1 or I3 fails, the revision is a redesign of the tool surface; do
   not add another writer.
2. **Design** the blocks (steps 2-4 above), keeping every passing behaviour (read the primitive's contract first:
   `docs/contracts/<id>.md`, `/primitive-contract --check`).
3. **Build** code first (blocks, solver, difficulty, variety, key derivation), then the tool and prompt (with
   `respond`/`speak`), then the component and workspace, then the card and boss ("Wiring to the tutor"), then
   catalog, priors and tester.
4. **Test** free, then paid (above). Replace any code-built W1 payload with a saved generation.
5. **Record** on the primitive's birth certificate: the invariant table before and after, the breadth verdict, spend.
   Queue what remains (blocks not built, levers) with its executor skill.

## Anti-patterns seen

- One writer per mode with fixed fields (wonder-walk 11-05). Fails I1, I3.
- Code pre-picks numbers into slots the agent must use (wonder-walk 11-05 `planNumberSlots`). Fails I1, I6: the tier
  was a slot property, not something the agent could reason about.
- Checks that only lint wording (sentence length, the ask says the number). Necessary, but fails I5 alone.
- Treating "the walk shipped" as the test. The test is the breadth verdict.
- Replacing a 2-item menu with a 4×4 menu (wonder-walk 11-06, first revision). Fails I3: 5 of ~22 standards.
- A default range that silently rules out a mode (count to 10 for teens). Fails I10; the agent declined, correctly.
- Generic labels on targets ("the plate") that the why-card also uses: the sweep reads them as a revealed answer.
- Wiring an agent primitive on `tapBoss` because its first blocks were taps (wonder-walk 11-06): every sayable number
  and word failed J14 (7 hits), and voice became a separate slice. Fails I11: the production is designed with the block.
- A generic channel menu (`respond: show | say-or-show`, this skill's own first draft on 11-06). It lets the agent turn
  voice on or off; it does not let the agent design what the child says. Fails I3 and I11 the way a task menu does.
- The agent writing the key, `alsoAccept` or the misses into the tool call. Fails I4 and I11: code derives all three.
- A primitive with its own display type, or a figure tool hard-coded to one kind (deep-dive's `write_figure` took only
  `svg` while its renderer could draw every kit display, 11-08). Fails I15: the author never saw the displays.
- A display checked only for whether it draws. A table's cells reached neither the leak check nor the tutor until 11-08.
