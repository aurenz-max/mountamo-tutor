# Tutor Scaffold Report — interactive-book — 2026-07-14

## Verdict

**PASS (Tier 1 + Tier 2)** — the catalog scaffold, component context, tagged pedagogical moments, and a real generated-content probe all resolve cleanly.

- Static contract: PASS; component and catalog were found, every `contextKey` is supplied by `aiPrimitiveData`, and all tutor tags are recognized.
- Generated-content probe: PASS; no unresolved template variables, missing context, or literal answer leakage was found.
- Probe context: topic `Animals and habitats`, grade `kindergarten`.
- Generated contract included one coherent book plus locally derived `find-feature` challenges.

## Scaffold shape

- Context keys: `mode`, `gradeLevel`, `wordDifficulty`, `currentChallengeIndex`, `totalChallenges`, `currentFeature`, `currentPageLabel`, `attempts`, `pagesVisited`, `focusWordsExplored`, `selectedFocusWord`, `voiceMode`.
- Tagged moments: `[ACTIVITY_START]`, `[FIRST_VOICE_SUCCESS]`, `[CHALLENGE_INCORRECT]`, `[HINT_REQUESTED]`, `[ALL_COMPLETE]`.
- Answer safety: the tutor may name the feature category and describe where it lives, but may not repeat `targetText` or identify the exact target page before the learner acts.
- Quiet voice mode: routine correct answers and page turns stay silent; the tutor speaks for orientation, first voice success, struggle recovery, explicit hints, and completion.

## Remaining runtime check

Tier 3 (a browser-backed live Gemini tutor journey with audio/transcript inspection) was not run in this build pass. It remains the next tutor-specific verification gate.
