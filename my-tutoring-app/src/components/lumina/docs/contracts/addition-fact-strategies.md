# Contract: addition-fact-strategies

- **Derived:** 2026-10-03, from the build slices that day (eval modes, curriculum fit, workspace W1, levers).
- **Component:** `src/components/lumina/primitives/visual-primitives/math/AdditionFactStrategies.tsx` · **Generator:** `src/components/lumina/service/math/gemini-addition-fact-strategies.ts` · **Domain:** `additionFactStrategiesWorkspace.ts`, `additionFactStrategiesLevers.ts`, `additionFactPools.ts` · **Live wiring:** `additionFactStrategies.card.ts` + `additionFactStrategies.boss.ts` (spoken preset, SAY_OR_SHOW)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G2 OPS002-04-a, fact fluency within 20 (direct); G1 OPS001-09-a, PTRN001-05-a/-c (partial) | curriculum fit | `qa/curriculum-fit/addition-fact-strategies-2026-10-03.md` | 2026-10-03 |
| G1 OPS001-01-c, sums up to 10 (partial; the sum window) | objective number window | same report, fixed draws 20/20 | 2026-10-03 |
| Six eval modes (plus_zero ... big_facts), IRT priors | catalog + backend registry | `scripts/addition-fact-strategies-modes-probe.mjs` 11/11; eval-test route 6/6 | 2026-10-03 |
| Live tutor / JEV teaching workspace, every mode | W1 binding + levers | `qa/tutor-reports/addition-fact-strategies-workspace-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — one strategy family per session; a fact's `type` is that family
- The root `strategy` is the session's family; every challenge's `type` equals it, so it matches the mode's catalog `challengeTypes`. The boss's `validate` rejects a session where it does not (the lever set reads a fact's mode from its `type`). Probe: eval-test route, typesFound per mode; `boss.test.ts` over the saved payloads.

### R2 — no unearned credit; the answer never reaches the screen or the scene before the child answers (re-based 2026-10-13)
- The slot shows "?" until solved; the pad is always 0-18. A tap is checked by `additionFactMatches` through `commitCheck`. The sum may also be said aloud: every item is a SAY_OR_SHOW spoken item (`additionFactKey`: the number word, its digits, and the signature error), the ask is the fact only (`given` = its addends; `askLeaks` over every saved payload), and JEV credits only from the tutor's feedback against the key. The scene facts never carry the sum; the worked example (first fact only) is a different fact and is named to the tutor by its addends only. Probe: `AdditionFactStrategies.workspace.test.tsx`, `scripts/tutor-verdict-probe.mjs --addfacts`.

### R3 — the sum window is the objective's
- A lesson that names a sum ceiling ("sums up to 10") gets only facts under it and only families that can fill a session under it; a pinned family with nothing under the window keeps its full sums. Probe: generator tests; fit probe draws.

### R4 — levers (`additionFactStrategiesLevers.ts`)
- **Leak rules (`leverNumbers`, unit-tested over every fact of every family):** `count_groups` prints no number but the child's own taps; `hop_strip` prints the start and each hop only once tapped, in order; `near_double` prints the double's addend, never its total or the fact's; `known_fact` prints the flipped fact with its total (the turn-around itself) and the attempt is recorded assisted.
- **One lever set** (`ADDITION_FACT_LEVERS`, `bossLevers.ts`): kinds, answers, carrier (`shown`) and order are those of the old switch (`additionFactStrategiesLevers.test.ts` "the lever set").
- **Assistance record:** a runtime pull lands on the next attempt (`levers`, `assisted`); easy's starting `count_groups` is not a pull.
- **Simplify mode floor:** `smaller_fact` stays in the session's family, has a smaller total, is never a session fact in either order, is ungraded, and returns to the full item.
- **No make-ten lever** (user-approved table, 2026-10-03).

### R5 — a tier draws harder facts only where the family has structure (item space, 2026-10-14)
- With `config.difficulty`, facts_mixed (big_facts), turnaround and facts_3_4 rank their facts by the add-sub-20 space's beta and each tier draws from its `tierWindow` (easy: sums inside ten; hard: sums that cross ten with larger addends). Each fact carries `itemSpace` {space, structure, beta}, never rendered or sent to the tutor. plus_zero, plus_one, plus_two, doubles, facts_5_6 and facts_7_8 are one structure each and keep the full pool at every tier. The lesson's sum window (R3) bounds the tier window. Probe: `service/math/additionFactItemSpace.test.ts`, `scripts/difficulty-lab/tier-probe.mjs --component addition-fact-strategies`.

## History
- 2026-10-03 — derived. Workspace-only from this date (comebacks and scripted cues removed; see the W1 report).
- 2026-10-13 — R2 re-based. "No key reaches the tutor" protected no unearned credit; a sum said aloud was never credited because every item was gesture-only. Every fact is now a spoken item that also takes the tap (`TeachingItem.acceptsGesture`); JEV verdict probe 21/21, false credit 0.
- 2026-10-14 — R5 added. Every tier of big_facts drew the same random mix (5 + 3 beside 9 + 8); the tier now picks the window of facts by predicted beta.
- 2026-10-19 — moved onto the boss framework (card + boss, spoken preset, every mode SAY_OR_SHOW). Requirements kept; R2 re-based from the hand-built `expectedAnswer` onto the spoken key, R4 onto the lever set. Catalog `tutoring` block and guidance prose deleted; the family's never-say rules live in the scene's `constraints`. The two `addend` spoken misses merged into one entry (journey J8: one id per item).
