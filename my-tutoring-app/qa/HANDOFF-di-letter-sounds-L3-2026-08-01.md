# HANDOFF — di-letter-sounds `/add-support-tiers` (L3), third use of the DI L3 template

Written by `/pm` 2026-08-01. Owning queue: `my-tutoring-app/qa/di/BACKLOG.md` (08-01 ordering
ruling: the family ladder is the top pull; di-math-facts L3 landed 2026-08-01, `catalog/di.ts` is
free, **this is the next serial rung**). Executor: `/add-support-tiers`.

**SERIAL CONSTRAINT: this session is the only one allowed to touch `catalog/di.ts`, the DI scripts,
or the DI tester while it runs.** Reader-fit sessions (14e/14b) are file-disjoint and may run
concurrently; census item 14g (DI generator scope regressions) belongs to this stream but is NOT
this slice — leave it queued.

## Paste-able prompt

> Run `/add-support-tiers` on `di-letter-sounds` — the third use of the DI L3 template. Read
> `qa/HANDOFF-di-letter-sounds-L3-2026-08-01.md`, then the two worked templates:
> `qa/eval-reports/di-math-facts-support-tiers-2026-08-01.md` (newest, closest) and
> `qa/eval-reports/di-sentence-reading-support-tiers-2026-07-25.md` (the original), plus the birth
> cert `qa/eval-reports/di-letter-sounds-birth.md`. The fade composes in the SCRIPT, never a UI
> flag; the spoken cue lines are bench-proven and byte-frozen.

## The template, instantiated for this pack

Zero `showOptions` → the whole ladder is **modality #2 instruction-as-scaffold**. DISTAR's
model→guide→test IS the ladder:

- **easy** = model + guide + test (byte-for-byte the current, bench-proven block)
- **medium** = model + test
- **hard** = **cold test** — the tutor never speaks the target sound before the attempt.

`diLetterSoundsScript.ts` already exports the pieces separately — `modelLine` (:74), `guideLine`
(:82), `testLine` (:90) — so the fade is a `leadInFor(tier)` composition exactly like the siblings
(math added `leadInFor` + `coldAnswerGuard` in `diMathFactsScript.ts`; copy that shape).

**Why `hard` matters here:** the model line SPEAKS the sound the child is about to produce — the
echo route. At hard the item becomes a genuine grapheme→sound retrieval probe and silent
`responseMs` becomes true retrieval time. The printed grapheme is stimulus and is NEVER withdrawn.

## Pack-specific cautions

1. **Three eval modes, different cue structures:** `letter_sound` (β1.5) / `letter_sound_review`
   (β2.5) / `first_sound_in_word` (β3.5). The onset mode has its own picture/word stage where the
   lone grapheme deliberately never leaks the onset — check that hard's withdrawal composes
   per-mode without breaking that inversion. **Gate on TIER, not mode** (math's proven rule: a
   `mixed`+medium run must tier ALL identities).
2. **Never withdrawn at any tier:** printed grapheme; the correction re-model (gate 3); the
   restating affirm; the `judgingContract` — byte-identical across tiers, test-pin it.
   **This pack still carries the PLAIN correction** — the contrastive port is frozen on
   HUMAN-CHECKS #55 (family rule). Do not reword any spoken line.
3. **Tutor second-channel audit (the sentence pack's hole):** read the letter-sounds
   `scaffoldingLevels` + `commonStruggles` in `catalog/di.ts` — if any level re-speaks the withheld
   sound pre-attempt, close it (per-item cold guard + a cold-items clause in the LIVE-JUDGED
   directive, math's pattern). Math's audit came back clean; record the result either way as a
   catalog note.
4. **`supportTier` contextKey:** add to contextKeys + connect payload + `updateContext` +
   `startDiRunLog` (math's pattern) so the tier is visible in run artifacts and to the tutor.
5. **No `tierSection` in the generator prompt** (Fork A departure, both siblings): the model only
   picks letters — a tier line could only nudge CONTENT, which is L4's axis, not L3's.
6. **Tester:** the family tier selector already exists (built in the math L3 slice, riding the
   eval-test route's `?difficulty=` tap) — verify it drives this pack; no new tester work expected.

## Gates

- `npm run typecheck:lumina` 0; full vitest green (baseline **1041/1041**); new suite with
  **proven non-vacuity** (reverting the hard fade must fail multiple tests).
- **3 probes through the REAL pipeline** (dev server + real Gemini), math's acceptance shape:
  pinned `letter_sound`+hard → all challenges `'hard'`, scope intact; `mixed`+medium → all three
  identities tiered; no param → no field (pre-L3 byte-compatible).
- Live `hard` ear-check is human-only: fold into an existing DI sitting row or take the next free
  HUMAN-CHECKS ID (check the file; last known next-free was #57). Do NOT block the slice on it.
- Report `qa/eval-reports/di-letter-sounds-support-tiers-<date>.md`; update the DI BACKLOG ladder
  table (L3 ✅, next rung per the nearest-rungs order = di-word-reading L2) + WORKSTREAMS DI
  "last touched" in the same slice. Commit as one tight slice.
