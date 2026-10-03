# Contract: di-word-problem-setup

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-09-07 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiWordProblemSetup.tsx` (own `useWorkspaceRunner`, not the DI stage) · **Domain:** `diWordProblemPlan.ts`, `diWordProblemScript.ts`, `diWordProblemWorkspace.ts`, `diWordProblemLevers.ts` · **Generator:** `service/direct-instruction/gemini-di-word-problem-setup.ts` · **Catalog:** `service/manifest/catalog/di.ts`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G1-3 word-problem setup: find_big_number, build_family, classify_and_build | catalog + QA | payloads `w1-payloads/di-word-problem-setup.*.json` (all three since 2026-10-03) | 2026-10-03 |
| Live tutor + JEV | tutor reports | `di-word-problem-setup-live-di-signature-2026-09-10.md` (12/12) | 2026-10-03 |
| Support levers (DI family 10) | `/add-support-tiers` | `qa/support-levers/di-word-problem-setup-lever-table-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — Hands place, voice says; the activity checks the placement · OBSERVED
- **Probe:** `DiWordProblemSetup.workspace.test.tsx`.

### R2 — Nothing the child must say or place is drawn before credit · OBSERVED
- **Property:** marks are keyed to credited step ids; a practice story's earlier steps are drawn as given (never credited).

### R3 — The model is two stories (add and subtract) or three (one per kind), never one (R1) · OBSERVED
- **Property:** code-owned themes; never the item's frame; no model amount is one of the item's; no model answer within one of the item's; the same card across the steps of one story.
- **Probe:** `diWordProblemLevers.test.ts` (every frame on a grid within 20).

### R4 — Help marks what the child does, never the answer · OBSERVED
- **Property:** `story_links` underlines only the tapped card's sentence; `read_along` highlights positions already drawn; `count_dots` draws known parts only (subtract: the known part crossed out), refused above 20.
- **Probe:** `DiWordProblemSetup.levers.workspace.test.tsx`.

### R5 — `within_ten` is the solve step of the same frame with small numbers · OBSERVED
- **Property:** at most 10 (20 in a within-100 session), no shared amount, a different answer; ungraded; the full step returns. No simplify on the placement, operation or classify steps.

### R6 — Only easy starts with the model (no tier is medium) · OBSERVED

## Conflicts

None open.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 6 requirements, 0 conflicts.
