# Pip shared surfaces

Pip's animation is a projection of activity state. The primitive owns its targets,
phase, and gesture. No LLM tool, transcript parser, or network message can select
an object or execute an animation, and no tutor session is required for Pip to join
a primitive.

`PipSurfaceStore` lives per Lumina provider. An opted-in primitive registers its
elements with `usePipTargets` and publishes with `usePipSurface(() => …)`:

- Its instance and current item IDs.
- A reserved DOM dock for Pip, outside the child's working targets.
- References to currently visible DOM or SVG objects.
- A `PipPose` derived from its actual phase and the child's events.

`usePipSurface` re-runs the builder after every commit; the store ignores an
unchanged surface, so builders are inline and carry no dependency list.

## Which surface Pip joins

Decided by events, in `PipSurfaceStore`:

1. The first surface to register.
2. Whichever surface's pose last changed into a non-idle phase — a runner start, a
   child's touch, a check, a spoken cue.
3. Host claims: the lesson's focused section (`ManifestOrderRenderer`, no session
   needed) and the tutor's active block (`LuminaAIProvider`). A claim on a block
   with no surface parks Pip on its perch.

Tutor speech is one input to a pose (it can make a surface `introducing`), never a
precondition. Classic primitives count speech only while the tutor's active block
is theirs and the utterance began on the current item (`useSpeechScope`).

`CuratorCompanion` moves its one character into the active dock whether or not a
session exists. Unregistered primitives retain the perch. `PipSurfaceActor`
measures targets on layout, resize and scroll, and draws gaze, hands and pointer: a
ring and connector for a small object, an outline only for a region (over 140px or
elongated), because a connector ends beside whichever choice sits nearest Pip.
Mouth motion follows audible tutor speech.

## Policies

Each policy is a pure file in this folder built on `pipPhasePose` (celebrate only a
confirmed item, neutral before start and over the previous item's audio tail, drop
invisible targets). Counting Board was the pilot:

| Activity state | Pip behavior |
| --- | --- |
| Idle / awaiting this item's cue | Neutral; no target |
| Current item's introduction or correction is playing | Points at the first visible object |
| Child is working | Looks at the most recently touched visible object |
| Gesture handover is being judged | Opens its hands |
| Other answer is being judged | Waits, retaining shared attention |
| Affirmed result / held reveal | Celebrates, without pointing at the next challenge |

Subitizing and the rearranged conservation task suppress individual-object cues.
Objects hidden by a flash, the count-on basket, or removal are not published.

