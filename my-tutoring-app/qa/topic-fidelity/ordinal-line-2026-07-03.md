# Topic Fidelity: ordinal-line — 2026-07-03

Scope/theme intended: the ordinal **position window** the lesson questions about
(e.g. "positions 6th through 10th" → targets ∈ {6..10}; the line still shows 1..N).

## Trigger
The "Meeting the Tenth Place" lesson (objective + manifest intent = positions 6th–10th)
rendered "The Great Forest Parade" teaching 1st–5th. In `identify` single-mode this
100% scores as **gate evidence** for a subskill the student was never tested on,
polluting the IRT state the selector reads.

## Diagnosis (before)

`identify` mode, grade 1:

| Probe | intent | maxPosition | targets | verdict |
|-------|--------|-------------|---------|---------|
| bug repro | positions 6th–10th | 8, then 10 | `[2,3,4,5,6,7,8]`, `[2,3,5,6,7,8,10]` | window ignored; one draw can't even reach a 10th |
| discrimination | first to fifth | 5 | `[1,2,3,4,5]` | coincidental (LLM set maxPosition=5), not real honoring |
| no-regression | generic | 10 | `[1,2,3,5,8,9,10]` | grade default |

**Verdict:** FIDELITY BUG (representable — a 6–10 window needs a 10-long lineup, within
the G1 ceiling — so not WRONG PRIMITIVE).

**Mechanism (two, both present):**
1. **Dead field** — the generator read `ctx.topic`/`ctx.gradeContext`/`ctx.raw` but
   never `ctx.intent`; the per-primitive assignment was dropped at the generator.
2. **Code-picked values** — target positions came from `pickPositionsByTier` /
   `pickDistinctPositions` over `[1..maxPosition]`. A `maxPosition` ceiling existed but
   **no window floor** (`minPosition`), so prompt prose alone couldn't bind them → Tier 2.

## Fix (Tier 2)

`resolveOrdinalPositionWindow(topic, intent, gradeLevel)` in `gemini-ordinal-line.ts` —
mirrors `resolveTopicNumberRange` in `gemini-number-line.ts`:
- Schema-constrained Flash-Lite call (`hasExplicitWindow`, `startPosition`, `endPosition`),
  `temperature: 0`. Returns `null` on failure OR general practice (no explicit window) →
  grade-band default stands. Grade is the ceiling: `end` clamped to 5 (K) / 10 (G1).
- Gated on `config.maxPosition === undefined` (the legacy override); +1 flash-lite call
  per render only when no window is pinned.

Threading (line = 1..maxPosition always; window narrows only *which positions are asked*):
- `generateSetup` — window forces `maxPosition ≥ window.end` (a 10th needs a 10-long lineup),
  clamped to grade max; only ever raises, never shrinks the grade default.
- Code builders — `questionPositions(maxPosition, window)` feeds `identify` (`pickPositionsByTier`),
  `match` (pairs), `relative-position` (reference position). `build-sequence` / `sequence-story`
  order the whole visible line, so the window governs line length only (noted in code).
- Multi-mode LLM generators (`generateIdentify`/`generateMatch`/`generateRelative`) — window
  bounds injected into the prompt + post-LLM clamp into the window.

## Verify (after)

`identify` mode:

| Probe | topic/intent | maxPosition | targets | verdict |
|-------|--------------|-------------|---------|---------|
| bug repro ×2 | positions 6th–10th (G1) | 10 | `[6,7,8,9,10]`, `[6,7,8,9,10]` | **HONORED** |
| discrimination | first to fifth (G1) | 10 | `[1,2,3,4,5]` | tracks |
| discrimination | third through seventh (G1) | 10 | `[3,4,5,6,7]` | tracks |
| no-regression | generic (G1) | 10 | `[1,2,3,4,6,8,10]` | grade default |
| grade-ceiling | 6th–10th at **K** | 5 | `[1,2,3,4,5]` | **clamps to K max** (grade wins over intent) |

- **tsc:** 1101 (baseline 1101 — zero new errors, none in the generator).
- **No answer leak** — window narrows which positions are asked; the correct character is
  never named in topic/intent text.

**Verdict:** FIDELITY BUG → fixed at Tier 2.
**Change:** `gemini-ordinal-line.ts` — new `resolveOrdinalPositionWindow` + window threaded
through setup and the identify/match/relative builders (both single- and multi-mode paths).

## General lesson
`ordinal-line` is the number-line range bug in ordinal clothing: a primitive with a
magnitude **ceiling** but no **window floor** silently anchors every question at position 1.
The dead-field + code-picked combo is invisible to a scope-carrying topic probe (the
discrimination "first to fifth" run looked HONORED pre-fix by coincidence) — the
window-narrowing intent-discrimination probe is what exposes it. See
[[topic-fidelity-context-native]], [[schema-over-regex-and-prompt]].
