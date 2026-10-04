# Contract: sentence-analyzer

- **Derived:** 2026-10-04 (static: lever table, QA reports, tests, git history; no live census) · evidence window: 2026-08-17 → 2026-10-04
- **Component:** `primitives/visual-primitives/literacy/SentenceAnalyzer.tsx` · **Domain:** `sentenceAnalyzerScript.ts`, `sentenceAnalyzerWorkspace.ts`, `sentenceAnalyzerLevers.ts`, `sentenceModels.ts` · **Generator:** `service/sentence-analyzer/gemini-sentence-analyzer.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (sentence-analyzer)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G2-8 grammar: identify_pos, identify_role, label_all, parse_structure | catalog + payloads | `w1-payloads/sentence-analyzer.*.json` (grades 2, 3, 4, 6; an easy tier) | 2026-10-04 |
| Live tutor + JEV (workspace path) | dry journey, text replay | `qa/tutor-reports/replay/sentence-analyzer-2026-10-04.json` | 2026-10-04 |
| Support levers (literacy G2-6 family 2) | `/add-support-tiers` | `qa/support-levers/sentence-analyzer-lever-table-2026-10-03.md` | 2026-10-04 |

## Requirements

### R1 — Every answer is a grammar label said from memory; the wall is reference, never narrowed · OBSERVED
- **Property:** the grade wall is printed in full on every item (plan R7: no narrowing).
- **Probe:** `SentenceAnalyzer.workspace.test.tsx`.

### R2 — No word of the item's sentence is labelled before credit · OBSERVED
- **Property:** labels appear under a word only after its credit. Levers act on other sentences (model cards, practice) and on the wall (examples for every label at once); the tutor does not say a label aloud before a try.
- **Probe:** `SentenceAnalyzer.levers.workspace.test.tsx`; text replay `no_key_before_try`.

### R3 — Models and practice are answer-blind (plan R1/R2) · OBSERVED
- **Property:** picks depend on the wall, the session's words and the item id, never the answer; a part-of-speech model carries both members of every pair on the wall (Adjective/Adverb, Noun/Pronoun), a role model every role on the wall; no pool word is a session target, and no pool word of 4+ letters is in a session sentence.
- **Probe:** `sentenceAnalyzerLevers.test.ts` (every saved payload; two items differing only in the answer get the same model and practice).

### R4 — Answer keys a child would be refused on are not asked · OBSERVED
- **Property:** an objectless preposition, an object of no preposition, and a number word's part of speech are cleared (`unaskableKeys`, 2026-10-04).
- **Probe:** `g26ContentGates.test.ts`.

### R5 — Simplify stays in the action · OBSERVED
- **Property:** `short_sentence` (3-4 words, one word to name), `short_subject` (two-word subject; refused when the item's is already two or fewer), `plain_kind` (the kind in its plainest form). Ungraded; the full item returns.

### R6 — The tier only sets where the levers start · OBSERVED
- **Property:** easy draws the wall examples (not offered, not recorded); other tiers draw nothing. `leadInFor` serves the DI bench only.
- **Probe:** `g26LeverStarts.test.ts`.

## Conflicts

None open.

## Changelog

- 2026-10-04: derived (initial, static) with the lever slice. 6 requirements, 0 conflicts.
