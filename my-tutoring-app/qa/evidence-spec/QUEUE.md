# Evidence spec — queue

Executor skill: `/lesson-evidence` (the spec contract, the bench, adding a surface for an act).

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

**The lesson writes the spec, once per objective (11-13; from the Primer bench, `qa/topic-traces/primer-bench-2026-11-13.md`).**
`ObjectiveData.evidence`: the curator brief writes `act/on/credit/notCredit` for every objective under
`EVIDENCE_WRITING_RULES` (kit, `evidence.ts`; acts include `say` and `explain`, which no surface collects yet, so the
run record counts them). Curriculum-launched lessons pass `preBuiltObjectives` into the brief, which keeps them
verbatim and writes only the evidence (`objectiveEvidence.ts`: given objects win on identity, evidence by id then
position). `flattenManifestToLayout` stamps `config.evidence` on every component of the block and on the final
check's `lessonObjectives`; `resolveGenerationContext` exposes `objective.evidence`; practice-studio takes it over its
own planned spec; `livePlan` carries it on each item's objective for the tutor. Verified on :3000: free-form make-ten
trace wrote `build` and `explain` specs; practice-studio ran with the given spec and recorded 0 of 4 `make` items
meeting "moves counters to fill a ten-frame" (card picks); the given-objective call kept ids/subskill/grade and
attached `say` and `explain` specs. Tests: `objectiveEvidence.test.ts`, `flattenManifest.test.ts`.

