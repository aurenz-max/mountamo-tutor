# gravity-drop-tower levers, 2026-10-15

Code: `primitives/visual-primitives/physics/gravityDropLevers.ts`. The catalog sets `teachingWorkspace.levers: true`.

**Evidence.** There is no real-learner evidence (no demonstration logs, misconception reports or remediation file for this id). The misses are what `dropMiss` sees on a tap or an order. The failures behind them come from the catalog's old commonStruggles: heavier falls faster, air and no-air results mixed up, height not connected to fall time, and trouble with h = ½gt².

**Starting position.** Every lever starts released. `config.difficulty` changes the items, not the levers (the gas-laws precedent): easy items are already the supported shape, for example the contrast pairs in predict and the same object three times in compare.

| Mode | Lever | Kind | What changes on screen | Answers | Leak rule |
|---|---|---|---|---|---|
| observe | `slow_replay` | help | Replays the drop at ¼ speed with a dashed line joining the two objects (or ghost pictures at equal moments on the "sped up?" item). Counts as watching. | all observe misses | states nothing; the scene fact describes the replay only |
| predict | `air_arrows` (air items) | help | An arrow on each object for how hard air pushes back for its weight (long, short or tiny) | ignored_air, slowed_first, heavier_reason | never "first", "together", "faster" |
| predict | `moon_card` | help | A card about a different drop: the Apollo 15 hammer and feather on the Moon | heavier_first, lighter_first, shape_first, air_when_none (and heavier_reason on air items) | never names this item's objects |
| predict | `outcome_only` (reason items) | simplify | The same pair and air, asking only which lands first; ungraded; the full item comes back | all predict misses | a different key label from the full item |
| compare | `air_arrows` (air items) | help | As above | ignored_air, ranked_by_mass | does not order them |
| compare | `same_look` (no air, different masses) | help | All three drawn as the same grey ball, masses hidden, heights kept | ranked_by_mass | does not order them |
| compare | `fall_lines` | help | A bar beside each column from its platform to the ground, with its length | reversed, other_order, ranked_by_mass, ignored_air | does not order them |
| compare | `two_drops` | simplify | The two drops closest in landing time, to order first | all compare misses | never the learner's own item |
| measure | `pattern_line` | help | Under the table: "From 5 m to 20 m the height is 4 times as much, and the time is 2 times as much." | all measure misses | never the asked row's value |
| measure | `one_row` | simplify | One measured row, asking the 4x height (or the height for twice the time) | all measure misses | its key is never the full item's key |
| calculate | `formula_card` | help | h = ½gt² turned round for the asked quantity, in symbols | all calculate misses | no number |
| calculate | `fill_in` | help | The item's numbers in that formula, with no result | forgot_half, no_root, not_squared, gave_time | never the key with its unit, never "= key" |
| calculate | `time_first` (impact items) | simplify | The same height, asking only for the fall time | all calculate misses | a different key |

Tests (`GravityDropTower.workspace.test.tsx`): every miss that any built item can show has a help lever chosen first by `nextLever`. No lever text states the key or the landing outcome, across 3 tiers x 3 seeds per mode. Each simplify builder gives an item in the same mode with a different key, which never shrinks twice and carries no levers. Each mode's mounted test pulls a lever and checks that the screen and the scene fact change in one commit.

**Holes.** observe has no simplify lever: watching is the task, and a simpler watch would be a different mode. predict easy and medium have no simplify either, because each item is already one choice between two objects. calculate easy and medium have none, because the only simpler numbers (t = 1 s) make two choices equal.

**Replay.** Every lever except `same_look` was pulled across the 5 payloads (`replay/gravity-drop-tower-2026-10-15-r3.json`). The compare payload is hard, with air, so it has no `same_look`; the mounted test pulls it. The lever notes in the replay show no reply that turns a card into the conclusion, except the Moon card's own last line, which tutors read aloud (open finding in the W1 report).
