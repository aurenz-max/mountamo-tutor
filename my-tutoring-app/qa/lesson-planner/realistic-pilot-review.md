# Broader-catalog lesson pilot — 2026-09-06

Changed the tester, not production selection. Full core + assessment catalog groups now join the five specialist candidates automatically: 26 total, up from the original manually selected 13. This includes knowledge-check, fast-fact, and other general teaching tools without requiring their selection. Every run saves included/excluded catalog IDs. The objective, Kindergarten learner, 15-minute budget and Gemini model/settings remain unchanged.

Defined six instructional contributions concretely: opening context, explanation/modeling, investigation, practice, situational application, and closing independent assessment. Component count is not a goal. Each contribution gets a provided/merged/partial/omitted decision with reasons and experience references. Added separate observable interpretation and manipulation evidence requirements. No app hydration has run.

## Runs

Three initial broader-catalog runs took 7.138, 12.240 and 16.454 seconds. All chose six experiences, including knowledge-check. All were structurally rejected because my validator demanded the model duplicate already-explicit partial contribution decisions into unmetRequirements. Removed that redundant reporting contract: instructional gaps now have one source of truth, while evidence gaps remain separate. Original artifacts and verdicts are preserved.

Those runs also revealed speculative capability claims. Checked LeverLab source (tilt uses torque and applied effort; moving loads changes distances) and LengthLab compare source (two bars, no bridge gap surface). Added those observations to candidate notes, not catalog bans. Neutralized a prompt sentence that could discourage legitimate cue-recognition/short-application use of fluency tools.

Three fresh runs after those changes:

| Run | API seconds | Estimated student minutes | Model/explanation choice | Structural result |
|---|---:|---:|---|---|
| [A](runs/direct-attribute-comparison-2026-09-06T11-54-52-604Z-c2569845.md) | 7.159 | 15 | comparison-panel | valid |
| [B](runs/direct-attribute-comparison-2026-09-06T11-55-09-722Z-5bd1f764.md) | 7.682 | 18 | foundation-explorer | valid; budget warning |
| [C](runs/direct-attribute-comparison-2026-09-06T11-55-18-583Z-2bd93fa2.md) | 8.376 | 15 | comparison-panel | valid |

All use the same broad sequence: curator-brief → explanation tool → lever-lab → compare-objects/compare_two → length-lab/compare → knowledge-check/apply. Seven deterministic tests pass, including group inclusion/deduplication and contribution-reference validation. API durations exclude hydration and are not a performance benchmark against production; no current-planner baseline was run.

## What improved

- All three include a distinct closing knowledge-check, selected from the supplied catalog rather than injected after generation.
- Generic explanation components have explicit instructional work, rather than assessment capability being the only criterion.
- Investigation and expressive-description practice are consistently labeled partial. Application is labeled partial in B and C; A still overstates the gap-spanning experience.
- Full candidate inputs and readable rejections now expose why fast-fact was passed over rather than silently excluding it upstream.

## Findings still open

1. **Role-filling can still override fit.** Lever-lab remains selected even with a torque limitation acknowledged. That is not proof of a valid elementary weight investigation. Its configuration and actual runtime task need verification before using this plan with a child.
2. **Top-level descriptions can dominate mode descriptions.** All three reject fast-fact as factual recall rather than conceptual comparison, despite the supplied recognize and apply modes supporting pictorial cues and short comparisons. This is an overly broad rejection rationale, not proof that fast-fact must appear. Next planning experiment: compact mode-level contribution cards vs current long primitive descriptions, while holding the candidate set fixed.
3. **Scenario prose still suggests unavailable surfaces.** A uses length-lab as if it showed a bridge-spanning target. B/C acknowledge the partial fit more honestly. A narrative request cannot create that interaction.
4. **Timing is estimated and compressible.** One run needs 18 minutes; others allocate two minutes to a final knowledge check. A complete generated item workload may take longer. Preserve this uncertainty rather than adjusting the budget to pass.
5. **Declared evidence is not observed evidence.** Explanation tools sometimes list targetEvidence even though their limits say observation only. The next integration must keep intended contribution and assessment credit distinct. Existing coverage QA must read the generated payloads.

The tester is more realistic and has exposed a specific selection mechanism to investigate. It is not yet a validated full lesson or an A/B victory. Review the generated experiences, then test mode-level cards before integrating hydration and comparing actual lessons against the current planner.
