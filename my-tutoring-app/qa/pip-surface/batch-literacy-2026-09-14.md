# Pip shared-surface batch: di-word-reading, phonics-blender, cvc-speller, letter-spotter, word-sorter — 2026-09-14

Previous batch: `batch-k-math-4-2026-09-14.md`. Policies and the target table: `src/components/lumina/pip/README.md`.

## What Pip does

| Primitive | Family | Points at (this item's cue) | Never points at | Watches | Receives |
| --- | --- | --- | --- | --- | --- |
| di-word-reading (all 4 modes) | speech loop, own phases | the whole printed word | one letter | the word | — |
| phonics-blender (cvc, cvce_blend, digraph, advanced) | speech loop, own stage | the letter row as a whole, every tier | one letter card | the card the child tapped to hear, else the row | — |
| cvc-speller `fill_vowel` | speech loop | the "?" box (the screen marks the gap) | a consonant | the gap | — |
| cvc-speller `word_sort` | speech loop | the word's picture; nothing when the tier withdraws it | a vowel column (built from earlier answers) | the picture | — |
| cvc-speller `spell_word` | speech loop, build commit | the box row | a bank letter | the box a letter landed in or was cleared from | the finished build while judged |
| letter-spotter `name_it` | judged runner | the star over the hidden letter | a word or letter of the sentence | the star | — |
| letter-spotter `find_it` | judged runner | the grid as a whole | a cell | the cell the child tapped (committed) | — (one tap is a choice, not a build) |
| letter-spotter `match_it` | judged runner | the big letter (the question side) | a little letter | the little letter the child tapped | — |
| word-sorter (binary, ternary, match_pairs) | judged runner | the word card | a mat, its picture, a bank word | the word card | — |

Deviations from the requested table:
- **word-sorter** is spoken on every mode since the 08-16 DI port (no hand sort), so it follows Sorting Station's spoken family: it points at the card the ask names.
- **letter-spotter match_it** points at the big printed letter rather than outlining the option area: the ask says "Look at the big letter", and it is the question side, not a choice. The options are never singled out. find_it outlines only the whole grid, as requested.
- **phonics-blender** is not a runner: it drives `useJudgedSpeechLoop` itself, like DI Word Reading and CVC Speller.

### The cue latch for the three speech-loop packs

DI Word Reading, Phonics Blender and CVC Speller open the next item on the affirming verdict, before the praise is spoken, and leave their stage word at `affirmed`. Each now records the item its loop's last *sent* cue was about (`onCue`, diagnostics-only in the engine), the runner's `cuedItemId` in miniature. Speech is a cue only once that id names the item on screen; until then the praise is held as the confirmed result (`celebrating`). This replaces the audio-edge scope (`useSpeechScope`) the DI math packs use, because those packs hold a reward beat and these do not.

## Host changes

- `LanguageArtsPrimitivesTester` had no companion and passed no `instanceId` to these four primitives: Pip could not appear in the helper. It now mounts `CuratorCompanion` beside the preview, keys the preview by a per-generation `la-helper-<primitive>-<n>` id, and passes that id into phonics-blender, letter-spotter, cvc-speller and word-sorter. The DI Lab already passed one.

## Gates

- Vitest: 48 files / 337 tests (all `pip/*` incl. the math helper attach test, plus every existing suite for the five primitives). 5 new surface tests, 20 tests. A mutation of the CVC policy (no handover, no praise hold) fails 2 of 4.
- `typecheck:lumina` 0. Full tsc 771 (771 at the previous batch); none in touched files.

## Runtime drives (headless Chromium, :3000 + :8000)

No sign-in, 1400px (and word-sorter at 760px): every primitive `bodies=1 inDock=true anchor=true idle` on generation, a new dock with one body after regeneration, no OVERLAP or PAGE-OVERFLOW-X.

Signed in, live tutor:

| Primitive (mode) | Observed |
| --- | --- |
| word-sorter (two groups) | Start → working/look; injected audio → point@word[region] — outline on the card, dock between card and mats |
| di-word-reading (cvc_reading) | Start → working/look; injected audio → point@word[region] around "sam" |
| letter-spotter (find it) | live opener → point@grid[region]; cell tap → checking/look; after the verdict the next ask → point@grid again |
| cvc-speller (spell it) | live opener "…Listen: cat. Your turn. Put in the letters for cat." → point@boxes[region]; three bank taps → checking/receive; live "My turn: Listen to the first sound: /k/…" → point@boxes |
| phonics-blender (cvc) | live opener "…Listen: /k/ … /t/ cat. Together … What word?" → point@letters[region]; letter tap → look; the tap-to-hear echo "/k/" → point@letters for 0.5s |
| di-word-reading (cvc_reading, 760px) | live "I'll sound it out: sss-aaa-mmm… sam. … Your turn. What word?" → point@word[region] throughout, then working/look |
| letter-spotter (match it, 760px) | live opener → point@letter[region]; option tap → checking/look; the tutor affirmed ("Yes, big …") → celebrating over the next item; the next ask "Your turn. … same." → point@letter |
| letter-spotter (name it) | live opener → point@marker[ring]; the connector rises from the dock to the star and crosses no word |
| cvc-speller (middle sound, 760px) | live opener → point@gap[ring] on the "?" box. The connector leaves Pip at the dock's left edge and passes through the "C" box on the way; C is part of the prompt, not a choice, and the ring sits on the gap |
| word-sorter (three groups, 760px) | live "… Listen: … Animals, Food, or Actions?" → point@word[region] |

Every signed-in drive: `bodies=1 inDock=true anchor=true`, a new dock with one body after regeneration, no OVERLAP or PAGE-OVERFLOW-X. At 760px a few frames report `introducing/point` with no measured target while the page scrolls; the actor draws no pointer to an off-screen target.

**Harness fix.** Chromium's default fake microphone plays a tone. On every voice pack it opened a turn as soon as the mic armed and interrupted the tutor (`ai_interrupted`, no `ai_audio`), so the first live drives of word-sorter, di-word-reading and cvc-speller heard nothing; the tap-answered find_it drive was unaffected. Feeding capture a silent WAV (`--use-file-for-fake-audio-capture`) fixed it; both skill scripts now do this, and `pipdrive.mjs` takes `PIP_HELPER="Language Arts"`.

## Findings queued (EVAL_TRACKER, executor `/eval-fix`)

Pre-existing; found while tracing each pack's affirm path for the praise hold. Each was probed on the rendered component.

- **PBL-1 HIGH** — after "cat" is affirmed the stage reads `d·o·g 🐱 yes!` through the model of "dog" and the child's whole attempt: the reward picture of the previous word under the letters being blended.
- **DWR-1 MEDIUM** — same mechanism: "mat" shows the picture for "sam" through the praise and the model line, until the next attempt opens.
- **CVCS-1 LOW** — after one affirmation the next item's stage word reads "yes!" instead of "middle sound?".

## Not verified

- `celebrating` after a real affirmation was seen only on Letter Spotter (a tapped answer). On the three speech-loop packs no drive produced a correct answer (the fake mic is silent and the one build was wrong), so their praise hold against real cue timing comes from phase tests only.
- A tap-to-hear echo on Phonics Blender and CVC Speller counts as tutor speech on the current item, so Pip briefly outlines the letter row or the cue target while the tapped sound or word plays. It points at where the child works, never at an answer.
- Lesson host (scroll-focus claim), reduced motion, and mouth timing against real speech were not inspected.
