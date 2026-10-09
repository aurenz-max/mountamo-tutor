# timeline-builder — W1 workspace binding (plain shape), 2026-10-09

**Modes:** `sequence-daily`, `sequence-yearly`, `place-historical` (all bound, all driven by the journey row; none undriven).

**Checked by code:** the activity's own Check Order (every slot filled; slot i holds the event with `correctPosition` i).
`commitCheck(describeTimelineWork, correct, timelineMiss)`; no `expectedAnswer`. Try again clears the board.

**Misses** (`TimelineMiss`, same list every mode): `reversed`, `adjacent_swap`, `two_swapped`, `one_moved`, `mixed_order`.

**Pedagogy fix in the same slice:** the generator sorts `events` by `correctPosition`, so the bank printed the answer
left to right on every lesson (scripted path too). The bank now draws `bankOrder()` (seeded shuffle, never time order
or its reverse); the scene lists events in that order. Contract R1.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 errors (final run) |
| `TimelineBuilder.workspace.test.tsx` | 5/5 |
| `workspaceContract.test.tsx` (timeline-builder, 3 payloads) | 13/13 (first run failed "scene facts over 500 characters" on `events` with card descriptions; split to `card1..n`) |
| `journeySweep.test.tsx` (timeline-builder, J1-J12) | 3/3 payloads, 0 findings |
| `misses.test.ts`, `lessonWorkspacePlan.test.ts`, `activityContract.test.ts` | 212/212 |

## Tutor replay (gemini-3.8-flash, 3 payloads x 4 moments x 5 samples)
| Run | Code checks | Read by hand |
|---|---|---|
| before (`replay/timeline-builder-2026-10-09-before.json`) | 0 misses | 3/5 historical openings read the events **sorted by the years on the cards** (the answer); 1/5 yearly stuck turns walked August → October → December → February → May "follow that order" |
| after guidance fix (`replay/timeline-builder-2026-10-09.json`) | 0 misses | 0/15 openings sorted; stuck turns compare two events ("August or October?") |

Guidance added: read events in the order given, never sorted; never list more than two events, dates or months in time order.
The after-run payload's bank happened to be the exact reverse of time order; `bankOrder` now excludes the reverse too (not re-replayed).

## Open
- **G1** `place-historical` card descriptions state the year ("around 1500"), so the item is ordering numbers; at Grade 2-3 that may not be the intended skill → `/eval-test`.
- Stuck/miss replies name the two red events and ask which comes first. Allowed by guidance (comparing two events); a ruling if that is too much help.
- Needs a browser check on the shell's Try again and the bank order.
