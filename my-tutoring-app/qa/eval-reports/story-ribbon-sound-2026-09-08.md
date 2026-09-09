# Story Ribbon — interaction sound

2026-09-08. Story Ribbon now uses the shared procedural `SoundManager` for sparse card-manipulation feedback. No audio assets or new palette entries were added.

| Interaction | Sound | Placement |
|---|---|---|
| Choose the first card to move | `select()` | after solved/submitted guards |
| Choose a story moment in `story_to_experience` | `select()` | after solved/submitted guards |
| Tap the selected card again to cancel | `tap()` | cancel branch only |
| Tap a second valid card and complete a swap | `snap()` | after both card indices are validated |

## Sound ownership

- The shared judged-script runner already plays `playCorrect()` on an affirmed verdict and `playIncorrect()` on a corrected verdict. Story Ribbon does not duplicate those calls.
- The runner already plays `tap()` for Hear the directions again.
- Story Ribbon does not call `navigate()`, `playStreak()`, or `playPerfect()`. Tutor cues own progression, and aggregate celebration remains automatic after final `submitResult()`.
- On the last correct response, the runner's per-challenge correct sound may be followed by the aggregate completion celebration. This is the intended success-to-reward escalation; no additional completion sound was added.

## Verification

- `npm.cmd run typecheck:lumina`: PASS, zero errors.
- Story Ribbon focused tests: 30/30 PASS.
- Static ownership trace: tactile calls exist only in `handleEventTap`; verdict and replay calls remain in `useJudgedScriptRunner`.

Audible acceptance remains manual: test card selection, cancel, swap, hear-again, one corrected response, and final success on a real browser/device with global mute and volume both exercised. Use Developer Tools → Sound Lab if the existing palette levels need tuning.
