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
| Rhyme Studio | both cards as one region (do they rhyme); the target word card (find, think of, build a family) | a choice card; a rhyme slot |
| Sound Swap | the printed starting word | one sound tile (on substitution a ring would be the sound-to-change highlight the hard tier removes) |
| Word Workout | both words as one region (real or silly); the printed word (picture match, extended word, its meaning); the chain row the screen marks; the near word the screen marks; the whole sentence (read it, its question, which word fits) | a picture; one word of a sentence; a near-word card on the choice |
| Phoneme Explorer | the sound tile, heard word card or starting word; the blend tiles as one row | a menu card; one blend tile; the worked example |
| Decodable Reader | the whole printed line; the read-along story; otherwise the question card | one word; a choice card |
| Story Talk | the listening card | — (nothing on screen can be the answer before the affirm) |
| Picture Vocabulary | the stimulus card — picture, base word, scale, or sentence frame (spoken modes); the picture cards as one region (receptive match) | one picture card; the "?" slot |
| Word Flip | the one → many (or today → yesterday) frame as a whole | — (the answer is only a blank) |
| Interactive Book | the glowing word the screen marks (read it); the whole page or cover (find a book part) | a title, author, heading, caption or page number |
| Spatial Scene | the grid or perspective scene as a whole, on every mode | a cell; a position-word button; the target cell |
| Letter Workshop | the writing paper as a whole (trace, copy, write — including while the browser speaks the letter name) | a start dot or arrow; the copy model; the model write reveals after a check |
| You & Me | both partners and the scene sentence as one region | one partner (the speaker highlight and actor marker are tier-withdrawn scaffolds) |
| Story Bridge | the ringed friend when it is in the first story (match characters); the Venn detail; story one's event (compare events); both stories as one region otherwise | a choice card or button; the ringed friend in the second story (on a narrow screen the choices sit between it and the dock) |
| Story Ribbon | the three-picture ribbon as a whole | one picture card (it would suggest which moment comes first) |
| Letter-Sound Link | the big letter card (see-hear, keyword match); the letter buttons as one region (hear-see) | one letter button; a keyword picture |
| Syllable Clapper | the hear-it-again button (the word is never printed) | the reveal bar's parts |
| Knowledge Check | the question card as a whole, on every item kind (judged surface only; the no-mic tap flow keeps the perch) | a choice, True/False card, sort group, word-bank word, or number-sentence token |
| DI Letter Sounds | the stage (picture with the letter, or with the word on first-sound items) | the word's first letter |
| DI Sentence Reading | the whole printed sentence; its reward beat celebrates | one word; anything while praise for the previous sentence plays |

### Shared surfaces

Most classic primitives use `useWorkspacePipSurface` (policy `workspacePipPose`): one
`workspace` region that wraps the item's model and its answer controls, a dock above it,
a point at the region only while the tutor speaks on this block and item, a `look` at
whatever the child presses or focuses inside it, and a celebration only on the
primitive's own confirmed result. It never points at a single control. Surface tests use
`pip/testing/classicSurface.tsx` (`expectClassicWorkspace`).

| Workspace primitives | Workspace region |
| --- | --- |
| Shape Builder, Strategy Picker, Timeline Builder, Fast Fact | the drawing grid; the strategy cards; the event lane; the fact card and answer pad |
| Base Ten Blocks (click modes), Fraction Bar, Fraction Circles (click modes), Area Model | the place columns; the step panels; the circle and its controls; the grid with its factor inputs |
| Array Grid, Multiplication Explorer, Skip Counting Runner, Regrouping Workbench, Coin Counter | the build/answer steps; the representations; the number line and jump controls; blocks beside the written problem; the challenge's coins and inputs |
| Measurement Tools, Percent Bar, Ratio Table, Double Number Line, Factor Tree | the measure/compare phase; the place and choice steps; the table, bars and inputs; both lines and the input row; the tree and factor panel |
| Function Machine, Equation Workspace, Formula Lab, Parameter Explorer, Practice Problem | the machine and its panels (dock stays through the "Complete" card); the equation readout and operation menu; the model and prediction panels; the sliders, observations and challenge; the whiteboard (dock in the header so it holds through the reveal overlay; the drawing is received while the judge compares it) |
| Angle Workshop, Circle Explorer, Polygon Area Builder, Transformation Lab, Net Folder | the canvas with its answer panel; the solid, its net and the challenge (Net Folder) |
| Histogram, Two-Way Table, Coordinate Graph, Distribution Explorer, Slope Triangle, Systems of Equations, Matrix Display, Function Sketch, Spatial Path | the chart or table with its answer controls; the whole workbench (Distribution Explorer, no celebration on guided exploration); the route map |
| Context Clues, Figurative Language (classify and interpret only — find and review are unscoped because a look at a tapped plain span would mark the figurative ones), Paragraph Architect, Poetry Lab (rhyme hunt), Evidence Finder, Spelling Patterns (celebrates only where the tier shows live correctness), Story Map, Character Web, Opinion Builder, Revision Workshop, Reading Repair Studio | the phase blocks; the poem and word cards; the reading round (Reading Repair never celebrates: its verdicts are provisional practice feedback) |
| Ramp Lab, Light & Shadow Lab, Day/Night & Seasons, Moon Phases, Life Cycle Sequencer | the scene or model with its controls and choices |
| Classification Sorter, Food Web Builder, Adaptation Investigator, Cell Builder, Microscope Viewer, Compare & Contrast (Venn only), Process Animator, DNA Explorer, Energy Cycle Engine, Evolution Timeline, Inheritance Lab (Punnett tab), Protein Folder (fold phase) | the sorting grid, web, panels, mission, lens, Venn, checkpoint, tabs or grid |
| Atom Builder, Mixing & Dissolving, Molecule Constructor, Reaction Lab (explain phase), pH Explorer, Equation Balancer, Energy of Reactions, Gas Laws Simulator, Stoichiometry Lab | the model or bench through its answer controls |
| Constellation Builder, Planetary Explorer (planet questions and quiz), Telescope Simulator, Orbit Mechanics, Mission Planner, Rocket Builder, Gravity Drop Tower, Motion Diagram, Race Track Lab, Sound Wave Explorer | the sky, viewport, orbit grid, mission controls, parts and rocket, or simulation with its answer area |
| Bridge Builder, Tower Stacker, Shape Strength Tester, Transport Challenge, Dump Truck Loader, Excavator Arm, Hydraulics Lab, Construction Sequence, Foundation Builder, Airfoil Lab, Flight Forces, Paper Airplane, Propulsion Lab, Propulsion Timeline, Engine Explorer, Vehicle Comparison, Vehicle Design Studio (the test run is received), Blueprint Canvas (the drawing is received while graded) | the build site or simulation with its controls |
| Digital Skills Sim, Foundation Explorer, Fact File, How It Works, Timeline Explorer, Vocabulary Explorer, Comparison Panel, Feature Exhibit, Image Panel (placed labels are received while graded), Tape Diagram | the practice area or the assessed check's answer controls (pre-reader faces use the same region) |

