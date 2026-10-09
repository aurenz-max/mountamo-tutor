# states-of-matter: support levers (2026-10-08 class sweep)

`/add-support-tiers` on observe, predict, compare. The lever table was not stopped for confirmation (user waived it for this sweep).

## Failure inventory

No real-learner evidence. There are no demonstration logs, misconception reports, eval reports or remediation module for this primitive. The DI script's corrections and the catalog `commonStruggles` are the documented sources, and `statesSpokenMisses` already named each mode's checked misses.

| Mode | Miss (checked) | Evidence |
|---|---|---|
| observe | `other_state`, `said_substance_back` | documented (commonStruggles "says the substance's name"), synthetic (journey plain wrong) |
| predict (state) | `said_start_state`, `other_state` | documented ("names the state it is in now") |
| predict (change) | `said_end_state`, `opposite_change` | documented ("answers a change question with a state word") |
| compare | `other_of_pair` | documented ("reads the comparison backwards") |

## Lever table

| Mode | Lever | Kind | Carrier | Leak rule (code) | Per-item gap |
|---|---|---|---|---|---|
| observe | `particle_models`: three model particle boxes in a colour no substance uses, one per state, tagged with how the particles move | help | both | one box per state; colour never one of the item substance's colours (`particleModelsLeak`) | none |
| observe | `three_named`: practice item on another (everyday first) substance, ask names "solid, liquid, or gas?" | simplify | both | new id, other substance, easy tier (`practiceLeaks`) | none on an item already asked at the easy tier (the menu is already named) |
| predict | `temperature_strip`: melting/boiling points marked, zones labelled (change items: each crossing labelled with its up/down change names), "now" pointer at the start temperature | help | both | no mark or pointer at the target temperature; every zone/crossing labelled, none singled out (`stripLeaks`) | none |
| predict | `one_point`: same question (same kind, same direction) on a substance that does not boil | simplify | both | other substance, no boiling point (`practiceLeaks`) | none when the item's substance already has one point (chocolate, butter, coconut oil) |
| compare | `model_pair`: two other substances heated to one temperature between their melting points, tagged "melts at N: melted / still solid" | help | both | neither model is in the item's pair; exactly one model melted (`modelPairLeaks`) | none on any saved item |
| compare | `far_pair`: which-melts-first practice on a pair at least 25 degrees apart (and twice the item's gap) | simplify | both | other substances, melt_first, gap >= 25 | none when no such pair is left in the band (K-2 chocolate/wax) |

Every model lever's `does` text fences the tutor: never say which box/zone/model the learner's item is like, never put the learner's two numbers beside the model's.

Every checked miss has a help lever on every item of every saved payload at every tier, so the catalog `unanswered` list stays empty. Simplify reach on the saved payloads: observe 6/6 (medium), predict 4/6, compare 1/2.

## What was built

- `statesOfMatterLevers.ts`: lever declarations, leak rules, builders (practice items built through `itemFromChallenge`, so every build gate applies), `leversOnScreen` scene fact.
- `StatesOfMatter.tsx`: lever state and practice item (matter-explorer pattern), three lever panels, practice banner; scene publishes `levers`, `pullLever`, `endPractice`, `onScreen`/`practice` facts.
- Catalog `teachingWorkspace.levers: true`; `liveJourneySpec.ts` row rebuilds a `~simpler` item from its parent.
- New payload `w1-payloads/states-of-matter.compare.json` (one generation, K-2).
- Not done: tier starting positions (Phase 6). The existing tier already sets the spoken rule and the observe menu; no lever starts pulled. No contract doc exists for this primitive.

## Tests

- `statesOfMatterLevers.test.ts` 145 pass (per item miss coverage, leak rules, builders over a spread of items, simplify reach on saved payloads, miss -> `nextLever`).
- `StatesOfMatter.levers.workspace.test.tsx` 6 pass (pull changes screen + fact in one commit, attempt records the lever, refused pull changes nothing, practice item then full item blank and credited).
- Existing: workspace, di-script, spoken misses, grade band, catalog misses 154 pass; `workspaceContract -t states-of-matter` 13 pass.
- `typecheck:lumina` 0.
- Not run: journey sweep, tutor replay, Live (batch step).
