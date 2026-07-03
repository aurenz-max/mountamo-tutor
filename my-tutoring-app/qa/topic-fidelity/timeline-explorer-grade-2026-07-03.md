# topic-fidelity --grade — timeline-explorer (2026-07-03)

**Generator:** `my-tutoring-app/src/components/lumina/service/core/gemini-timeline-explorer.ts`
**Eval mode:** `identify` · **Topic:** "the water cycle"
**Verdict:** FIDELITY_BUG_FIXED
**Bug shape:** (A) BAND-MAP KEYED BY PROSE — always-'Elementary'

## Root cause
`const gradeLevel = ctx.gradeContext` (a PROSE sentence) was fed to
`getGradeLevelContext(gradeLevel)`, whose keys are band labels
('Kindergarten'|'Elementary'|'Middle School'|'High School'). The prose never
matched a key, so the `|| contexts['Elementary']` fallback fired for EVERY
objective. A K lesson and a grade-9 lesson both got Elementary content.

## Fix (two parts, established pattern)
1. `gradeToBand(ctx.grade)` resolves the band KEY from the canonical numeric
   grade first; `inferGradeLevelFromContext(ctx.gradeContext)` (mirrors
   fast-fact) is the prose fallback only when grade is absent. `bandKey` is fed
   to `getGradeLevelContext` — fixes the gross always-Elementary bug.
2. `gradeLine` injects the EXACT numeric grade into the prompt so grade-2 ≠
   grade-4 within the Elementary band. Schema / challenge-type / eval-mode axis
   untouched.

## Probe table (avg description signals)

| probe | grade | avg_desc_words | avg_sentence_len | qualitative signal | 
|-------|-------|----------------|------------------|--------------------|
| pre   | K     | 26.6 | 13.3 | "invisible gas called water vapor" |
| pre   | 2     | 25.4 | 12.7 | ~same |
| pre   | 4     | 22.2 | 11.1 | ~same |
| pre   | 5     | 25.2 | 12.9 | ~same |
| pre   | 9     | 30.8 | 15.4 | STILL "invisible gas called water vapor" (elementary vocab) |
| **post** | **K** | 19.2 | 9.6  | "tiny, invisible bubbles" |
| **post** | **2** | 20.2 | 10.1 | "invisible gas called water vapor" |
| **post** | **4** | 22.4 | 11.2 | added "liquid water into invisible gas" |
| **post** | **5** | 23.6 | 11.8 | "energy turns liquid water into..." |
| **post** | **9** | 33.4 | 16.7 | title "The Hydrological Cycle"; "volcanic outgassing", "condensed this vapor into precipitation" |
| post  | none  | 22.8 | —    | elementary band control — unchanged/sensible |

## Outcome
- Cross-band now tracks: K (9.6 wpx) vs grade-9 (16.7 wpx) — grade-9 gains
  genuine HS vocabulary/concept sophistication instead of collapsing to
  Elementary.
- Within-band now tracks: grade-2 (10.1) < grade-5 (11.8), distinct titles.
- Monotonic reading-level gradient K<2<4<5<9.
- No-grade band control unchanged (no regression).
- No answer leak: `identify` descriptions do not reveal the correct option.
- Eval-mode cognitive KIND unchanged (grade governs realization only).
