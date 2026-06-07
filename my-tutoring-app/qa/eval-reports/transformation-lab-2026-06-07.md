# Eval Report: transformation-lab — 2026-06-07

Grade 8 coordinate-plane transformations (CCSS 8.G.A.1-4). Fork A pool service —
Gemini emits only the session wrapper (title/description); all per-challenge
geometry is built deterministically in `gemini-transformation-lab.ts`.

## Results

| Eval Mode | Beta | Verdict | Notes |
|-----------|------|---------|-------|
| `apply_translation_reflection` | 2.5 | PASS | translation / reflect-x / reflect-y / reflect-y=x |
| `apply_rotation` | 3.5 | PASS | 90 / 180 / 270 about origin |
| `identify_transformation` | 4.0 | PASS | MC; correct + 3 same-pool distractors |
| `compose_sequence` | 5.0 | PASS | reflection/rotation then translation; palette-reachable |
| `dilation_similarity` | 5.5 | PASS | scale factor 2 / 3 about origin; isSimilarity flagged |

All 5 IRT-pinned modes pass. No CRITICAL or HIGH issues.

## Verification method

**Live** `/api/lumina/eval-test` confirmed end-to-end against the running Next.js
dev server (all 5 modes returned `status:"pass"`, `challengeCount:4`, correct
`typesFound`). Because this is a **Fork A** primitive, 100% of the graded content is
deterministic local code (Gemini only writes the title/description), so the math was
additionally checked against an independent oracle that re-derives each image from
its `transformLabel`.

## G1–G5 Sync Check

- **G1 — required fields / bounds / non-identity:** PASS. Every challenge has
  `preImage`/`expectedImage` of equal vertex count, all integer lattice points in
  [-7, 7], and `expectedImage ≠ preImage`. The component reads exactly these per
  `answerKind` (drag/identify/sequence); `identify` adds `options` (4) +
  `correctOption`, both present and validated by `isValid`.
- **G2 — flat-field reconstruction:** N/A. Gemini emits no per-challenge fields
  (Fork A); vertices are real arrays, no flattened-index schema.
- **G3 — eval-mode semantic differentiation:** PASS. Each eval mode maps to a
  single distinct `challengeType` with its own builder; variance rotation
  guarantees all sub-families appear (translate/reflect ×4, rotation ×3,
  identify ×6, compose ×5, dilation ×2).
- **G4 — answer derivability:** PASS. Spot-checked every challenge in all 5 live
  responses: drag/dilation `expectedImage == applyTransform(label, preImage)`;
  identify correct option's transform reproduces the shown image AND each image is
  uniquely produced (no distractor reproduces it); compose target is reachable by
  the fixed button palette (axis reflections + origin rotations + unit translations)
  with all vertices inside the grid.
- **G5 — fallback quality:** PASS. Each builder has a guaranteed-valid hardcoded
  fallback gated behind a bounded retry loop (`isValid` + `withinBounds` +
  non-identity `sameSet` rejection); the live responses showed varied randomized
  figures, so the primary path is reliable and fallbacks effectively never fire.

## Answer-leak audit (PRD §5 rule 7)

- `drag` modes (apply / dilation): the target image is **never drawn** — only the
  pre-image and the student's own draggable image. The instruction states the rule
  (e.g. "reflect over the y-axis"); the student must compute each vertex.
- `identify`: the image **is** shown (it must be) but the transformation **name**
  is the answer and is never labeled on the canvas; distractors are same-category
  (reflection/rotation) so the parameter must actually be read off the figure.
- `compose`: a dashed ghost target is shown — that is the *where*; the gradeable
  skill is the *how* (which sequence), so this is not a leak.

## Mixed (Auto) path — SP-21

PASS by construction. `selectMixedTransformationLabChallenges` round-robins all 5
tiers and sorts by tier rank (in-tier tiebreaker = figure magnitude). IRT-pinned
modes pass a non-null constraint and take the single-type path untouched. This
primitive shipped with the SP-21 round-robin already built in — no Auto-path defect.

## Visual Check

Open MathPrimitivesTester, select **transformation-lab**, pick each mode, click
Generate, and confirm the canvas renders the cyan pre-image with the expected
interaction surface (draggable pink corners for drag/dilation, MC options for
identify, the transformation palette + dashed ghost target for compose). The
"Generated Data (Gemini Output)" panel shows the JSON.
