# measure-lab levers, all modes (2026-10-09)

`/add-support-tiers` on balance_predict, capacity_predict, pour_count and order_capacity. This is a C10 batch run in a non-interactive session, so the lever table below was built without stopping for review.

## Failure inventory

- **Real-learner evidence:** none. No demonstrations, misconception reports or remediation modules mention measure-lab.
- **Synthetic evidence:** the journey's scripted wrong answers (lighter guess, the container that holds less, one cup short, order reversed). These come from the W1 report.
- **Documented evidence:** the generator docblock and the catalog guidance ("a tall container does not always hold more").
- **Observable side:** every miss below is something `measureMiss` already names.

| Mode | Misses (class) |
|---|---|
| balance_predict | picked_lighter (synthetic) |
| capacity_predict | tall_means_more (synthetic + documented), picked_less (synthetic) |
| pour_count | one_short (synthetic), one_over, too_few, too_many (inferred) |
| order_capacity | most_to_least (synthetic), two_swapped, out_of_order (inferred) |

**Evidence corrupted (G2, not fixed here).** `buildBalance` gives the vocabulary objects random weights. In the saved payload the sock outweighs the rock and the leaf is lighter than the apple only by chance. A child who knows a rock is heavy is recorded as `picked_lighter`, and the scale then shows something false. So on those items `picked_lighter` is not evidence of a misconception. This is filed as contract G2 and routed to `/eval-fix`.

## Lever table (built)

Every lever is drawn (carrier: shown). That matters because the learners are Kindergarten pre-readers.

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| balance | `down_model`: a small model balance, 3 blocks against 1, the 3-block pan down | help | picked_lighter | Fixed constant. Never shows the item's objects; no digit or name in the fact. |
| balance | `far_pair`: feather vs brick (or leaf/rock, balloon/pumpkin) | simplify | picked_lighter | `farPairLeaks`: never uses the item's objects; clear winner; key agrees with the weights. |
| capacity | `cup_lines`: a shelf under each container, one cup picture per cup taken | help | tall_means_more, picked_less | `shelfCups`: shelves stay empty until the test has filled both. |
| capacity | `easy_pair`: two shapes, the one drawn much larger holds more (`scale`) | simplify | both | `easyPairLeaks`: shapes differ (mode floor); none of the item's names; the larger drawing holds more. |
| pour_count | `poured_shelf`: each poured cup stands in a row, no number | help | all four | `shelfCups`: shows only the cups poured. |
| pour_count | `smaller_pour`: a three-cup container | simplify | all four | `smallerPourLeaks`: fewer cups and never the item's count; key is among the options. None on a 3-cup item. |
| order | `order_steps`: three wordless bars that grow left to right | help | most_to_least | Fixed `[10,20,30]`; marks no jar. |
| order | `level_lines`: the same 7 even lines on every jar | help | two_swapped, out_of_order | Uniform across jars. |
| order | `far_levels`: identical jars at levels 1/4/8, drawn out of order | simplify | two_swapped, out_of_order | `farLevelsLeaks`. Offered only when two of the item's levels are under 3 apart. |

**Considered and rejected:** a "tall glass holds less" model for capacity. It is a fixed counterexample, so on the half of items where the tall container wins it would teach "wide holds more".

## What was built

- `measureLabLevers.ts`: lever declarations, the easier-item builders, leak rules, `shelfCups`, `leverFacts`, `practiceItem` / `practiceParent`.
- `MeasureLab.tsx`:
  - Lever state is keyed by the session item.
  - A practice item renders in place of the session item, with a "Practice" marker.
  - `pullLever` and `endPractice` are on `workspace.current`; the `onScreen` fact is added to the scene.
  - Try again keeps the practice item; a fresh item drops it.
  - New drawings: the model balance, the cup shelves, the order bars, and dashed level lines in `ContainerView`.
  - `MeasureContainer.scale` lets a container be drawn larger or smaller.
- `measureLabWorkspace.ts`: the scene says "drawn large/small" when a container has a scale.
- Catalog: `levers: true`.
- `liveJourneySpec.ts`: an item ending in `~smaller` is rebuilt from its parent.
- Contract: R4 and G2 added.
- **No tier starting positions.** The generator has no `config.difficulty` harness.

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| `measureLabLevers.test.ts` | 19/19 (builders over 90-160 items per mode, leak rules, miss → lever table, J9/J12 on generated and saved items) |
| `MeasureLab.levers.workspace.test.tsx` + `.workspace` + `.surface` | 39/39 total |
| journeySweep + workspaceContract + misses | 2629 passed. measure-lab: 0 findings on all 4 payloads; misses 17/17 named; J10 clean 100; J11 recover 67; lever inventory: every miss answered by an item lever |
| tutor replay (gemini-3.8-flash, 4 payloads × 5 samples) | 0 check misses on every check, including `stuck no_change_before_receipt` 0/20. Read by hand: the stuck/lever replies describe only the drawing and ask ("Which shelf has the longer line of cups?", "Which one on our balance pushed down?"). None names the answer. Saved: `qa/tutor-reports/replay/measure-lab-levers-2026-10-09.json` |

## Failures with no lever

None by mode. Per item: a 3-cup pour_count item and an order item whose levels are already far apart have no simplify lever, but their help levers answer every miss. Real-learner evidence is still zero.
