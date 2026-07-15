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

### 1. Reader-fit K queue — last touched 2026-07-14
- **Queue:** `my-tutoring-app/qa/reader-fit/BACKLOG.md` (top = next)
- **Executor skills:** `/reader-fit [--fix]`, `/eval-fix`, `/tutor-test`
- **Now:** #1e sorting-station PRE presentation audit (generator drift already
  fixed), then #8 rhyme-studio audit, then #9 explainer tail (foundation-explorer
  first, extract shared PRE pattern).
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

### 3. Opus generator-fix lane — `qa/reader-fit/HANDOFF-opus-2026-07-14.md`
- Status per EVAL_TRACKER 2026-07-14: shape-tracer SHT-1 RESOLVED (code-placed
  geometry, 4/4 modes runtime-verified); word-workout vowel-scope binding DONE;
  phoneme-explorer DONE via routing fix. Remaining: word-flip verification detail +
  optional 2b-P2 chrome band-gate (BACKLOG 2b still lists it).
- **Close-out:** confirm all reports + tracker rows recorded, fold residuals back
  into the reader-fit queue, then retire this lane.

## PARKED (trusted-as-of date; re-verify before acting)

| Stream | Queue / doc | Next action | As of |
|---|---|---|---|
| Misconception loop | memory `project_misconception-loop` | Phase 3A | 07-12 |
| Grade-fidelity sweep | memory `project_grade-fidelity-dead-band` | ~24-gen normalizeObjectiveGrade rollout | 07-08 |
| Literacy eval-modes densification | memory + working tree (uncommitted) | /eval-test the 6 ladders, then /ship | 07-13 |
| Flash-lite truncation hardening | memory `project_flash-lite-truncation-template` | ~50-gen sweep | 07-06 |
| LuminaReadAloud 🔊 sweep | `qa/HANDOFF_read-aloud-sweep.md` | pilot browser check → sweep | 07-13 |
| Lumina kit roadmap | `docs/DROPZONE_MIGRATION_PRD.md` + memory `project_lumina-kit-motion-roadmap` | motion tokens + LuminaDropZone COMMITTED (e17679f, e450cb0) + pilot browser-verified; next = DropZone migration batch B1 (10 HTML5-DnD) or LuminaCompletionScreen (88 hand-rolled 🎉 blocks); PRD §2 rulings settled — don't relitigate | 07-14 |
| Curriculum authoring | memory (K-5 archive) | G5 Science + G5 Social Studies; GK phonics starvation | 07-09 |
| Analytics/snapshot residue | memory | snapshot `--all` + commit; metrics grade-join `--apply` | 07-08 |
| K-stage presentation mode | BACKLOG systemic item | browser verification (→ HUMAN-CHECKS); keep accumulating chrome FAILs | 07-13 |
| Gemini Live resumption | memory `project_gemini-live-session-resumption` | live test | 07-10 |
| DeepDive block scaffolding + curator-brief PRE scaffold | memory | live confirms | 07-14 |

**Absorbed:** tutor-test fix campaign (46/130 FAIL) → SP-27. Orphaned tutoring
configs (distribution-explorer, dot-plot) → SP-27 Phase 2/3.

## CLOSED (verified 2026-07-14; reopen deliberately, not by accident)
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
