# Topic Trace: "Identify and explain the roles of common community helpers (police, firefighters, teachers, doctors)" (kindergarten) — 2026-07-14

Scope intended by the topic: the four named helpers, their roles and tools.
Part of the 2026-07-14 K demand census.

## Components

| Component | In scope? | Off-scope value / issue | Broken link | Fix target |
|-----------|-----------|-------------------------|-------------|------------|
| foundation-explorer | ✓ | diagram covers 3 of 4 helpers (teacher absent from diagram, present in concepts) | — | — |
| concept-card-grid | ✓ | 4 helpers, tool clues; dense prose at K → reader-fit | — | reader-fit backlog |
| sorting-station | ✗ (partial) | c1 sorts helper gear by **color** (blue vs red) — perceptual, not role knowledge | GENERATOR | `gemini-sorting-station` — same drift as shapes + needs traces |
| deep-dive | ✓ | PRE treatment visible | — | — |
| media-player | ✓ (scope) | knowledgeCheck options are text sentences at K → reader-fit; title/description echo the raw intent string verbatim (template artifact) | GENERATOR (cosmetic) | note only |
| knowledge-check | ✓ (scope) | categorization is text-only at K; "Doctor → Helping us learn or get better" grouping is defensible | GENERATOR | knowledge-check PRE band-gate (reader-fit backlog) |
| image-comparison | ✓ | firefighter before/after with tool | — | — |
| fact-file | ✓ (scope) | text-primary at K; keyStats padded with filler ("2 hands each") | — | reader-fit backlog (minor) |
| word-sorter | ✓ | tool→helper binary sorts, emoji-primary — PRE fixes visible | — | — |
| flashcard-deck | ✗ (mild) | expands beyond the four named helpers (lifeguard, crossing guard, dentist, vet, 15 cards); term/definition text cards at K | INTENT (mild) + band | manifest intent said "all four helpers taught"; generator padded to 15 — mild drift, K-friendly content |

## Scope drops

### sorting-station — gear sorted by color instead of by helper
- Same GENERATOR drift documented in the shapes and needs/wants traces: challenge variety padding replaces the objective attribute. One fix in `gemini-sorting-station` heals all three lessons.

### flashcard-deck — 15 cards vs the 4 taught helpers
- **Chain:** objective "identify four common community helpers" ✓ → intent "recall … all four helpers taught in the lesson" ✓ → data: 15 cards across 8+ helper types
- **Broken link:** GENERATOR — card-count padding ignores the enumerated scope
- **Fix target:** `gemini-flashcard-deck` scope binding (low severity — extra content is topical, but review-of-taught-material becomes introduction-of-new-material)
