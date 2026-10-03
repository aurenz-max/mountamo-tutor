# Contract: di-deduction

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-09-07 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiDeduction.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diDeductionPlan.ts`, `diDeductionScript.ts`, `diDeductionWorkspace.ts`, `diDeductionLevers.ts` · **Generator:** `service/direct-instruction/gemini-di-deduction.ts` · **Catalog:** `service/manifest/catalog/di.ts` · **Probe:** `scripts/di-deduction-spares-probe.mjs`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G3-5 reasoning from a rule: conclude, deny, cannot_tell | catalog + QA | payloads `w1-payloads/di-deduction.*.json` (regenerated 2026-10-03 with spares) | 2026-10-03 |
| Live tutor + JEV | tutor reports | 09-07 bench (67/67), signature run | 2026-10-03 |
| Support levers (DI family 8) | `/add-support-tiers` | `qa/support-levers/di-deduction-lever-table-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — Every rule is true, and every lookalike is a kindNoun thing that truly has the property · OBSERVED
- **Property:** the truth review drops a false rule and trims any entity that fails its list, including a lookalike that is not the kind of thing named (pillow for "this animal"). The schema names the field `notCategoryButHasProperty` (as `lookalikes`, flash-lite listed members in most rules). A failed review keeps nothing; the call is retried once.
- **Probe:** `scripts/di-deduction-spares-probe.mjs --run`.

### R2 — The cannot_tell subject is anonymous; the lookalike appears only in the reason · OBSERVED

### R3 — The model is a generated spare rule worked through every verdict (R1, R3) · OBSERVED
- **Property:** spares are truth-reviewed rules the session never asks and that share no content word with it (kind noun excluded). A spare with a lookalike is reserved before the session is filled when the rest keeps the case floor; otherwise one extra call writes spares against the session's words. The model card shows the spare's yes, no and (with a lookalike) can't-tell cases with reasons; a cannot_tell item needs a spare with a lookalike, or the lever is not offered.
- **Evidence:** probe 2026-10-03 with the route's grade string: a usable spare in 5 of 6 runs.
- **Probe:** `diDeductionLevers.test.ts`.

### R4 — Help prints frames and lights printed words, never a verdict · OBSERVED
- **Property:** `answer_frame` ("A robin ___." / "___ because ___"); `shared_term` (conclude, deny only).
- **Probe:** `DiDeduction.levers.workspace.test.tsx`.

### R5 — `counterexample_card` is an ungraded cannot_tell case on a spare, its lookalike printed · OBSERVED

### R6 — Guidance stays under the 2000-character offer cap · OBSERVED
- **Probe:** `activityContract.test.ts`.

## Conflicts

None open.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 6 requirements, 0 conflicts.
