# Story Ribbon — L4 structural difficulty

2026-09-08. Story Ribbon now uses `config.difficulty` for two independent within-mode axes: scaffold withdrawal and narrative problem shape. The four retell modes keep exactly three events while moving from a familiar routine to a direct problem-solution arc to a failed-attempt/adapted-solution arc. `story_to_experience` is explicitly structurally saturated because its current response contract permits a connection to any single event.

| Tier | Retell narrative shape | Code-owned signals |
|---|---|---|
| Easy | setup → ordinary action → direct result | no problem, setback, or adaptation signal |
| Medium | small need/problem → direct response → solved result | one explicit problem/result pair; no failed attempt |
| Hard | goal → failed attempt/setback → changed successful plan | one explicit setback and one explicit adaptation |

The generator resolves support and shape from the same tier key and places both descriptions in each slot prompt, including mixed and blended sessions. Its post-process counts explicit arc signals, honors a generated story only when it hits the exact target, and otherwise reconstructs a deterministic familiar story with the correct mode and tense. The untiered path returns the original challenges unchanged and emits neither `supportTier` nor `problemShape`.

## Results

| Eval mode | Baseline | Easy | Medium | Hard | Issues |
|---|---|---|---|---|---|
| `tell_connected_account` | PASS | routine PASS | problem-solution PASS | adapted-solution PASS | — |
| `tell_present_account` | PASS | routine PASS | problem-solution PASS | adapted-solution PASS | — |
| `tell_future_account` | PASS | routine PASS | problem-solution PASS | adapted-solution PASS | — |
| `tell_past_account` | PASS | routine PASS | problem-solution PASS | adapted-solution PASS | — |
| `story_to_experience` | PASS | saturated PASS | saturated PASS | saturated PASS | — |

## Verification

- Live `/api/lumina/eval-test`: 20/20 pinned baseline/easy/medium/hard runs passed. Every result contained three events, the pinned mode, and the required Today/Tomorrow/Yesterday cue.
- Five-mode hard mixed session: PASS; four retells emitted `adapted_solution`, experience emitted `connection_saturated`, all five titles were distinct.
- Medium connected-account/experience blend: PASS; problem-solution and saturated shapes were assigned from each challenge's own mode.
- Offline constructive stress test: 1,000 cross-mode/tier/fallback constructions hit the exact problem/setback/adaptation targets, remained askable, and preserved future-tense `will` on every event.
- Fresh authoring-reliability sample after the shape-aware retry: 4/24 retell challenges used structural fallback (16.7%). A future-only follow-up after removing a contradictory past-tense prompt line used fallback for 6/24 challenges (25%), below the 30% reliability threshold; every fallback was disclosed in payload provenance and the activity description.
- Focused Story Ribbon tests: 30/30 PASS.
- Lumina typecheck: PASS, zero errors.

A runtime content review caught and fixed one deterministic present-tense agreement error (`seeds was` → `seeds are`); the re-probe passed. No CRITICAL or HIGH findings remain. Manual browser/microphone acceptance is still owed.
