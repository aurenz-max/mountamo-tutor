# Workstreams — Portfolio Index

The single orientation surface for all Lumina workstreams. Any session answering
"what's next?" starts HERE, not in memory or individual queues.

**Rules:** WIP limit = 2 ACTIVE streams + 1 DELEGATED lane. Everything else is
PARKED with a trusted-as-of date — act on a parked stream's queue only after
re-verifying its claims against EVAL_TRACKER + git. Maintained by `/pm`
(reconcile → update → propose); every session that closes work updates the owning
queue AND this file's "last touched" in the same slice.

| State | Meaning |
|---|---|
| ACTIVE | being worked now; queue is trusted |
| DELEGATED | handed to another session/agent; check its report before touching |
| PARKED | intentionally idle; queue trusted only as of the noted date |
| BLOCKED | waiting on a named dependency |

## ACTIVE

### 1. Reader-fit K queue — last touched 2026-07-15
- **Queue:** `my-tutoring-app/qa/reader-fit/BACKLOG.md` (top = next). NOTE: tree carries the
  uncommitted phonics-blender contract slice (see WIP note) — `/ship` it before starting #9 so the
  reader-fit work lands on a clean base, not mixed with a different stream's slice.
- **Executor skills:** `/reader-fit [--fix]`, `/eval-fix`, `/tutor-test`
- **Now:** **#9 explainer tail** — audit **foundation-explorer** first (text-primary "reading"
  surface, 4/6 census lessons), extract the shared PRE pattern (auto-read + 🔊 + picture-primary
  checks), then sweep concept-card-grid / comparison-panel / fact-file / flashcard-deck / media-player.
  #2b comparison-builder remaining is DEFERRED to K-stage coordination, not next. (#8 rhyme-studio PRE
  **DONE 2026-07-15**, committed; READY @ PRE for recognition + identification, live 3/3 both routes;
  production floored Grade 1+. #7 phonics-blender PRE **DONE 2026-07-15**, live 3/3 `cvc`. #1e
  sorting-station PRE **DONE 2026-07-15**, live 3/3.)
- **Milestone:** K queue drained → re-run topic-trace census at grade 1 (EMERGING).

### 2. SP-27 Tutoring Context Integrity — last touched 2026-07-14
- **Docs:** `my-tutoring-app/src/components/lumina/docs/PRD_TUTORING_CONTEXT_INTEGRITY.md`,
  sweep `my-tutoring-app/qa/tutor-reports/sweep-2026-07-14.md`
- **Executor skills:** `/tutor-test`, `/add-tutoring-scaffold`
- **Now:** Phase 0 — harden `scaffoldAudit.ts` (invalid-syntax detection,
  studentPrompts coverage, fingerprints), **re-run the sweep before cutting the
  baseline** (comparison-builder listing already stale), Vitest gate, report-only
  runtime guard. Amendments accepted 2026-07-14: demand-ordered batches; silent-tag
  criterion nuanced (student-initiated asks may be non-silent); 5-beat sufficiency
  contract added to the repair matrix for K-1-claiming primitives.
- **Then:** Phase 1 pilot `how-it-works` (judgment pass — keep in main session).

## DELEGATED

*(none — lane 3 closed 2026-07-15, folded to the PARKED contracts stream below.)*

> **WIP note (`/pm` 2026-07-15):** working tree carries the phonics-blender contract lane
> (delegated lane 3 CLOSED — `docs/contracts/phonics-blender.md` derived, contracts BACKLOG
> #6 → Done, sorting-station constraints rider APPLIED to `math.ts`; tsc 0-new + typecheck:lumina
> clean). Uncommitted (per doctrine — commit on user request). Portfolio back to a clean
> **2 ACTIVE + 0 DELEGATED**, under the 2+1 limit. Residuals: browser spot-checks queued as
> HUMAN-CHECKS #12/#13/#14 + one queued phonics tap-pronounce verification (reader-fit BACKLOG,
> executor `/tutor-test`). Room to open one delegated lane if needed.

## PARKED (trusted-as-of date; re-verify before acting)

