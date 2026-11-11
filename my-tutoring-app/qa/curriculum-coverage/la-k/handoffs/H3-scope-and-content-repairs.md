# H3: scope and content repairs on phonics primitives

Read `README.md` in this folder first. Use `/eval-fix`. Each item below was read from code by an audit agent and
has NOT been reproduced. Reproduce it first with a failing vitest or a generation; if it does not reproduce, say so
and move on.

These are code defects with a test-shaped fix. None changes what the tutor hears or says, so none needs a Live run.

| # | Defect | Where | Subskills (`n`) | Fixed when |
|---|---|---|---|---|
| 1 | The vowel scope reads only vowels written directly after the word "short". "Decode CVC words with Short 'o' … mix with previously learned short a, e, and i" gives o + a. | `service/wordSpace/scope.ts:114` | 30, 31, 32 | the scope for subskills 30, 31 and 32 is the stated vowel plus every earlier vowel the text names |
| 2 | Named blends are parsed only after "initial/beginning blends", so "blends (st, pl, br)" is not honored. | `service/wordSpace/scope.ts:143-149` | 51 | the scope for subskill 51 holds sh, ch, th, wh and st, pl, br |
| 3 | One session carries one pattern, so subskill 51 gets digraphs or blends, never both. | `service/literacy/gemini-phonics-blender.ts:277-325` | 51 | a lesson on subskill 51 draws from both pattern sets |
| 4 | `cvc-speller` takes its letter group from config or the vowel only and defaults to group 3, so the curriculum's own example words (van, wet, win, jet, fox) are out of scope. | `service/wordSpace/cvcSpellerSpaces.ts:40-62`, `service/literacy/gemini-cvc-speller.ts:484-498` | 34-38 | an objective that lists example words admits those words; with no letter group named, the default is the full alphabet |
| 5 | `letter-spotter` and `letter-sound-link` fall back to letter group 1 (six letters) when the objective names no group. | `service/literacy/letterGroups.ts:166-175` | 46, 47 | with no group named the scope is the full alphabet |
| 6 | `real_vs_nonsense` requires a different first letter so the spoken answer is distinguishable. Vowel pairs (map/mep, fin/fip), which the curriculum asks for at the hard tier, are never generated. | `service/wordSpace/wordWorkoutSpaces.ts:48-74` | 39 | the hard tier offers vowel pairs and takes a tap on the word as the answer; easy and medium are unchanged |
| 7 | `find_it` shows uppercase cells only. | `primitives/visual-primitives/literacy/letterSpotterDomain.ts:136-146` | 16-19 | a tier or config shows lowercase cells |
| 8 | No season category, so "sort by season" has model-written bins. | `service/wordSpace/categorySpaces.ts:20` | 137 | the category space has winter, spring, summer, fall members with rated pictures |
| 9 | The catalog calls `word-flip` past-tense modes a Grade 1-2 extension while the card lists Kindergarten. | `service/manifest/catalog/literacy.ts:1591`, `wordFlip.card.ts` | 112, 113 | the two agree; pick the one the generator actually honors and say which |
| 10 | `sound-swap` shows the start word and its tiles in print and its catalog entry lacks the non-reader affordance. | `service/manifest/catalog/literacy.ts:822` | 13, 14, 15 | decide from the contract whether the print is a lever or the default; if it is the default, move it behind the help lever |
| 11 | Small hand tables: 12 inflected words, a short compound list, a short near-word trial table. | `primitives/visual-primitives/literacy/wordWorkoutEarlyDecoding.ts:25-90`, `service/wordSpace/wordWorkoutSpaces.ts:143-171` | 52, 53 | each table has at least 30 entries drawn from the word library, with the same structure checks |

## Status 2026-11-10

Done: 1, 2, 4, 5, 9 (EVAL_TRACKER H3-1/2/4/5/9). Reproduced worse than read: 30 and 31 admitted all five vowels, 32
only u. Held on contracts: 3 (phonics-blender R9), 6 (word-workout R2, R10), 7 (letter-spotter R2, R6, C1), 10
(sound-swap R1, R4). Blocked: 8 needs rated pictures for fall and winter nouns. Not started: 11. Detail in
WORKSTREAMS row 22.

## Order

Do 1, 2, 4 and 5 first: they are parser and default fixes with a unit test each, and they decide which letters a
K lesson may use. Then 6. The rest in any order. Stop and report rather than guess if a contract file says the
current behavior is required by another skill; items 5, 7 and 10 are the likely ones.

## Not in this handoff

- Spoken production of j, w, y, x, qu and of stop sounds in `letter-sound-link` and `di-letter-sounds`. Those
  letters were left out because the tutor's hearing of an isolated sound is unproven for them. Widening that needs
  a Live sample the user runs. Report what the code excludes and why; do not widen it.
- `letter-workshop` copy and write being excluded from adaptive updates. That waits on calibration data.
- Component mastery for letters. The main session has it.

## Check before you call it done

- One failing test before each fix, passing after. `npm run test:primitive -- <id>` for every primitive touched.
- One generation each at the text of subskills 31, 34, 39 and 51, payload read against the "fixed when" column.
- Each fixed defect also gets a line in `my-tutoring-app/qa/EVAL_TRACKER.md` in that file's existing format.
