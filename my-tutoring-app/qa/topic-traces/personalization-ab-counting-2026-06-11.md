# Topic Trace: Personalization A/B — "Counting objects up to 20" (kindergarten) — 2026-06-11

First wiring test of the STUDENT PROFILE block in the manifest prompt. Three
manifest-only runs with **identical fixed objectives** (so the profile is the
only variable):

- obj1: "Count objects one by one up to twenty and say how many there are" [apply]
- obj2: "Compare two groups of objects to tell which group has more" [compare]

| Run | Profile | Source |
|-----|---------|--------|
| baseline | none | — |
| strong | P(correct) ≈ 97-98%, theta ~5.9, gate 0 | real student 1004 (COUNT001 ability docs) |
| struggling | P(correct) = 32%, theta 1.2, gate 1, 9 attempts | synthetic fixture (edited from 1004's context) |

## Results

### Component selection + difficulty per objective

| | baseline | strong | struggling |
|---|---|---|---|
| obj1 components | counting-board (beginner), ten-frame (medium), number-line, number-tracer (easy) — **4** | counting-board, ten-frame, number-line — **3**, all `challenging` | ten-frame, counting-board, number-sequencer — **3**, all `easy` |
| obj2 components | comparison-builder, sorting-station (easy), knowledge-check — **3** | comparison-builder, sorting-station, knowledge-check — **3**, all `challenging` | comparison-builder, sorting-station — **2**, all `easy`, **knowledge-check dropped** |
| finalAssessment | flashcard-deck | flashcard-deck | knowledge-check |

### What the curator did with the profile

- **Strong:** every difficulty-bearing config flipped to `challenging`; intro
  compressed (dropped number-tracer, the most introductory writing component).
- **Struggling:** every config flipped to `easy`; the assessment block was
  removed from the weak objective (practice stays, drill pressure goes);
  number-sequencer (gentler sequencing) replaced number-line.
- **Leak check: PASS.** No title or intent in either personalized run mentions
  scores, gates, P(correct), mastery, or percentages (regex sweep over all
  componentConfigs + finalAssessment).

## Verdict

The wiring works end-to-end and the curator responds in both directions:
difficulty configs, component counts, and assessment weighting all move with
the profile, with zero student-facing leakage. Personalization currently stops
at the manifest — the `easy`/`challenging` config reaches generators as a
string label only; numeric IRT target difficulty is the step-3b work.

Replay fixtures: `C:/tmp/trace_{baseline,strong,struggling}.json` →
`POST /api/lumina/topic-trace` (manifestOnly).
