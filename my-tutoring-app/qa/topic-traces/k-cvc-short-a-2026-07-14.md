# Topic Trace: "Decode CVC words with short 'a' (e.g., cat, map, van)" (kindergarten) — 2026-07-14

Scope intended by the topic: reading/decoding CVC words with the short-a vowel only.
Part of the 2026-07-14 K demand census.

## Components

| Component | In scope? | Off-scope value / issue | Broken link | Fix target |
|-----------|-----------|-------------------------|-------------|------------|
| letter-sound-link | ✓ | Group-1 letters, short-a target | — | — |
| cvc-speller (word-sort) | ✓ | short-a vs short-o contrast is legitimate discrimination | — | — |
| cvc-speller (spell-word) | ✓ | all short-a targets | — | — |
| phonics-blender | ✓ | cat/map/fan/sad all short-a | — | — |
| decodable-reader | ✓ | **read_along mode routed at K by the manifest** — closes the open routing follow-up; short-a passage, emoji comprehension options | — | — |
| word-workout | ✗ | word-chains leave short-a scope (bed, tip, top, pen, pet, rot, bug, tag, tug); `masteredVowels` claims all 5 vowels | GENERATOR | `gemini-word-workout` — no vowel-scope binding for chain steps |
| word-flip | ✗ | plural_s grammar mode with non-decodable words ("cloud") for a decoding topic | INTENT then GENERATOR | manifest intent drifted to grammar ("apply … to grammar"); generator compounded with non-CVC words |
| knowledge-check | ✓ (scope) | short-a focused, but matching_activity right-items are text **descriptions of pictures** ("A picture of a paper map…") — pure reading at K | GENERATOR | knowledge-check PRE band-gate (reader-fit backlog) |

## Scope drops

### word-workout — chains wander across all five vowels for a "short a" topic
- **Chain:** objective "create simple words by choosing the right letters" (already vowel-generic — mild OBJECTIVE softening) → intent "change one letter of a CVC word (cat → can → van)" stayed short-a in its example → data chains hit e/i/o/u in 5/5 challenges
- **Broken link:** GENERATOR (primary) — no scope binding on chain letters; check `buildScopePromptSection` wiring
- **Fix target:** `gemini-word-workout`

### word-flip — routed into grammar (plural_s) for a decoding topic
- **Chain:** objective "create simple words by choosing the right letters" → intent explicitly pivots to plurals → data: plural_s with "cloud" (CCVC + digraph vowel, not K-decodable)
- **Broken link:** INTENT — the manifest chose a grammar application for a phonics objective; GENERATOR added out-of-scope words
- **Fix target:** manifest intent guidance + word-flip word constraints

### Positive confirmation
The catalog `constraints` band-floor note works: the manifest explicitly instructed "Use the 'read_along' mode suitable for kindergarteners" for decodable-reader — the open follow-up from `decodable-reader-PRE-2026-07-14.md` ("verify the resolver prefers read_along at K") is confirmed at the manifest level.
