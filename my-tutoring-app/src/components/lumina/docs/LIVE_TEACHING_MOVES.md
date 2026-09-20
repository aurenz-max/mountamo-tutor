# Live teaching moves: paradigm and roadmap

Status: M0 BUILT 2026-09-18; M1 onward proposed. Rulings 1 and 2 ACCEPTED, ruling 3 (prefetch)
REJECTED and replaced by the open lane below. Owner queue: `LIVE_LESSON_ROADMAP.md` item LA-12.
It replaces "which tools can the tutor call" with "which teaching moves can the tutor make", and
it sets the order of work for `/add-live-tutor-tools`.

**M0 as built.** One tool, `compose_move`, replaces `generate_visual_support` end to end:
`runtime/moveContract.ts` (deltas, the four-field parse, the non-redundancy rule, the carrier
builders), `composeMoveRefusal` / `openComposedMove` in `LiveLessonRuntime.ts`, `moveOptions` in
the snapshot, `RuntimeTransport.composeMove`, the backend `compose_move` declaration and
`MOVE_INSTRUCTION`, and ten-frame publishing `representation`, `alternateRepresentations` and its
values as data. Two departures from this page, both to stop a move claiming what it cannot draw:
the tutor names a delta and code picks the carrier rather than the tutor choosing a shape, and
`representationRefusal` also refuses a shape-carried move asking for a model no shape draws
(`SHAPE_REPRESENTATION`), which is how ruling 2 is enforced rather than by instruction. The
2026-09-18 request is refused in a unit test; composed contrast and process shapes render on the
real surface in `composedMove.render.test.tsx`. **Not yet driven against a real model** — that is
the M2 pilot gate, and until then no claim here is a runtime claim. The ten-frame journey's
`exampleTaught` failure was a separate defect and is now CLOSED, 3/3 PASS: a self-contradicting
tutor instruction plus a harness that judged one turn of a detour —
`qa/tutor-reports/example-taught-and-dead-regexes-2026-09-18.md`.

## The failure this answers

`qa/tutor-reports/generated-picture-ten-frame-host-card-2026-09-18.png`: the child is on a ten
frame showing 3 and must make ten. The tutor's help is a static picture of a ten frame showing 4,
with 6 empty. Same model, same question left open, different numbers, and the child cannot touch
it. It took about 15 s and moved the child away from their own frame. A child who could not do 3
gets nothing new for 4.

The pipeline did what it was asked. Three causes, all in shared code:

1. **The two tests were accuracy and answer leak.** `GENERATED_SUPPORT_INSTRUCTION` says "Choose a
   NEARBY example", and the only refusal is `drawsTask(counts)`. Nothing asks what the picture adds
   to the screen the child already has.
2. **`purpose` names a format, not an obstacle.** `contrast | worked_example | hint |
   step_visualization` say what the artifact looks like. None says what the child is missing.
3. **The tutor has no visual move inside the workspace.** Across the 12 adopted primitives every
   `scaffold` is a text reminder and no adapter advertises `point` (only `contract.ts` and the
   fixture mention it). On a pre-reader band the text is for the adult, so the child's screen does
   not change until the tutor leaves it for a detour. The detour is the most expensive move and it
   is the only visual one.

## The paradigm

**A support is a teaching move. A move is valid only if it changes what the child can see or do
about the obstacle they actually have.** Tools are how a move is carried out; they are not the
unit of design, of advertisement, or of testing.

Every move carries four fields. A move missing any of them is refused.

| Field | Meaning |
|---|---|
| `obstacle` | What the child is missing |
| `delta` | What is different from the current screen, from the closed list below |
| `nextAction` | The one observable thing the child does next |
| `check` | Same item again (assisted), then a fresh item with the aid off (transfer) |

### The delta list (closed, in cost order)

| Delta | What changes | Where | Budget | Ten frame, 3 shown, make ten |
|---|---|---|---|---|
| `attend` | Marks part of the child's own work | in place | 0.5 s | ring the empty cells left in the top row |
| `reveal-aid` | Switches on an aid the component already draws at an easier support tier | in place | 0.5 s | `twoColorMode`, `showCount` |
| `microstep` | Shrinks the task to one action with its own completion rule | in place | 0.5 s | "fill the top row first" |
| `re-represent` | The same quantity in a second, linked model | beside the work | 1 s | number bond: 10 is 3 and ? |
| `contrast` | Two cases and the one feature that differs | detour shape | 1 s | (not this obstacle) |
| `model-process` | Worked steps on a different example, then hand back | detour shape | 1 s | existing `step-sequence` |
| `illustrate` | A generated picture of something no shape or primitive draws: a story context, a real object, a letter in a scene | detour | about 15 s | fingers on two hands |

