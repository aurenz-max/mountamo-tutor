# DI lesson isolation ? 2026-09-12

Status: diagnosed from the supplied live log; repair implemented and component-tested. Live microphone replay remains open (TU-7).

## Evidence

Original artifact preserved: `backend/logs/lumina-sessions/2026-09-12-131948-lumina-tutor-f1b2ab9da15f.jsonl`.

- Seq 4?9, 63?94ms: multiple item-state bags arrive while the active primitive is still curator-brief, including CVC and sentence-reading fields.
- Seq 44: switch to di-sentence-reading at 15.000s. Seq 91?98: learner transcript ?The cat sat.? and tutor ?Yes, that says The cat sat.?
- Seq 93: CVC fields (`task`, `word`, `middleSound`) update the sentence-reading context. Seq 103 at 34.531s: a two-cue batch begins with `[DI_CVC_ITEM]` asking for the middle sound in ?wet?. Seq 104?109: the tutor speaks it.
- Seq 117: switch to read-aloud-studio at 79.766s. Seq 161?171: the tutor affirms its passage line. Seq 162?165: multiple activity-state bags arrive. Seq 176 at 106.031s: a three-cue batch begins with CVC's ?fix? item. The tutor speaks that instead of the active passage's next line.

This is direct evidence of cross-activity cue/state contamination in one session, not an estimate of a stochastic failure rate. The mismatch between the user transcript at seq 156 and the later passage affirmation is a separate observation; without the full input audio, this review cannot determine what Gemini heard.

## Cause and repair

The learner should answer the visible activity; only that activity may consume the shared judge and advance. Scroll lessons keep every primitive mounted. `useJudgedSpeechLoop` already had an `active` gate, but nine legacy consumers omitted it, inheriting `true`. Each started loop subscribed to the same closed voice turn and interpreted the same ?Yes? as its own verdict. Their progression handlers then queued different next questions into one session.

Added instance focus checks to CvcSpeller, PhonicsBlender, SoundSwap, WordFlip, DiLetterSounds, DiWordReading, DiMathFacts, DiSentenceReading, and DiShapes. Their item-context effects now publish only while focused and refresh on return. The shared `useJudgedScriptRunner` context effect has the same gate, covering read-aloud-studio and other migrated packs; an unselected lesson no longer grants every runner focus.

The engine now also gates immediate openers, voice callbacks, audio-edge processing, verdict-timeout ticks, and resume/dead-session recovery. An immediate opener from an inactive activity waits for focus. Leaving an activity drops its incomplete judge-text accumulator. Ordinary standalone behavior is preserved. No generated content, spoken script, grading criterion, or persistence schema changed.

## Verification

- 440 tests passed in 31 related suites, covering the loop, reducer, shared runner, and affected DI/literacy components.
- New `DiLessonIsolation.test.tsx` mounts the real CVC and sentence-reading components with the real loop/reducer and a simulated shared lesson transport. Replays the ?The cat sat? verdict: sentence reading advances to ?I see a pig?; CVC emits no next-item cue and stays on ?hat? when revisited. Only the focused component publishes item context or subscribes to closed voice turns.
- Additional regressions cover shared-runner context publication on focus/return, immediate opening while inactive, and inactive verdict/dead-session recovery. Existing standalone, arming, cue pacing, verdict-text, and recovery suites remain green.
- Typecheck: no diagnostics in the changed files; the Lumina gate still fails on two pre-existing `baseTenScript.ts` errors at 267 and 295 are unrelated and remain untouched.
- Local ports 3000 and 8000 are reachable, but browser automation exposes no browsers/tabs. No live microphone/Gemini replay was performed. The headless tutor harness bypasses the mounted client loops and cannot validate this particular defect.

Residual verification: replay the saved lesson with CVC, sentence reading, and passage reading all mounted, answer once on each, and return to CVC. Confirm one next cue from the focused activity and no foreign item-state keys in the session ledger. Existing DI backlog item 31 residuals (off-screen stimulus timing and mic-state presentation) remain separate and unchanged.
