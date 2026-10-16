# sound-wave-explorer W1 binding (ROLLOUT C28), 2026-10-15

**Shape P, four modes, all bound** (observe, predict, classify, apply). Levers in `../eval-reports/sound-wave-explorer-levers-2026-10-15.md`. Not committed.

## What changed, and why
The old screen did not make the learner do the concept. Gemini wrote every instruction, key and distractor, and the
keys were not checked against anything on screen: one object was drawn per item while the question compared two
("which one makes a lower sound?"), and the schema had no force or speed fields, so predict items had no settings to
predict from. During a vibration the wave panel printed "Pitch: High  •  Volume: Loud", which named the answer, and
the sliders were labelled "Force (Volume)" and "Speed (Pitch)". The learner could tap the object to hear the result
before answering. After three misses the answer was printed. The scripted context sent the key to the tutor. Water and
solid-wall filters played made-up timbres (water as a low-pass, a wall as a high-pass), which are not the physics.

Rebuilt so that each mode is a closed choice with a code-built key (`soundWaveWorkspace.ts`) and nothing on screen
answers it before credit:
- **observe** (vibration and sound, 1-PS4-1): easy, the maker is played and starts shaking, or is held still; what
  happens to the sound? Medium, a sound starts or stops; what does the maker do? Hard, a loud speaker makes rice on a
  drum shake (on, off) and a struck fork makes still water ripple. The picture shows the moment before the change; the
  change runs after credit.
- **predict**: a maker is played (Before wave drawn, "Hear before" plays it), one change, and the learner predicts the
  loudness or the pitch. The After panel shows "?" until credit. Easy names the change in shaking words; medium names
  the physical change (tighten the string, walk away); hard asks about the feature the change leaves alone ("Stays the
  same" keys, at most half the items) and adds pumping the air out of a bell jar.
- **classify**: two or three waves drawn at one scale; which sound is louder, quieter, higher or lower. The sounds play
  only after credit, so the learner reads the drawing. Easy differs in one feature; medium crosses them (the taller wave
  is the lower sound); hard has three crossed waves or two that differ only in the other feature ("They are the same").
- **apply**: a Before and an After wave; what was done (played harder or more gently, tightened or loosened). Hard
  changes both at once.
- **Generator**: Gemini writes only the title, the description (not rendered) and `soundFocus` (vibration, loudness,
  pitch or both). Code builds the items from those, the mode pin and the tier. A legacy payload is rebuilt from its
  challenge types. The frame moved to the Lumina kit.

**Rulings needed.** (1) The free medium selector (air, water, solid wall, vacuum) and the distance buttons are
removed. Travel is kept as two predict changes (walking away, the bell jar). Sound through water and solids is no
longer taught here; the old filters taught it wrongly. (2) The catalog no longer claims NGSS 1-PS4-4 (design a device
to communicate), which no mode ever did. The description and constraints now say what the screen does.

Every item is `speech` with `acceptsGesture` (J14). Misses (`soundMiss` = `soundSpokenMisses` ids): observe
`start_stop_swapped`, `said_no_change`; predict `mixed_up_features`, `opposite_direction`, `said_same`; classify
`read_other_feature`, `opposite_end`, `missed_same`, `said_same`; apply `wrong_feature`, `opposite_change`,
`loudness_misread`, `pitch_misread`, `both_misread`.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770), none in these files.
- `SoundWaveExplorer.workspace.test.tsx` 19/19. live-activity + `misses.test.ts` + `sourceControlBytes` + the Pip
  surface test (legacy fixture) + physics: 46 files, 2 failures, both in `GravityDropTower.workspace.test.tsx` (another
  agent's work in progress).
- Payloads from `save_payload.py`, all with model-written titles (no fallback): observe K hard, predict Grade 2 hard,
  classify Grade 3 medium, apply Grade 3 hard.
- Sweep: 0 findings on all four payloads; misses named 3/3, 4/4, 4/4, 3/3. The advisories ("scene facts contain the
  key") come from the choice list, which is on screen.

## Replay (gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 14 items x 5 samples, `--observe`; `replay/sound-wave-explorer-2026-10-15{,-r2,-r3,-r4}.json`)
- **r1.** Checks: 4/70 stuck replies on predict#4 (pluck harder, loudness) read the feature card's "bigger shakes are
  louder". By reading: after the credit on the fork item, 2/5 replies said the water "splashes" (only ripples are drawn).
  Fix: the run fact says what the picture now shows ("rings of ripples... no splash is drawn").
- **r2.** No splash claims. Classify stuck replies pulled crest_marks or the feature card and then asked about only the
  asked feature ("Which wave has its crests packed closer together?" on a pitch item, 4/5 on classify#2; "Which wave is
  shorter and quieter?"), which hands over the step the item tests. Fix: guidance says to read the whole card, never
  only the half about the asked feature, never to follow it with a question about that half, and that crest marks show
  both features.
- **r3.** Cards are read whole. The predict check flags (4/70) are now the full feature card read aloud, which is on
  screen. New by reading: on physical predict items, 4/10 stuck replies pulled the feature card and then stated what the
  change does to the shaking ("when the string shakes more slowly?"), which the guidance forbids. Fix (structural): on
  a physical predict item the feature card is offered only after the change card is up.
- **r4** (predict items only): 0/20 checks missed; stuck replies pull change_card and read it. 1/20 lever reply read
  half the feature card ("faster shakes make a higher pitch. What pitch do slower shakes make?").
- Shared doctrine (not fixed here): 0 two-lever turns; "I/We added/opened..." lever narration in 5 (r1), 6 (r3) and 3
  (r4) replies; in the predict lever moment 8/20 replies pull a second lever and describe only the first card.

## Undriven modes
None. The sweep drives taps; the workspace test drives a spoken answer on classify.

## Open findings
- 2/20 classify crest_marks replies (r3) still ask about crest spacing alone on a pitch item. Fixed-unmeasured past
  r3; read it off the next replay of this family. `/add-live-tutor-tools`.
- Lever narration and second pulls in the lever moment: shared doctrine, `/add-live-tutor-tools` (the agent editing
  `adapterContract.ts`).
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`: one spoken
  program per mode.
- No `docs/contracts/sound-wave-explorer.md`. The requirements (code-built keys, the After wave "?" until credit,
  classify sounds only after credit, at most half "same" keys) are recorded only here. `/primitive-contract`.
- Needs a browser check: the wave drawings at each level, the observe pictures (rice, speaker, fork and water), the
  vibration animation and the tones. Only JSDOM has run them.
