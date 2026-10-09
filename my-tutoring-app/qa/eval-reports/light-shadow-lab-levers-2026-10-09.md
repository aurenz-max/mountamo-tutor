# light-shadow-lab levers, all modes (2026-10-09)

`/add-support-tiers` on observe, predict, measure and apply, right after the W1 binding
(`qa/tutor-reports/light-shadow-lab-w1-2026-10-09.md`). Non-interactive batch run: the lever table was built without a
review stop.

## Failure inventory

- **Real-learner evidence:** none (no demonstrations, misconception or remediation files name this primitive).
- **Documented:** the catalog's `commonStruggles`: the shadow drawn toward the sun; length not linked to the sun's
  height; east/west labels confused (its scripted text also had east on the right, the opposite of the picture: fixed).
- **Synthetic:** the journey's wrong answers (`toward_sun`, `side_when_overhead`, `mirror_time`, `wrong_height`).
- **Evidence corrupted, fixed first:** the drawn shadow scaled with the object's generated height, so a tall pole at
  noon drew a medium-looking shadow for a "short" key. The object is now drawn at a fixed height, so the drawn length
  falls in the key's own altitude bins.

| Mode | Misses (class) |
|---|---|
| observe, predict, measure | toward_sun (documented + synthetic), side_when_overhead (synthetic), below_when_side (inferred), length_flipped (documented), length_off, both_wrong (inferred) |
| apply | mirror_time (synthetic), wrong_height (synthetic), other_time (inferred) |

## Lever table (built)

Every lever is a drawing with no words (carrier: shown), for K-2 pre-readers.

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| all | `side_model`: three pictures, sun left / overhead / right with its shadow | help | toward_sun, side_when_overhead, below_when_side, both_wrong; apply mirror_time, other_time | Fixed `SIDE_MODEL`; every side once, so it favours none; reads nothing from the item. |
| all | `height_model`: a low and a high sun, both on the left, long and short shadow | help | length_flipped, length_off, both_wrong; apply wrong_height, other_time | Fixed `HEIGHT_MODEL`; a true model of the rule. |
| observe, measure | `shadow_zones`: ground marks at the short/medium and medium/long edges, both sides | help | length_off, length_flipped | Same on both sides, no words; not offered where no shadow is drawn (predict) or where the shadow is the given (apply). |
| observe, predict, measure | `easy_sun`: an obvious sun, two choices | simplify | all six | `practiceLeaks`: obvious sun, a shadow unlike the item's, neither choice the item's answer, not the item. |
| apply | `easy_shadow`: a very long or very short shadow, two times | simplify | all three | Same rule, on times. |

Starting positions (Phase 6): the easy tier sets `startLevers` per challenge (observe/measure `shadow_zones`,
predict/apply both models), replacing the easy tier's live readout, which printed the answer's words. Drawn and declared
pulled; not recorded as help. Checked on a generated easy K observe payload (`light-shadow-lab.observe-easy.json`).

**Considered and rejected:** a time path with the choices' times marked on apply (it puts the key's time on screen a
second time and does the sun-to-time step for the learner); light rays from the sun through the object's top (on
predict that draws where the shadow ends).

## What was built

- `lightShadowLevers.ts`: declarations, `practiceItem` / `practiceParent` / `practiceLeaks`, `leverFacts`.
- `LightShadowLab.tsx`: lever state keyed by item; practice item in place of the session item with a "Practice"
  marker; `pullLever` / `endPractice`; the `onScreen` fact; the model pictures and ground marks; fixed object height.
- `lightShadowWorkspace.ts`: a practice item's own `choices`; `PRACTICE_SUNS`.
- Generator: `startLevers` at easy. Catalog: `levers: true`. Journey row rebuilds `~easier` items. Contract R5.

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| full `tsc` | 770 (baseline) |
| `lightShadowLevers.test.ts` | 17/17 (builder over 1,000+ suns across 4 modes, leak rules, miss → lever, J9/J12 on generated and saved items) |
| `LightShadowLab.levers.workspace.test.tsx` + `.workspace` | 4/4 + 9/9 |
| journeySweep + workspaceContract + misses + astronomy + Pip surface | 3375 passed. light-shadow-lab: 0 findings on 5 payloads (J1-J13); misses 19/19 named; J10 clean 100; J11 recover 67; every miss answered by an item lever |
| tutor replay (gemini-3.8-flash, 4 payloads x 5 samples) | 0 code misses on every check, `stuck no_change_before_receipt` 0/20. Read by hand: the tutor pulls `side_model` on "I'm stuck" (19/20; 2 also tried the simplify lever first) and describes only the pictures, then asks "if the sun is on the left, does the shadow point left or right?". No reply names the item's answer. Saved: `qa/tutor-reports/replay/light-shadow-lab-2026-10-09-r4.json` |

## Failures with no lever

None. Real-learner evidence is still zero; `below_when_side`, `length_off`, `both_wrong` and `other_time` are inferred.
