# Contract: oral-sentence-studio

- **Derived:** 2026-09-29 · evidence window: workspace rollout C7 + w1 payloads + `OralSentenceStudio.workspace.test.tsx` + `oralSentenceStudioScript.test.ts` + git
- **Component:** `primitives/visual-primitives/literacy/OralSentenceStudio.tsx` (workspace only) + `oralSentenceStudio.card.ts` + `oralSentenceStudio.boss.ts` (spoken preset) + `oralSentenceStudioDomain.ts` (build gate, meaning key, misses, scene) + `oralSentenceStudioLevers.ts` (lever set) · **Generator:** `service/literacy/gemini-oral-sentence-studio.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`oral-sentence-studio`)
- **Status:** ACTIVE (no open conflicts)

Static derivation for the oral-sentence-studio slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 vocabulary in speech: describe_scene, guided_writing_rehearsal, use_story_words | catalog evalModes | `literacy.ts` oral-sentence-studio entry | live |
| Shared teaching workspace + live journey | live + code | `oralSentenceStudio.boss.ts`; w1 payloads | 2026-10-19 |

## Requirements

### R1 — One original spoken sentence, both words with their meanings; the answer set is open · OBSERVED
- **Probe:** `npm test -- OralSentenceStudio.workspace oralSentenceStudioDomain`.

### R2 — No example sentence or scene meaning on screen or said before credit · OBSERVED
- **Probe:** `npm test -- OralSentenceStudio.levers` (no accepted sentence in the DOM after both pulls).

### R3 — Generated meaning pictures · OBSERVED (09-29)
- **Property:** `meaningEmoji0/1` are required in the schema and validated softly into `wordEmojis`. A missing, doubled or scene-repeating picture drops the pictures, never the challenge. Fallback scenes carry none.
- **Probe:** `node scripts/oral-sentence-studio-levers-probe.mjs --run` (09-29: 18/18 items, 0 fallbacks).

### R4 — In-item levers · OBSERVED
- **Property:** spoken misses `words_listed`, `fragment`, `word_missing`, `word_misused`, `off_task` (`oralSentenceSpokenMisses`; listed on the card, `ORAL_SENTENCE_MISSES`). `sentence_strip` (help, both; lever type custom; empty Who? / What happens? boxes beside the word chips) answers `fragment`, `words_listed`. `word_pictures` (help, both; lever type meaning; a meaning picture under each word) answers `word_missing`, `word_misused`, and is withheld when `wordPicturesLeak`. `off_task` has no lever by decision. No simplify: two words in one sentence is the mode.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- oralSentenceStudioLevers OralSentenceStudio.levers`.

### R5 — Open-speech modes print nothing and have no code key · OBSERVED (generation 11-10)
- **Property:** ask_question, say_why and two_voices (`oralSentenceStudioOpen.ts`) show library pictures only (`gemini-oral-open-speech.ts` picks words through schema enums and looks up the emoji) and print no words; the tutor says the situation and the claim. The key is a meaning key with the mode's credit rule; the three examples are judge anchors, shown only after credit. A say_why claim must carry an opinion frame and no measurable or countable fact (`claimIsOpinion`), and the model's own right-answer flag must be "no". A situation or claim that names an animal not pictured is refused. The word levers (R4) are restricted to the three word modes; the open modes list every miss unanswered by decision. Mixed sessions still schedule only the word modes (R1-R4 payloads unchanged).
- **Demanded by:** handoff H2 (K LA audit: SP2, SP4, SP8, CR3).
- **Probe:** `npm test -- journeySweep -t oral-sentence` (w1 payloads `oral-sentence-studio.{ask_question,say_why,two_voices}.json`); `/eval-test oral-sentence-studio` per open mode.

## Changelog

- 2026-11-10: three open-speech modes (R5), handoff H2. Eval-mode split: they carry no target words, so R1-R4 hold for the word modes only.

- 2026-10-19: moved onto the boss framework (spokenBoss). The judging contract became a meaning `SpokenKey` per mode (the three sentences are examples, never required words); levers became one lever set. R1-R4 unchanged; probes renamed.
