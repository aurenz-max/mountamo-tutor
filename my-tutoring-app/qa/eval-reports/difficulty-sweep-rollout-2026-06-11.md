# Difficulty Sweep: rollout #1 (number-line, hundreds-chart, ordinal-line, number-sequencer) — 2026-06-11

Second wave of IRT within-mode difficulty after the ten-frame/counting-board
keystone. Same contract: mode = WHAT (pinned by pedagogy), difficulty = HOW HARD
within the mode's β band, computed code-side from `config.studentTheta` (2PL
inverted at P*=0.70 using the mode's catalog `discrimination`), every quantity
drawn from `modeRange ∩ scopeWindow ∩ difficultyBand` so scope/difficulty
violations are impossible by construction. All 4 generators verified via
`/api/lumina/eval-test?...&theta=`. Representative mode per primitive is β1.5,
a=1.8 → swept at θ 1.5 (LOW) / 2.0 (MID) / 2.5 (HIGH).

## Results

| Primitive | Mode | Architecture | Monotonic | Scope-wins | Null-θ no-op | Verdict |
|-----------|------|--------------|-----------|------------|--------------|---------|
| number-line | plot | pool-service (added cap) | ✅ | ✅ | ✅ | PASS |
| hundreds-chart | highlight_sequence | refactored-to-pool | ✅ | ✅ | ✅ | PASS |
| ordinal-line | identify | refactored-to-pool | ✅ | ✅ | ✅ | PASS |
| number-sequencer | count_from | refactored-to-pool | ✅ | ✅ (after fix) | ✅ | PASS |

### number-line · `plot` (β1.5, a=1.8)
| θ | range.max | plotted targets | verdict |
|---|-----------|-----------------|---------|
| 1.5 (LOW) | 10 | 1–5 | PASS |
| 2.0 (MID) | 15 | 1–12 | PASS |
| 2.5 (HIGH) | 20 | 9–20 | PASS |
| 2.5 + "Plot numbers to 5" | **5** | all ≤5 (2–5) | PASS (scope caps the band) |
| null-θ | 15 | ≤9 | PASS (grade-band default = mid) |

### hundreds-chart · `highlight_sequence` (β1.5, a=1.8)
Difficulty expressed via start offset (0→1→2 = tidy multiple → mid-run start) and
run length / skip pool.
| θ | start offset | skip values | largest cell | verdict |
|---|--------------|-------------|--------------|---------|
| 1.5 (LOW) | 0 (2,5) | {2,5} | 50 | PASS |
| 2.0 (MID) | 1 (11,6,3) | {2,5,10} | 79 | PASS |
| 2.5 (HIGH) | 2 (7,12) | {5,10} | 97 | PASS |
| 2.5 + "Skip count within 30" | 2 | {5,10} | **27** (≤30) | PASS (correctCells sliced at ceiling) |
| null-θ | 1 | {2,5,10} | 79 | PASS |

### ordinal-line · `identify` (β1.5, a=1.8)
| θ | maxPosition | target positions | verdict |
|---|-------------|------------------|---------|
| 1.5 (LOW) | 5 | 1–5 | PASS |
| 2.0 (MID) | 7 | 1–7 | PASS |
| 2.5 (HIGH) | 10 | 1–9 | PASS |
| 2.5 + "first through fifth" | **5** | 1–5 | PASS (maxPosition capped) |
| null-θ | 8 | 1–7 | PASS |

### number-sequencer · `count_from` (β1.5, a=1.8)
| θ | largest term | step | verdict |
|---|--------------|------|---------|
| 1.5 (LOW) | 6–7 | 1 | PASS |
| 2.0 (MID) | 12–15 | 2 | PASS |
| 2.5 (HIGH) | 18–27 | 4–5 | PASS |
| 2.5 + "Counting to 10" | **10** | (clamped) | PASS *(after fix — see below)* |
| 2.5 + "Counting to 5" | **5** | (clamped) | PASS *(after fix)* |
| null-θ | 10–17 | 2 | PASS |

## Bug found + fixed: number-sequencer scope overshoot (CRITICAL → fixed)

Initial sweep: topic "Counting to 10" at θ2.5 produced terms up to **21**
(`rangeMax:21`, answers `…17,21`) — the ceiling was ignored. Reproduced
deterministically across all phrasings ("to 10", "to ten", "numbers to 10") and
a "to 5" variant (→11). Not LLM flakiness: `scopeCeiling` WAS read, but the
**term construction overshot the capped max**.

Root cause (`gemini-number-sequencer.ts` `buildChallenges`): `length` and `step`
were chosen from the difficulty bands independently of `maxHi`. For `count_from`
at HIGH the span `(length-1)*step = 5*4 = 20` while scope capped `maxHi` to 10;
`start` clamped to 1 but the 6-term stepped sequence ran 1→21. Shared by every
stepped mode (count-from / order-cards / fill-missing): when `span ≥ maxHi`,
`start` collapses to 1 and terms overshoot.

Fix: a SCOPE/GRADE GUARD shrinks the span to fit the window before construction —
step first (keep ≥1), then length (keep ≥2) so `(length-1)*step ≤ maxHi-1`.
Scope wins over the length/step difficulty axis (pedagogy rule #1). Re-verified:
"to 10"→10, "to 5"→5, "to 20"→18; unbounded monotonicity preserved (largest
term 7→15→18 across θ 1.5/2.0/2.5).

This is the same class memory flagged ("number-sequencer migrated but still
overshoots") — now closed by construction.

## Catalog + plumbing changes (this rollout)

- **catalog/math.ts**: added `discrimination` to all 19 eval modes across the 4
  primitives (1.8 concrete recognition / 1.6 abstract operational / 1.4 estimation,
  mirroring ten-frame). Required by `computeDifficultyTuple`.
- **MathPrimitivesTester.tsx**: added a **Student Ability θ** control (slider +
  Auto/LOW/MID/HIGH presets) gated to the 6 difficulty-spec primitives; sends
  `config.studentTheta`; live readout shows derived target β, the mode's β band,
  and the within-mode level (LOW/MID/HIGH + saturation) via `computeDifficultyTuple`.
- Registration: all 4 already forward `item.config` (number-line/number-sequencer
  spread; hundreds-chart/ordinal-line pass wholesale) → `studentTheta` flows. No edit.
- tsc: 1441 errors (below 1444 baseline), zero in any touched file.

## Verdict

All 4 primitives honor calibrated, monotonic, scope-safe difficulty. The
load-bearing lesson this round: a scope cap on the *max band* is not enough —
the **derived span (length×step) must also be clamped to the window**, or
multi-term constructions walk past the ceiling. Difficulty spec now lives on 6
primitives (2 keystone + 4 here).
