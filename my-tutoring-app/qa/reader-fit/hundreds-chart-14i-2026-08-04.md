# Reader-fit 14i — hundreds-chart generator-local grade resolver — 2026-08-04

**Outcome: the 14m canonical-first template is applied to hundreds-chart — the
first sweep target after the number-line pilot, and the class's *different defect
shape* (hard `?? '2'` default rather than a prose parse). `ctx.grade` now decides
`gradeBand`; the legacy `'2'` default is fallback-only. Machine-gated end-to-end;
zero sittings. The G1 census defect ("both draws stamp Grade 2") is closed; bands
'3'/'4' are reachable for the first time on the ctx path.**

## Premise check (per the pilot's sweep instruction)

Verified the actual input before predicting direction: the generator read ONLY
`config?.gradeBand ?? '2'` — no prose parse, no `ctx.grade` read anywhere in the
file. The manifest never emits `gradeBand`, so every production lesson ran band
'2' regardless of grade. Bite, per band:

- **G1** (the census's 2/42): the stamp — the component hands `Grade ${gradeBand}`
  to the live tutor, so a Grade-1 child was tutored "as Grade 2." The skip pool
  happens to be identical ('1' and '2' are both [2,5,10]), so the pool itself was
  not wrong at G1 — the stamp and tutor label were.
- **G3/G4**: the pool — [2,3,4,5] and [3,4,6,7,8,9] were unreachable; every
  lesson drilled [2,5,10].

## The edit (14m template, ~24 insertions)

`gemini-hundreds-chart.ts`:
- `hundredsChartGradeBandFromGrade(grade?)` exported — K/1 → '1', 2 → '2',
  3 → '3', 4+ → '4' (ceiling clamp), `null` without a canonical grade (mirrors
  `calendarGradeBandFromGrade` `423c58f` / `numberLineGradeBandFromGrade`
  `dcfaac7`).
- Threading: `config?.gradeBand ?? hundredsChartGradeBandFromGrade(ctx.grade) ?? '2'`
  — explicit config pin keeps highest precedence, canonical grade next, the
  legacy '2' default never deleted.

## Gates

- Focused `gemini-hundreds-chart.grade-band.test.ts` **7/7**; **non-vacuity:
  reverting the threading fails 3** (G1 stamp, G4 pool, K clamp).
- `typecheck:lumina` **0**; full tsc **803 = baseline**.
- Real-Gemini `/eval-test` probes (dev :3000, real route → `ctx.grade`):
  - `grade=1` highlight_sequence → **gradeBand 1**, skips [2,5,10] (was: stamp '2')
  - `grade=3` identify_pattern → **gradeBand 3**, skips [2,3,4,5] (band-3 pool)
  - `grade=4` find_skip_value → **gradeBand 4**, skips [3,4,6,7,8] — **first
    runtime band-4 render on the ctx path**
  - no `&grade=` → **gradeBand 2**, skips [2,5,10] — legacy default byte-alike
  - intent probe (census replay shape): G1 + "Skip counting by 5s and 10s to
    count coins" → skips [5,10,2,5,10,5,10] — **6/7 on the named intervals**.

## 14i local halves — measured, dispositioned

- **Intent/eval-mode focus:** the existing `PRIMARY OBJECTIVE` prompt section
  already concentrates on a named interval and explicitly allows "at most one or
  two other intervals for contrast." The census's "injects a by-2 challenge into
  the nickel/dime 5/10 focus" is that documented contrast allowance, measured
  live at 6/7 focus. **In-design, not a defect.** If pedagogy later wants
  zero-contrast on money lessons, that is a design change, not a bug fix.
- **Honest 120 capability: STAYS OPEN in 14i.** The chart is structurally 1–100
  (`buildSequence` caps at 100, `gridMax: 100`, catalog: "Grid always 1-100").
  A 100–120 intent cannot be honored without EXTENDING the visual to a
  120-chart (12 rows — the standard CCSS 1.NBT.1 classroom chart), per
  [[trust-intent-over-hardcoded-caps]]: extend the visual, don't delete the
  legibility cap. Fork territory (band/config axis), its own slice. Until then,
  a 100–120 ask served as 1–100 skip counting is degradation, and routing such
  intents to number-line (which now honors G1 + is getting 14k's window fix) is
  the better manifest outcome.

## Sweep position

number-line (pilot, `dcfaac7`) → **hundreds-chart (this slice)** → next:
sorting-station, number-tracer, fraction-circles, shape-composer, net-folder,
timeline-builder → coin-counter (14c rides) → 11 chemistry last (verify bite
first). Template held: mapper + `??` threading + focused wiring test + eval-test
probes at two+ grades.
