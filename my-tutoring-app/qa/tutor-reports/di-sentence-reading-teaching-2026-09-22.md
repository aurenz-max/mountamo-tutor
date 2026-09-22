# di-sentence-reading teaching workspace — 2026-09-22

Eighth adopter of the shared tutor/JEV teaching workspace, fourth DI pack
(after di-letter-sounds, di-word-reading, di-math-facts), first CONNECTED TEXT
pack on the workspace. User request: "is there a literacy primitive we can do?"

## Built

- `diSentenceReadingDomain.ts`: item shape, validity gates (independent word-count
  cross-check against the printed text, same "drop rather than repair" rule as the
  sibling packs), `askFor`, success condition, `workspaceAssignment`/`workspaceScene`.
  `MAX_SENTENCE_WORDS`/`MIN_SENTENCE_WORDS` moved here from `diSentenceReadingScript.ts`
  and re-exported for their other consumers (decodable-reader, read-aloud-studio,
  word-workout, knowledge-check and their generators/tests — unaffected).
- One demonstrable object (`sentence`): connected text has no discrete sound-out
  sub-unit the way a single decodable word does, unlike `di-word-reading`'s per-letter
  marks.
- `DiSentenceReadingTeaching.tsx` via `DiTeachingStage`, with a read-sentences reward
  trail mirroring word-reading's answer-leak shape (reward emoji never precedes the
  committed read, never a workspace object).
- `diSentenceReadingLive.ts` adapter, registered in `activityContract.ts` and
  `liveRenderers.tsx`. `DiSentenceReading.tsx` renamed its original component to
  `ScriptedDiSentenceReading` and switched via `withTeachingWorkspace`, unchanged
  internals otherwise.
- `liveJourneySpec.ts` row (type-enforced — the compiler caught the missing entry).
- `scripts/learner-intent-probe.mjs`: `--sentences` case set (self-correction,
  mid-sentence pause, a wrong-but-complete read, an off-task confound on the
  sentence's own content) — written, not yet run against the real API.

## Verified

- `typecheck:lumina` 0.
- Full `tsc --noEmit`: 770 errors, unchanged from baseline.
- 26/26 new deterministic mounted-component tests
  (`DiSentenceReading.teaching.test.tsx`), covering the TW behavioral matrix in this
  domain: factual ask with no scripted cue, no sentence leaked into the task, no
  learner response stated as a scene fact, exactly one demonstrable object per mode,
  the near-neighbour/self-correction success condition, the reward-reveal gate,
  help/demonstration history, stale/duplicate command refusal, retry preserving
  attempts, observed settlement + single completion, no scripted-drill leakage,
  registry shape, guidance length, and pool validation (including the independent
  word-count gate).
- Full Lumina vitest suite: 7172 passed / 10 skipped / 0 failed.
- `lessonWorkspacePlan.test.ts`'s hardcoded bound-family fixture updated (no other
  hardcoded family lists found elsewhere).

## NOT verified — explicit unrun gates

- **Real JEV verdict probe** (`scripts/tutor-verdict-probe.mjs --sentences`, once
  added): the near-miss/self-correction judging shape is asserted by a mocked
  classifier in the unit tests, not by the real model.
- **Real learner-intent probe** (`scripts/learner-intent-probe.mjs --sentences`):
  cases are written, not run. False help/stop requests are unmeasured for this domain.
- **Connected `--audio` journey** (`run_live_runtime.py --primitive di-sentence-reading`):
  no real speech has been driven through this pack's workspace binding.
- **Human microphone/visual sitting** (HUMAN-CHECKS #167).

All four were deferred on explicit user instruction to avoid API cost in this slice,
not because a service was unavailable. Do not call this primitive workspace-VERIFIED
until those run — the deterministic tests above prove lifecycle mechanics only, per
`TEACHING_WORKSPACE.md`'s own verification-layer distinction.

## Next

Run the four gates above when cost is acceptable. Otherwise the next slice in this
stream is unrelated to this pack: multi-objective lesson sections (attribution per
objective) or Shape Sorter's remaining siblings (`count`, `sort`,
`identify-real-object`) — see WORKSTREAMS.md's "Live tutor tools + lesson pilot" row.
