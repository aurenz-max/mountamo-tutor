# Topic Trace: "Listen to a short narration about an invention and explain how it changed life for people" (Grade 1) — 2026-08-01

Published subskill: `SS004-05-c` (target primitive: `media-player`).
Scope intended by the subskill: a 30–45 second narrated invention story followed by three simple comprehension questions.
Part of the 2026-08-01 EMERGING demand census.

## Components

| Component | In scope? | Generated evidence / issue | Broken link | Fix target |
|---|---:|---|---|---|
| media-player (`listen_and_look`) | yes | three narrated light-bulb segments with per-segment checks; generic `gradeLevel: elementary` stamp | — | owned by media-player workstream |
| sorting-station (`sort_one`) | yes | Grade-1 inventions vs nature sort | — | — |
| comparison-panel | yes | before/after light-bulb comparison | — | — |
| image-comparison | yes | candle-lit vs electric-lit room | — | — |
| knowledge-check (`analyze`) | **reader-fit fail** | promised picture support but generated long, text-only multi-clause analysis/matching tasks | GENERATOR / modality | EMERGING knowledge-check audit |
| flashcard-deck (final) | **no** | requested 10 review cards about the lesson; announces 15 and expands to Internet, medicine, patent, prototype, etc. | GENERATOR | flashcard scope/count binding |

## Scope drops

### flashcard-deck — review becomes a 15-card introduction to unrelated invention vocabulary

- **Chain:** objective focuses the narrated invention and its impact -> intent asks for 10 simple review cards -> data expands to 15 cards and advanced terms including `patent` and `prototype`.
- **Broken link:** GENERATOR.
- **Fix target:** `gemini-flashcard-deck.ts`; honor requested count and the enumerated taught concepts.

## Reader-fit signal

The authored `SS004-05-c` route reaches media-player in its intended `listen_and_look` mode, so that consumer remains real and should stay owned by the separate media-player reimagining stream. The local reader-fit queue should instead pick up the final `knowledge-check`: its Grade-1 `analyze` problems omit the promised pictures and rely on long written explanations.
