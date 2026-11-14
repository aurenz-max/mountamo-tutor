---
name: practice-studio
description: >-
  Author, check and play a studio plan: a practice-studio session written offline (by Claude Code or a person) as one
  model the child keeps working with through the session (set it up, predict, test, a harder case) plus 3-5 problems
  of values, filled by code with no model call. Every item still passes the kit's own reader, checks and lever builder,
  and a choose key can be worked out by code from the model. Use to write a plan for an objective, to add problems to
  one, to fix a plan the gate refuses, or to turn a weak live practice-studio run into a plan. Not for the live author
  loop (/agent-primitive), a canvas program (/canvas-primitive), the host's tutor wiring (/review-live-wiring), or a
  native React primitive (/primitive).
---

# Studio plans

> **Free.** Filling a plan, the gate and the tester's "Build from plan" call no model. Live practice-studio authoring
> (the tester's Generate) calls Gemini and is metered against the daily cap: report the spend if you run it.

## What this is (USER 2026-11-14, PROTOTYPE)

The canvas loop applied to practice-studio. Live practice-studio items are written one at a time, so a session is a
list of unrelated items. A teacher carries one model through a session and changes one thing per item. A plan does
that: Claude Code writes the session once, code fills and checks every problem, and a lesson gets a checked session
for free. The live author stays for objectives no plan covers.

- **One format.** `service/core/practice-studio/plans/<id>.json`, registered in `plans/index.ts`.
- **One fill.** `studioPlan.ts` `fillPlan` puts a problem's values into the plan and runs every item through
  `readDraft`, `itemErrors`, `shortcutChecks` and `buildSurfaceLevers`, the same path a live item takes.
- **One gate.** `studioPlan.test.ts` fills every problem of every plan: no problem found, both levers on every item.
- **One host.** `agent-practice-studio.ts` serves `config.plan` (and `config.problem`) with no model call.

Lessons do not get plans yet: only the tester serves them. Do not route plans into lessons without a user ruling.

## The plan format

```jsonc
{
  "id": "lever-lift", "title": "...", "idea": "the one idea the session teaches",
  "serves": { "grades": ["4"], "objective": "what the learner does and the skill it shows" },
  "world": { "lever": { "kind": "system", ... } },   // displays the steps share
  "steps": [ { "role": "setup|predict|test|harder", "draft": { /* an item in the author format */ }, "keyFrom"?: {...} } ],
  "problems": [ { "rock": 12, "rock_arm": 2, ... } ]   // one value for every {{token}}
}
```

- A **draft** is an item in the live author's format (`itemLoop.ts` `surfacePrompt`: `tier`, `surface`, `prompt`,
  `board`/`stimulus`/`options`, `goal`, `help`, `simplify`, `why`). Read `plans/lever-lift.json` first.
- **`{{name}}`** is filled from the problem. A whole-string token keeps its type (a number stays a number).
- **`{"$use": "lever", "parts": {"push": {"value": 6}}}`** is the world display with changes. Parts change by id;
  `null` removes a field, so `"min": null, "max": null` fixes a part the child could otherwise move.
- **`keyFrom: {part, rule}`** (choose items): each option's `value` is put into `part` of the first system display in
  the stimulus; the key is the least value that makes `rule` true. Code refuses a plan where no option or every option
  makes it true. Use it whenever the right answer follows from the model: never hand-write a key code can work out.

## The bar

Code-checked by the gate (blocking): every token has a value; every item passes the kit's checks and shortcut solver;
help and simplify both ship on every item, and simplify is easier by the computed difficulty; a `keyFrom` key exists
and is not every option.

Read by the author in the tester (not code-checkable, so do it every time):

1. **One model, carried through.** Every step uses the same world display. A step that needs a different picture is a
   different plan.
2. **Each step changes one thing.** Setup (find any way), predict (from the rule, before running it), test (the same
   model, the prediction played out), harder (a new idea: here, moving the load instead of the push). A harder step that
   is only bigger numbers is not a step.
3. **Predict before run.** A predict item's stimulus shows the model with results as "?". The test step that follows
   shows the result; a choose stimulus does not reveal results after Check.
4. **Problems vary in structure, not only numbers.** The keys should differ across problems (lever-lift: 4, 6, 3, 5
   blocks), and a child who memorised problem 1 should not pass problem 2.
5. **No answer in the words.** The prompt, labels, option text, help and the default board never show the key or the
   goal state. The board starts with the goal unmet (the shortcut check catches most; read the first screen too).
6. **Levers change the screen.** Help adds what the representation shows (a rule in words, a reading); simplify is the
   same task one step simpler (a part fixed, an option removed, the board moved part way). A lever that only adds
   text where the screen could do more is low-yield.
7. **Hands on the model.** On a system board the controls sit on the model: ◀ ▶ in each changeable part's row, and the
   scene piece bound to a part with `data-move` or `data-turn` can be dragged. Bind the piece each changeable part
   moves, so the child can drag it; a part with no drawn piece is still stepped in its row.

## The stages

### 1. Pick the objective and the model

Name the objective, the grade, and the one idea. Pick the kit display that is the model (`displays.ts`: `system` for
cause and effect, `number_line`, `array`, `shares`, `clock`, `base_ten`, `ten_frame`, `bar_graph` and more). If no
display draws the model, the objective is a canvas (/canvas-primitive) or a new kit display (/agent-primitive), not a
plan.

### 2. Write the plan

Write `plans/<id>.json` and add it to `STUDIO_PLANS` in `plans/index.ts`. Write 4 steps and 3-5 problems. Work out each
problem's values by hand or in a script: the goal must be reachable from the starting board, and each simplify must be
easier.

### 3. Run the gate

```bash
cd "<abs>/my-tutoring-app" && npm test -- src/components/lumina/service/core/practice-studio/studioPlan.test.ts
```

A failure names the problem, the step and the check. Fix the plan, never the check. Add a test line when a plan has a
property worth holding (lever-lift: the predict keys per problem).

### 4. Play it in the tester

Dev panel → Practice Studio → "Studio plan, written offline" → pick the plan and a problem → Build from plan. Play every
step: one right path, one wrong try (it must show the result and offer help), and the simplify lever. Headless:
`project_headless-chrome-drive-recipe` in memory; drag a system handle with `page.mouse` along its `data-move` vector
(user units × rendered width / viewBox width).

### 5. The user plays it

The user's play is the gate for anything past the tester.

## What is built, and what is next

| Piece | State |
|---|---|
| Plan format, fill, `keyFrom`, gate, tester panel | Built 11-14 (`studioPlan.ts`, `plans/`, `studioPlan.test.ts`) |
| Controls on the system model (row ◀ ▶, drag the bound scene piece) | Built 11-14 (`system.ts` `controls`, `SurfaceBoard.tsx`), kit-wide for every set board on a system |
| Plans | `lever-lift` (G4, 4 problems) |
| Difficulty a plan can state or prove | NOT built: the kit rates set items by taps (capped at 6) plus model load, so every lever-lift step reads medium and the harder step's new idea is invisible |
| Reveal after Check on a choose stimulus | NOT built: only set boards reveal results |
| Flash filling a plan's values for a lesson | NOT built (bench needs the Google monthly cap raised) |
| Plans served to lessons | NOT built; needs a user ruling |
