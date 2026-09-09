# Story Ribbon — L3 support tiers

2026-09-08. At L3, Story Ribbon applied `config.difficulty` as a support-withdrawal axis on every challenge, including pinned, blended, and mixed sessions. This support-only axis leaves story content unchanged. L4 now adds a separate structural story-shape axis; see [the structural-difficulty report](story-ribbon-structural-difficulty-2026-09-08.md).

| Tier | Retell and tense modes | Story-to-experience |
|---|---|---|
| Easy | First/Next/Last labels, flow arrows, live order self-check, guided two-tap instruction | Sequence context, live selection coaching, and a three-part connection frame |
| Medium | Position labels remain; arrows and live correctness feedback withdraw; concise instruction | Connection frame and sequence chrome withdraw; concise connection prompt |
| Hard | Position labels, arrows, and live correctness feedback withdraw; minimal instruction | Minimal connection prompt; no connection frame or sequence chrome |

Privacy-safe alternatives remain visible and audible at every `story_to_experience` tier. The Today/Yesterday/Tomorrow condition also remains visible and present in the spoken task at every tense tier because it is part of the assessed task, not optional help.

## Verification

| Check | Result |
|---|---|
| Pinned baseline + easy/medium/hard across all five modes | 20/20 PASS |
| Hard five-mode mixed session | PASS; all five task identities retained and tiered per challenge |
| Medium connected-account + experience blend | PASS; each mode received its own support mapping |
| Deterministic content-invariance test | PASS; stripping support fields leaves story and answer-bearing content unchanged |
| Story Ribbon focused tests | 23/23 PASS |
| Lumina typecheck | PASS, zero errors |
| Tutor Tier 1 audit | PASS, zero findings |
| Tutor easy/hard prompt probes | 3/3 PASS; all keys component-resolved, no `(not set)` |

The untiered baseline preserves the previous surface and emits no `supportTier` or `support` fields. The judged-script runner publishes the tier, visibility flags, instruction level, and a mode-aware reveal policy so the live tutor cannot restore support withdrawn from the screen.

Manual browser/microphone acceptance remains owed: compare easy, medium, and hard on one retell, one tense task, and `story_to_experience`; verify the visual aids withdraw, privacy language remains, and the tutor does not narrate hidden labels/arrows or event meanings.
