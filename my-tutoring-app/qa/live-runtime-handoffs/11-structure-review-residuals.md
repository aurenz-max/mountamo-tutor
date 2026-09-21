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

1. ~~**The host-text guard is a guard in the loop**~~ **DONE 2026-09-21.** `sendText(text,
   { author: 'host' })` emits `runtime_host_text`; the transport's `hostText()` opens the next
   exchange for the outcome observer with an empty `learner`; `hostTexts` is deleted. The
   headless driver and the harness's `[LESSON_START]` now take the same route the browser does.
   Checked-tap verdict probe 10/15 → 12/15; 9/9 connected gesture journeys, 27/27 gesture
   observations committed with no learner words.
   [Report](../tutor-reports/host-text-source-2026-09-21.md).
2. **Packet weight.** Every `runtime_state` carries the ~170-char `about` note, 14 signal
   fields and up to 5 observations with full probabilities, about 4-5 times per spoken exchange,
   and each is relayed into the Live context. Send `about` once per item (or from the backend
   runtime instruction), drop `probabilities` from the packet copy. Pair with the already-queued
   with/without-packet comparison. Executor: `/tutor-test`.
3. ~~**`markMeaning` rides `facts`**~~ **MEASURED, NOT ADOPTED 2026-09-21.** Removing it (and
   Shape Sorter's `ringMeaning`) changed no JEV verdict (same passes and failing cases in all five
   domains, confidence flat or higher) but cost the tutor demonstrations: 3 of 15 connected audio
   journeys answered "show me" in speech or claimed an unmade mark, against 1 of 15 in a
   same-conditions control with the sentence kept. The sentence stays in `facts`. Guidance has no
   room for it (item 8). [Report](../tutor-reports/workspace-scene-2026-09-21.md).
4. ~~**Shared workspace doctrine is retyped in six adapters against the 2000-char cap**~~
   **DONE 2026-09-21.** `WORKSPACE_DOCTRINE` + `workspaceGuidance()` in `adapterContract.ts`;
   the seven adopters keep only domain sentences, and the five "name it back" variants became
   one instruction to credit the learner and name what they got right. It rides in adapter
   guidance, not the backend session instruction: that placement was measured and cut visible
   demonstrations 19/21 → 14/21. Kept design, 21 audio journeys: 40/42 correct answers credited
   (both misses are the tutor misjudging synthetic `aaa`), 0 false credit, 21/21 demonstrations,
   16/21 passed vs 13/21 before. A refused workspace action now returns its reason. The LA-13
   criterion did not need changing. [Report](../tutor-reports/workspace-doctrine-2026-09-21.md).
5. **`lessonVoiceTurnPolicy.ts` is a per-primitive if-chain** that has drifted from the
   primitives' own values (di-math-facts 420 ms in a lesson, 1000 ms standalone for compound
   numerals). Move to a catalog field beside `audioInput`. Copying values is safe; changing any
   is a mic-timing change. Executor: `/add-voice-control`.
6. ~~**`tutor-verdict-probe.mjs` hand-copies domain sentences and scenes**~~ **DONE 2026-09-21.**
   Every adopter's domain exports `workspaceAssignment(item)` and `workspaceScene(item, view)`;
   the seven components spread them and the probe imports them through the Vite module runner,
   building items from challenge fixtures with the real builders (a domain table replaces the
   ternaries; `--dry` prints the input). The copy had drifted further than listed: Counting Board
   and Shape Sorter cases sent `facts: { response }` only, and train before/after cases had no
   `kind` or `assignment`. Re-baseline on the real input: board 54/54, shapes 42/42, letters 36/48,
   words 45/48, trains 41/42, facts 63/63, links 57/63, the same failing cases as before.
   [Report](../tutor-reports/workspace-scene-2026-09-21.md).
7. ~~**`DiTeachingStage` shell.**~~ **DONE 2026-09-21.** `direct-instruction/DiTeachingStage.tsx`
   owns the empty state, workspace binding, evaluation submit, recap and card; each DI pack
   supplies its domain, stimulus, trail, recap label, metrics and wording. The three components
   went from 574 to 291 lines plus a 140-line shell; DOM and `data-*` selectors unchanged. 647
   tests; 9/9 connected `--audio` journeys (18/18 demonstrations, 18/18 correct answers credited).
   [Report](../tutor-reports/workspace-scene-2026-09-21.md).

8. **Guidance budget — standing constraint, no task.** The shared doctrine is 900 of each
   adapter's 2000 characters; letter-sound-link sits at 1961, word reading 1917. The next shared
   sentence must replace one, or the per-offer cap in `live_activity_tools.parse_activity_spec`
   moves (a backend change; the lesson path's `teachingGuidance` has no such cap), with the
   connected journeys re-run. The cap is stated in `/add-live-tutor-tools` §2.

Not recommended: merging the two observers' `observe()` bodies (their cancellation semantics
differ on purpose), or merging the two JEV calls per exchange (the outcome kind deliberately
withholds the learner transcript from the verdict question).