**`teach`: the kit's surface for the explain act (11-13, Primer bench item 2).** `service/agent-kit/teachSurface.ts`: the
child explains an idea out loud to a character who holds a wrong one; the live tutor plays the character and judges
the explanation on meaning. The author writes the character, the wrong idea (`holds`), the idea (one proposition,
4-16 words) and 0-2 presses; code derives the spoken key (`teachSpokenKey`, a meaning key as the DI pack's
`explain_concept` uses), the misses (`agreed_with_character`, `read_back`, `named_only`, `opposite_idea`), the
harness answers, the difficulty (1.2 + 0.4 per press + reading load) and refuses an item whose prompt, presses or
screen text say the idea. `ACT_SURFACES.explain = ['teach']`, so an explain objective is no longer counted as a kit
gap. practice-studio moved from `tapBoss`/TAP_ONE to `spokenBoss`/SAY_OR_SHOW with `SPOKEN_AUDIO` (wonder-walk's
wiring): a tap item still carries no key and plays its taps; a teach item carries the key. The look stage's blind
reader answers in words and `teachAgrees` judges them on meaning (a word count would send a paraphrase back). The
component shows the character and its wrong idea, no Check. Catalog `answers: ['tap', 'spoken']`. Gates: Lumina
typecheck 0; `teachSurface.test.ts` (6), kit + manifest tests (650), `test:primitive practice-studio` (767 + the dry
journey on `w1-payloads/practice-studio.practice-teach.json`), `misses.test.ts` (177). NOT yet seen: an author run
building a teach item (Google's monthly Gemini spend cap returned 429 at 22:57; the run is EV-16), the component in a
browser (EV-17), and a real spoken session (EV-18, user-run).

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
| EV-16 | **DONE 11-14** (traces in `qa/topic-traces/primer-bench-2026-11-13/teach-run-1.json`, `teach-freeform.json`). Forced explain spec: the author built 4 of 4 items as `teach` (Mia, Sam, Mia, Pip; each with a ten frame, 1-2 presses, no idea leak), the look stage kept all 4 after one round, `teachAgrees` agreed on every solve, evidence met 2 of 4 with the two gaps named (one asks why 5 splits 2 and 3 rather than why ten is faster; one character's misconception is about 10 > 8, not counting on); $0.14, 116 s; 3 of 4 shipped with a simplify lever but no help lever. Free-form lesson, same topic: the brief wrote `build` and `explain` on its own; the manifest put practice-studio in the explain block; the author built 1 teach + order/choose/categorize there (evidence 1 of 4, the three card items flagged "Use teach") and 1 teach inside the build block; $0.07 and $0.08, 115-140 s, one revise round each before the time budget. Follow-ups: the first write for an explain spec should mostly be teach items (the reader's gap arrives after the budget is spent: EV-14), and a teach item needs a help lever the author can write (a display the character and child look at). | `/agent-primitive` |
| EV-17 | Browser check of a teach item on the teaching workspace (it renders only there, so it needs a tutor connection: open a make-ten lesson or the Practice Studio tester with an explain objective): the character bubble and ten frame fit at phone width, no Check or Clear, the help lever adds a second frame, the simplify shows the same character with no presses. Seen 11-14 headlessly in the look stage's own render of the authored items (`qa/topic-traces/primer-bench-2026-11-13/teach-pip-look-390.png`, `teach-sam-look-760.png`: prompt, frame, name, bubble, "explains out loud" line, all legible at 390 px); the component itself is not yet seen. | user |
| EV-18 | One spoken session on the teach payload, the only evidence of what the tutor does as the character: `cd backend/tests/tutor_live && ../../venv/Scripts/python run_live_runtime.py --primitive practice-studio --mode practice --input ../../../my-tutoring-app/src/components/lumina/components/live-activity/runtime/testing/w1-payloads/practice-studio.practice-teach.json --runs 1 --audio`. Questions: does the tutor open as Pip with the wrong idea; does it press with the scene's lines and never say the idea first; does a paraphrase ("two go over, then it's ten and three") get credit; does "just count them all" get `agreed_with_character`; does it say in Pip's voice that it gets it now. | user |
| EV-19 | Lesson tail: a feedback / reflection / transfer stage after practice, reading the session's evidence (verdicts, misses, levers): one self-assessment ask, one cited moment, one next action, one transfer question, never a moment that did not happen (Primer bench item 3). Needs a lesson-shape design: a kit stage or a tutor boss on the lesson's close, not a new page. | user ruling, then `/add-live-tutor-tools` |
| EV-9 | A credit condition with two parts (cut the circle AND name a share) is judged per item, so a lesson that collects each part on its own item counts as 0. Give the spec parts, each with its act, and count a lesson by the parts some item collects. | `/agent-primitive` |
| EV-10 | A display that refuses an empty state cannot start a build from nothing: `base_ten` needs at least one block, so "show 34" starts from one. Decide per display whether empty is drawable. | `/agent-primitive` |
| EV-11 | The board's buttons sit under the drawing. Tapping the drawing itself (a bar, a point on the line) is a `marks` function per display, as `shares` has. Add one only where the browser check shows the buttons are not enough. | `/agent-primitive` |
| EV-3 | A `run-read` surface: two conditions that differ in one variable, a prediction, a run, a result the child reads. Lift life-lab's `fair_test` rule into the kit. Covers SCI001-03-G and the K science fair-test briefs. | `/agent-primitive` |
| EV-4 | Deep-dive: its reader (`deep-dive-agent/review.ts`) does not read the spec, and nothing the child does in a mini-sim is graded. Give its review the spec, then decide whether a graded sim is a deep-dive block or a kit surface it embeds. | `/agent-primitive` |
| EV-5 | Life-lab adopts `make`: its `write_item` tool has no goal field, so it is offered `CARD_SURFACES` only. | `/agent-primitive` |
| EV-6 | The manifest emits the spec per objective (a field on `ObjectiveBlock`), replacing `config.evidence` set by hand. Do this after EV-2 or EV-3, when more than one act can be collected. | direct |
| EV-7 | `say` and `explain`: move wonder-walk's spoken production (`wonderWalkSpoken.ts`) into the kit as a surface, so the spec's last two acts have one. | `/agent-primitive`, `/add-live-tutor-tools` |
| EV-8 | Coverage number: classify every published subskill into a spec (text only), count per act, and rank EV-2, EV-3 and EV-7 by subskills blocked. | `/curriculum-lumina-audit` |
