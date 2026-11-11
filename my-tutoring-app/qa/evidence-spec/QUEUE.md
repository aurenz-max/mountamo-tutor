# Evidence spec — queue

**What it is (user 2026-11-09):** each objective carries the evidence a lesson must collect (`act`, `on`, `credit`,
`notCredit`, `observed`; `service/agent-kit/evidence.ts`). The author is told it, the item loop's blind reader judges
every item against it, and the run record counts the items that collect it (`agentDebug.evidence`). The count is the
measure of what the kit cannot yet collect, by act.

**Built 11-09:** the spec and its judge in the item loop; the `make` surface (pieces on a tray, judged by a goal
condition, any set that meets it is right); the `set` surface (the child changes a kit display
until a goal holds); practice-studio reads the spec from `config.evidence`.

**Tester (11-09):** the Practice Studio tester sends the spec (`config.evidence`): an evidence form, six presets from
the probe's cases, the run's evidence count and gaps, and each `make`/`set` item's goal, board and controls. One real
clock run through the tester's API path: 4 of 4 `set` items, $0.17, 162 s. The form and panels were typechecked, not
yet seen in a browser (part of EV-1).

**Working models and a default spec (user 11-09, built the same day, uncommitted).**
- `system` display (`service/agent-kit/system.ts`): the author declares parts (amounts) and rules (arithmetic and
  comparisons over them), and may draw a scene whose elements code turns, shifts or shows from the values. As a `set`
  board the child changes the parts and Check runs it; results are "?" until then. `run-read` is now collected by `set`.
- A lesson with no spec gets one planned from its objective by the item loop (`withEvidence`), from the acts the kit can
  collect. Practice-studio passes the objective, so "any surface" is no longer the default.
- Code checks from the first real run: a yes/no goal decided by a bare number, a goal on a part, and a scene that does
  not move with a changeable part are blocked. Each rule is printed in words under its result.
