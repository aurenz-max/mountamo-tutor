# Contract: oral-sentence-studio

- **Derived:** 2026-09-29 · evidence window: workspace rollout C7 + w1 payloads + `OralSentenceStudio.workspace.test.tsx` + `oralSentenceStudioScript.test.ts` + git
- **Component:** `primitives/visual-primitives/literacy/OralSentenceStudio.tsx` (workspace only) + `oralSentenceStudioScript.ts` (build gate, judging contract) + `oralSentenceStudioWorkspace.ts` + `oralSentenceStudioLevers.ts` · **Generator:** `service/literacy/gemini-oral-sentence-studio.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`oral-sentence-studio`)
- **Status:** ACTIVE (no open conflicts)

Static derivation for the oral-sentence-studio slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 vocabulary in speech: describe_scene, guided_writing_rehearsal, use_story_words | catalog evalModes | `literacy.ts` oral-sentence-studio entry | live |
| Shared teaching workspace + live journey | live + code | `oralSentenceStudioWorkspace.ts`; w1 payloads | 2026-09-29 |

## Requirements

### R1 — One original spoken sentence, both words with their meanings; the answer set is open · OBSERVED
- **Probe:** `npm test -- OralSentenceStudio.workspace oralSentenceStudioScript`.

### R2 — No example sentence or scene meaning on screen or said before credit · OBSERVED
- **Probe:** `npm test -- OralSentenceStudio.levers` (no accepted sentence in the DOM after both pulls).

### R3 — Generated meaning pictures · OBSERVED (09-29)
- **Property:** `meaningEmoji0/1` are required in the schema and validated softly into `wordEmojis`. A missing, doubled or scene-repeating picture drops the pictures, never the challenge. Fallback scenes carry none.
- **Probe:** `node scripts/oral-sentence-studio-levers-probe.mjs --run` (09-29: 18/18 items, 0 fallbacks).

### R4 — In-item levers · OBSERVED
- **Property:** spoken misses `words_listed`, `fragment`, `word_missing`, `word_misused`, `off_task` (`oralSentenceSpokenMisses`, the judging contract's categories). `sentence_strip` (help, both; empty Who? / What happens? boxes beside the word chips) answers `fragment`, `words_listed`. `word_pictures` (help, both; a meaning picture under each word) answers `word_missing`, `word_misused`, and is withheld when `wordPicturesLeak`. `off_task` has no lever by decision. No simplify: two words in one sentence is the mode.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- oralSentenceStudioLevers OralSentenceStudio.levers`.
