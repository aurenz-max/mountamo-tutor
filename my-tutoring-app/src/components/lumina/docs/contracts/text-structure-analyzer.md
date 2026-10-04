# Contract: text-structure-analyzer

- **Derived:** 2026-10-04 (static: lever table, QA reports, tests, git history; no live census) · evidence window: 2026-08-17 → 2026-10-04
- **Component:** `primitives/visual-primitives/literacy/TextStructureAnalyzer.tsx` · **Domain:** `textStructureAnalyzerScript.ts`, `textStructureAnalyzerWorkspace.ts`, `textStructureAnalyzerLevers.ts`, `textStructureModels.ts` · **Generator:** `service/literacy/gemini-text-structure-analyzer.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (text-structure-analyzer)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G2-6 text structure: chronological_description, cause_effect, compare_contrast, problem_solution | catalog + payloads | `w1-payloads/text-structure-analyzer.*.json` (12: every mode, a description passage, grades 2-4, easy and hard) | 2026-10-04 |
| Live tutor + JEV (workspace path) | dry journey, text replay | `qa/tutor-reports/replay/text-structure-analyzer-2026-10-04.json` | 2026-10-04 |
| Support levers (literacy G2-6 family 4) | `/add-support-tiers` | `qa/support-levers/text-structure-analyzer-lever-table-2026-10-03.md` | 2026-10-04 |

## Requirements

### R1 — The passage is never read aloud; every answer is said · OBSERVED
- **Property:** the tutor may read an idea card and a model card, never the passage or a practice card.
- **Probe:** `TextStructureAnalyzer.workspace.test.tsx`; text replay.

### R2 — Nothing marks a word inside the passage before credit · OBSERVED
- **Property:** `focus_sentence` and `source_sentence` ring one whole sentence; `source_sentence` is refused when the sentence holds a word of the answer's part name and of no other.
- **Probe:** `TextStructureAnalyzer.levers.workspace.test.tsx`; `textStructureAnalyzerLevers.test.ts`.

### R3 — The passage does not print its structure's name (plan R6) · OBSERVED
- **Property:** a passage that does loses its structure ask (`passageNamesStructure`); the generator draws once more and the prompt bans the phrases; the phrases stay countable signals. No mini passage prints any structure's name.
- **Probe:** `g26ContentGates.test.ts`; pool test.

### R4 — Models and practice are other material · OBSERVED
- **Property:** a link model's word is not in the passage and shares no passage word of 4+ letters; a structure model is a different structure in the grade band (off the menu first; a menu structure only on a menu of 3+); `structure_practice` (plan R5) is a mini passage of another structure named from two far options. Grade 2 gets neither (elimination). Anchor and two-part practice use spare ideas that are never asked.

### R5 — Simplify stays in the action · OBSERVED
- **Property:** `short_link_sentence` (one linking word on a card), `structure_practice`, `two_part_practice` (3-part charts only: a comparison drops its shared part, a sequence its middle). Ungraded; the full item returns.

### R6 — The tier only sets where the levers start · OBSERVED
- **Property:** easy draws the ring, the spoken menu and the anchor; medium the ring and the spoken menu; hard nothing. The levers make these pullable where the tier left them off.
- **Probe:** `g26LeverStarts.test.ts`.

## Conflicts

None open.

## Changelog

- 2026-10-04: derived (initial, static) with the lever slice. 6 requirements, 0 conflicts.
