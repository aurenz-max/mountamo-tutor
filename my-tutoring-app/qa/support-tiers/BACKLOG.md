# Support Tiers (non-math) — Campaign Queue

Working queue for `/add-support-tiers` on the non-math surface. Top = next.
Authored `/pm` 2026-08-04 from the batch-1/2 evidence (the campaign had been
running out of memory and report tails — this file is now the roster of record;
memory is a hint, never authority). **Update discipline:** whoever wires a
primitive strikes it here with evidence + report link in the same slice, and
updates the WORKSTREAMS row's "last touched".

**State: 31/36 eligible non-math primitives code-wired; 21/36 have complete
batch-report evidence.** Batch 1 (13, 2026-06-21, no per-item probes) + batch 2
(8, committed `423c58f`, per-item real-Gemini probes — report
`qa/eval-reports/support-tiers-batch2-2026-08-02.md`) + batch 3 implementation
(10, committed `effc7a6`; required real-Gemini probe report not shipped).
Math is 41/41 COMPLETE — never re-touch it from this queue.

**BATCH 3 STATUS (reconciled 2026-08-04):** implementation from
`qa/HANDOFF-support-tiers-batch3-2026-08-04.md` landed in `effc7a6` for all 10
targets. Do not reimplement them. The handoff's closing discipline did not land:
there is no batch-3 report carrying the required per-item real-Gemini probes.

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

## Queue — top is batch-3 evidence closure, then remaining 5

### TOP — batch-3 verification/report closure

> **EXECUTION SHAPE (user ruling 2026-08-05): SERIAL, one primitive at a
> time — NO orchestrated Workflow.** Prior attempts ran out of tokens because
> the parallel fan-out multiplies spend and an interrupted batch lands
> nothing. Loop: pick the next unstruck target → `/eval-test` it (≥3
> real-Gemini probes) → append its section to the batch report → strike it in
> the target list below → move on. Commit after each primitive (or every few)
> so a token-out session loses nothing. The orchestrated-Workflow batch shape
> is now OPT-IN only (memory: `serial-over-workflow-token-budget`).

Run `/eval-test` against the 10 shipped targets below using the handoff's
per-item gates (>=3 real-Gemini probes each, including hard/easy or no-tier
compatibility as specified), fix only confirmed regressions, and write
`qa/eval-reports/support-tiers-batch3-2026-08-04.md` (append per-item as you
go — a partial report with 4 finished sections is a valid landing state).
Code is already present in
`effc7a6`; this is verification and reporting, not a second implementation pass.

Targets: spelling-pattern-explorer, story-map, opinion-builder,
paragraph-architect, poetry-lab, revision-workshop, sound-wave-explorer,
constellation-builder, planetary-explorer, construction-sequence-planner.

### Remaining implementation (5)

Ordered literacy-first (the LA K-2 demand map is the density frontier), then
by routing likelihood. Two rows carry coordination flags — read them before
pulling.

1. **flight-forces-explorer**
2. **propulsion-lab**
3. **transport-challenge**
4. **hydraulics-lab** — ⚠️ OWNED by its mission-reimagining stream
    (`project_hydraulics-lab-mission-reimagining`); coordinate — do NOT wire
    tiers over a surface that stream is rebuilding.

5. **timeline-builder** — reader-fit **14m** resolver prerequisite shipped;
   support-tier work is now independently pullable in its own slice.

## Not yet eligible (~59)

~59 non-math generators lack `resolveEvalModes` and need `/add-eval-modes`
before tier work is possible. Not enumerated here — derive at pull time from
the eligibility probe (value-origin classification: probe where the value
ORIGINATES, never grep for code touch). Opening that frontier is its own
decision, not a batch-3 side effect.

## Residuals (open, human-only)

- **HUMAN-CHECKS #60** — batch-2 hard-tier browser feel-pass (8 primitives,
  one sitting).
- **HUMAN-CHECKS #62** — batch-3 hard-tier browser feel-pass (10 primitives,
  one sitting).
- Live-tutor ear-check that reveal-policy directives hold in real audio —
  rides any DI/lesson sitting at a hard tier. None blocks machine
  verification/report closure.

## Done

- **Batch 3 implementation — 2026-08-04, committed `effc7a6` (21/36 → 31/36
  code-wired):** spelling-pattern-explorer, story-map, opinion-builder,
  paragraph-architect, poetry-lab, revision-workshop, sound-wave-explorer,
  constellation-builder, planetary-explorer, construction-sequence-planner.
  Unit coverage and tier anchors landed. Required per-item real-Gemini probes
  and the batch report remain the queue's top closure task.

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

