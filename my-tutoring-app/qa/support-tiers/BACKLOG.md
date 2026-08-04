# Support Tiers (non-math) — Campaign Queue

Working queue for `/add-support-tiers` on the non-math surface. Top = next.
Authored `/pm` 2026-08-04 from the batch-1/2 evidence (the campaign had been
running out of memory and report tails — this file is now the roster of record;
memory is a hint, never authority). **Update discipline:** whoever wires a
primitive strikes it here with evidence + report link in the same slice, and
updates the WORKSTREAMS row's "last touched".

**State: 21/36 eligible non-math primitives wired.** Batch 1 (13, 2026-06-21,
no per-item probes) + batch 2 (8, committed `423c58f`, per-item real-Gemini
probes — report `qa/eval-reports/support-tiers-batch2-2026-08-02.md`).
Math is 41/41 COMPLETE — never re-touch it from this queue.

**📋 BATCH 3 HANDOFF (paste-able, anchors verified 2026-08-04):**
`qa/HANDOFF-support-tiers-batch3-2026-08-04.md` — 10 items (rows 1–13 below
minus the two flagged), batch-2 orchestration pattern, per-item probe gates,
closing discipline. A session executing batch 3 starts THERE.

**Executor skills:** `/add-support-tiers` per primitive (+
`/primitive-contract --check` where a contract exists); batch shape =
the batch-2 orchestrated workflow (profiles → orchestrator writes
line-anchored specs → agents implement → orchestrator applies catalog patches
serially, runs merge gates). Known trap: decode agent journals as **UTF-8**
explicitly — PS 5.1 `Get-Content` ANSI-mojibake'd em-dashes into catalogs once.

**House pattern (do not re-derive):** per-challenge optional fields default to
byte-identical legacy; tier stamped in CODE post-parse from `ctx.supportTier`
(never prompt-steered); band (K/PRE) gates compose and WIN over tier; thread
`supportTier` to the tutor + ship a SUPPORT-TIER reveal-policy directive so the
voice channel matches the screen.

## Queue — remaining 15 eval-wired primitives

Ordered literacy-first (the LA K-2 demand map is the density frontier), then
by routing likelihood. Two rows carry coordination flags — read them before
pulling.

### Literacy (6)
1. **spelling-pattern-explorer**
2. **story-map**
3. **opinion-builder**
4. **paragraph-architect**
5. **poetry-lab** — RF fix + rhyme_hunt K mode shipped previously; check
   `docs/contracts/` for a contract before editing.
6. **revision-workshop**

### Physics / astronomy (3)
7. **sound-wave-explorer**
8. **constellation-builder**
9. **planetary-explorer**

### Engineering (5)
10. **construction-sequence-planner**
11. **flight-forces-explorer**
12. **propulsion-lab**
13. **transport-challenge**
14. **hydraulics-lab** — ⚠️ OWNED by its mission-reimagining stream
    (`project_hydraulics-lab-mission-reimagining`); coordinate — do NOT wire
    tiers over a surface that stream is rebuilding.

### Calendar / time (1)
15. **timeline-builder** — ⚠️ also named in reader-fit **14m** (grade-resolver
    prose-parse defect, one of the 8 K-2/elementary generators). The 14m sweep
    owns the grade fix; this queue owns the tier work. If the 14m sweep reaches
    it first, wire tiers in a separate slice AFTER the resolver fix lands —
    one owning entry per register, cross-referenced here.

## Not yet eligible (~59)

~59 non-math generators lack `resolveEvalModes` and need `/add-eval-modes`
before tier work is possible. Not enumerated here — derive at pull time from
the eligibility probe (value-origin classification: probe where the value
ORIGINATES, never grep for code touch). Opening that frontier is its own
decision, not a batch-3 side effect.

## Residuals (open, human-only)

- **HUMAN-CHECKS #60** — batch-2 hard-tier browser feel-pass (8 primitives,
  one sitting).
- Live-tutor ear-check that reveal-policy directives hold in real audio —
  rides any DI/lesson sitting at a hard tier. Neither blocks batch 3.

## Done

- **Batch 2 — 2026-08-02, committed `423c58f` (13/36 → 21/36):**
  phoneme-explorer, phonics-blender (contract-first), syllable-clapper,
  rhyme-studio, word-sorter, word-workout, letter-sound-link (partial —
  `see_hear` single-tap declined by judgment), calendar-explorer. Every item
  gated on ≥3 real-Gemini probes + reverted-gating non-vacuity tests. 7
  defects fixed en route incl. 2 rule-#1 leaks and the grade-prose band bug
  that became reader-fit 14m. Report:
  `qa/eval-reports/support-tiers-batch2-2026-08-02.md`.
- **Batch 1 — 2026-06-21 (0/36 → 13/36, no per-item probes — retro-probe if
  one misbehaves):** context-clues-detective, figurative-language-finder,
  text-structure-analyzer, stoichiometry-lab, push-pull-arena, race-track-lab,
  gravity-drop-tower, gas-laws-simulator, light-shadow-lab, cvc-speller,
  sound-swap, sentence-builder, letter-spotter.
