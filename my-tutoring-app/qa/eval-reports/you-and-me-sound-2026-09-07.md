# You & Me sound audit

Result: sound support already exists through the shared useJudgedScriptRunner. No production edits or duplicate sound calls were needed.

| Event | Owner | Sound |
|---|---|---|
| Hear the scene again | Runner hearStimulus, after item/cue guards | SoundManager.tap() |
| Accepted spoken verdict | Runner applyVerdict | SoundManager.playCorrect() |
| Incorrect spoken verdict, including correction-cap handling | Runner applyVerdict | SoundManager.playIncorrect() |
| Completion reward | Shared PhaseSummaryPanel | Existing score-tier celebration |

The current completion owner is PhaseSummaryPanel, rather than the CelebrationLayer described in the skill's general overview. YouAndMe renders that summary and submits its aggregate result once. The final verdict sound followed by the summary reward is the existing success-to-completion escalation. No extra navigation, microphone, retry-callback or component-level verdict sound was added.

The shared SoundManager synthesizes audio and owns persisted mute/volume and SSR handling. No new assets, audio context or timers were introduced. Speech overlap and microphone pickup have not been checked by ear.

Verification: source trace through YouAndMe, the runner, SoundManager and PhaseSummaryPanel; 45 existing runner/component/script tests pass across three files. These tests mock sound playback and establish lifecycle regression coverage, not audible sound quality. No code changed, so a fresh compiler run was unnecessary.

Remaining acceptance: listen in Primitives Tester to scene replay, correct/wrong responses and final completion; verify comfortable levels, no distracting overlap with tutor speech or spurious microphone turns, and global mute. Sound Lab can audition the shared palette.