| Primitive | Points at (during this item's cue) | Never points at |
| --- | --- | --- |
| Number Sequencer | the highlighted gap car | any car in spot-error; any card in order-cards |
| Number Tracer | the canvas, copy model, or sequence gap | the numeral's stroke path |
| Number Bond | the bond board, covered part, or equation slots | a counter, tile, or action button |
| Ordinal Line | the line's start; the marked place when the tier shows it | a character; the story cast |
| Sorting Station | the named focus card; the tray a count ask names | a tray or card that could be the answer |
| Compare Objects | the drawing as a whole | an object or name button |
| Comparison Builder | the workspace as a whole | any answer choice |
| Ten Frame | the frame as a whole, on every mode (on subitize, before the flash) | a box or counter; on subitize, nothing on the frame is followed |
| Addition & Subtraction Scene | the story picture; the empty equation tray on build-equation | an object, a tile, the add button |
| Bar Model | the whole graph; the row the screen already highlights (read modes); the group to count (match a group); the controls (build graph) | a row on most/fewest, compare, or match; a row whose highlight the tier withdrew; a number option |
| Length Lab | the objects side by side; the clues; the object with the row its units go in | a unit tick, the tile count, an answer or guess button |
| Analog Clock | the clock face as a region; the option faces on hear-the-time | a hand (a touch on the dial is watched as the dial), a numeral, an option |
| Time Sequencer | the ordering list as a whole; the event card a time-of-day or before/after question names; the duration pair as a whole; the schedule table | a card to order, a period, an option card, a duration button, a schedule row or activity |
| Pattern Builder | the next empty "?" slot (extend, find the rule), or the row once every slot is filled; the row as a whole (identify the core); the build zone (create, translate) | a palette token; a single token of the row on identify |
| Shape Sorter | the one shape the screen rings (or draws alone) on every mode | a mat; any other shape in the pool |
| DI Spoken Practice | the stimulus panel as a whole; nothing on a listen-only item | one picture of a compare pair; one object of a count |
| DI Math Facts | the printed problem (its own loop phases mapped onto the gate; the reward beat celebrates) | the completed equation; anything while praise for the previous fact is still playing |
| Measure Lab | the object pair before the prediction, then the scale; both containers (holds more, least to most); the container while pouring, then the cups row | one object or container; a number option |
| Math Fact Fluency | the dots, frame or fingers (visual fact, picture-to-equation match); otherwise the printed equation | a number, equation or picture choice; the stepper |
| Number Line | the whole line (plot, find between); the marked start point (jump); the chips as a row (order) | a tick, a label, or a place where a hop lands |
| Calendar Explorer | the grid when a date is the answer; the starred "today" cell when an option is the answer; the start-day card (days forward); the listen card on the spoken chain | a date cell that could be the answer; the target-day column; an option |
| DI Shapes | the whole drawn shape or object (its own loop phases mapped onto the gate; the reward beat celebrates) | one side or corner; the labeled reward; anything while praise for the previous shape is still playing |
| Equation Builder | the empty slot row (build, rewrite); the printed "?" (missing value, balance); the whole printed equation (true or false) | a tile in the pool, a number option, True or False, the number box |
| Shape Tracer | the canvas as a whole, on every mode | a dot or vertex (the next dot is the answer once a tier withdraws the numbers and the next-dot ring); a grid corner |
| Shape Composer | the canvas as a whole — silhouette, picture or composite — on every mode | a palette piece, a decompose shape button, where a piece goes |
| Hundreds Chart | the chart as a whole, on every mode | a cell; an option |
| Balance Scale (equality) | the right pan (build); the gathered right-side weights (say the total); the unnumbered left weight (find the left weight) | a tray weight, a placed block |
| DI Word Reading | the whole printed word, on every mode | one letter; anything while praise for the previous word is still playing |
| Phonics Blender | the letter row as a whole, on every mode and tier | one letter card (a ring would draw the segmentation the hard tier removes) |
| CVC Speller | the "?" box (middle sound); the word's picture (sound groups); the box row (spell it) | a vowel column; a bank letter; on sound groups with the picture withdrawn, nothing |
| Letter Spotter | the star over the hidden letter (name it); the grid as a whole (find it); the big letter (match it) | a grid cell; a little letter |
| Word Sorter | the word card, on every mode | a mat, its picture, a bank word |

Hands answers (order cards, split, tiles, picture placement, ordering taps, ink, a balanced pan, a
spelled word) are followed with `look` and received with `receive` while judged. A single
committed tap (Letter Spotter) is followed with `look`, not received. Docks sit so that a
pointer to the cue does not cross an answer surface. Pip's pose never calls the
child's handler, advances the runner, or writes an evaluation.

The three packs that run `useJudgedSpeechLoop` directly (DI Word Reading, Phonics
Blender, CVC Speller) open the next item on the affirming verdict, before the praise
is spoken. Each records the item its loop's last *sent* cue was about (`onCue`), the
runner's `cuedItemId` in miniature: speech counts as a cue only once that id names the
item on screen, and the praise is held as the confirmed result until then.

## Trying it

Math Primitives helper: select an integrated primitive and generate. Pip appears in
the dock immediately — idle for judged primitives until Start, working for classic
ones — and follows touches without any session. Start the lesson to hear cues and
see pointing. Regenerating or selecting another primitive removes the old surface.
The Language Arts helper hosts the four literacy primitives the same way; DI Word
Reading is in the Direct Instruction Lab.

Preview: `/lumina/pip-surface` (also in Pip Lab) demos the actor with local phase
controls; it does not verify a primitive.

Verification: `pip/*.test.ts(x)` — store activation, phase gate, speech scope, one
surface test per primitive, and the helper attach test (real helper, companion and
actor, no session). Browser layout check: `.claude/skills/add-pip-surface/scripts/`.
Run logs: `qa/pip-surface/`.
