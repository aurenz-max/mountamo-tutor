# Eval Report: planetary-explorer — 2026-04-04

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| explore   | PASS   | —      |
| identify  | FAIL   | 1      |
| compare   | PASS*  | —      |
| apply     | PASS   | —      |

*compare mode may hit fallback stochastically (see prior report). Fallback is structurally valid.

## Issues

### identify — Trivial identification: questions always about the current planet

- **Severity:** CRITICAL
- **What's broken:** In Identify mode, questions are generated per-planet and ask "Which planet has X?" while the student is currently viewing that planet — its name is shown in the header, its stats/description just read. The student trivially answers by picking the planet they're on. The mode tests nothing beyond basic UI reading.
- **Data:** API response confirms: Jupiter stop asks "Which planet is the largest?" (answer: Jupiter). Saturn stop asks "Which planet has rings?" (answer: Saturn). Every question's answer = the current planet.
- **Root cause:** Data architecture nests questions inside each `PlanetStop`. The generator prompt says "describe a planet without naming it" but Gemini generates questions about the planet it's currently describing. Even if Gemini asked about a *different* planet, the component shows the current planet name in the header — student can eliminate it.
- **Fix in:** GENERATOR + COMPONENT
- **Fix approach (two options):**
  1. **Post-journey quiz phase** (recommended): After visiting all planets, present a pooled quiz where questions ask about any planet visited. Component hides planet-name headers during quiz. Generator builds cross-planet questions from the full set.
  2. **Cross-planet questions per stop**: Each planet's identify questions ask about a *different* planet the student visited earlier. Component hides planet name during these questions. More complex to implement, less natural UX.

## G1-G5 Sync Check

| Rule | Status | Notes |
|------|--------|-------|
| G1 — Required fields | PASS | All fields present across all modes |
| G2 — Flat-field reconstruction | PASS | Stats and questions correctly reconstructed |
| G3 — Eval mode differentiation | **FAIL (identify)** | Identify mode questions are semantically identical to explore — both ask about the current planet. The mode doesn't test identification. |
| G4 — Answer derivability | PASS | Answers match visible data (the problem is the data is *too* visible) |
| G5 — Fallback quality | PASS | Fallback produces valid challenges |
