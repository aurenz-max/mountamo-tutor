# Topic Fidelity: counting-board — 2026-06-27

Scope/theme intended: counts ≤ the bound named by the topic/intent ("Counting to 5" → all counts ≤ 5).
Probe mode: `count` (count_all), gradeLevel kindergarten.

## Before fix

| Probe | topic | max count | verdict |
|-------|-------|-----------|---------|
| honored        | Counting to 5  | 20 / 10 | IGNORED |
| discrimination | Counting to 10 | 20      | doesn't track |
| discrimination | Counting to 20 | 20      | (matches, but constant) |
| no-regression  | Counting practice | 20   | grade default |

Every probe ramped to the K grade-band ceiling (20) regardless of the topic — a constant. The "to 10" control maxing at 20 confirmed scope was ignored, not coincidentally correct.

## After fix (Tier 1)

| Probe | topic | max count | verdict |
|-------|-------|-----------|---------|
| honored        | Counting to 5  | 5 (×2 runs) | HONORED |
| discrimination | Counting to 10 | 10      | tracks |
| discrimination | Counting to 20 | 20      | tracks |
| no-regression  | Counting practice | 20   | grade default (unchanged) |

No answer leak: instructions/hints/narration never name the bound number.

**Verdict:** FIDELITY BUG → fixed at Tier 1 (prompt prose; counts are LLM-chosen).

**Mechanism:** prose-only + code-conflict. The prompt interpolated `topic` only in the
opening line; counts were LLM-chosen but pushed to the grade ceiling by (a) the grade
guidelines and (b) line 441's hardcoded `randomStartCount` (3–8) + "progress upward"
instruction. Code clamped only to the grade band (K ≤ 20), never to the topic. Separately,
`config.intent` was a fully **dead field** — not even declared on the config type, and the
registry never threaded production `item.intent`.

**Changes:**
- `gemini-counting-board.ts`: added `intent?: string` to config; added a high-priority
  `## TOPIC SCOPE` prompt section that caps every count at the topic/intent bound (grade =
  ceiling, tighter topic wins) with an explicit no-answer-leak rule; softened the
  `randomStartCount` "progress upward" line to yield to a tight bound.
- `mathGenerators.ts`: threaded intent into the counting-board registration
  (`intent: (item.config?.intent as string|undefined) || item.intent || item.title`),
  mirroring the ten-frame pattern, so intent reaches the generator in production, not just
  via the eval-test route.

tsc: 1419 (baseline 1419).
