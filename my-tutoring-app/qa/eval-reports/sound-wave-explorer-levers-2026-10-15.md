# sound-wave-explorer: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/sound-wave-explorer-w1-2026-10-15.md`). Not committed.

## Failure inventory
There is no real-learner evidence: no demonstrations, misconception or remediation files exist for
sound-wave-explorer, and the 2026-03-29 eval report covers only generator breakage. The documented failures are the
old catalog commonStruggles: pitch and loudness confused, sound without vibration, sound through a vacuum, louder read
as faster. The synthetic failures are the journey's scripted wrong taps. The rest are inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| observe | start and stop swapped (`start_stop_swapped`) | inferred, synthetic |
| observe | the shaking and the sound not linked (`said_no_change`) | documented (struggle 3) |
| predict | a change to one feature said to move the other (`mixed_up_features`) | documented (struggle 1), synthetic |
| predict | the right feature, the wrong way (`opposite_direction`) | inferred |
| predict | a change that moves the asked feature called no change (`said_same`) | inferred |
| classify | the wave read by the other feature (`read_other_feature`) | documented (struggle 1), synthetic |
| classify | the other end picked (`opposite_end`), "same" missed or said (`missed_same`, `said_same`) | inferred |
| apply | a change to the other feature (`wrong_feature`), the right kind reversed (`opposite_change`) | inferred, synthetic |
| apply | one or both parts of a two-part change wrong (`loudness_misread`, `pitch_misread`, `both_misread`) | synthetic |

## Lever table (built, `soundWaveLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| observe | shake_card | help | every miss | a model outside the item: humming with a hand on the throat, or a window rattling as a truck passes; `soundWordLeak` refuses a sound word or a choice label |
| observe | plain_link | simplify | every miss | medium and hard: a forward item with the same maker, the other way round from the full item (its key always differs); ungraded |
| predict, apply | change_card | help | every miss | physical wording only: what the change (or each kind of change) does to the shaking; no sound word, no wave |
| predict, classify, apply | feature_card | help | every miss | the rule with two small wave pictures; names no wave and no choice. On a physical predict item offered only once change_card is up (replay r3) |
| classify, apply | crest_marks | help | every miss | numbers the crests and draws a top line on every wave at once, so it does not point at the asked feature |
| predict | easier_change | simplify | every miss | the same maker and asked feature, the change in shaking words, the other way from the full key |
| classify | one_difference | simplify | every miss | two waves differing only in the asked feature, the key at another label |
| apply | one_change | simplify | every miss | hard: only the loudness change; medium: the change in shaking words, reversed |

Starting position: every lever starts released. `config.difficulty` picks the item structure, not the levers.

## Gates
- `SoundWaveExplorer.workspace.test.tsx`: for every item built at every tier and focus, every miss its choices can show
  gets a help lever first from `nextLever`. Each lever changes the screen and the scene fact in one commit and rides the
  next attempt. No shake or change card states a sound word or a choice. The simpler item keeps the mode, is valid,
  never has the learner's key, has no levers, and never shrinks twice.
- Sweep lever inventory: every catalog miss answered on every mode.
- Replay r4: stuck replies on predict pull change_card and read it; r3 classify replies read the whole feature card.

## Failures with no lever
- An easy item has no simplify lever (it is already the simplest shape): easy observe, predict, classify and apply.
- A learner who cannot hear or see a difference in loudness at all is a perception question, not a lever. The tones
  play only after credit, so they are not a lever either: hearing the sounds would answer a classify item.
