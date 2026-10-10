# spatial-path W1 binding, 2026-10-09

Plain shape (P), `withWorkspaceController`. Grades: Kindergarten.

## Eval mode registered first (L0 -> L1)

The catalog had no `evalModes`, but the component has a real code check (chosen route id against
`correctRouteId`; endpoints are identical for every route). Registered that task as `choose_route`
(beta 2.5, scaffolding 2) in `catalog/literacy.ts`, `problem_type_registry.py` (`choose_route` + `default`,
both 2.5), and the generator (single-mode `logEvalModeResolution`). Route geometry moved to the pure
`spatialPathRoutes.ts` so the component's simplify lever can build maps; the generator re-exports it.

## What is checked by code

`routeMatches`: route id equality. Misses (`routeMiss`): `went_over | went_under | went_through | went_around |
went_across`, the movement the chosen route made instead of the asked one.

## Workspace behavior

- Scene: traveler, landmark, asked word, route count, learner work. A route's movement is named only after the
  learner animated it. No route number of the key, no `correctRouteId`.
- A wrong check no longer turns the correct route green on the workspace path (Try again reopens the same map).
  The scripted path keeps contract R3 (green key after any check); see findings.
- Next and "Try another route" hidden; scripted `sendText` muted; `useLuminaAI({ enabled: !tutorOwned })`;
  evaluation submits from `onFinished` only under an evaluation provider.

## Gates

| Gate | Result |
|---|---|
| typecheck:lumina | 0 |
| full tsc | 770 (baseline 770) |
| SpatialPath.workspace + SpatialPath + gemini-spatial-path tests | 8/8 |
| workspaceContract + journeySweep + misses + lessonWorkspacePlan (full run) | 3452 passed, 635 skipped, 0 failed |
| Sweep, spatial-path.choose_route | 5 items, 0 findings, misses 5/5 named; recover score 67, clean 100 |
| Payload | `w1-payloads/spatial-path.choose_route.json` |

## Tutor replay (text, 5 samples)

Run 1 (`replay/spatial-path-2026-10-09.json`): every check 0/5, but the `stuck` replies described the right
path on the map ("find the line that goes straight into it and comes out the other side", "look at where the
tunnel opens up"). Guidance changed once: never say what the right path looks like or where on the map it goes;
the movement word is explained away from the map. Run 2 (`-r2`): every check 0/5; stuck replies now use an
everyday example (a doorway, a play tent) and ask "which path goes inside the tunnel".

## Undriven modes

None.

## Open findings

- Scripted path (contract R3): after a wrong check the correct route turns green and is labelled before "Try another
  route", so the retry can copy the key. Kept because R3 is a recorded requirement; needs a ruling to fork or drop.
- The payload's five items ask each word once in a fixed order (through, around, across, over, under) with the same
  geometry per word, so a second same-word item would be recognition, not comprehension. Not a finding for this
  session length (5 items, 5 words).
- One replay reply used markdown bold (`**through**`); shared doctrine already forbids markup.
- Needs a browser check of the map on the live host (jsdom does not run SVG animation).
