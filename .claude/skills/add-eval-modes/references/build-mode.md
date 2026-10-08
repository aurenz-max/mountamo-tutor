# Build modes (open build)

**Outcome:** the learner MAKES an example of the skill on an empty scene, instead of answering about one we
drew. "Count the 6 apples" becomes "Put six apples on the tree." Many builds pass. While the learner works, a
one-line narrator reacts to what they have made. At "I'm done!" the primitive's own check judges the build,
the miss routes the ladder's levers, and Try again keeps the build so the learner revises it.

A build mode is an eval mode like any other: a new challenge type, a catalog mode with a β, routed by intent.
It adds a surface and a live layer; it never replaces the primitive's judgment.

Reference implementations:
- `counting-board` `build_n` (math, code-judged): `CountingBuildScene.tsx`, `countingBoardDomain.ts` (`makesASet`,
  `buildPlaceFor`), the `build_n` branches in `CountingBoard.tsx` and `gemini-counting-board.ts`.
- `open-builder` (creation, vision-judged): the whole primitive is one build mode; `gemini-open-builder-judge.ts`.
- The shared layer both use: `primitives/build-layer/buildLayer.ts` (`svgPicture`, `useBuildWatcher`) and
  `service/build-layer/gemini-build-watch.ts` (`watchBuild`, `keepWatchLine`; route action `watchBuild`).

## When a primitive gets one

Add a build mode when the primitive already computes a property of something a learner could make, and many
different makes are correct: a set of N, a number in base-ten blocks, a fraction of a bar, a shape with area 12,
a repeating pattern, a sentence of a given type. Skip it when the skill is recognition (subitize, name the shape)
or when only one make is correct (then it is the existing mode with a different surface, not a new task).

## Who judges

| The property | Judge | Why |
|---|---|---|
| Computable (a count, a value, an area, a length, a pattern rule) | Code, at "I'm done!" | Exact, free, instant; vision miscounts, and counting is often the skill |
| Only visual ("looks like a bridge", "a house over the puppy") | `gemini-flash-latest` vision on `svgPicture` | The judge sees the picture the learner sees |
| Both ("seven apples, some up high") | Code for the number, vision for the rest | Never ask vision for a number |

Reuse an existing judgment when one fits. `build_n` is `give_me_n`'s judgment on a new surface: the same
`countMiss`, misses and levers, so it needed no new judging code.

## Steps

1. **Read the contract** (`docs/contracts/<id>.md`). A build mode is the fork the contract-first rule asks for: a
   new challenge type, never an edit to an existing mode in place. Where the contract says "the board draws exactly
   `count` objects", the build mode is the stated exception (it draws none).
2. **Domain:** add the kind; mark it a gesture answer; give it a how-to-play line, an ask that STATES the target
   (it is the task, not a leak: add it to `publicValuesFor` and the leak-guard exemption), an action key, an
   evidence line, and the miss function.
3. **Surface:** one `<svg>` holding the scenery and the learner's pieces, so `svgPicture` is exactly what the
   learner sees. Tap to place, tap a piece to remove it, no overlaps. Anything that is help rather than the
   learner's work (order tags, a ghost preview, a running count) is marked `data-aid` and stays out of the picture.
4. **Live layer:** `useBuildWatcher({ buildKey, enabled, svg, request: { task, sceneNote, numbers } })`. Use
   `numbers: 'never'` whenever the skill is a number; a line naming one does the skill for the learner and is
   dropped in code. Show the line under the scene with `👀`. Off while checking and after a pass.
5. **Commit:** "I'm done!" commits through the primitive's existing commit (`commitGesture` on the workspace
   runner, or the progress hook's `commitCheck`). Try again KEEPS the build; a new item (or a simplify lever's
   easier ask) opens an empty scene. The verdict's words stay on screen until the next check.
6. **Levers:** start bare. Keeping track IS the task, so the count and tag levers come on a miss, not from the
   tier. Simplify = the same build, smaller (half the target). Every lever's `when`/`does` text names the build
   ("puts in"), not the original mode's action ("hands over").
7. **Generator:** code owns the target (distinct requests per session, within the scope ceiling), the instruction
   and the scene; the model never writes the number. Add the type to the schema enum, `CHALLENGE_TYPE_DOCS`, the
   valid-types list and the fallback.
8. **Registry:** catalog mode (β near the closed-answer mode it builds from; `build_n` = `give_me_n` + 0.1), the
   backend `PROBLEM_TYPE_REGISTRY`, the catalog `misses` for the mode, and the oracle's known types.

## The tutor during a build (shared, nothing to wire)

On the teaching workspace the Live tutor is told facts and teaches from them; a build mode gets three things from
`useTeachingWorkspace` for free, provided step 3's scene is right:

- **Stopped building.** When the learner has changed the work and then stopped for `WORK_PAUSE_MS` (5 s) without
  committing, the tutor gets one host fact ("The learner changed their work and has stopped..."), once per state of
  the work. The shared doctrine keeps the step with the learner: invite the next step or a check, never do the step
  or say what the work adds up to. Needs an explicit commit ("I'm done!"): a mode that auto-checks on stillness
  (`armStillness`, 3 s) is checked before the pause fact can fire.
- **How it was made.** `demand.workHistory` records where each NUMERIC scene fact turned back
  (`markedOnBoard 0 → 10 → 9`), and the doctrine's credit rule names a self-correction from it. So publish the made
  quantity as a number (`countersOnFrame: 6`), never only as text, or the history stays empty.
- **The verdict.** "I'm done!" sends `The learner submitted "…". The board checked it: right/not right.` No
  instruction tail; the tutor's words are its own.

Evidence (2026-10-07): text replay over 136 gesture payloads, pause fact with vs without the doctrine rule, gave
the step away 7/272 vs 0/272; Ten Frame credit naming the fix 1/6 vs 6/6 with `workHistory`; Live A/B on `build_n`.
A family-specific rule still belongs in its catalog guidance when counting (or the made property) IS the skill:
counting-board says "never say how many are on the board or how many more are needed".

## Leak rules (each is a test or a code filter)

- The watcher never judges, never advises, never asks, never says "done/ready/complete" (`keepWatchLine`).
- On a numeric skill the watcher says no number word, digit, or quantity word ("few", "many", "both").
- No running count or "k of N" on screen until a lever is pulled; never the target beside the learner's count.
- Building aids are `data-aid` and never reach the picture a model reads.

## Verify

- vitest: the item builds and is a gesture answer; the miss for one over and one under; the levers' text.
- Drive it in the domain tester, offline levers, pinned to the new mode: build one too many → the right miss →
  Try again keeps the build → remove one → pass. Pull each lever and see it on the scene. Record 5+ watcher lines
  and check them against the leak rules. Save the run under `qa/open-build/<primitive>-<date>/`.
- No Live run is needed for the build layer itself (the watcher is flash-lite, not Live); the tutor's wording on
  the new verdict cue rides the primitive's next class Live gate.

## Shapes for other primitives (candidates, not commitments)

| Primitive | Build mode | Judge |
|---|---|---|
| ten-frame | make N on an empty frame, your own way | code (count) |
| base-ten-blocks | build N with rods and units, then a second way | code (value) |
| fraction-bar / fraction-circles | shade 3/4, then an equal fraction | code (shaded parts) |
| polygon-area-builder | make a shape with area 12, then a different one | code (area) |
| pattern-builder | make your own ABB pattern | code (rule) |
| number-bond | make 7 two different ways | code (parts sum) |
