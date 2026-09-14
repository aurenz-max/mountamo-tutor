# number-tracer — grader and sequence-leak fix (2026-09-14)

Found while scoping `/add-misconception-loop number-tracer`: before building capture, the skill
requires confirming that the grader rejects the error it would record. It did not, in either
direction. Fixed under `/eval-fix`. Artifacts: [number-tracer-2026-09-14/](number-tracer-2026-09-14/).

## Findings

| ID | Severity | Observation | Cause |
|---|---|---|---|
| NT-5 | CRITICAL | A correct digit whose geometry score is below 90 is rejected with "It looks like nothing was drawn yet". Real app, sequence easy: a slanted 1 (geometry 87) → vision score 0, confidence 100. Replica probe: 12 of 14 vision calls said nothing was drawn, including correct 4, 5 and 7. | `handleCheckDrawing` sent `canvas.toDataURL()` of the on-screen canvas. The render effect only `clearRect`s it (its dark ground is CSS), so the PNG is white strokes on alpha 0, which the judge reads as blank. With the same strokes on a dark fill, the judge rejected 6 of 6 wrong numbers and accepted correct ones. |
| NT-6 | HIGH | Geometry ≥ 90 accepts without asking the judge, and scaled geometry accepts a different numeral: 2 for 3 (90, real app), 8 for 3, 3 for 8, 6 for 5, 6 for 0 (probe). | copy/write/sequence scale the ink into the target's bounding box and measure closeness to the target's path; a numeral that overlaps the target's strokes scores high. Geometry cannot establish which numeral was written. |
| NT-7 | HIGH | Sequence at easy/medium paints the dotted path, start dots and arrows of the missing number before any ink (screenshot: "0, ?, 2, 3" canvas shows a dotted 1). | `resolveSupportStructure('sequence', easy/medium)` set `showGhostDigit`/`showStartDot`, and the component paints `getDigitPaths(challenge.digit)` — the hidden answer. |
| NT-8 | MEDIUM | Sequence answers repeat on neighbouring items: real generation 1, 3, 3, 5, 5. | `buildSequenceChallenges` walked `start = lo + i` with `missingIndex = 1 + i % 2`, so items 2/3 and 4/5 always share an answer, and the session was identical for a given window. |

## Repair

- **NT-5** (`NumberTracer.tsx`): `renderInkForJudge(strokes)` draws only the learner's ink, white on
  `#020617`, on its own canvas; that image goes to the judge. Guides no longer reach the judged image.
- **NT-6** (`NumberTracer.tsx`): the geometry shortcut applies only to trace (unscaled, position-bound
  to the guide). copy/write/sequence always ask the judge. A failed request now falls back to geometry
  like a low-confidence reading; before, the rejection escaped the handler and left "Checking your writing…" on screen.
- **NT-7** (`gemini-number-tracer.ts` + `NumberTracer.tsx`): sequence gets no guide flags at any tier, and
  the component never paints a guide for a sequence item whatever the flags (stale data). The tutor
  clause for sequence says no guide is shown and the missing number must not be said.
- **NT-8** (`gemini-number-tracer.ts`): the builder shuffles every legal (start, interior blank) item and
  picks distinct answers while the window has them, then avoids repeating the previous answer.

## Verification

| Check | Result |
|---|---|
| Real app, sequence easy, before fix | slanted correct 1 rejected ("haven't drawn"); 2-for-3 accepted without the judge; 6-for-3 rejected as blank; all 5 items ghost + dot on; answers 1,3,3,5,5 |
| Real app after fix, 4 modes (sequence easy, trace easy, copy medium, write hard) | correct digits 20/20 accepted (incl. 4 slanted, geometry 84–87); wrong numerals 7/7 rejected with the judge naming the written numeral; sequence canvas empty before ink; answers distinct; trace keeps its ghost and accepts close traces without a judge call |
| Tests `NumberTracer.grading.test.tsx` (5), `gemini-number-tracer.sequence.test.ts` (3) | pass; each fails with its defect restored (NT-5, NT-6, NT-7 component, NT-7 generator mutants checked) |
| Existing `pip/NumberTracer.surface.test.tsx`, grade-band test | pass (surface test's `getContext` mock changed from `null` to a no-op 2D context, since the check now renders its own image) |
| `typecheck:lumina` | 0 |
| full `tsc --noEmit` | 770, no number-tracer diagnostics |

Limits: the judge is a model call. 13 wrong numerals were rejected across the probe and drives, but
the drawings were canonical paths with slant and wobble, not children's handwriting. When the judge
request fails, the check falls back to geometry, which can still accept an overlapping numeral.
Mirror-reversed digits are accepted by the judge prompt's rule 5; that is unchanged policy.
Copy and write checks now wait for a judge call every time (about 1–3 s).

## Open

- **NT-9** tutor channel: sequence sends `digit` (the answer) in `aiPrimitiveData`, `[ACTIVITY_START]` and `[NEXT_ITEM]`, and the catalog scaffold levels read "For the number {{digit}}…". Unverified; `/tutor-test number-tracer`.
- **NT-10** write mode's instruction "Write the number 6!" shows the numeral, so write is copying for a reader. Needs a product ruling on the pre-reader prompt; then `/eval-fix`.
- **NT-11** K band ceiling is 9, below K `COUNT001-01-B` "Write numbers 0-10" and `COUNT001-01-C` "write 11-20". `/topic-fidelity number-tracer`.
- **NT-12** after NT-7, sequence tiers differ only in `supportTier`. `/add-support-tiers number-tracer` (a counting-on scaffold, not a guide for the answer).

## Later the same day

- **NT-13** (found by the misconception probe): the sequence-window call's free-text title and description ran
  away in 7 of 26 real draws (130-500 KB, minutes each, then the grade-ceiling fallback). The schema is now
  `rangeMin`/`rangeMax` only; code writes the title ("Find the Missing Numbers") and description; the call has
  `maxOutputTokens: 1024` and a 20 s timeout. Retest `scripts/probe-number-tracer-window.mjs`: 30/30, no
  failure, slowest 918 ms, windows in scope (K to 10 → 1-10 clamped to 9, K within 5 → 1-5, Grade 1 → 1-20).
- **NT-14**: metrics now carry `evalMode` when the session has one mode, so the backend stops recording `default`.
- The judge schema gained `writtenAs` (the number it reads) for misconception evidence. Re-judging the 23
  after-fix drive images moved 0 accept/reject decisions and read the ink correctly 23/23.
