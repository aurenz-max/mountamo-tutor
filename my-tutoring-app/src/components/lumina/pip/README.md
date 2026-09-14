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

Hands answers (order cards, split, tiles, picture placement, ordering taps, ink) are
followed with `look` and received with `receive` while judged. Docks sit so that a
pointer to the cue does not cross an answer surface. Pip's pose never calls the
child's handler, advances the runner, or writes an evaluation.

## Trying it

Math Primitives helper: select an integrated primitive and generate. Pip appears in
the dock immediately — idle for judged primitives until Start, working for classic
ones — and follows touches without any session. Start the lesson to hear cues and
see pointing. Regenerating or selecting another primitive removes the old surface.

Preview: `/lumina/pip-surface` (also in Pip Lab) demos the actor with local phase
controls; it does not verify a primitive.

Verification: `pip/*.test.ts(x)` — store activation, phase gate, speech scope, one
surface test per primitive, and the helper attach test (real helper, companion and
actor, no session). Browser layout check: `.claude/skills/add-pip-surface/scripts/`.
Run log: `qa/pip-surface/sweep-2026-09-14.md`.
