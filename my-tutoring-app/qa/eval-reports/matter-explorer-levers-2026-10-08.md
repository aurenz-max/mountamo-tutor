# matter-explorer levers (2026-10-08, class sweep)

`/add-support-tiers` on sort, property, change, mystery. All four modes are spoken; the scene must never classify the item's object, so every help lever draws models beside the item, never on it.

## Failure inventory

No real-learner evidence (no demonstrations, tutor reports or misconception runs name this primitive). No contract doc exists (`docs/contracts/matter-explorer.md`).

| Mode | Failure | Class |
|---|---|---|
| sort | another state word (`other_state`); a thick liquid called solid, pouring grains called liquid | documented (judging contract signature misses), synthetic (journey plainWrong) |
| sort | says the object's name back (`said_object_back`) | documented |
| property | another cup behaviour (`other_shape`) | synthetic (harness plainWrong); miss function added today |
| property | names the state instead of the behaviour (`state_word`) | documented (contract "signature miss"); miss function added today |
| change | the other way (`other_way`), the change said back, a state word | documented + synthetic |
| mystery | another state word (`other_state`); guessing the object | documented; object guess has no fixed examples, so stays unchecked |

## Lever table

| Mode | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|
| sort, mystery | `three_models`: a solid, a liquid and a gas from everyday life, each in a cup, tagged "a solid: it keeps its own shape" etc. | help | both | exactly one per state; no model shares a word with any lesson object (`modelsLeak`) |
| property | `three_models`, tagged with the cup behaviour only | help | both | same |
| sort, mystery | `plain_object`: practice item on a plain thing at the easy tier (three states named; mystery clues that point at the state, e.g. "it feels wet") | simplify | both | new id, same kind, no lesson object or drawn model, no state/shape/flow word in name or clues (`practiceLeaks`) |
| property | `plain_object`: practice item on a plain thing, two options (its answer and the far one) | simplify | both | same, plus the two-option menu holds the answer |
| change | `two_changes`: one model change that can go back and one that cannot, each tagged with why | help | both | one of each kind, never the item's own change, no lesson object (`changesLeak`) |
| change | none (simplify) | — | — | one premise and two options is the plainest shape |

Per item: on a sort item that is already a plain thing at the easy tier (rock, water, air in the saved sort payload) no simplify exists; `three_models` answers both its misses. Every checked miss on all 16 saved items, at every tier, has a help lever (unit-tested, J12 shape). `does` texts fence the tutor: never say which model the learner's object or change is like. Starting positions: unchanged (the existing spoken rule/menu tier); no picture lever starts pulled, so every K-1 item keeps a pullable lever.

## Built

- `chemistry/matterExplorerLevers.ts` (new): pools, `modelsFor`, `changesFor`, `practiceItem`, `practiceParent`, leak rules, `leversOnScreen`, `matterLevers`.
- `MatterExplorer.tsx`: lever state + practice state, `ModelCups` / `ModelChanges` panels, `pullLever` / `endPractice`, practice label; retry keeps the practice item.
- `matterExplorerScript.ts`: optional `menu` on a property practice item; `propertyMenuClause`.
- `matterExplorerWorkspace.ts`: property misses `other_shape`, `state_word`.
- Catalog: `levers: true`, property misses. Journey row rebuilds `~simpler` from its parent.
- New payloads: `w1-payloads/matter-explorer.property.json`, `matter-explorer.mystery.json` (one generation each).

## Tests

- `matterExplorerLevers.test.ts` (159): per item × tier on all four payloads, coverage, leak rules, practice builder; pools; `nextLever` table.
- `MatterExplorer.levers.workspace.test.tsx` (5): pull changes screen and fact in one commit; next attempt records the lever; refused pull leaves html/levers/attempts unchanged; practice opens, retries on itself, full item returns blank and is credited; property practice asks two options; change has no simplify.
- Existing matter tests, `chemistrySpokenMisses.test.ts` (+2 rows), DI script test, catalog `misses.test.ts`: pass. `typecheck:lumina`: 0 errors in my files (1 sibling error in the solar-system-explorer journey row).

Not run: journey sweep, tutor replay, Live (batch step).
