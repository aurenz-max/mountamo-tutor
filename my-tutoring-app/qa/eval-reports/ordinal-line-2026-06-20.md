# Structural-Difficulty Eval-Test — ordinal-line (2026-06-20)

Primitive: `ordinal-line` (generator `gemini-ordinal-line.ts`), archetype graph-data, codeEnforceable=yes.
Sweep: topic="ordinal positions in a race", gradeLevel="Grade 1" (maxPosition=10 → wide band so the full ladder shows; K saturates because maxPosition=5 < instance count=7).
Modes tested: identify, relative_position, build_sequence (the three code-enforced levers). match=none (scaffold-only, not tested per brief). sequence_story=partial (code-selected ordering + LLM text) — not in the 2-4 sample.

## Results

| Mode | Scaffold flip (easy→hard) | Structural lever (easy→hard) | Magnitude in band | Answer leak | Null-tier no-op | Verdict |
|---|---|---|---|---|---|---|
| identify | showPositionLabels T→F; labelFormat both→symbol | positionLocus: easy anchors-first {1,2,10}; hard pure interior {3,4,5,6,7,8,9} (no 1/2/last) | yes (all pos ≤10) | none | yes (baseline unbiased mix 1,2,3,4,5,9,10; no scaffold fields) | PASS |
| relative_position | showPositionLabels T→F; highlightTarget T→F; labelFormat both→symbol | coupled: easy ref edge-clustered (edgeDist 0-2) + far distractors (dist 5-9); hard ref interior (refPos 3-6, edgeDist 2-3) + adjacency trap (dist 1,1,2) | yes (all pos ≤10) | none (glow withdrawn at hard, answer is 1 of 4 options) | yes (baseline unbiased ref 2-9, shuffled distractors, no scaffold fields) | PASS |
| build_sequence | showSlotLabels T→F; labelFormat both→symbol | clueCount easy=4(min)→hard=10(full line); list order easy inv=0 (position-ordered)→hard inv 15-25 (scrambled) | yes (all positions ≤10; count rise is parts-to-coordinate, not number inflation) | none (correctAnswer='sequence_complete') | yes (baseline clueCount=4 fixed, inv=0, no scaffold fields) | PASS |

## Observed values (per tier)

- **identify** — baseline pos [2,1,5,3,4,9,10] tier=None scaffold=None; easy pos [1,2,10,8,4,3,6] (anchors front) showPosLbl=T tier=easy labelFmt=both; hard pos [4,3,5,6,7,8,9] (interior only) showPosLbl=F tier=hard labelFmt=symbol.
- **relative_position** — baseline refPos [7,9,2,4,6,3,8] shuffled distractors scaffold=None; easy refPos near edges [1,10,9,2,2,9,8] distractorDist 5-9 showPosLbl=T hl=T; hard refPos interior [5,4,4,5,6,3,6] distractorDist {1,1,2} showPosLbl=F hl=F.
- **build_sequence** — baseline 4 challenges clueCount=4 listOrder[1,2,3,4] inv=0 scaffold=None; easy clueCount=4 inv=0 showSlotLbl=T; hard clueCount=10 listOrder scrambled inv 15-25 showSlotLbl=F.

## Issues

None. No CRITICAL, no HIGH.

Note (not a defect): setup-call variance gave relative_position/build a maxPosition of 8 on some calls vs 10 on others — this is the Gemini setup picking 8 vs 10 characters, both within the G1 cap of 10, independent of tier. Magnitude stays bounded by maxPosition at every tier.
