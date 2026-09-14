# Shared learning applicability — 2026-09-12

Generation applicability gate: PASS. This supersedes the regex applicability architecture described in the earlier two-primitive bridge report.

## Contract

The user requested generalizing first, validating Place Value, then retrying the second primitive. This explicitly supersedes the add-misconception-loop skill's narrow text-matching resolver instruction for this slice.

`service/generation/planLearningAdaptation.ts` is a shared server-only semantic planner. It accepts observations with IDs, a current task, and a capability with supported move descriptions. It contains no primitive-specific diagnosis vocabulary or source→destination mapping. One LLM call before content generation selects a move or abstains. Runtime validation rejects unknown moves, unknown/missing citations, extra fields, malformed JSON, and model failures. No observation means no call. The generator receives only the validated enum; private observations never enter wrapper prompts or serialized content.

`service/math/placeValueTeachingCapabilities.ts` describes two executable affordances:

- Place Value compare/medium: contrast a digit's worth across positions, or pair positional-name and numeric-worth questions.
- Base-Ten read_blocks/medium, Grade 4: contrast equal block counts with different unit sizes. The description explains how column counts represent written digits; naming positions is not practiced here.

Task eligibility remains code-owned, including grade, mode, support, explicit anchors and scope. Regex used for numeric/task constraints is not diagnosis applicability. Deterministic selectors preserve counts, structural bands, script and answer recomputation and report insufficient capacity honestly.

The old Place Value text recognizer remains only in immediate-retest certification. A model-selected move cannot independently certify or resolve a hypothesis. Base Ten still receives no receipt and cannot resolve the source. Observation retrieval is still the existing exact-scope authenticated pilot path, not a profile-wide retrieval system. The planner accepts general observations, but current production callers supply the existing tentative misconception text; strength/support consumption and raw-evidence enrichment remain open.

## Verification

- Focused initial suite: 29 passed. Full frontend suite: 6,018 passed / 10 skipped. Final compiler replay + planner + generator suite: 17 passed after final prompt/budget changes and saved-output replay addition.
- Lumina typecheck: 0 errors; backend scope/opportunity/roundtrip: 51 passed.
- Real HTTP generation: Place Value's seven cases passed before proceeding to Base Ten's seven cases. Saved synthetic LLM diagnosis and two semantic paraphrases target both representations. Blank, unrelated and unreliable/contradictory observations abstain. Place-name confusion targets only Place Value. [All final cases](../../../artifacts/learning-applicability/report.json).
- Saved real outputs pass the actual production compilers: equal digits/counts, different positional worth, correct answers, unchanged mode/support and no diagnosis leakage. Pure seeded generator tests establish causal targeting against the same baseline, not merely random differences between live draws.
- Direct production planner probe additionally verifies the second paraphrase through both capabilities with real model responses and STOP finish reasons. [Responses](../../../artifacts/learning-applicability/direct-planner.json).
- Fresh authenticated Firebase → store → Next generator run: PASS, two positive draws each, source remains one active hypothesis, no canonical synthetic learning submissions, cleanup verified absent. [Authenticated report](place-value-opportunities/pvc-http-qa-42caa74fa5434e16b9316174a09e93fa/authenticated-report.json).

## Findings during development

The first small response budget produced no usable adaptation on a positive case; the final budget is 4096 output tokens with low thinking and a 20-second request timeout. Later direct probes ended normally. Earlier no-move cases did not retain raw model output, so their precise cause is not established.

One chart draw selected the right move but had insufficient legal content capacity. Its failed probe report and payload are retained under `artifacts/learning-applicability/capacity-*`. The harness now distinguishes capacity from semantic failure and retains every draw. The final run passed all fourteen cases without a capacity retry.

The first Blocks capability description omitted its relationship to written digits, and a paraphrase produced no adaptation. The description now states the representation relationship rather than adding diagnosis phrases or a primitive-specific rule to the planner. Earlier incomplete reports remain in the artifact directory.

Two ordinary, unadapted Blocks draws repeated mat values (baseline and unrelated-observation cases). All adapted final draws were unique. The new selector did not create these duplicates; ordinary generator variety remains a separate limitation recorded in the DI backlog.

Capture/catalog/storage stations remain as previously verified; this changes generation interpretation only. Browser microphone acceptance, teaching effectiveness, support fading, general profile retrieval, cross-primitive resolution and learner transfer remain unverified/open. HUMAN-CHECKS #113/#63 stay user-owned.
