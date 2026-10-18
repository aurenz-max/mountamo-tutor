# Context axes — letting the lesson decide content that code now fixes

Status (2026-10-17): steps 1-3 BUILT, uncommitted. Next: step 4 (spatial-scene `objects`).
Source: curriculum design reviews `ss-g1-2026-10-17`, `science-k-2026-10-17`.
Executor skill for each new axis: `/add-context-axis`.

| Step | State | Evidence |
|---|---|---|
| 1 `contextAxis.ts`; prepositions + deck moved onto it | done | prompts unchanged; spatial-scene + flashcard tests 76/76 |
| 2 `bar-model.dataset` (`service/math/barModelDataset.ts`) | done | real draws on SCI003-01-G / -D: Summer vs Winter graphs, counts ranked per season; K math survey control still Morning/Afternoon |
| 3 gap log `qa/fit-gate/axis-gaps-*.jsonl` + `scripts/axis-gap-report.mjs` | done | only the preposition axis reports gaps so far |

Known limits of the pilot: the weather objective names places *and* times, and the resolver
chose two seasons only; make_graph takes the lesson's categories but not its contexts (its
ask is code-assigned and no graph label is shown).

## The problem

Many generators keep a closed, code-owned pool for *content*: theme lists, label pairs,
object sets, story shapes. The pool was right for the skill the primitive was born for.
When the manifest routes a different skill to the primitive, the pool overrides the lesson:

| Primitive | Fixed in code | What the lesson asked for |
|---|---|---|
| bar-model `compare_two_graphs` | labels Morning / Afternoon (`gemini-bar-model.ts` `generateGraphExplanation`) | two places or two months |
| bar-model all K modes | random counts; `K_SETTINGS` pulls to toys and playgrounds | weather counts with a real pattern (snow in January) |
| spatial-scene | ten fixed emoji on a random `SCENARIO_THEMES` pick | objects that belong to the lesson's scene |
| story-bridge `venn_place` | two 5-sentence stories, three characters | features of two named celebrations, two children's lives |
| knowledge-check `matching` | 3 pairs per draw | 6 pairs |

## The split every generator should follow

1. **Code owns correctness.** Answer keys, geometry, counts that satisfy a rule, the
   one-defensible-answer guard. Unchanged by this plan.
2. **The lesson owns content.** Labels, vocabulary, which objects, which two subjects,
   which direction a pattern goes. Read from the lesson context through a typed axis.
3. **The pool is the fallback.** When the lesson names nothing for an axis, the existing
   pool runs exactly as today. Existing consumers see byte-identical output.

## The mechanism: one resolver per axis, one shared helper

Both existing resolvers (`service/math/spatial-scene/resolvePrepositionScope.ts`,
`service/flashcard-deck/resolveDeckRequest.ts`) follow the same contract. Extract it into
`service/contextAxis.ts`:

```ts
resolveContextAxis<T>(scope: PedagogicalScope, spec: AxisSpec<T>): Promise<AxisResult<T> | null>

interface AxisSpec<T> {
  id: string;                    // 'bar-model.dataset'
  schema: Schema;                // what the primitive CAN express, as enums/bounded arrays
  describe: string;              // one paragraph: what to extract, what absence means
  validate(raw: unknown): T | null;
}
interface AxisResult<T> {
  requested: T | null;           // null = the lesson named nothing → caller uses its pool
  unsupported: string[];         // asked for, cannot express → logged, never faked
}
```

Rules, all already proven in `resolvePrepositionScope`:
- One flash-lite call, temperature 0, schema-constrained. No regex over intent prose.
- Fires only when the scope carries objective or intent text.
- **Request-presence fork:** absence is reported as absence; the resolver never invents.
- **Widens only:** a resolved value can add to the pool's range, never remove what the
  band already allowed.
- Any parse or validation failure returns null → today's behavior.
- `unsupported` goes to the fit ledger as `axisGap` rows. This is the demand signal:
  "lessons asked spatial-scene for near/far 14 times" ranks the next mode to build.

Code still turns the resolved content into the item. Example: the bar-model axis returns
`{ categories: [...], labels: ['January', 'July'], rank: { January: ['snowy','cloudy','sunny'], ... } }`
and code generates counts that obey that rank. The model supplies the domain fact
(snow ranks first in January); code supplies numbers and answers.

## When an axis is the wrong rung

Apply the contract ladder (`/primitive-contract`): eval-mode split → band gate → config
axis → variant. An axis only changes *content inside an interaction that already
exists*. It is wrong when:
- the lesson needs a new judgment rule (near/far needs a distance rule → new spatial-scene mode);
- the lesson needs a new interaction (two-design test, map with compass → new mode or primitive);
- the pool content is wrong (ramp-lab's confounded "fair test" → `/eval-fix` defect).

## Rollout

Pilot, then sweep (CLAUDE.md Verification Doctrine). Each step is verified with the
review's own probe (`qa/curriculum-design-review/*/probe.mjs`) on the exact objective
that failed, plus the primitive's existing tests to show the old consumer is unchanged.

1. **Extract `contextAxis.ts`** from `resolvePrepositionScope`; move spatial-scene's
   preposition resolver onto it with no behavior change (its tests must pass unchanged).
2. **Pilot: bar-model `dataset` axis.** Fixes SCI003-01-D and SCI003-01-G (brief 1 shrinks
   from a new mode to this axis plus a season question). Verify: the SCI003-01-G probe
   gives two weather graphs labelled with two months; a K math survey probe is unchanged.
3. **Fit-ledger `axisGap` rows** and a ledger query that ranks gaps by count.
4. **Sweep**, one primitive per slice, ordered by how many reviewed subskills it unblocks:
   - spatial-scene `objects` axis (objects drawn from the lesson's scene; emoji from a vetted set);
   - story-bridge `subjects` axis — test whether this serves SS brief 1 (same and different)
     before building a new primitive for it;
   - knowledge-check `count` axis (pairs per matching item from the objective; trust intent over caps).
5. **Birth rule.** Add to `/primitive` Phase 1: any code-owned content pool gets an axis at
   birth, or a one-line reason it never needs one. Add to `/primitive-contract`: list each
   pool and whether an axis covers it.

## Notes for parallel sessions

- **Map primitive (new, in progress):** born on this split. Places, landmarks and the scene
  come from the lesson through an axis; code owns the grid, the compass and which answer is
  right. Do not ship a fixed town as the only map.
- **di-spoken-practice (DSP-SS1, in progress):** independent of this plan. If the zero-item
  result comes from a closed item pool rejecting social-studies topics, the fix is this
  pattern; if it comes from the plan step refusing the objective, it is a plain defect.

## Not in scope

- Curator or manifest rules (user ruling: the manifest passes, the generator works).
- Letting the model pick numbers or answers. Item spaces and word spaces stay code-owned.
