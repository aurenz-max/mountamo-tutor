# LA-12 M0: the teaching-move contract

2026-09-18. Spec: `src/components/lumina/docs/LIVE_TEACHING_MOVES.md`. Machine-verified only —
no real-model drive of `compose_move` yet, which is the M2 gate.

## What changed

One tool, `compose_move`, replaces `generate_visual_support`. A support is now a teaching move:
the tutor names the obstacle it diagnosed, the delta that will be different from the child's
screen, the representation the help uses and the one action the child takes next, plus the
numbers the help draws. The tutor never picks a renderer — code picks the carrier from the delta
and builds the artifact, captions included, so a shape cannot state a relationship it does not
draw.

| Layer | File |
|---|---|
| Deltas, four-field parse, non-redundancy rule, carrier builders | `runtime/moveContract.ts` (new) |
| Refusal and commit | `LiveLessonRuntime.composeMoveRefusal` / `openComposedMove` |
| What the tutor may compose now | `RuntimeSnapshot.moveOptions` |
| Wire | `RuntimeTransport.composeMove`, `runtime_compose_move` |
| Tool + instruction | `live_runtime_tools.py`: `compose_move`, `MOVE_INSTRUCTION` |
| Ten-frame opts in | `representation`, `alternateRepresentations`, `TutorPrimitiveState.values` |
| Move log | `AssistanceEvent.move` (obstacle, delta, representation, nextAction) |

Two departures from the spec page, both so a move cannot claim what it cannot draw:

- The tutor names a delta and code picks the carrier, rather than the tutor choosing a shape and
  filling its parameters. A flat schema also survives a Live model better than nested shape params.
- `representationRefusal` additionally refuses a shape-carried move asking for a model no shape
  draws, and refuses a picture of something a shape draws exactly. That is how ruling 2
  (pictures are `illustrate` only) is enforced in code rather than in the instruction.

The picture service's four format purposes (`contrast | worked_example | hint |
step_visualization`) collapsed to `illustrate` alone. A picture now carries an obstacle, not a
layout.

## Gates

| Gate | Result |
|---|---|
| The 2026-09-18 ten-frame request is refused | PASS — unit test; `illustrate` + `ten-frame` is refused by non-redundancy, and the same obstacle re-represented as counters commits |
| A tutor-composed shape renders | PASS — `composedMove.render.test.tsx` drives the real `LiveRuntimeSurface`: a composed contrast draws two aligned rows with the unpartnered tail ringed, a composed process draws three steps with code-written captions |
| `typecheck:lumina` | 0 |
| Frontend suite | 6875 passed, 10 skipped |
| Backend `tutor_live` | 61 passed |
| Real SDK tool declaration | `compose_move` builds with the closed delta and operation enums |
| Existing live journeys stay green | **NOT MET, and not M0's doing** — see below |

## The ten-frame journey failure

`run_live_runtime.py --primitive ten-frame` fails 3/3 on `exampleTaught`: the tutor opens the
prepared `step-sequence` and says only step 1's caption ("6 counters are on the frame."),
omitting 4 and 10, so the example is announced rather than taught. The same journey passed 3/3
on 09-17.

It is not M0's. With ten-frame reverted to its pre-M0 state — no `values`, no representations —
the journey still fails 3/3 (`ten-frame-ab-no-values-2026-09-18.json`). An earlier A/B wrongly
implicated the `demand` values on one lucky pass; the fuller run corrected it.

Prime suspects are the two uncommitted `RUNTIME_INSTRUCTION` additions in the working tree (the
step-caption line and the purpose line), neither of which is in HEAD. Removing the step-caption
line alone did not fix it in one run
(`ten-frame-ab-without-step-caption-line-2026-09-18.json`). Filed under LA-10a for `/eval-fix`;
bisect the uncommitted tree against HEAD before editing the instruction again.

## What M0 does not answer

Whether a real Live model diagnoses an obstacle, picks the cheapest delta that fits it, and ends
its turn on `nextAction`. Every refusal here is a floor, not evidence of teaching. That is M2,
on ten-frame `make_ten`, with an obstacle the inventory does not list.