The tutor picks the cheapest move that fits the obstacle. It is a preference order, not a ladder
to exhaust.

### Two lanes: known and open

Failure modes cannot all be listed in advance, per primitive, across every subject. So the rails
are the **generic contract** (four fields, the delta list, the validators), not a per-primitive
list of missteps. A lesson of 5 to 10 primitives needs no prepared prompts and no prefetch.

| | Open lane (default, every primitive) | Known lane (fast path, optional) |
|---|---|---|
| Who diagnoses | The tutor, from facts the adapter publishes: what is on screen, the task's values as data, what the child did and said | The adapter: a misstep aid is advertised once its evidence fits |
| `obstacle` | Free text, the tutor's own diagnosis, logged | A misstep id from the inventory |
| How the move is made | The tutor **composes** it: `delta` (enum), `representation` (enum from the adapter's alternates), typed shape params or a picture description, `nextAction` | The tutor copies an advertised ticket |
| What it costs a primitive | Publish facts; declare `representation` and `alternateRepresentations`; have named targets | A misstep inventory and per-misstep handlers |
| Exists today | No. `request_support { shape, params }` is LA-10a open item (3) | Yes: text aids on 12 math primitives |

What makes the open lane general:

- **`attend` needs no per-primitive handler.** 184 of 212 primitives already publish named,
  item-scoped targets with element refs for Pip (`usePipTargets`, `data-pip-object`). One shared
  overlay rings a named target. It is a projection and mutates nothing in the primitive, so it
  does not conflict with the skill's rule that a Pip target is not an action channel.
- **Composed shapes are instant.** The tutor fills a typed schema (`counter-example`,
  `contrast-pair`, `step-sequence`, `part-whole`); a deterministic renderer draws it in under a
  second. The 15 s cost applies only to `illustrate`, which is rare by design. While a picture
  draws, the tutor makes an `attend` move first, so the child is not left waiting.
- **The validators are subject-agnostic.** Non-redundancy (below), answer leak on values sent as
  data, structure checks per shape, the vision check on pictures.
- **Unknown failure modes are discovered, not predicted.** Every open-lane move logs the tutor's
  `obstacle` text, the move and its outcome. An obstacle that recurs on a primitive is promoted to
  a known-lane aid through `/add-live-tutor-tools`. The inventory grows from sessions.

The tutor's job in the open lane is small because the contract does the hard part: it cannot
redraw the workspace, cannot show the answer, must name a delta, and must end on one action.

### The non-redundancy rule (enforced in code, not in the prompt)

The adapter declares the `representation` it draws (`ten-frame`) and the `alternateRepresentations`
a support may use (`number-bond`, `fingers`, `equation`). The runtime refuses a support whose
representation equals the workspace's unless its delta is `contrast`, `model-process` or
`microstep`. `representation` and `delta` are enums in the tool schema, built from the mounted
adapter, so the tutor cannot ask for a ten frame while a ten frame is on screen. The refusal sits
beside `drawsTask` in `runtime.composeMoveRefusal`. The 2026-09-18 request becomes a unit
test that must be refused.

### Timely

- **Trigger on evidence, not a miss count.** Cannot start: `attend` or `microstep`. First miss: the
  owner's correction, no tool. Same difficulty twice: a move. Success with help: fade, then a
  fresh item. Productive work: nothing.
- **Most help stays in the workspace or is a composed shape**, both under a second.

### Accurate

Deterministic renderers wherever count or geometry carries the teaching. Generated pictures keep
the vision check and the `counts` sweep and are limited to `illustrate` (ruling 2). Every move,
not only examples, gets an `exampleTaught`-style assertion: did the tutor state the relationship
the move shows, and did it end its turn with `nextAction`.

### Does it improve understanding

Machine drives can prove a move was valid, became visible inside its budget, and was followed by
the child's next action. They cannot prove understanding. Per move, record: same-item result after
the move, fresh-item result with the aid off, and time from visible to the child's next action.
LA-11 runs the same journey with words only as the baseline. A move that does not beat words on
the fresh item across sittings is removed.

## The independent pieces

The model gets one new tool, `compose_move`, which absorbs `generate_visual_support` (a picture is
the `illustrate` delta). `perform_runtime_action` stays for known-lane tickets and mechanics.

| Piece | State | Work |
|---|---|---|
| Fact publisher (`getTutorState()`) | ten-frame BUILT: values as data (`shown`, `capacity`, never the answer) and `representation` / `alternateRepresentations` | the other 11 adapters, one at a time; three still note "evidence not published yet" |
| `compose_move` tool + validators | BUILT | `moveContract.ts` + `composeMoveRefusal`; deltas and operations are schema enums, `representation` is checked live against `moveOptions` because the tools are declared before anything is mounted |
| Shared `attend` overlay on Pip targets | missing; the target registry exists | one runtime renderer; check each adopted primitive's target names are meaningful to the tutor |
| `reveal-aid` (ruling 1) | missing | per primitive: a runtime override of aids the component already renders for its support tiers. The item keeps its tier for IRT; the reveal is an assistance event at level 2 to 4 with its own fade |
| `microstep` under a judged runner | missing | the runner owns progression in 10 of 12 adoptions, so a microstep is a runner-owned sub-ask. Shared `useJudgedScriptRunner` work, regress both families |
| Shape renderers | all three now tutor-parameterised (code builds frames and captions from the tutor's numbers) | add `part-whole` and a glyph `ContrastPanel` for letters |
| Picture service (draw, vision check, one redraw) | BUILT as the `illustrate` branch | its four format purposes collapsed to one; a picture now carries an obstacle, not a layout |
| Move log | `assistance[].move` carries obstacle, delta, representation and nextAction | add same-item / fresh-item outcome to the journey report; persistence waits for LA-09 |

## Roadmap

One primitive at a time. The skill changes only after the pilot has been driven in the real host.

| Step | Scope | Exit gate |
|---|---|---|
| ~~**M0 contract**~~ DONE 2026-09-18 | `compose_move` schema and validators; adapter `representation` + `alternateRepresentations`; task values as data in the packet (`TutorPrimitiveState.values`, its own field so a move's numbers are never confused with an example's); instruction rewritten from "nearby example" to the move rule. | MET on the first two: the 2026-09-18 ten-frame request is refused in a unit test; composed contrast and process shapes render on the real surface. Frontend 6879 green, `typecheck:lumina` 0, backend `tutor_live` 61 green. The third is now MET: the ten-frame journey passes 3/3 on `exampleTaught`. Its failure was never M0's — `RUNTIME_INSTRUCTION` told the tutor both "one short sentence per step" and "in one short sentence", and the harness kept only the last turn spoken over the detour. Both fixed; counting-board 1/1. |
| **M1 shared `attend`** | The overlay over Pip targets, offered on any mounted primitive that publishes targets. | Host drive on ten-frame and number-line: "I don't know where to start" rings a named part of the child's own work within 0.5 s, no per-primitive handler written. |
| **M2 pilot: ten-frame `make_ten`, open lane end to end** | Composed shapes and `reveal-aid` (`twoColorMode`, `showCount`) with fade. Read `docs/contracts/ten-frame.md` first. | Host drive x3 with an obstacle the inventory does NOT list: the tutor diagnoses from facts, composes a valid move, ends with one action, a fresh item follows with the aid off. User reviews shots from the real host. |
| **M3 a non-math primitive in the open lane** | One literacy primitive with Pip targets and no misstep inventory (LA-07); glyph panel for b/d. | The contract holds with no per-primitive misstep work and no new delta. |
| **M4 `re-represent` + runner microstep** | `part-whole` shape; runner sub-ask, first home ten-frame "fill the top row first" | Second adopter of the shape with no renderer change; sub-ask regresses both families. |
| **M5 skill** | `/add-live-tutor-tools`: open-lane adoption (facts, representations, targets) becomes the default path; the misstep inventory becomes the promotion path for recurring logged obstacles. | Fresh-session dry run of the skill on one primitive. |
| **M6 measurement** | LA-11 words-only baseline against moves; promotion of recurring obstacles; sittings | Keep, change or remove each move on fresh-item results. |

**Why this order.** M0 and M1 are shared work that every primitive inherits, which is what lets a
5 to 10 primitive lesson have visual help without per-primitive preparation. Ten-frame is the
pilot because it is the observed failure and its aids already exist in the component. A literacy
primitive comes third, before more math, because the claim under test is that the rails generalise
across subjects.

## Rulings

| # | Ruling | State |
|---|---|---|
| 1 | `reveal-aid` reuses support-tier aids mid-item as an assistance event; the item keeps its tier for IRT. Revises the skill's "do not overload the tier axis" line. | ACCEPTED 2026-09-18 |
| 2 | Generated pictures are limited to `illustrate` and never the workspace's own representation. Narrows the 2026-09-18 picture ruling. | ACCEPTED 2026-09-18 |
| 3 | Prefetch host-built picture prompts on first miss. | REJECTED 2026-09-18: a 5 to 10 primitive lesson makes the prepared surface large, and failure modes are not all known in advance. Replaced by the open lane: generic rails, tutor-composed moves, recurring obstacles promoted from the log. |
