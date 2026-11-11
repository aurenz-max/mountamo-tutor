# Contract: measure-lab

- **Derived:** 2026-10-09 (W1 workspace binding; no earlier contract)
- **Component:** `primitives/visual-primitives/math/MeasureLab.tsx` · **Boss:** `measureLab.card.ts` +
  `measureLab.boss.ts` (bespoke) · **Domain:** `measureLabWorkspace.ts` · **Levers:** `measureLabLevers.ts` ·
  **Generator:** `service/math/gemini-measure-lab.ts` · **Oracle:** `service/qa/oracles/measure-lab.ts` ·
  **Catalog:** `service/manifest/catalog/math.ts` (`measure-lab`)
- **Modes:** `fill_level` · `balance_predict` · `capacity_predict` · `pour_count` · `order_capacity` (K.MD.A.1, K.MD.A.2, MEAS001-08)

## Requirements

### R1 — no quantity is ever printed · OBSERVED
- **Property:** weights, capacities and fill amounts are code-owned and never rendered; the beam's tip and the water
  level are the only evidence. The scene facts carry none of them before the test runs.
- **Probe:** `MeasureLab.workspace.test.tsx` (no digit in the facts before a try, every mode).

### R2 — the prediction is the score · OBSERVED
- **Property:** balance and capacity take a guess first; the test (both on the scale, or Pour) runs only after it, and
  the check grades the guess, after a 900 ms settle owned by `verdictTimerRef`.
- **Probe:** `MeasureLab.workspace.test.tsx` (no verdict until the beam settles).

### R3 — shared teaching workspace (W1, plain shape) · OBSERVED (NEW 2026-10-09)
- **Property:** taught only on the workspace (`withWorkspaceOnly`). `measureLabBoss.assignment` gives the prompt as
  the task, gesture response, no key, no `expectedAnswer`. Each verdict commits through `progress.commitCheck` with `measureMiss`
  (`picked_lighter`; `tall_means_more`, `picked_less`; `one_short`, `one_over`, `too_few`, `too_many`;
  `most_to_least`, `two_swapped`, `out_of_order`). Try again clears the bench (guess, pans, pours, taps). The scene
  states what the test showed only once it has run (`scale`, `afterPouring`); the pour count is never stated.
  Next is hidden, input is closed while a checked answer waits, the legacy AI hook is off.
- **Probe:** `MeasureLab.workspace.test.tsx`; journey sweep on `w1-payloads/measure-lab.*.json` (17/17 misses named);
  tutor replay `qa/tutor-reports/replay/measure-lab-2026-10-09.json`.

