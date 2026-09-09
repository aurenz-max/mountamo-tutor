# Birth Certificate — story-ribbon (2026-09-08)

**Lifecycle layer: L5 (sound-enabled).** Story Ribbon is registered end to end as a multi-instance Kindergarten oral-storytelling primitive with five measurable task identities, a verified mode-aware tutoring contract, deterministic scaffold withdrawal, code-enforced narrative shape difficulty, and sparse procedural interaction sound.

- Core task identity: `tell_connected_account` — rearrange three pictured events and tell a connected account from beginning to end.
- Generator fork: **B orchestrator** — three parallel flat-schema Gemini calls by default (maximum four), local array reconstruction, reject + one retry, then an explicit logged fallback bank. Controlled picture keys and shared cue anchors keep the visible picture/label synchronized with hidden judged meaning.
- Interaction: the child taps two cards to swap their positions on a first/next/last ribbon, then uses the microphone to produce the story. Every initial order is deliberately incorrect.
- Judged surface: `useJudgedScriptRunner`, `answerKind: 'voice'`, `responseClass: 'connected_account'`; tags `[SR_ITEM]`, `[SR_MOVE]`, `[SR_COMPLETE]`, `[SR_HEAR]`. The runner is the sole progression authority.
- Evaluation: canonical multi-instance metrics plus per-challenge outcomes, arrangement history, arrangement at first voice attempt, transcripts, observations, and diagnosis evidence flow through `onEvaluationSubmit`.
- Answer-leak boundary: visible cards contain only controlled emoji cues and time-neutral noun phrases; model sentences stay hidden until an affirm verdict. Corrections may model the account only after an incorrect attempt. Tense is not graded at L0.
- Design gate: **direct manipulation PASS** (cards themselves move); **living-simulation exception** (narrative sequence, not a physical/process simulation); **production PASS** (original connected speech); **timer PASS** (no visible timer); **layout leak PASS** (mixed start, uniform card chrome, hidden script).
- Curriculum fit: **abstain / diffuse**, despite strong K neighbors (best cosine 0.8479 at LA006-01-C). No curriculum ID is pinned from this probe. See [fit report](../curriculum-fit/story-ribbon-2026-09-08.md).
- L1 ladder: `tell_connected_account` (β 2.5), `tell_present_account` (β 3.0), `tell_future_account` (β 3.5), `tell_past_account` (β 3.5), and privacy-safe `story_to_experience` (β 4.0). Catalog and backend priors match.
- L2 tutoring: the catalog scaffold publishes eight focused, turn-aware runtime keys; documents the runner's four silent `[SR_*]` cues; and routes missing-event, chronology, tense, connection, pause, and privacy struggles through the exact judged-loop correction contract without adding a second tutor connection.
- L3 support tiers: easy keeps position labels, arrows, and self-check help; medium removes arrows and live correctness feedback; hard removes all positional chrome and uses a minimal task prompt. Experience mode fades its three-part connection frame while retaining privacy-safe alternatives. The tutor receives the same visibility policy and may not restore withdrawn help.
- L4 structural difficulty: the four retell modes progress from a familiar routine to a direct problem-solution arc to a failed-attempt/adapted-solution arc. Code counts explicit arc signals and reconstructs misses deterministically while retaining three events, mode, and tense. `story_to_experience` is honestly saturated under its current one-event connection contract.
- L5 sound: first-card and experience choices use `select`, cancel uses `tap`, and a completed valid swap uses `snap`. The judged runner retains ownership of correct/incorrect feedback, hear-again audio, and progression timing; aggregate celebration remains automatic.
- Verification: [birth eval](story-ribbon-2026-09-08.md), [L1 eval-mode report](story-ribbon-evalmodes-2026-09-08.md), [L2 tutoring report](../tutor-reports/story-ribbon-2026-09-08.md), [L3 support-tier report](story-ribbon-support-tiers-2026-09-08.md), [L4 structural-difficulty report](story-ribbon-structural-difficulty-2026-09-08.md), and [L5 sound report](story-ribbon-sound-2026-09-08.md); 30/30 current focused tests including 1,000 structural constructions; 2/2 backend calibration tests; Lumina typecheck 0; 20/20 pinned baseline/tier generations plus mixed and blended structural paths passed; current tutor audit and three tier-policy probes passed with zero findings. Sound still requires by-ear device acceptance.

## Follow-up queue

| # | Layer / skill | Work |
|---|---|---|
| 0 | Human browser/mic check | Verify card swapping and responsive layout on tablet, reveal timing, hear-again behavior, and real-child speech capture. |
| ✓ | `/add-eval-modes` | **DONE 2026-09-08:** base + present/future/past + `story_to_experience`; root schema constraining, Fork B slot scheduling, and matching β/a priors. |
| ✓ | `/add-tutoring-scaffold` | **DONE 2026-09-08:** five-mode catalog scaffold, eight-key live context, exact-script/answer-boundary directives, struggle routing, and Tier 1–2 tutor-test gate. Tier-3 browser/mic behavior remains in row 0. |
| ✓ | `/add-support-tiers` | **DONE 2026-09-08:** deterministic easy/medium/hard visual and instructional withdrawal, per-mode blend/mixed application, null-tier compatibility, and tutor reveal-policy synchronization. |
| ✓ | `/add-structural-difficulty` | **DONE 2026-09-08:** routine → direct problem-solution → failed-attempt/adapted-solution retell arcs, exact code-side classification/reconstruction, mixed/blend handling, and explicit experience-mode saturation. |
| ✓ | `/add-sound` | **DONE 2026-09-08:** sparse select/tap/snap interaction feedback; existing runner verdict/replay sounds preserved without duplication; no manual celebration or navigation sound. |
| ✓ | `/eval-test story-ribbon` | Re-run generation and judged-loop QA after each lifecycle layer. |

Try it in Lumina Developer Tools → Language Arts → Speaking & Listening → Story Ribbon. A useful prompt is “Tell a story from pictures.”
