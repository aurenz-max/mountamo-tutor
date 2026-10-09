# Contract: timeline-builder

- **Derived:** 2026-10-09 (workspace W1 binding; no earlier contract)
- **Component:** `primitives/visual-primitives/calendar/TimelineBuilder.tsx` · **Domain:** `calendar/timelineBuilderWorkspace.ts` ·
  **Generator:** `service/calendar/gemini-timeline-builder.ts` · **Catalog:** `service/manifest/catalog/calendar.ts`
- **Modes:** `sequence-daily` (daily) · `sequence-yearly` (yearly) · `place-historical` (historical); one challenge type each.

## Requirements

### R1 — the bank never shows the answer · OBSERVED
The generator returns `events` sorted by `correctPosition`; drawn as given, the bank read left to right was the
answer. The bank draws `bankOrder(challenge)`: a shuffle seeded by the challenge, never time order or its reverse.
Probe: `TimelineBuilder.workspace.test.tsx` (bank ≠ order on every mode; `bankOrder` never sorted either way).

### R2 — the check is the activity's own, and the key stays off the tutor · OBSERVED
Check Order is enabled only with every slot filled; correct = every slot holds the event whose `correctPosition` is
its index (`timelineCorrect`). On the workspace path the check commits through `commitCheck` with `timelineMiss`
(`reversed`, `adjacent_swap`, `two_swapped`, `one_moved`, `mixed_order`); the scene lists events in bank order and
the learner's placements, never the order. Try again clears the board. Probe: workspace test + journey sweep J1-J8.

### R3 — scripted path unchanged · OBSERVED
Outside a live runtime: Try Again keeps placements, three misses reveal the order and record a partial score, Next
advances and submits. Workspace path: no Next, no scripted Try Again, no `sendText`, `useLuminaAI` disabled.

## Open
- **G1** — card descriptions for `place-historical` can carry the year; ordering by stated year is the intended
  skill at grades 4-8 but makes K-3 historical items a number-ordering task. Generator question → `/eval-test`.
