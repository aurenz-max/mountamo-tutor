# Reader Fit: comparison-builder @ PRE — 2b TAIL — 2026-07-20

Modes audited: compare_numbers, one_more_less, order (compare_groups was closed
07-14/07-16, NOT re-touched) | Probes: eval-test ✓ (K, 3 modes) · jsdom
`ComparisonBuilder.reader-fit.test.tsx` 25/25 · `typecheck:lumina` 0 · full vitest
857/857 · `/primitive-contract --check` COMPATIBLE. Live `--lesson` + browser pixel
→ HUMAN-CHECKS #35 (residual).

Closes the two open bullets left after the 2026-07-16 head (chrome band-gate,
one_less symmetry, 🔊 Read-me): **Audit-C rule 5 (feedback on the object)** and the
**per-mode PRE picture passes** for the three non-compare_groups modes. This is a
band+mode fork keyed on `gradeBand==='K'` — Grade-1 is byte-unchanged. It BUILDS
contract gap G1.

## Slice 1 — Audit-C rule 5: feedback lands on the touched object (K)

Before: a wrong answer at K rendered a `LuminaFeedbackCard` (text a non-reader
cannot read) + a generic beep. Now, at K the text card is hidden and the feedback
lands on the object, with SFX + the (already-wired, silent) spoken tutor hint intact.
Precedent: rhyme-studio / word-workout rule-5 (ring/shake + SFX, no text card).

| Mode | Wrong-answer feedback @ K |
|---|---|
| compare-groups | tapped side (`<rect>`/`=` `<g>`) shakes (`motion.shake`) |
| compare-numbers | tapped numeral box (or `=`) shakes |
| one-more-one-less | tapped number cell shakes |
| order | ordered slots already flash `incorrect` (pre-existing `orderFlash`) — unchanged |

Mechanism: a shared `wrongFlash` key (`'more'`/`'less'`/`'equal'`, `num-<sym>`,
`<more|less>-<n>`) set by `flashWrong()`, self-clearing after the 350 ms shake and
re-armed on the next tap; cleared in the per-challenge reset. The text card is gated
`!isK`; Grade-1 keeps it (jsdom control asserts it appears).

## Slice 2 — per-mode PRE picture passes

### compare_numbers @ K — tap the BIGGER numeral (was: read `< > =`)
The K skill is K.CC.C.7 (compare two **written numerals** 1–10) — legitimate at K;
the barrier was the `< > =` answer surface. Now the two numeral boxes + a middle `=`
ARE the answer surface (mirrors compare-groups): tap the bigger numeral (or `=` if
equal), the tap derives the symbol and evaluates — no symbol buttons, no alligator
mnemonic, no Check. Grade-1 keeps the symbol buttons + alligator + Check.

### order @ K — wordless direction cue (was: text badge)
The `Least → Greatest` / `Greatest → Least` badge is text. At K it is replaced by a
wordless SVG of three graduated bars matching the fill order (short→tall = smallest
on the left = ascending; tall→short = descending). The bar heights ARE the
instruction. Grade-1 keeps the text badge. (Order keeps its Check button at K — it is
a multi-part construction, which the band contract rule 2 explicitly allows.)

### one_more_less @ K — 5-cell window + wordless arrows + tap=choose (was: up to 21 cells)
The full 0–20 number line (up to 21 cells/row, ×2 for `both` = 42) was a rule-4 load
violation. At K each row now shows only a **5-cell window centered on the target**
(`[target−2 .. target+2]` clamped to the band) — always containing target−1 / target
/ target+1, the only viable answers. Row labels ("One more than 5?") are text →
replaced at K by a wordless ⬆ (one more, emerald) / ⬇ (one less, blue) glyph; the
tutor voices the ask (catalog ORIENT + per-part DISAMBIGUATE, both already live). The
"Target" caption word is hidden at K (the numeral is the stimulus). Interaction is
tap=choose: a single ask evaluates on the tap; `both` gives immediate rule-5 feedback
on a wrong part, then the DISAMBIGUATE beat asks the other part and the second tap
completes — no Check at K.

## Audit results (touched modes @ K)

| Rule | compare_numbers | order | one_more_less |
|---|---|---|---|
| 1 audio is the instruction channel | PASS (directive + 🔊 Read-me) | PASS | PASS |
| 2 tap = choose | PASS (tap bigger, no Check) | PASS* (construction keeps Check) | PASS (tap cell, no Check) |
| 3 pictures/numerals are the answer surface | PASS (numerals, not `<>` symbols) | PASS (numeral tiles) | PASS (windowed numeral cells) |
| 4 ≤ ~5 interactive elements | PASS (2 numerals + `=`) | PARTIAL — 3-number orders OK; 4–5-number orders show 4–5 tiles + slots (see residual) | PASS (5-cell window; `both` = two 5-cell rows) |
| 5 feedback on the object | PASS (shake) | PASS (slot flash) | PASS (cell shake) |
| 6 no typing / no notation | PASS | PASS | PASS |
| 7 no adult chrome | PASS (no alligator hint) | PASS (text badge gone) | PASS ("Target" word gone) |
| 8 assessment in the mechanics | PASS | PASS | PASS |

**Overall: READY @ PRE for compare_numbers, order, one_more_less** (pending the
live/pixel confirmation below). Findings → fix layer: all COMPONENT band-gates (Tier
2) + one CATALOG directive reword (Tier 1). No WRONG-BAND floor was needed — all three
are genuine K standards (compare written numerals 1–10, order to 10, adjacent-number
reasoning); the barriers were presentational, not band-mismatches.

## eval-test @ K (generator unchanged — R4/R7 no-regression probe)

- **compare_numbers**: 5/5, numbers 1–10, `correctSymbol` computed correctly incl. an
  `=` case (2<5, 7>3, 4=4, 6<9, 8>6). ✓
- **one_more_less**: 5/5, targets in range; each viable answer falls inside the K
  window (e.g. target 9 `both` → window [7,8,9,10], one-more 10 & one-less 8 present). ✓
- **order**: 5/5, numbers 1–10. ✓ (Observation: one draw's *instruction text* said
  "biggest down" while `direction:'ascending'` — a pre-existing LLM instruction/field
  drift; the wordless cue keys on `direction`, the field the component sorts by, so the
  visual is correct. Not introduced here.)

## Loop log

| Iter | Change | Check | Result |
|---|---|---|---|
| 1 | Slice 1 (wrongFlash + hide card @ K) + Slice 2a/2b/2c component band-gates + catalog reword | `typecheck:lumina` 0; jsdom 25/25; full 857/857; eval-test 3/3 pass; contract --check COMPATIBLE | READY pending live/pixel |

## Residuals

- **Live `--lesson --runs 3` per touched mode** — the bespoke `comparison-builder`
  journey with `--eval-mode` passthrough already exists; behavioral confirmation of
  the ORIENT/DISAMBIGUATE beats on the new surfaces is deferred (needs backend + Gemini
  Live). Mechanism = the same cap-overriding catalog directive proven 07-14/07-16.
- **Browser pixel/click** → HUMAN-CHECKS #35 (SVG shake, wordless bar/arrow cues, K
  tap surfaces, no-Check at K for compare_numbers/one_more_less).
- **order @ K load (rule 4, PARTIAL)** — 4–5-number order challenges put 4–5 tiles +
  4–5 slots on screen. Out of scope for this tail (the handoff scoped order to the
  direction badge only); recorded as a candidate for an EMERGING re-audit or a K
  order-length cap (a generator/constraint slice, not a presentation fork).
- **PhaseSummaryPanel % ledger** at completion → K-stage systemic item (unchanged).
