# Bar-model: K graph explanations and related surveys

Implemented 2026-09-09. Automated checks pass; live microphone and browser acceptance remain open. This does not close the two curriculum requirements as verified/shipped.

## Behavior

- `say_what_it_shows` (beta 2.0): the child explains a true comparison from a three-category one-to-one graph in their own words. Covers the remaining MEAS001-03-G surface.
- `compare_two_graphs` (beta 2.2): morning and afternoon surveys use matching categories, icons, and spacing. Challenges alternate requests for a similarity and a difference. Each pair offers both. Covers the remaining MEAS001-09-E surface.
- Gemini supplies category vocabulary; code supplies counts and derives the private comparative facts from the displayed data. Each icon represents one item. No totals, numeric axis, or answer choices appear in these tasks.
- The existing `concept_statement` spoken runner judges meaning, accepts paraphrases, and refuses reversed facts, bare numbers, prompt echoes, and irrelevant statements. After a correct attempt, the tutor counts supporting rows aloud. Two corrections cap an item; unresolved items remain incorrect.
- Spoken outcomes, correction scores, and observations flow through the existing primitive evaluation hook. The phase display and submitted score agree. Mixed sessions identify themselves as `mixed` and preserve each challenge's mode in their results.
- Intent resolution now supports single modes and blends; a request without a routing signal produces varied grade-appropriate practice. The existing flat-slot sub-generators remain mode-specific, so routing selects the schema before generation; there is no generated-type post-filter.
- Build sticker totals are hidden at every tier, including older payloads requesting placed-count labels.
- Disabled legacy tutoring now cancels queued context updates, preventing interference with the spoken judging contract during a mixed session.

## Evidence

- **26 focused tests passed**: independent graph-fact calculations, ties, requested relation, shared spoken-pack validation, malformed second graphs, displayed icons/masking, correction-cap progression, score preservation, and tutor-context handoff; includes the existing bar-model oracle suite.
- **6/6 fresh pinned sessions, 24 challenges** across both new modes and easy/medium/hard: [draws](bar-model-explanations-2026-09-09.json).
- **4/4 live routing cases**: each new mode from intent, a two-mode spoken blend, and a genuinely mixed unpinned K session: [routing](bar-model-routing-2026-09-09.json).
- **8/8 existing K regression sessions, 36 challenges** across build/read/most-least/match at easy and hard: [regression](bar-model-k-regression-2026-09-09.json).
- Project-local `tsc --noEmit`: no new diagnostics against the pre-change baseline. The repository has existing TypeScript errors; this is not a clean whole-project typecheck.
- Catalog and backend beta priors agree; discrimination remains the shared 1.4 default. Context generator registration passes the complete generation context through.

The component tests mock the speech transport. The data oracle explicitly records `live-spoken-meaning` as unchecked; neither constitutes live audio-judging evidence.

## Remaining acceptance

In Math Primitives Tester, select Bar Model, Kindergarten, then **Tell What the Graph Shows (K)** and **Compare Related Graphs (K)**. On a real microphone, try a correct informal paraphrase, the opposite comparison, a bare number, and an irrelevant statement. Confirm that the graph-specific meaning decides the verdict, totals are not spoken before an attempt, count-along feedback finishes, and a capped wrong answer advances without credit. Compare the morning/afternoon layouts at tablet width and try one blended session to exercise the tutor handoff. Tracked in HUMAN-CHECKS #147.

No browser automation or live microphone capability was available in this session. Curriculum support rows remain open pending this acceptance.
