# Sound Promotion Report: di-dice-roll — 2026-09-03

## Outcome

`di-dice-roll` is promoted to **L5 polished** with sparse procedural Web Audio feedback. The sound layer changes only the tactile roll experience; challenge values, evaluation modes, support tiers, spoken judging, and scoring are unchanged.

## Sound choreography

| Event | Sound | Ownership |
|---|---|---|
| Valid die press | `SoundManager.tap()` once | `DiDiceRoll` |
| Four transient roll frames | `SoundManager.tick()` once per frame | `DiDiceRoll` |
| Finalized face appears | `SoundManager.snap()` once | `DiDiceRoll` |
| Reduced-motion roll | `tap()` then immediate `snap()`; no ticks | `DiDiceRoll` |
| Correct / incorrect spoken verdict | Existing `playCorrect()` / `playIncorrect()` | `useJudgedScriptRunner` |
| Terminal session reward | Existing shared celebration after `submitResult()` | Celebration layer |

The component does not add verdict, navigation, processing, streak, perfect, or completion sounds. This avoids double feedback and leaves the learner response/judging interval free of Dice Roll-specific sound. All cues use the existing runtime palette; no audio assets or new sound specifications were added.

## Verification

| Gate | Result |
|---|---|
| Dice Roll generator + script + sound Vitest | **35/35 passed** across 3 files |
| Focused sound choreography | **3/3 passed**: animated roll, reduced motion, and replay guard |
| Lumina typecheck | **0 errors** |
| By-ear browser check | **Not attempted** |

The focused component test mocks the shared sound manager and proves one press, four rattle ticks, one settle, reduced-motion silence during skipped frames, and no replay after the settled control disables.

## Human gate

Listen once in the Direct Instruction Primitives Tester with sound enabled. Confirm that the four ticks read as a short dice rattle, the settle is distinct but not loud, the immediate reduced-motion `tap + snap` does not feel crowded, and the sounds do not interfere with the tutor prompt or the child's spoken response. Use Sound Lab only if levels need tuning.
