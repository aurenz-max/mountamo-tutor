# Contract: genre-explorer

- **Derived:** 2026-10-04 (static: lever table, QA reports, tests, git history; no live census) · evidence window: 2026-08-17 → 2026-10-04
- **Component:** `primitives/visual-primitives/literacy/GenreExplorer.tsx` · **Domain:** `genreExplorerScript.ts`, `genreExplorerWorkspace.ts`, `genreExplorerLevers.ts`, `genreModels.ts` · **Generator:** `service/literacy/gemini-genre-explorer.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (genre-explorer)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G1-6 genre: identify_basic, classify_genre, compare_genres | catalog + payloads | `w1-payloads/genre-explorer.*.json` (grade 1 band floor, grade 3, grade 4 and 5 hard) | 2026-10-04 |
| Live tutor + JEV (workspace path) | dry journey, text replay | `qa/tutor-reports/replay/genre-explorer-2026-10-04.json` | 2026-10-04 |
| Support levers (literacy G2-6 family 3) | `/add-support-tiers` | `qa/support-levers/genre-explorer-lever-table-2026-10-03.md` | 2026-10-04 |

## Requirements

### R1 — No text names its kind; one ask per kind; identify_basic is binary · OBSERVED
- **Property:** `namesAGenre` gate; identify_basic buckets to Fiction/Nonfiction and drops features that restate either side (`restatesBinaryGenre`, 2026-10-04).
- **Probe:** `g26ContentGates.test.ts`; `GenreExplorer.workspace.test.tsx`.

### R2 — Nothing marks evidence in the learner's text, or the kind of a session text, before credit · OBSERVED
- **Property:** `sentence_rows` marks every sentence alike; `two_checks` are empty; `read_again` reads the whole text evenly (band floor only).
- **Probe:** `GenreExplorer.levers.workspace.test.tsx`.

### R3 — Genre names on a model card only for kinds off the session menu (plan R4) · OBSERVED
- **Property:** a lever exception to the no-badge rule, not an edit of it: `kind_pair_model` shows a sibling pair whose kinds are both off the menu; identify_basic gets no genre model (any model on a two-item menu answers by elimination). The text model is said "this one does …", never "yes": "Yes" is the runtime's verdict sentinel.
- **Probe:** `genreExplorerLevers.test.ts` (every saved payload).

### R4 — Models and practice are never session texts · OBSERVED
- **Property:** hand-written pool (`genreModels.ts`, plan R2); a model predicate shares no content word with a session predicate and says no menu kind in other words.

### R5 — `two_far_kinds` stays a name-genre item · OBSERVED
- **Property:** a pool text named from its kind and one from the other side of fiction/nonfiction, not a sibling, both off the menu; refused on identify_basic. Ungraded; the full item returns.

### R6 — Per-mode misses; the tier only sets where the levers start · OBSERVED
- **Property:** identify_basic `opposite_verdict, said_feature_back, close_relative`; classify adds `other_genre, said_broad_kind`; compare has `other_text, said_both, close_relative, other_genre, said_broad_kind`. Easy starts with the rows, the two checks or the menu marks, by action.
- **Probe:** `g26LeverStarts.test.ts`; catalog test in `genreExplorerLevers.test.ts`.

## Conflicts

None open.

## Changelog

- 2026-10-04: derived (initial, static) with the lever slice. 6 requirements, 0 conflicts.