### R4 — in-item levers, every mode · OBSERVED (NEW 2026-10-09)
- **Property:** `MEASURE_LEVERS` (one lever set, `measureLabLevers.ts`) declares levers per item, all drawn. balance: `down_model`
  (a fixed model balance, three blocks against one; never the item's objects; when it comes is the item's
  `supportTier`, stamped by the generator, medium when absent), `far_pair` (practice: a feather and a
  brick, neither of the item's objects). capacity: `cup_lines` (shelves under both containers, empty until the test
  has filled both, then one cup picture per cup taken), `easy_pair` (practice: two shapes, the one drawn much larger
  holds more; `MeasureContainer.scale`). pour_count: `poured_shelf` (one cup picture per cup poured, no number),
  `smaller_pour` (practice: a three-cup container; none when the item takes three). order: `order_steps` (fixed
  wordless bars, least first), `level_lines` (the same seven even lines on every jar), `far_levels` (practice: levels
  1/4/8 drawn out of order; only when two of the item's levels are under three apart). Leak rules in code
  (`farPairLeaks`, `easyPairLeaks`, `smallerPourLeaks`, `farLevelsLeaks`, `shelfCups`); no lever text or fact
  carries a digit or an item name. Practice items are `<id>~smaller`, ungraded; Try again keeps them; the full item
  comes back blank. Types: `down_model` model, `cup_lines`/`poured_shelf` layout, `order_steps` legend,
  `level_lines` marks, the four practice items easier.
- **Probe:** `measureLabLevers.test.ts`, `MeasureLab.levers.workspace.test.tsx`, journey sweep J9/J12.

### R5 — fill_level: the drawn water is the only evidence, said or tapped · OBSERVED (NEW 2026-11-11)
- **Property:** fill_level (MEAS001-08-A, MEAS001-08-B) is a look-and-say task: even items are one container, empty
  (level 0) or full (level = capacity), with Empty and Full buttons; odd items are two IDENTICAL containers (same
  shape and capacity, named `left <noun>` / `right <noun>`) with different amounts, asked "more" and "less" in turn.
  Code sets every level and key (`buildFillLevel`); `fillLevelKey` re-derives the key from the levels and the boss
  refuses one that disagrees. Tells defeated: which of empty and full is the answer alternates from a random start;
  the answer's side alternates by item; the ask word alternates, so "tap the fuller one" fails half the time. No label,
  badge or default selection marks a container; the scene states no level or amount. The tier sets the gap between
  the two levels in eighths (easy 5, medium 3, hard 2). SAY_OR_SHOW (voice beside the tap, J14): the spoken ask names
  both containers (`measureAsk`), the key is a menu (`measureKey`), misses `mixed_empty_full`, `picked_opposite`.
  measure-lab is on the spoken preset since this change; every other mode keeps no key (R3). Levers: `fill_words`
  (meaning, fixed model containers tagged empty, full, more, less), `level_lines` (marks), `far_fill` (simplify,
  levels one and seven eighths apart, the same ask, only when the item's levels are under five apart).
- **Note:** the K row asks the child to judge by looking, so the levels are drawn; reading them is the skill, not a
  leak. The leaks guarded are labels, badges, default state, position and the ask word.
- **Demanded by:** qa/curriculum-coverage/math-k/REPORT.md "Modes to add" (MEAS001-08-A, MEAS001-08-B).
- **Evidence:** `measureLabFillLevel.test.ts` 2 (30 mocked generations: keys, tier gaps, alternation; check, miss,
  scene, levers, practice); `MeasureLab.workspace.test.tsx` fill_level cases; sweep on
  `w1-payloads/measure-lab.fill_level.json` (eval-test route generation 2026-11-11, medium).
- **Probe:** `measureLabFillLevel.test.ts`; `journeySweep -t measure-lab.fill_level`.

## Gaps

### G1 — vocabulary does not fit the drawn shape · OPEN
- **Shortfall:** the generator draws the shape by index, so a "big bowl" can render tall and narrow, and a
  "cooking pot" tall beside a "coffee mug" drawn wide (2026-10-09 payloads). The capacity compare reads the shape.
- **Path:** generator picks the name per shape → `/eval-fix`.

### G2 — weights ignore what the objects are · OPEN (2026-10-09)
- **Shortfall:** `buildBalance` assigns random weights to the vocabulary objects, so a saved payload has the sock
  heavier than the rock and the feather 5 against a book 8 by chance only. A child who knows a rock is heavy is
  marked `picked_lighter`, and the scale then shows a false fact. The miss is not evidence of a misconception on
  those items.
- **Path:** the vocabulary call ranks the objects (or tags each light/heavy) and code pairs far-apart ranks →
  `/eval-fix`, then `/oracle-test` adds the check.

## Changelog

- 2026-11-11 — R5 (`fill_level`, β 1.0). The boss moves to the spoken preset (`spokenBoss`, `SPOKEN_AUDIO`) so
  fill_level can be said; R3 re-based: every other mode still publishes no key. The card's words were shortened to
  keep the family guidance under OFFER_GUIDANCE_MAX. The vocabulary prompt names the fill task (a "Weighing Table"
  title came back on a fill lesson). The oracle (`service/qa/oracles/measure-lab.ts`) does not cover fill_level yet.

- 2026-10-20 — moved onto a boss (wave 3): `measureLab.card.ts` + `measureLab.boss.ts` replace
  `adapters/measureLabLive.ts` and the catalog guidance; one lever set; scripted path, legacy cues and hand-wired Pip
  deleted (`pip/measureLabPipPose.ts`, `pip/MeasureLab.surface.test.tsx`); generator stamps `supportTier`.

- 2026-10-09 — R4 levers on every mode (`/add-support-tiers`). G2 filed.

- 2026-10-09 — derived with the W1 binding. Scripted path gains a Try again after a wrong guess on the prediction
  modes (it was a dead end: no control after the test ran). The capacity pour's timer moved onto the balance's ref.
