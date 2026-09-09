# Birth Certificate — measure-lab (2026-09-09)

**Lifecycle layer: L0 born + L1 eval-dense in the same push** — the atlas item this
serves (`measure-sim-weight-capacity`) names four K rows, and one core mode would
have closed one of them. The four modes shipped together; the catalog `evalModes`
and the backend β priors are registered.

- Core task identity: `balance_predict` (the other three are the same simulation asked differently)
- Generator fork: **A (pool service)** — one Gemini call returns VOCABULARY ONLY (8 objects
  with emoji, 6 container names, the pouring unit, the wording). Every weight, capacity,
  count, option set and answer key is built in code afterwards, so the model is never told
  a number it could recite.
- sendText tags wired: `[ACTIVITY_START]`, `[NEXT_ITEM]`, `[ANSWER_CORRECT]`, `[ANSWER_INCORRECT]`, `[ALL_COMPLETE]`
- Answer-leak audit: weights and capacities are never rendered — the beam's tip and the
  water level are the only evidence. The tutor context block carries names and the unit,
  never a quantity. The oracle refuses a `pour_count` prompt that states its own count.
  Verified in Chrome: no weight appears anywhere on the bench.
- Curriculum home: routes from the four published K rows the atlas item lists
  (MEAS001-04-D balance predict, MEAS001-08-D container predict, MEAS001-08-F non-standard
  units, MEAS001-08-C order by amount). Catalog description names all four tasks.

## Design gate

1. **Direct manipulation** — pass: the child taps an object to put it ON the pan and taps a
   cup to POUR it; the beam and the water level move because of that touch. No "simulate" button.
2. **Living simulation** — pass: `tiltFor(leftW, rightW)` and the fill fraction are component
   physics; Gemini supplies only names and wording.
3. **Production over recognition** — partial: `pour_count` and `order_capacity` are produced
   (the child measures, the child orders); the two predict modes are a committed two-choice
   prediction followed by a physical test. The prediction is the pedagogy (predict-then-test),
   so a menu of two is the task rather than a weaker form of it.
4. **No visible timers** — pass: nothing is timed; the only delay is the 900ms the beam takes
   to settle before the verdict.
5. **No answer-leak by layout** — pass: container SHAPE is drawn from `shape`, never from
   capacity, and the builder alternates whether the taller container is the bigger one, so
   "tall means more" fails half the time by construction.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 errors |
| Live generator probe (`scripts/probe-measure-lab-birth.mjs`, 2 draws × 4 modes) | 8/8 clean through the shipped oracle |
| Headless Chrome drive (all four modes, right and wrong answers) | 15/15 checks, twice |

Findings the probes caught, all fixed:

- **The answer sat in a guessable place.** The heavier object landed on the same side five
  times out of five, and the bigger container on the same side three times out of four —
  each drawn independently per challenge. Both are now alternated by index; capacity also
  alternates whether the taller one wins, on a different period, so neither "always tap the
  left one" nor "taller means more" scores.
- **A repeated card.** `order_capacity` drew each jar's level independently from eight
  possible triples, so a four-challenge session repeated one about half the time. The triple
  is now drawn by index.
- **A verdict a re-render could cancel.** The balance's settling delay was a `setTimeout`
  inside a `useEffect` whose deps include `submit` — rebuilt on every tutor re-render. Not
  observed failing in Chrome, but the timer now lives in a ref where nothing else reaches it.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | ~~`/add-eval-modes`~~ | L1 | **DONE in this push** — 4 modes, β 1.2/1.6/2.0/2.2, backend registry matched |
| 2 | `/add-tutoring-scaffold` | L2 tutored | contextKeys candidates: `challengeType`, `currentPrompt`, `objects`, `containers`, `unitName`, `attemptNumber`. The block must forbid naming which is heavier / holds more — the whole primitive is predict-then-test. Struggles seen: predicting by SIZE rather than weight; expecting the taller container to hold more. |
| 3 | `/add-support-tiers` | L3 tiered | Scaffolding intrinsic to the interaction that could withdraw: the `N cups` badge under a filled container (easy only); the number of jars in `order_capacity` (3 → 4); whether `pour_count` shows the cups already used as greyed-out (a tally the child can re-count). |
| 4 | `/add-structural-difficulty` | L4 shaped | (requires L3) Candidate levers: the weight GAP on the balance (obvious → one step apart, which the beam still shows); how close the two capacities are; whether the shapes differ a little or a lot. |
| 5 | `/add-sound` | L5 polished | Candidate points: the pan settling, a cup pouring, the jar reaching full. |
| ✓ | `/eval-test measure-lab` | QA loop | Run after each layer. `/oracle-test measure-lab` is CI-able today — the oracle re-derives the physics rather than trusting the key. |

Not built and not owed at birth: a spoken mode. The four tasks are tap/manipulate by
design; a spoken "which is heavier" would be `/add-di-loop` territory and is not queued
until a K row asks for it.
