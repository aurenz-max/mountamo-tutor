# spatial-scene: near and far

Curriculum IDs: SS003-06-a, SS003-06-c (SOCIAL_STUDIES, grade 1). Source: design review ss-g1-2026-10-17.

## Curriculum

**SS003-06-a** (Location and Spatial Thinking): "Students practice positional vocabulary by reading definitions and seeing visual examples of spatial relationships. Focus: Mastering words like above, below, next to, between, near, far. ... Constraints: 6 words, visual illustrations for each, fill-in-the-blank practice."

## Gap

spatial-scene covers four of the six words: above, below, next to (identify, place) and between (place_between).

Near and far are not supported. The supported word list is fixed in code (`service/math/spatial-scene/resolvePrepositionScope.ts:65-67`). Words outside it that a lesson names are logged as unsupported and dropped (`gemini-spatial-scene.ts:1336-1344`).

vocabulary-explorer accepts any words but shows text cards with no pictures, so it is not a substitute for the visual examples the objective asks for.

## Missing learner action

Judge distance relative to a reference object. Which thing is near the house, and which is far from it? Put the ball near the tree.

## Evidence wanted

- Tap or say "near"/"far" for a target and reference object.
- Place an object near or far, checked in code like the other words.
- Contrasting pairs in one scene (one object near and one far from the same reference) so the child compares distance, not position.

## Example

A 3x3 grid with the house in a corner. The dog is in the next cell; the tree is in the opposite corner. "Is the dog near or far from the house?" Then: "Put the ball far from the house."

## Constraints

- The rule must be unambiguous on a small grid: near means an adjacent cell, far means at least two cells away, and the middle distance is never asked. The implementing session may decide whether a larger grid is needed.
- Keep the code-owned answer key and the existing distractor rule (one true option among four).
- Follow the existing scope rule: the words join the lesson's set when the objective names them.

## Handoff

Read the spatial-scene contract (`docs/contracts/spatial-scene.md` if present; `/primitive-contract` otherwise) before editing, then use `/add-eval-modes` or extend the word scope as you judge best, with `/eval-test` to close.
