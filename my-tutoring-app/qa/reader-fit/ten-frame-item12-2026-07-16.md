# Reader Fit: ten-frame `make_ten` @ K (item 12) — 2026-07-16

Mode audited: `make_ten` @ K | Probes: eval-test ✓ · Vitest jsdom 5/5 ✓ · full suite 810/810 ✓ · contract-first ✓ (`docs/contracts/ten-frame.md`)

The 2026-07-16 direct-manipulation census found a strong proxy: the K frame already showed `targetCount` counters and offered tappable empty cells, but the judged answer came from a separate `counterCount + ___ = 10` stepper. The child could manipulate the mathematical model without that action affecting the answer.

## Before → after

| Contract beat | Before | After |
|---|---|---|
| Answer surface | `+`/`−` numeric stepper below a tappable frame | the empty frame cells themselves |
| Judged state | `makeTenInput` | enacted frame count and counters placed beyond the seed |
| Completion | separate Check button | final empty-cell tap fills 10 and auto-judges |
| Number bond | inferred from a typed/stepped number | derived as `filledCount - targetCount` |
| Seed | shown but removable | fixed at K `make_ten`; only empty cells accept answer taps |

## Scoped implementation

- **Component:** `TenFrame.tsx` defines `isKMakeTen` as the band+mode fork. It seeds the existing challenge count, fixes those seed counters, places a counter on each empty-cell tap, and records the correct challenge result when the frame reaches 10. The success beat reports the enacted bond (`seed + placed = 10`).
- **K make-ten UI:** the bespoke stepper and Check button are absent. Next Challenge appears after the enacted frame is full.
- **Preserved controls:** K `build`/count-all retains frame construction + Check; K `subitize` retains flash → hide → numeric response + Check; Grade 1–2 `make_ten` retains its stepper + Check; operate answer/checking paths are unchanged.
- **Browser-reported transition follow-on:** the first mixed-mode browser run showed a completed make-ten frame carrying all 10 counters into the next `add` challenge. Root cause was a stale `keepFrame` branch that treated `add` without `startCount` as “build on previous,” contradicting the generator contract that add starts empty. Every transition now clears the frame; make-ten and subtraction then seed through their existing effects.
- **No schema/catalog change:** `targetCount`, frame capacity, and final filled count already provide one code-owned source of truth. The catalog’s task identity remains “find the complement to 10.”

## Verification

- **Focused jsdom 5/5** (`TenFrame.reader-fit.test.tsx`):
  - K make-ten seeds 6, prevents removing seed counters, remains incomplete after three new counters, then auto-completes after the fourth; stepper/Check absent; next challenge reseeds correctly.
  - K build/count-all retains Check and completes from its existing frame construction.
  - A full make-ten frame transitions to `Show 2 + 3` with zero counters and the normal operate Check button.
  - K subitize counters hide before its numeric response becomes enabled.
  - Grade 1–2 make-ten retains the numeric stepper and Check behavior.
- **Full Vitest:** 68 files, **810/810** tests pass.
- **TypeScript:** `npm run typecheck:lumina` = 0 errors. Project-wide `tsc --noEmit` still has the large pre-existing legacy baseline; filtering the compiler output finds 0 errors in the touched TenFrame files.
- **Live eval-test:** K `make_ten` PASS — 7/7 `make_ten`, `gradeBand:'K'`, `mode:'single'`, seed counts 1–9, `showEmptyCount:false`, every complement derivable. Regression controls PASS: build 7/7, subitize 7/7, operate 5/5.
- **G1–G5 sync:** required fields present; no flat reconstruction; mode identity distinct; answer is `10 - targetCount` from the visible frame; no fallback fired in the sampled draw.

## Residual

No bespoke ten-frame journey exists in `backend/tests/tutor_live/run_tutor_live.py`, so a live `--lesson` run was not feasible in this slice. A real-browser check remains for empty-cell hit targets, fill feel, and two-color/pixel clarity; tracked in `qa/HUMAN-CHECKS.md`.

**Overall: READY pending the recorded browser/pixel check.** The affected behavior itself is runtime-exercised in jsdom and generated-data eval-test; only browser hit-testing/visual feel remains human-only.
