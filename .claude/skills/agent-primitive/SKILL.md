---
name: agent-primitive
description: >-
  Design, audit, test or revise an agent-authored primitive (a generator that runs a model in a tool loop under code
  checks: wonder-walk, deep-dive, annotated-example). Holds the invariants that make an agent primitive stronger than a
  schema primitive: the agent describes a world and a goal (no writer per mode, no task menu), code derives every
  answer and names the skill from the structure, solves every item for shortcuts, computes difficulty from what was
  built, and every part has a render, a tool and a tutor face. Use when building a new agent primitive, when an agent primitive
  feels no stronger than an on-rails schema, or to audit one. Not for which primitive a lesson gets (the manifest owns
  that), a schema generator with no tool loop (/primitive, /add-eval-modes), or levers alone (/add-support-tiers).
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
*Check:* the write result carries `difficulty: { band, score, reasons }`; a walk off its tier blocks.

**I7. Variety is a walk-level check.** Agents repeat themselves (11-05 bench: agents reused the same primitive and
mode). Code blocks a set of items with the same task and representation throughout, and the same number twice.
*Check:* a walk-level rule names what must vary, with a test.

**I8. Every block has three faces.** Render and grade (the component draws it and the activity's own check judges it),
tool (the agent can build it), tutor (the workspace scene describes it in words with no key, and the tutor has a
lever on it or one is queued to `/add-support-tiers` by name).
*Check:* the block table (design step 2) has all three columns filled for every block.

**I9. Code names the eval mode and standards from the structure.** The agent does not declare a skill; code reads it
from the world (a hidden group is count-on, a story is add-take, a two-place sum goal is parts) by fixed precedence,
returns it with every write, and refuses a world whose skill is not open. The mode's β is a prior; the computed
difficulty moves within it.
*Check:* a classifier test for every mode; the catalog list, backend priors and resolver docs name the same modes.

**I10. Scope and bounds come from the lesson, and a decline is a signal.** Ranges (count to 5, to 20) and limits come
from the lesson text and the open modes, never a default that rules a mode out. A mode that needs a wider range
widens it (teens open means 20). When the agent declines, read why: the 11-06 teens decline was right and exposed a
default range of 10.
*Check:* each mode generates at least once without a decline on a topic that names it.

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
7. **Answers that can be said** (a number, a word) are J14 items: they need voice beside the tap (USER 10-13). Plan
   the voice rung with the answer kind, not after.

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
3. **Build** code first (blocks, solver, difficulty, variety), then the tool and prompt, then the component and
   workspace, then catalog, priors and tester.
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
