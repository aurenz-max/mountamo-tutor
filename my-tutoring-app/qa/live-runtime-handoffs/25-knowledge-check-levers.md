# knowledge-check levers (core, every subject)

Date: 2026-09-29 · Executor: `/primitive-contract`, then `/add-support-tiers` · Follows: [21](21-lever-rollout.md) "Literacy and core" · Draft: `qa/support-levers/inventory-2026-09-27/levers-core.json` (knowledge-check entry) · Evidence: `qa/support-levers/reinventory-2026-09-29.md`

## Why this exists

knowledge-check appears in lessons of every subject and has no levers (0/4 modes; 60 declared misses, 1 mode measured, 3 unmeasured). A stuck learner on a check question gets only `begin_help`. It is the highest-reach primitive without levers.

## Rulings

Handoff 21's apply. The draft's open "R4" question is settled: removing a choice is allowed and counts as assisted work, never unaided credit (09-27). Live per the 09-28 readiness rule.

**Not ruled, do not touch:** handoff 19 item 9b (the session-score merge overwrites each problem's own score on knowledge-check). Build levers without changing scoring; note any interaction in the report.

## Before you start

1. `/ship` anything uncommitted.
2. **Files:** `primitives/knowledgeCheckWorkspace.ts` and its tests, the knowledge-check component and generator, its catalog entry (`catalog/assessment.ts`). Math (23) and literacy (24) run beside it; no overlap. No `runtime/` edits.
3. `/primitive-contract knowledge-check` first: it serves every subject, so the contract lists what each consumer relies on.

## Work

1. **Measure:** saved payloads for the three unmeasured modes (Flash only); run the sweep.
2. **Near/far tag:** the generator tags each text distractor `near` or `far` (schema field, not prompt prose); numeric distractors use distance in code. Keep the schema small (CLAUDE.md: 3-4 types). Probe 10+ generations that the tag is present and sensible before building on it.
3. **Levers from the draft:** `drop_far_choice` (disable one unpicked far distractor, keep at least two live choices; not offered on a single-try item's only try), and `cue_picture` for recall/apply items where a picture helps. Leak rule: a cue never names or pictures the keyed answer, and never shows which choice is right by position or emphasis.
4. **Misses:** the tap miss function exists (`knowledgeCheckMiss`); spoken kinds were named in Part B. Map each miss to a lever or to `unanswered` with a reason.
5. Gate: miss and `nextLever` tables, leak tests on saved payloads per subject (math, science, literacy at least), mounted pull test, J9 green, `typecheck:lumina` 0, tsc at or below baseline.

## Closing

Contract, a report in `qa/eval-reports/`, handoff 21's core line, `WORKSTREAMS.md` Phase 3, one HUMAN-CHECKS row. knowledge-check is its own class for Live: one pair once every mode is levered.

**DONE 2026-09-29.** Report `qa/eval-reports/knowledge-check-levers-2026-09-29.md`; contract R10-R12, `--check` COMPATIBLE; HUMAN-CHECKS #178. Finding KC-UB (`/eval-fix`) in WORKSTREAMS 3.1c.
