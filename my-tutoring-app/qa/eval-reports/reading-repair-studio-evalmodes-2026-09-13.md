# Reading Repair Studio — L1 single-mode registration

**PASS.** `notice_and_repair` is now a selectable eval-mode identity. The user explicitly requested this layer before child-voice calibration. Mode routing and adaptive assessment eligibility are separate: catalog/renderer `supportsEvaluation: false`, `localOnly: true`, and exclusion of renderer-injected score callbacks remain intact.

| Mode | Task | Design beta | Scaffolding mode | Discrimination |
|---|---|---|---|---|
| `notice_and_repair` | Read cold, compare one's own reading with print, mark words to revisit, reread | 4.5 | 4 | Default a=1.4, c=0 |

The beta is an uncalibrated design prior, mirrored in the backend registry. It reflects monitoring and rereading beyond the nearby cold-sentence-reading prior of 3.0, using the transitional prior 5.0 minus 0.5 for short 5–8 word sentences and direct word marking. It is not evidence that the audio judge is reliable.

## Implementation

- Catalog adds one mode. The existing interaction implements one skill; accurate-first, independently repaired, supported, unresolved and unknown outcomes are evidence categories, not separate modes. Help levels do not become task identities.
- Generator consumes `GenerationContext.targetEvalMode`, `intent`, and `objective.text` through the shared `resolveEvalModes` utility. An explicit pin uses no routing model call. Auto, absent pins, and explicit `mixed` use the sole available task with honest single-task logging. Unknown pins or unavailable blends fail before content generation.
- Single-mode architecture: Gemini returns sentence content only; the orchestrator stamps `notice_and_repair` on every challenge. There is no model-selected challenge enum to constrain or output-type post-filter to hide a mismatch. Sentence validity and within-session deduplication remain bounded checks with no fixture fallback.
- Existing `registerContextGenerator` already builds the complete context through `resolveGenerationContext`; it preserves mode pin, intent, objective and support-tier input without a registration edit.
- The tester exposes `Notice and Repair (Practice)` under `Practice task` and labels Auto as a single task. Its explicit selection reaches the real generator.

## Verification

| Check | Result |
|---|---|
| Focused tests | 47/47 pass across five files |
| Backend metadata | beta=4.5 and default a=1.4/c=0 verified via imported registry functions |
| Live routing | Seven real production API cases pass: pin, easy/medium/hard inputs, conflicting 100-word request, unpinned intent, explicit mixed |
| Pinned eval endpoint | PASS; catalog metadata resolves, all three challenges counted and typed `notice_and_repair` |
| Content | 24 sentences across the seven cases plus eval endpoint; every session has three unique natural 5–8 word sentences. Pond topic retained; long-passage request respects the short audio window |
| Tester | Explicit mode selection and real generation pass; three micless rounds produce one local evidence report, three unassessable readings, zero adaptive writes, zero page errors |
| TypeScript | 771 errors before and after; no new diagnostics after normalizing line shifts and existing Next generated-route union ordering |

No blend test is claimed: there is only one task to select. Support-tier inputs currently preserve the same sentence contract; this is routing compatibility, not completed L3/L4 difficulty work. Audio judging, evidence classification, help behavior and tutoring prompts did not change in this layer.

Reproduce from `my-tutoring-app`: `node scripts/probe-reading-repair-modes.cjs <playwright-package-path>`; `--browser-only` repeats just the tester journey. Artifacts live in `artifacts/literacy-grade2-design/reading-repair-l1-*`: raw responses, generation summary, eval response, browser request/evidence ledger, screenshot, test log and TypeScript log.

## Lifecycle handoff

L1 mode wiring, L2 tutoring and L5 sound are implemented. L3 support tiers can now target the explicit `notice_and_repair` mode, with support recorded before any help; L4 follows L3. Neither layer requires enabling adaptive scores. The previous handoff over-gated mode registration and these development phases on assessment calibration; that interpretation is superseded here.

Calibration remains required before treating this judge as a reliable independent-repair assessment or enabling adaptive scoring. Future distinct modes need their own real learner interactions, generators and evidence contracts; none are advertised prematurely.
