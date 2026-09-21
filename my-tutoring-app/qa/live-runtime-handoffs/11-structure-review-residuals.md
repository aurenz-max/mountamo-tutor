# Structure review of the live tutor tools: what was fixed, what is queued

Date: 2026-09-20 · Owner: roadmap LA-14 · Source: a `/simplify` pass over the uncommitted
teaching-workspace, learner-signal and DI-adopter work (four reviewers: reuse, simplification,
efficiency, registry soundness).

## Fixed in that pass (behavior-preserving)

| Duplicate | Now |
|---|---|
| `ELIGIBLE` + `LessonWorkspacePrimitiveId`: a central primitive allowlist, and a second copy of the same `c.type` gate in `livePlan.ts` | `bindsTeachingWorkspace` / `challengeTypes` on the adapter; one `modeContentGate.ts` reads mode -> challenge types from the catalog for both paths. No mode list: every bound mode reaches lessons (user ruling) |
| Try again / Next challenge existed only in the dev sandbox, so gesture modes were withheld from lessons | One control in the shared shell `LiveRuntimeSurface`; the sandbox and the lesson both pass `learnerProgress` |
| Evaluation-submit block copied into five teaching components | `runtime/useTeachingEvaluation.ts`; each binding supplies only `metrics` |
| Scripted-or-teaching switch copied into five primitives (one with a literal `'identify'`) | `runtime/withTeachingWorkspace.tsx`, fed by the domain's `*_WORKSPACE_MODES` |
| Three DI validators and five `lessonStart` templates, byte-identical | `validateChallengePool`, `workspaceLessonStart` in `adapterContract.ts` |
| Item-scope key built by hand in three places that must match byte for byte; `probability`/`text`/scope validators ×2-3; two copied routes; two copied fetch classifiers | `runtime/observationContract.ts`, `service/typesafe/observationRoute.ts` (the caller's abort now also stops the upstream model call) |
| Three copied DI rows and an inlined domain helper in `liveJourneySpec.ts` | `spokenWorkspaceInputs`, shared constants, `sequencerHarnessAnswers` |
| 4 alias constants, 2 re-export lists with no importers, an unread item field ×3, an unused mode map | Deleted |

A registry test now runs over every adapter (`activityContract.test.ts`). It failed on first run:
number-sequencer's picker offered `order_cards` while the mode was withheld. The mode is bound
again, so the two agree.

Verification: 1,058 affected tests pass, `typecheck:lumina` 0, full `tsc` 770 (baseline), both
observation routes probed on the running server, one `--lesson-entry` number-train drive.

## Queued — each changes what the tutor or JEV receives, so each needs live runs

1. **The host-text guard is a guard in the loop** (`expectHostText`/`consumeHostText`,
   `useTeachingWorkspace.ts`, `runtimeTransport.ts`). `LuminaAIContext` stamps every non-silent
   `sendText` as `runtime_learner_text`, so the hook registers its own string and the transport
   drops it again — and the dialogue observer still receives "The learner submitted their
   selection…" as learner words. Fix at the source: `sendText(text, { author: 'host' })`, emit
   `runtime_learner_text` only for learner-authored text, delete `hostTexts`. Matches the 09-17
   ruling. Executor: `/add-live-tutor-tools`; re-run the verdict probes for gesture turns.
2. **Packet weight.** Every `runtime_state` carries the ~170-char `about` note, 14 signal
   fields and up to 5 observations with full probabilities, about 4-5 times per spoken exchange,
   and each is relayed into the Live context. Send `about` once per item (or from the backend
   runtime instruction), drop `probabilities` from the packet copy. Pair with the already-queued
   with/without-packet comparison. Executor: `/tutor-test`.
3. **`markMeaning` rides `facts`**, so a tutor-directed sentence about purple marks enters every
   packet and every outcome-JEV input. Move it to adapter guidance or publish it outside
   `demand`. Executor: `/add-live-tutor-tools`; re-baseline the verdict probes.
4. **Shared workspace doctrine is retyped in six adapters against the 2000-char cap**
   (word reading 1996, letter sounds 1969). The "name the answer back in the same breath"
   sentence exists in five tuned variants. Carry the shared part once for
   `progression === 'observer'`. Guidance wording is known to be sensitive: measure before and
   after. Executor: `/add-live-tutor-tools`, under LA-13.
5. **`lessonVoiceTurnPolicy.ts` is a per-primitive if-chain** that has drifted from the
   primitives' own values (di-math-facts 420 ms in a lesson, 1000 ms standalone for compound
   numerals). Move to a catalog field beside `audioInput`. Copying values is safe; changing any
   is a mic-timing change. Executor: `/add-voice-control`.
6. **`tutor-verdict-probe.mjs` hand-copies ~130 lines of domain sentences and scenes** on the
   stated premise that `.mjs` cannot import TypeScript; `primitive-runtime-driver.mjs` already
   does through the Vite module runner. The copy has drifted: production facts carry
   `markMeaning` (and `supportTier` for letters), the probe sends neither, so it is not replaying
   the real model input. Extract a pure `workspaceScene(item, marks)` per domain, have component
   and probe both call it, replace the five six-arm flag ternaries with a table. Probe inputs
   change, so re-baseline. Executor: `/add-live-tutor-tools`.
7. **`DiTeachingStage` shell.** The three DI teaching components share ~110 of ~200 lines
   (props, empty state, speech-only assignments, summary card, header, receipt trail). Seven DI
   packs are still unmigrated, so extract before the fourth copy — after item 6, which supplies
   the `scene(item)` seam. DOM and `data-*` selectors must be preserved. Executor:
   `/add-live-tutor-tools`.

Not recommended: merging the two observers' `observe()` bodies (their cancellation semantics
differ on purpose), or merging the two JEV calls per exchange (the outcome kind deliberately
withholds the learner transcript from the verdict question).
