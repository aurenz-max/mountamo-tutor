# Letter Workshop contracts

Updated 2026-09-07 after the trace/copy/write implementation. [Birth record](../../../../../qa/eval-reports/letter-workshop-birth.md) and [mode verification](../../../../../qa/eval-reports/letter-workshop-modes-2026-09-07.md).

**Runtime: three practice modes implemented.** Copy/write geometric feedback is provisional and local-only; it does not update adaptive state. Human template/device review, real audible playback, and empirical calibration remain open. Catalog/backend beta values are matching design priors, not measured difficulty.

| Key | Student task | Support before submission | Cue | Beta prior |
|---|---|---|---|---|
| `trace` | Follow reference strokes | Guide, numbered starts, arrows, writing lines | Visible and spoken instruction | 1.5 |
| `copy` | Reproduce a separate model on blank paper | Separate noninteractive model; writing lines only on drawing surface | Visible and spoken instruction | 3.5 |
| `write` | Produce a letter from its spoken name | Writing lines only; target absent from component title, prompt, model, paper label, and tutor context | Browser speech with completion/error gate and replay | 5.0 |

## Generation and scope

- Code owns 52 uppercase/lowercase template identities and stroke geometry. Gemini supplies framing only; current-mode instructions are code-owned. Copy/write descriptions are code-owned too.
- Objective, intent, title, topic, and explicit letter constraints intersect. Cumulative Groups 1?4, case restrictions, and counts 3?6 hold across every mode. Conflicting scopes and unsupported mode keys fail explicitly.
- `resolveEvalModes` consumes the context's target pin, intent/title/topic, and objective text. Pins bypass the resolver LLM call. Explicit `copy|write` blends and `mixed` are supported.
- The wrapper's root `challengeType` enum is constrained before generation and validated against the allowed types afterward. Gemini cannot supply letter geometry or challenge IDs.
- Local selection rotates the selected types, deduplicates `(type, templateId)` until exhausted, then orders trace ? copy ? write and assigns IDs. Mixed covers all three types even at count three. A limited letter pool may repeat without expanding scope.
- Each challenge's `type` drives rendering, assessment, evidence, and phase summary. Session `challengeType` is representative metadata; aggregate metrics report `mixed` when needed.
- `registerContextGenerator` already forwards the complete resolved context. Keep its routing of targetEvalMode, intent, objectiveText, and raw config.

## Presentation, audio, and exposure

Copy has separate model and drawing SVGs. Model scaling never changes recorded writing coordinates. The drawing surface retains its 400 ? 300 coordinate system.

Write has no visible target before submission. Its cue uses an English letter name and case, independent of live-tutor connectivity and without a tutor transcript. Drawing waits for playback completion. Playback errors or a 20-second timeout offer retry without scoring an unheard prompt. Old playback is cancelled on advance, payload replacement, and unmount; readiness is keyed to the current challenge.

Write feedback reveals a separate model after the attempt is saved. That model stays visible on retry, and retry evidence changes to `beside-model`. Model visibility is keyed to challenge ID so it cannot flash the next target. Prior exposure to the same template in earlier items is retained: write after a model is practice, not an unaided baseline. New sessions start fresh exposure history; the app does not infer exposure across sessions.

Tutor context explicitly overwrites letter and case with `withheld` during write, including after feedback, so prior targets cannot survive a merged context update. The catalog scaffold receives 15 keys covering mode, assistance, item progress, feedback, attempts, drawing and cue state. Help me requests levels 1?3 with the current state. Trace/copy introductions fire once per item; write introductions are suppressed to preserve the browser cue. Checked work in every mode emits short, target-free feedback. Inactive lesson primitives and late connections over existing ink do not introduce themselves. Drawing gestures emit no speech triggers; help/read-aloud controls are disabled during drawing or cue playback. The scaffold instructs the tutor to stay silent then. Live tutor audio and browser speech coordination still need a full device check.

## Assessment and student data

Trace retains `assisted-trace-v1`. Copy/write use `provisional-formation-v1`: permit horizontal translation, preserve writing-line height and orientation, and compare stroke parts, starts, direction, coverage, precision, and length. The assessor does not rotate, reflect, or independently scale shapes into a match. Accepted alternate manuscript conventions and child tolerances are not yet calibrated; this is practice shape feedback, not a validated formation classifier.

Attempts preserve strokes, event timestamps, pointer type, submitted/cleared disposition, task/template identity, template/scorer versions, assistance, completed cue count, and prior model exposure. Clear/retry never replaces earlier evidence. Pointer cancellation/capture loss and repeated submit/next retain the existing lifecycle protections.

Completion emits one normal evaluation callback with per-mode aggregates and the complete attempt ledger. Any session containing copy or write sets the hook's `localOnly` option: the callback receives provisional results, but the evaluation context and backend are bypassed, including auto-submit on unmount. In the tester this evidence is available in the callback; it is not persisted student history. Trace-only sessions retain their existing submission behavior. Never enable adaptive updates merely by removing this flag: first validate formation scoring, mode-specific calibration, and evidence persistence through `/student-data-loop`.

## Verification and remaining work

Verified: all three pins, explicit blend/mixed, unpinned copy/write intent routing, scope retention, all 52 model positives, geometric negatives, isolated local feedback, browser mouse drawing/check/next/finish, cue gate/failure via simulated speech events, and exposure accounting. See the linked report for counts and artifacts.

Still required: actual audible cues on supported devices; human review of manuscript forms and alternate stroke conventions; child finger/stylus trials; empirical tolerances/IRT; backend replay once copy/write becomes eligible for adaptive submission. The tutoring scaffold is implemented and passes three-mode prompt probes plus a real live connection; full live coaching behavior remains to verify. Support tiers and structural difficulty remain separate lifecycle layers. Withdrawing arrows from trace must never relabel it copy or independent write.