| Stream | Queue / doc | Next action | As of |
|---|---|---|---|
| Primitive contracts | `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` | 2 contracts derived (sorting-station pilot + **phonics-blender DONE 07-15**: 10 R, 2 conflicts, 4 gaps incl. G3 vowel-teams where the curriculum names the primitive but no eval mode exists → `/add-eval-modes`; sorting-station constraints rider APPLIED). Next = #2 **knowledge-check** derivation (largest blast radius; before `true_false @ PRE` lands), then wire `--check` into the fix loops | 07-15 |
| Misconception loop | memory `project_misconception-loop` | Phase 3A | 07-12 |
| Literacy eval-modes densification | memory `project_literacy-evalmodes-densification` | tree is CLEAN (no longer uncommitted — /ship step moot); remaining = `/eval-test` the 6 task-identity ladders to confirm they draw, then close | 07-15 |
| Flash-lite truncation hardening | memory `project_flash-lite-truncation-template` | ~50-gen sweep | 07-06 |
| LuminaReadAloud 🔊 sweep | `qa/HANDOFF_read-aloud-sweep.md` | pilot browser-VERIFIED 07-15 (user); remaining = 🔊 sweep across the other hand-rolled read-aloud surfaces | 07-15 |
| Lumina kit roadmap | `docs/DROPZONE_MIGRATION_PRD.md` + memory `project_lumina-kit-motion-roadmap` | motion tokens + LuminaDropZone COMMITTED (e17679f, e450cb0). DropZone Batch 1 (+2) are CODE-COMPLETE (◐ browser spot-checks pending, PRD tracks them) — "next = B1" was STALE. **DropZone Batch-3 tail CODE-COMPLETE 2026-07-15** (10 migrated + 3 triaged; typecheck:lumina clean; browser spot-checks → HUMAN-CHECKS #13/#14; uncommitted). Next = Batch-4 triage or LuminaCompletionScreen (106 hand-rolled 🎉 blocks). PRD §2 rulings settled | 07-15 |
| Curriculum authoring | memory (K-5 archive) | G5 Science + G5 Social Studies; GK phonics starvation | 07-09 |
| Analytics/snapshot residue | memory | snapshot `--all` + commit; metrics grade-join `--apply` | 07-08 |

**Absorbed:** tutor-test fix campaign (46/130 FAIL) → SP-27. Orphaned tutoring
configs (distribution-explorer, dot-plot) → SP-27 Phase 2/3.

## CLOSED (verified 2026-07-14; reopen deliberately, not by accident)
- **Grade-fidelity sweep close-out** (2026-07-15) — **committed** (`7cb5e5f`). 4/4 tasks closed
  via runtime probe: daily-session grade threading verified HONORED; 11/11 probe-sweep HONORED;
  `gradeToBand`+`buildGradeLine` extracted to `scopeContext.ts`; and a real 6-gen phonics dead
  lever fixed via `clampGradeToK2`. Report: `qa/topic-fidelity/grade-fidelity-closeout-2026-07-15.md`.
  Residual: none.
- **reader-fit 1e sorting-station @ PRE** (2026-07-15) — **committed** (`7cb5e5f`). READY @ PRE for
  `sort_one` + `odd_one_out`; other four modes floored to Grade 1+. jsdom 6/6 + live `--lesson` 3/3.
  Residual = pixel look (HUMAN-CHECKS #12). Report: `qa/reader-fit/sorting-station-PRE-2026-07-15.md`.
- **DropZone Batch-3 tail** (2026-07-15) — code **committed** (`7cb5e5f`). 10 migrated onto
  LuminaDropZone + 3 triaged decorative; `typecheck:lumina` clean. Residual = browser spot-checks
  (HUMAN-CHECKS #13/#14). Next kit move (Batch-4 triage / LuminaCompletionScreen) tracked under the
  PARKED Lumina-kit-roadmap row. Handoff: `qa/HANDOFF-dropzone-batch3-2026-07-15.md`.
- **DeepDive block scaffolding + curator-brief PRE scaffold** (2026-07-15) —
  **user-confirmed live**. BlockTutorHelp + tap-to-explore + the full K-eligible
  PRE read-aloud palette (prose/key-facts/MC/mini-sim/pull-quote/diagram) and
  curator-brief `[READ_SECTION]` auto-narrate all committed (tree clean) and
  behaving in a live lesson. Residual (minor, non-blocking): no jsdom tests yet
  for the new mini-sim/pull-quote/diagram preReader branches; the "toggle-as-core-
  control PREDICT block at PRE" ergonomics question stays a watch-item.
- **K-stage presentation mode (MVP)** (2026-07-15) — **user-confirmed in browser**:
  on-rails one-section rail, wordless arrow advance, `[SECTION_START]` narration
  work. The stream's browser gate is closed. NOTE: per-primitive internal chrome
  (counters/steppers inside components) is a SEPARATE ongoing backlog item — keep
  recording Audit-C chrome FAILs under the BACKLOG systemic entry; the stage only
  removes lesson-level chrome.
- **Gemini Live resumption** (2026-07-15) — **user-confirmed live**. The 1008
  session-duration abort is fixed via `context_window_compression` +
  `SessionResumptionConfig` + GoAway-driven transparent reconnect
  (`backend/app/api/endpoints/lumina_tutor.py`, `LuminaAIContext.tsx`). Memory's
  "NOT runtime-tested live yet / uncommitted" was the last stale caveat — the
  code is committed (tree clean) and the user verified the live behavior.
- **Opus generator-fix lane** (2026-07-15) — all three delegated tasks landed and
  are committed: shape-tracer SHT-1 (code-placed geometry, 4/4 runtime-verified),
  word-workout vowel-scope binding, phoneme-explorer initial-sound routing, plus
  word-flip routing. Residual = PRE band-audit for word-workout/word-flip, which
  lives in the reader-fit queue as **item 10** (not a delegated task). Optional
  2b-P2 chrome band-gate is tracked as reader-fit **item 2b**. Nothing lane-specific
  remains.
- **Pulse Agent v2** — Phases 1–3 + v2.1 + v2.2 SHIPPED, committed AND pushed
  (cb058b9/ecac549/5a5f7d3; main in sync with origin — "push pending" was stale).
  Phase 4 (close-out delta + generation-context) is **optional per PRD §D** —
  reopen only if that delta becomes needed. Residual worth keeping: the
  gate/selector disagreement on student 1004 COUNT001-01-D the harness surfaced.
- **Voice control (knowledge-check pilot)** — TF + MCQ wiring COMMITTED
  (edeadeb); LetterSpotter has NO voice wiring **by ruling** (unbenched
  letter-name homophone class — that's a standing decision, not pending work;
  reopens only if a Voice Studio letter-name bench is built). Sole residual =
  2-min human mic smoke → HUMAN-CHECKS #11. Platform follow-up noted in memory:
  global single-mic lock before any MCQ voice sweep.

## Standing hygiene
- Human-only verification debt lives in `my-tutoring-app/qa/HUMAN-CHECKS.md` — burn
  down in one browser sitting, not per-stream archaeology.
- Uncommitted surface: keep it to ONE stream's worth; `/ship` slices as streams
  close work. Shared files (EVAL_TRACKER, BACKLOG, run_tutor_live.py) commit in
  their own slice to reduce cross-session collisions.