---

## 📥 MOVED FROM `WORKSTREAMS.md` — `/pm` 2026-08-13 (user ruling)

The index's `## ACTIVE` section had grown to ~1,360 lines (79% of the file), so each
stream's DETAIL now lives in its owning queue and the index carries the pointer plus the
one-line state. **Moved verbatim, nothing deleted.** The index remains authority for
STATE (active/parked, what to pull next); this block is authority for the detail behind
it. Where the two disagree, the queue wins on WHAT and reports win on EVIDENCE.

### 3. Support-tiers campaign (non-math) — **PARKED 2026-08-08 (was OPPORTUNISTIC +1)** — last touched **2026-08-04**

*Parked by `/pm` 2026-08-08. Not stale-by-neglect and nothing is wrong with it: it
was being carried as the opportunistic +1 while three other lanes had live findings
and it had not moved in four days. Its queue is trusted as of 2026-08-04. Resume
cost is zero — batch-3 evidence closure via `/eval-test`, serial, one primitive per
slice. **The +1 slot now belongs to reader-fit item 17.***
- **Queue:** `my-tutoring-app/qa/support-tiers/BACKLOG.md` — **RECONCILED `/pm` 2026-08-04**.
  Batch-3 implementation already shipped in `effc7a6`; the top task is its missing
  `/eval-test` evidence/report closure, not another implementation pass. After that, five eligible
  primitives remain. Hydraulics-lab still requires coordination with its reimagining stream;
  timeline-builder's reader-fit 14m resolver prerequisite has landed, so its tier work is now
  independently pullable. The ~59 not-yet-eligible generators (need `/add-eval-modes` first) stay
  un-enumerated by design — opening that frontier is its own decision.
- **Executor skills:** `/add-support-tiers` (+ `/add-eval-modes` first for the ~59 that lack modes),
  `/eval-test`, `/primitive-contract --check`.
- **State: 31/36 non-math primitives code-wired; 21/36 have complete batch-report evidence.**
  Batch 3 shipped in `effc7a6` across 10 primitives, but no
  `qa/eval-reports/support-tiers-batch3-2026-08-04.md` or equivalent per-item real-Gemini probe
  record landed. Close that evidence gap before declaring the batch fully done. Batch 2
  (**committed `423c58f`**, report
  `qa/eval-reports/support-tiers-batch2-2026-08-02.md`) took 13/36 → 21/36 via an 8-agent
  orchestrated Workflow — 7 implemented, 1 partial (letter-sound-link `see_hear` correctly declined
  single-tap commit: its options are bare speaker bubbles, so a first tap would commit an *unheard*
  option). ~15 remain, plus ~59 that need `/add-eval-modes` before they are even eligible.
- **The batch's real value was the defects it found en route, not the tiers** — and this is the
  argument for the campaign continuing: a **rule-#1 answer leak in rhyme-studio** (the rime
  highlight rendered only when the pair rhymed, so the highlight WAS the yes/no answer), **three
  live rule-#1 tutor leaks in letter-sound-link** ([ACTIVITY_START] named the sound and keyword
  before the challenge), an **unanswerable calendar-explorer identify** mode, and the
  **calendar-explorer grade-band bug that turned out to be systemic** (now reader-fit **14m**).
  Profiling 8 primitives closely enough to withdraw their scaffolding is what surfaced these; none
  were findable from the tier work alone.
- **Residuals:** batch-2 hard-tier browser feel-pass → **HUMAN-CHECKS #60**; batch-3 feel-pass →
  **HUMAN-CHECKS #62**; the
  live-tutor ear-check that reveal-policy directives hold in real audio rides any DI/lesson sitting
  at a hard tier. None blocks machine verification/report closure.
- **Note the shape for reuse:** the orchestration pattern held — profiles → orchestrator writes
  line-anchored specs → agents implement mechanically → orchestrator applies all catalog patches
  serially and runs the merge gates. Zero collisions across 7 agents in `catalog/literacy.ts`, and
  the concurrent 14f session's uncommitted register edits were untouched. One trap recorded: apply
  structured-output patches with **UTF-8 decoding**, since PowerShell 5.1 `Get-Content` ANSI-decoded
  the journal and briefly wrote em-dash mojibake into the catalogs.
