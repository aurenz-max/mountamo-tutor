# Contract: word-sorter

- **Derived:** 2026-09-28 · evidence window: workspace rollout C2 + w1 payloads + `WordSorter.workspace.test.tsx` + git
- **Component:** `primitives/visual-primitives/literacy/WordSorter.tsx` (workspace only) + `wordSorterScript.ts` (build gates) + `wordSorterWorkspace.ts` + `wordSorterLevers.ts` · **Generator:** `service/literacy/gemini-word-sorter.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`word-sorter`)
- **Status:** ACTIVE (no open conflicts)

Static derivation for the word-sorter slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 categorisation: binary_sort, ternary_sort | catalog evalModes | `literacy.ts` word-sorter entry | live |
| K-2 word relations: match_pairs (opposite, synonym, plural, rhyme) | catalog evalModes | same | live |
| Shared teaching workspace + live journey | live + code | `wordSorterWorkspace.ts`; w1 payloads | 2026-09-28 |

## Requirements

### R1 — Every answer is spoken; nothing is tapped · OBSERVED
- **Probe:** `npm test -- WordSorter.workspace`.

### R2 — Nothing marks the right group or partner before credit; the bank never shrinks · OBSERVED
- **Probe:** `npm test -- WordSorter.workspace`.

### R3 — K always names the groups aloud and shows group pictures (band floor) · OBSERVED
- **Probe:** `npm test -- WordSorter.workspace` ("K always may").

### R4 — In-item levers · OBSERVED
- **Property:** `group_pictures` (sorts; a picture on every mat; answers `other_group`, `said_word_back`) and `filed_examples` (the learner's own credited words or pairs of this challenge; answers `other_group` / `other_bank_word`), both help, shown, offered only where the tier withdrew the aid. `filed_examples` is offered only once something is filed. Leak rule `groupPicturesLeak`: no pictures lever when a mat picture is the item's own picture. match_pairs `said_word_back` has no lever by decision. No simplify.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- wordSorterLevers WordSorter.levers`.
