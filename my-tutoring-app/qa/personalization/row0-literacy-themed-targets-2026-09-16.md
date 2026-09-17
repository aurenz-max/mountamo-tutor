# Row 0 — literacy generators under a themed intent (2026-09-16)

Question: now that interests theme component intents (every intent at PreK), do the literacy generators let the theme choose what the child is taught?

Probe: `scripts/probe-literacy-themed-targets.mjs`, live Gemini, grade K, context built through `resolveGenerationContext`. Each case sends the objective plus "Theme it around his favorite dump trucks and excavators at the construction work site." (themed ×4) or the objective alone (control ×2).

## Result

Columns are "unusable / total" as each generator's audit defines it (in the script).

| Generator / mode | What counts as unusable | Themed before | Control before | Themed after | Control after |
|---|---|---|---|---|---|
| decodable-reader / literal | word not CVC and not sight | **9/42** (truck in 4/4, work) | 2/25 (the name "Alex") | 0/46 | 1/23 ("out" tagged cvc) |
| word-sorter / binary_sort | groups ≠ the objective's "animals / food" | **8/12** (Big/Small, Toys/Tools, "nut→Tools") | 0/6 | 0/12 | 0/6 |
| letter-spotter / name_it | hidden word > 5 letters | **7/24** (asphalt ×3, tractor ×2, steamroller, pavement) | 0/12 | 1/36 (paving) | 0/12 |
| phoneme-explorer / isolate | non-CVC word | **16/72** (crane, truck, wrench, hardhat, cone…) | 7/28 | 2/56 (duck, soap) | 3/33 |
| phonics-blender / cvc + unpinned | non-CVC word | 0/36 (but rig ×2, cop) | 0/19 | 0/35 (dig, mud) | 0/18 |
| cvc-speller / fill_vowel + spell_word | non-CVC or outside letter group | 0/40 | 0/20 | 0/40 | 0/20 |
| sound-swap / substitution | non-CVC word | 0/70 | 0/36 | 0/71 | 0/34 |
| rhyme-studio / recognition | non-CVC word | 1/66 | 1/35 | 0/66 | 1/34 |
| word-workout / picture_match | non-CVC word | 0/59 | 0/27 | 0/56 | 0/28 |
| syllable-clapper / count_parts | > 3 syllables | not run | not run | 2/32 | 2/16 (watermelon) |
| letter-sound-link / see_hear | letters = the group's own set? | yes, same as control | yes | yes | yes |
| di-letter-sounds / unpinned | letters picked | m s f a (4/4) | m s f a | m s f a | m s f a |
| resolveEvalModes (rhyme-studio) | mode picked | recognition 4/4 | recognition 2/2 | recognition 4/4 | recognition 2/2 |

Raw draws: `literacy-themed-targets-2026-09-16.json`, `-extended-`, `-words-` (before); `-after-`, `-letter-spotter-` (after).

## What changed

- `service/literacy/themeFocus.ts` — `themedFocusLine`: the intent sets skill and scope; a theme goes to the carrier (title, sentence, story events); targets are chosen as with no theme, plus at most 2 everyday theme words that pass every rule. Replaces the "lean word/letter choices toward <intent>" line in phonics-blender, cvc-speller, letter-sound-link, letter-spotter, phoneme-explorer, rhyme-studio, sound-swap, word-workout, syllable-clapper, and decodable-reader's "must specifically target" line.
- word-sorter: `sortFocusLine` — groups named by the focus are used in every challenge; a theme only reaches the title and instruction.
- decodable-reader: the K guideline is "ONLY CVC and sight words"; a K decode-mode word outside that (or tagged cvc but not spelled C-V-C) is a content issue that re-draws once. Names capitalized in the intent are exempt.
- phonics-blender: post-parse CVC gate (contract R6 in code, R10 narrowed).
- `isCvcSpelling` in `letterGroups.ts` (tested).
- di-letter-sounds and the shared `resolveEvalModes` prompt: "a theme names no letters / no skill".
- letter-spotter fallback table: `o: 'owl'` → `'octopus'` (owl opens with the digraph ow, which breaks the file's own first-sound rule).

## Residuals

- letter-spotter still uses up to 2 everyday theme words as hidden words (truck, tools, pipes). The code checks that the first letter spells the first sound, so these are allowed.
- decodable-reader themed draw 2 wrote "I can see a big mud." (not natural English); the retry gate does not catch grammar.
- The controls show two issues that exist without a theme: letter-spotter names ("Pip", "Nan") despite its no-names rule, and a mis-tagged "out" in decodable-reader.
- you-and-me and story-bridge resolve eval modes from the themed intent too. They are covered by the shared resolver line but were not probed.
- Not browser-driven: all changes are prompt or post-parse generator code, and no component changed.