Components with no tutor hook pass `tutorSpeaking: false`: Pip never points there, but still follows touches and celebrates confirmed results.

Judged primitives whose question side is one panel use `useStimulusPipSurface` (policy
`stimulusPipPose`): Pip points at the stimulus region (or at an object the ask already
marks), looks at it while the child answers, receives it only when the tapped work is a
hands answer, and celebrates the held reveal. Surface tests use
`pip/testing/runnerSurface.tsx` (`expectStimulusSurface`). Place Value Chart and 3D Shape
Explorer have their own policies (`placeValueChartPipPose`, `stimulusPipPose`).

| Stimulus primitives | Stimulus (cue target) | Never a target |
| --- | --- | --- |
| Genre Explorer, Sentence Analyzer | the texts; the sentence | the genre menu; the label wall |
| Text Structure | the passage; the idea card on place-idea items | the structure menu, the mats |
| Oral Sentence Studio, Word Builder | the scene; the clue | the target words; the word-part wall |
| Read Aloud Studio | the printed line (a phrase plan is received while judged) | a break mark |
| DI Dice Roll, DI Deduction, DI Worked Procedure, DI Word Problem Setup | the dice; the rule and case; the written problem; the story (the big-amount builder is looked at and received on placement items) | a verdict pill, a story-part card |
| Solar System, Habitat Diorama, Matter Explorer, States of Matter, Push Pull Arena, Periodic Table, Cause & Effect Chain, Era Explorer | the sky; the habitat (connect and restore taps are looked at, never received); the bench; the arena; the table (find taps are looked at); the staged ending; the statement | a single body, organism, cell, or event card |

Hands answers (order cards, split, tiles, picture placement, ordering taps, ink, a balanced pan, a
spelled word) are followed with `look` and received with `receive` while judged. A single
committed tap (Letter Spotter, Word Workout and Picture Vocabulary pictures, Interactive Book
parts, Story Bridge choices) is followed with `look`, not received, and neither is Story
Ribbon's arrangement, which plans a spoken story rather than being judged. Docks sit so that a
pointer to the cue does not cross an answer surface. Pip's pose never calls the
child's handler, advances the runner, or writes an evaluation.

The packs that run `useJudgedSpeechLoop` directly without a reward beat (DI Word Reading, DI Letter
Sounds, Phonics Blender, CVC Speller, Sound Swap, Word Flip) open the next item on the affirming verdict, before the praise
is spoken. Each records the item its loop's last *sent* cue was about (`onCue`), the
runner's `cuedItemId` in miniature: speech counts as a cue only once that id names the
item on screen, and the praise is held as the confirmed result until then.

## Trying it

Math Primitives helper: select an integrated primitive and generate. Pip appears in
the dock immediately — idle for judged primitives until Start, working for classic
ones — and follows touches without any session. Start the lesson to hear cues and
see pointing. Regenerating or selecting another primitive removes the old surface.
The Language Arts helper hosts the literacy primitives the same way (it passes each
preview a per-generation `la-helper-<primitive>-<n>` instance id); Spatial Scene is in
the math helper; DI Word Reading is in the Direct Instruction Lab.

Preview: `/lumina/pip-surface` (also in Pip Lab) demos the actor with local phase
controls; it does not verify a primitive.

Verification: `pip/*.test.ts(x)` — store activation, phase gate, speech scope, one
surface test per primitive, and the helper attach test (real helper, companion and
actor, no session). Browser layout check: `.claude/skills/add-pip-surface/scripts/`.
Run logs: `qa/pip-surface/`.
