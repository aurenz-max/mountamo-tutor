# telescope-simulator levers and eval-test, 2026-10-16

Built with the W1 binding (`../tutor-reports/telescope-simulator-w1-2026-10-16.md`). Code: `telescopeLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
No real-learner evidence: no demonstrations, misconception, remediation or tutoring-block files existed for this id
(the old entry had no tutoring block). All failures are inferred from the tasks; the misses are what the check sees.

| Mode | Failure (class) | Miss |
|---|---|---|
| find_by_look | picks a look-alike that lacks one clue (inferred) | `near_match` |
| find_by_look | holds one clue and drops the others (inferred) | `shares_clue`, `other_object` |
| brightest | takes the biggest for the brightest (inferred; the hard tier is built on it) | `picked_biggest` |
| brightest | misjudges two close brightnesses (inferred) | `picked_dimmer` |
| object_type | star vs planet vs moon; nebula vs galaxy vs cluster (inferred) | `sharp_mixup`, `fuzzy_mixup` |
| object_type | sharp-edged vs fuzzy (inferred) | `other_family` |
| pick_instrument | picks too weak, or reads "least powerful" as "most" (inferred) | `too_weak`, `too_strong` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| find_by_look | `closer_look` | help | the whole view through the next instrument | offered only when the ask still matches one object there (`closerOk`) |
| find_by_look | `clue_pictures` | help | a card: one model picture per clue in the ask | models only, the ask's clues only, no object or position |
| brightest | `same_size` | help (sizes differ) | every object a same-size dot, brightness kept | no order, no mark |
| brightest | `side_by_side` | help | the objects in a row under the view, same size | left-to-right sky order, never sorted by brightness |
| object_type | `closer_look` | help | the object through the next instrument | names nothing |
| object_type | `type_pictures` | help | a model picture of each offered kind, captioned | generic models, none is the object |
| pick_instrument | `ladder` | help | the five instruments, least to most powerful, with magnification | names no object or detail |
| pick_instrument | `my_pick_view` | help (after a tapped miss) | the object through the learner's own last pick, and whether the detail shows | the learner's pick only |
| all | `drop_one` | simplify, on the item | greys out the farthest wrong object or choice | at least two untried options remain |

Every miss an item can show is answered by a help lever first (tested over every tier, 5 seeds per mode). No practice
items: the simplify lever acts on the item (user ruling 09-27).

## Measured
- Workspace test: each lever changes the screen and the scene fact in one commit; the next attempt records it
  (`assisted`, `levers`); `drop_one` greys an object that then takes no tap; `my_pick_view` follows the last pick.
- Sweep J9, J12, J13: 0 findings. Replay: lever and stuck replies describe each card by what it shows (r2).

## Eval-test (`/api/lumina/eval-test`, topic "Observing the night sky with telescopes", 4 items each)
Content checked by code with the live modules (`telescopeItems`, keys, harness answers, name and kind leaks, every miss
answered); rendering by the browser drive in the W1 report.

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| find_by_look | PASS: 3 objects, no shared clue | PASS: 4, one same shape | PASS: 4, a look-alike missing one clue |
| brightest | PASS: 2 dots, gap ≥ 0.35 | PASS: 3 dots, gap ≥ 0.2 | PASS: 4, a big faint patch is the biggest |
| object_type | PASS: 2 kinds, other family | PASS: 3 kinds | PASS: 4 kinds incl. both look-alikes, binoculars |
| pick_instrument | PASS: 2 instruments | PASS: 3 | PASS: 4 |

Fixed during the sweep: the Moon was not tagged "shines steadily" although drawn without twinkling, so "a ball that
shines steadily" matched two drawn objects; colours a child cannot tell apart were separate clues; the overview
followed an unrelated topic ("practice counting") and now describes only the telescope task.
Checked and kept: pick_instrument's key position. Over the detail table the key is the middle choice of three 44% of
the time (chance 33%), strongest 30%, weakest 26%; no one-position strategy beats chance by much.

## Failures without a lever
None. `my_pick_view` is absent after a spoken miss (no tapped pick to show); `ladder` answers both misses there.
