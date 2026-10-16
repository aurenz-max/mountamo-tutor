# ph-explorer W1 binding (ROLLOUT C26), 2026-10-15

**Shape P, three modes, all bound** (test, indicator, neutralize). Not committed.

## What changed, and why
The old component ran generator-written challenges with free-text answers checked by `answer.includes(target)` against
a Gemini key, and its screen gave the answers away: every substance card had a dot in its universal-indicator colour,
a tested card printed "pH 2 · Acid", the scale marked each tested substance at its pH, the description and the
real-world lines said "acid", and a sort challenge was credited as correct whether or not the sort was right. The
catalog's `indicator` mode named a challenge type the generator never produced, and the generator ignored the eval
mode. None of that could be bound as it stood, so the primitive was rebuilt around items code builds and keys from the
substances' pH values (`phExplorerWorkspace.ts`):

- **test**: a named substance, a blue and a red litmus paper, "Dip the litmus papers", then Acid / Base / Neutral.
  Names that say acid or base, and substances litmus reads weakly (pH 6-6.75, 7.25-8), are not asked.
- **indicator**: an unnamed sample in red cabbage juice; choose one of six pH ranges. No scale is drawn beside the
  tube (its colours are not cabbage colours). Samples within 0.25 of a colour edge are not asked.
- **neutralize**: 1 cup of a strong acid and a strong base, each at a stated pH; choose 1/100 to 100 cups of base.
  Key 10^(14 - acid pH - base pH), mixed result computed from the ions; bleach is never mixed.

The generator now writes only substances (name, pH, category, real-world line), stamps `challengeTypes` from the
eval-mode pin, and adds pure water when the model leaves it out. The real-world line and a test substance's pH show
only after credit. The component is on the Lumina kit; the indicator selector, rainbow, particle view and accordion
are gone (the catalog description is updated to match).

Every item is a sayable choice, so it is `speech` with `acceptsGesture` (J14): JEV judges speech against
`phExpectedAnswer`, the tap is checked by `phCorrect`. Misses (`phMiss`, the same ids as `phSpokenMisses`): test
`acid_base_swapped`, `said_neutral`, `missed_neutral`; indicator `other_side`, `next_band`, `far_band`; neutralize
`equal_amounts`, `too_little`, `too_much`. On the workspace path a wrong tap stays marked with no reveal until Try again
(which keeps the dipped papers); Next and the scripted messages are off. The scripted path keeps Next, two tries, then
the answer.

## Gates
- `typecheck:lumina`: 0 errors in ph-explorer files (2 others, in AtomBuilder and MixingAndDissolving tests, belong
  to the parallel sessions). Full `tsc` 772 = baseline 770 + those 2; none in ph-explorer files.
- `PhExplorer.workspace.test.tsx` 12/12. `live-activity` + `misses.test.ts` + ScienceWorkspaces Pip surface +
  chemistry grade-band: 4063 passed; one `lessonWorkspacePlan` failure during the run came from another session's
  mid-edit and passed on re-run (16/16).
- Payloads: `w1-payloads/ph-explorer.{test,indicator,neutralize}.json` from `save_payload.py` (test and indicator at
  Grade 5, neutralize at Grade 7). All three are real generations, not the fallback.
- Sweep: 0 findings J1-J14 on the three payloads; misses named 5/5, 4/4, 3/3; J10 100, J11 67. The advisories "scene
  facts contain the key" are the choice list (all choices are on screen).

## Replay (gemini-3.8-flash, 3 payloads x 5 samples, `--observe`)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| r1 (`replay/ph-explorer-2026-10-15.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| r2, pointing rules (`-r2.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |

Read by hand. r1 passed the checks but neutralize stuck and lever replies drew the conclusion from the step counts:
"Since both liquids are the same number of steps away from seven, how many cups..." (stuck 2/5, lever 4/5), which is
one step from "equal amounts". One test stuck reply pointed at the key card's answer row ("see what it says when red
paper turns blue"). Guidance now says never say which row or swatch matches, and never say the two liquids are equally
far from 7; ask the learner to compare. r2: every stuck reply pulls the mode's help lever itself and asks the learner to
compare or match; no reply names a range, an amount or a row. One neutralize miss reply said the red beaker means "still
acidic" (1/5): it names the meaning of a colour, a direction hint, not the key.

## Undriven modes
None.

## Open findings
- The spoken path was not exercised by the sweep (the row taps), so the spoken-miss probe has no requests. Next replay
  or `/eval-test` of this family: one spoken program per mode.
- No contract doc existed; the new requirements (code keys, no pH or real-world line before credit, no scale beside the
  cabbage tube, no bleach in a mix) are recorded only here. `/primitive-contract`.
- Needs a browser check on the workspace path: the papers after Dip, the tube colour, the mix colour and meter.