- Runs on the bare topic "excavators", grade 2, no spec (`2026-11-09-excavators.json`, `-excavators-2.json`): before
  the checks, 4 of 4 items were locks ("boom equals 3") with a still drawing; after, 4 of 4 are a jointed arm that moves
  with rules a child can work out (boom plus stick at least the dirt's reach). $0.10-0.12, 150-183 s. Not seen in the
  component yet.

**`set` is one engine for every display (user 11-09: "did we just wire a single assignment?").** The first build had a
hand-written board per display and the author could pick from two. It was replaced the same day by
`service/agent-kit/setting.ts`: the author names which of the display's own values the child changes (`controls`) and
what must hold at the end (`goal`, over the board's fields, what code reads off it, and sums or differences the author
names in `derive`). The engine applies a tap, searches the controls for the nearest board that meets the goal, walks the
taps to prove the child can get there, and writes the reader's prompt. 12 display kinds are boards in `set.test.ts`
(array, ten frame, base ten, number line, bar graph, picture graph, chart, timeline, map, food web, shares, clock); 10 of
them have no set code at all. A display may add facts only code can know (`shares`: parts, equal) and where its marks
sit; neither is needed to be a board.

**Runs** (`node scripts/evidence-spec-probe.mjs`, one generation per cell, hand-read):

| Objective | Act | Before (`2026-11-09.json`) | After (`2026-11-09-after.json`) |
|---|---|---|---|
| MEAS002-05-c, 35¢ with exactly 5 coins | build | tray made from categorize; a fixed key marked a right set wrong on 2 of 3 items | 4 of 4 `make` items, goal-judged |
| GEOM002-03-a, cut a circle into equal shares | set | picks among drawn cuts; shipped with no note | `2026-11-09-set.json`: 3 of 4 items are cuts on a blank circle, goal-judged. Counted 0 of 4, because the credit also asks the child to name a share and no item collects both (EV-9) |
| GEOM002-02-a, cut a rectangle into rows and columns | set | not run | `2026-11-09-set.json`: 4 of 4 `set` items, goal-judged |
| MEAS002-04-b, set the clock to a time | set | not run | `2026-11-09-engine.json`: 4 of 4. The a.m./p.m. half of the objective is not in the spec and not collected |
| OPS002-01-a, add with place value blocks | set | not run | `2026-11-09-engine.json`: 4 of 4. The author declared tens and ones controls on `base_ten` itself |
| SCI003-01-G, weather graphs | set | not run | `2026-11-09-engine.json`: 4 of 4. The author declared a control per bar and derived goals with several right answers ("more rainy than cloudy, 6 days in all"). The prompts are long for Kindergarten |
| SCI001-03-G, sun-warming test | run-read | reads a shown result; shipped with no note | 0 of 4, recorded: no kit surface for `run-read` |

## Queue

| ID | Item | Executor |
|---|---|---|
| EV-1 | Browser check at phone width of the tray (`practice-studio.practice-coins-make.json`) and the boards (`…practice-cut-circle-set.json`, `…cut-rect-set.json`, `…set-clock-set.json`, `…add-blocks-set.json`, `…weather-graph-set.json`): tap a mark on and off, the back and forward buttons under a board, Clear, Check, the miss hint, and whether the marks on a 10-wide rectangle are big enough for a child. The journey sweep plays the taps and a screenshot of the drawing with its marks was read; nobody has used the component. | user |
| EV-12 | Browser check of a `system` board in the Practice Studio tester (preset "excavators"): the arm moves on each tap, results appear after Check, a miss shows what happened, retry resets. | user |
| EV-13 | The drawn scene and the model disagree: on excavators the solved arm folds toward the cab and never touches the dirt. Flash writes the bindings but not their geometry. Options, in order: a blind look at the solved, run board that asks whether the picture shows the result (kit look stage); then a stronger model for the scene only. | `/agent-primitive` |
| EV-14 | First write is 150-220 s with four drawn scenes, past the 140 s budget, so items get at most the one forced revise round. Reuse one scene across a session's items, or write the scene in its own call. | `/agent-primitive` |
| EV-15 | The planned spec can ask for more than the model does (credit said "scoop and lift", the models only scoop: 1 of 4 counted). Tell the planner to keep credit to one observable result. | `/agent-primitive` |
| EV-9 | A credit condition with two parts (cut the circle AND name a share) is judged per item, so a lesson that collects each part on its own item counts as 0. Give the spec parts, each with its act, and count a lesson by the parts some item collects. | `/agent-primitive` |
| EV-10 | A display that refuses an empty state cannot start a build from nothing: `base_ten` needs at least one block, so "show 34" starts from one. Decide per display whether empty is drawable. | `/agent-primitive` |
| EV-11 | The board's buttons sit under the drawing. Tapping the drawing itself (a bar, a point on the line) is a `marks` function per display, as `shares` has. Add one only where the browser check shows the buttons are not enough. | `/agent-primitive` |
| EV-3 | A `run-read` surface: two conditions that differ in one variable, a prediction, a run, a result the child reads. Lift life-lab's `fair_test` rule into the kit. Covers SCI001-03-G and the K science fair-test briefs. | `/agent-primitive` |
| EV-4 | Deep-dive: its reader (`deep-dive-agent/review.ts`) does not read the spec, and nothing the child does in a mini-sim is graded. Give its review the spec, then decide whether a graded sim is a deep-dive block or a kit surface it embeds. | `/agent-primitive` |
| EV-5 | Life-lab adopts `make`: its `write_item` tool has no goal field, so it is offered `CARD_SURFACES` only. | `/agent-primitive` |
| EV-6 | The manifest emits the spec per objective (a field on `ObjectiveBlock`), replacing `config.evidence` set by hand. Do this after EV-2 or EV-3, when more than one act can be collected. | direct |
| EV-7 | `say` and `explain`: move wonder-walk's spoken production (`wonderWalkSpoken.ts`) into the kit as a surface, so the spec's last two acts have one. | `/agent-primitive`, `/add-live-tutor-tools` |
| EV-8 | Coverage number: classify every published subskill into a spec (text only), count per act, and rank EV-2, EV-3 and EV-7 by subskills blocked. | `/curriculum-lumina-audit` |
