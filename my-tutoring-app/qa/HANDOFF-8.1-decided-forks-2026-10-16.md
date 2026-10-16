# Handoff: 8.1d, 8.1e, 8.1g — the three items the user decided 10-15 — 2026-10-16

Queue: `my-tutoring-app/qa/difficulty-demo/QUEUE.md` (authority over this file). Phase 8 in `WORKSTREAMS.md`.
Branch `ship/2026-08-10-judged-loop`. Other sessions share the tree: commit by path, never `git add -A`.
The rulings are made; do not reopen them. Each item is one slice and one commit.

## 8.1g fraction-bar: build a real `compare` (do first, largest)

Executor `/add-eval-modes fraction-bar`. Today's `compare` names one fraction and compares nothing.
- **Rename** today's mode to what it does (e.g. `identify`) and keep its lessons working: grep the catalog, the
  eval-mode registry and any stored mode names before renaming; add an alias if a stored name can reach it.
- **New `compare`:** two bars; the child picks the bigger one, or `<` `=` `>`. Tiers from the `fraction-compare`
  item space: easy same denominator, medium same numerator, hard unlike denominators or against 1/2.
  Code picks the pair and the key; Gemini writes the context only.
- Contract first: `/primitive-contract fraction-bar --check` before editing.
- Verify: `/eval-test fraction-bar` on both modes x 3 tiers; Easy/Medium/Hard table.
- 8.1n (`add_subtract`) is NOT in scope: its ruling is still owed.

## 8.1e ratio-table: hide the scale factor

Executor `/primitive-contract ratio-table` fork, then `/add-support-tiers`. The `missing_value` header shows the
scale factor, which does 6.RP.3's step for the child (contract R2).
- Hide the factor at every tier. The `xm` label moves into the `times_arrows` help lever.
- Tiers stay structural (whole factor, non-whole, unit rate below one). Never make a tier "show the factor".
- Record the fork in `docs/contracts/ratio-table.md` (the requirement R2 changes for this mode only).
- Verify: `/eval-test ratio-table missing_value` x 3 tiers, and the lever pulled once in the tester.

## 8.1d measurement-tools `convert`: the objective's grade sets the units

Executor `/eval-fix`. Today `convert` is in<->cm with 2.54 (decimal multiplication) even for 4.MD.A.1, which is
within one system.
- Ruling: cross-system stays allowed, but only when the objective asks for it (e.g. 6.RP.3d). 4.MD/5.MD objectives
  convert within one system (ft/in, m/cm, lb/oz, L/mL).
- Read the grade and objective through the shared scope context (`scopeContext.ts`; grade is a ceiling).
- Verify: generations for a 4.MD.A.1 objective (0 cross-system items in 10) and a 6.RP.3d one (cross-system present).

## Gates and close-out

- `npm run typecheck:lumina` = 0; full tsc not above baseline (770); the touched primitives' tests.
- Screen changes: drive them in the tester or write "needs a browser check" and file a HUMAN-CHECKS row
  (re-grep the next free `### #N` first).
- Mark each row DONE in `QUEUE.md` with its commit, in the same commit. Update the phase 8 row in `WORKSTREAMS.md`
  at the end.
