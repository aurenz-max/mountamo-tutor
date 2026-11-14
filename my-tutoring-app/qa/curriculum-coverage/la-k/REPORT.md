# K Language Arts audit, 2026-11-10

Scope: `LANGUAGE_ARTS`, grade K, 191 published subskills in 9 units (`snapshot.json`, sha256 `7cf30220…e6a0bb`). The
subskill set is identical to the September atlas (`../requirements.json`). Model spend: $0 (no model was called).

Method: the main session wrote an action for every subskill and grouped them into 88 families. Four read-only
agents then read the generator plus the domain, card, boss or component file for each candidate. Level 2 below means
that code read confirmed the action and the scoring. Nothing was generated and nothing was played. The September
atlas was used as a hint only; the catalog has changed too much since for its decisions to carry over.

## Update 2026-11-14: two canvases built

**Score now: 131 of 191 at level 2.** Built from the H5 records, both passing `canvas-check` with every screenshot read,
in the pilot tier until played:

| Canvas | Problems | Subskills |
|---|---|---|
| `picture-chain` (VO5, **played and approved 11-14, in the lesson library**) | fish drawn at their sizes; animals drawn against their real size (ant biggest); freezing to hot; seed to bee; egg to hen with an apple that does not belong | LA005-01-H, LA005-03-H |
| `treasure-map` (GR14, **played and approved 11-14, in the lesson library**) | next to; next to then between; next to, around the pond, between; through the tunnel then across the bridge. Clues are numbered picture cards above the map | LA004-05-F, LA004-05-H |

H5 said to wait for a play of `print-page` first (does the tutor speak a canvas `ask` to a non-reader?). That play is
still owed and decides whether these two hold as built. `feeling-faces` and `do-two-things` are not built.

## Update, later on 2026-11-10: three strands built

**Score now: 124 of 191 at level 2 (65%); Grammar 40 of 53. 0 played, 0 served.** `audit.json` carries the new
levels; the tables below are the morning's numbers.

| Strand | Built as | Subskills to level 2 |
|---|---|---|
| C1 sentence building | `wonder-walk` mode `sentence`: build a sentence from word cards, tap or say the word or end mark it lacks, find who it is about and what they do | 14 |
| C2 spoken grammar choice (handoff H1) | `di-spoken-practice` article_choice, pronoun_choice, verb_form, verb_tense | 17 |
| C4 open speech (handoff H2) | `oral-sentence-studio` ask_question, say_why, two_voices; `story-ribbon` listen_retell, tell_own | 12 |

C1 was verified by its own tests, `test:primitive wonder-walk`, `typecheck:lumina` 0 and four real generations
(about $0.25). No strand has had a browser look or a Live sample. Open points are in WORKSTREAMS row 22.

The main session rebuilt `audit.json` from its script after H1 and H2 had edited it, which erased their level
changes. The levels were restored from WORKSTREAMS row 22; those sessions' own `routeWhy` wording is lost. The file
is now patched in place only.

## Score (morning)

**81 of 191 at level 2 (42%). 0 played. 0 served.** A further 40 are at level 1 (routed, or blocked by a named
defect) and 70 are at level 0.

| Unit | Subskills | Level 2 | Level 1 | Level 0 |
|---|---|---|---|---|
| Phonological & Phonemic Awareness | 15 | 11 | 2 | 2 |
| The Alphabet | 12 | 7 | 5 | 0 |
| Phonics & Word Recognition | 15 | 14 | 1 | 0 |
| Reading Foundations | 11 | 6 | 1 | 4 |
| Speaking and Listening | 10 | 2 | 1 | 7 |
| Grammar Basics | 53 | 10 | 17 | 26 |
| Vocabulary Development | 29 | 11 | 9 | 9 |
| Reading Comprehension | 40 | 20 | 3 | 17 |
| Creative Expression | 6 | 0 | 1 | 5 |

| Route | Subskills | At level 2 |
|---|---|---|
| specialist | 88 | 79 |
| converge into a specialist (the four strands below) | 61 | 2 |
| add a mode (outside those strands) | 15 | 0 |
| canvas-new | 13 | 0 |
| repair | 6 | 0 |
| not observable on a tablet | 4 | 0 |
| ambiguous curriculum | 3 | 0 |
| none | 1 | 0 |

The foundational skills (sounds, letters, phonics: 42 subskills) are 32 at level 2, and the gaps there are defects
and missing modes on primitives that already have the word space, the spoken boss and levers. Grammar is the
largest unit and the weakest: 10 of 53.

## Canvases to build

Thirteen subskills are canvas work. Each is a picture task with a small closed set, done by tapping or dragging,
with no word library or spoken answer needed. Full objective records for the first five are in `audit.json`
(`families[].record`).

| Rank | Canvas | Action | Subskills | Cost |
|---|---|---|---|---|
| 1 | `print-page` | tap words in reading order, count them | 3 (LA001-01-C, -D, -G) | new program |
| 2 | `picture-chain` | order pictures along a scale or chain | 2 (LA005-01-H, LA005-03-H) | new program |
| 3 | `feeling-faces` | match a feeling to a face or situation | 2 (LA005-01-G, LA006-02-A) | new program |
| 4 | `treasure-map` | trace a route from position clues | 2 (LA004-05-F, -H) | new program |
| 5 | `do-two-things` | hear two steps once, do both in order | 2 (LA003-01-A, LA005-04-C) | new program |
| 6 | `picture-web` | build a topic web, leave outsiders out | 1 (LA005-03-F) | new program |
| 7 | `two-meanings` | tap both pictures a word can mean | 1 (LA005-02-G) | new program |

None was built in this pass. A kindergartner cannot read a canvas's `ask`, so every one of these depends on the
tutor speaking it; that has not been checked on a K canvas. Build `print-page` first and play it with the tutor on
before building the rest. About fifteen canvases from the science and math panels are also still waiting on a play.

## Converge into a specialist

Sixty-one subskills sit in four strands where a canvas is the wrong tool: the child answers by voice or the
stimulus is read aloud, the items come from the word library or a new story each lesson, and the strand is large.

| | Strand | Subskills | Signals | Target | Executor |
|---|---|---|---|---|---|
| C2 | Spoken grammar choice with a picture: articles, pronouns, verb forms, tense | 20 | word-library items, one spoken word as the answer, named misses, size | `di-spoken-practice` gains code-built frames (a/an/the, he/she/his/her/their, will, is/are + -ing, today/yesterday); the word library gains the grammatical facts | `/add-eval-modes`, `/add-word-space` |
| C1 | Sentence building: order cards, add a describing word, join with and/but, end mark, whole sentence or not | 14 | word-library cards with pictures, tap-to-hear for a non-reader, levers, six families in one world | a sentence track in the `wonder-walk` word world | `/agent-primitive` |
| C3 | Illustrated read-aloud story: problem and solution, what next, repeated phrase, main topic, feelings from the picture, beginning/middle/end | 14 | read-aloud, a new story per lesson, levers, seven families in one world | the `wonder-walk` story world gains four-event stories and those answer conditions | `/agent-primitive` |
| C4 | Open speech: ask a question, give a reason, retell, tell your own story, say what you like and why | 13 | free speech, named misses | `oral-sentence-studio` gains ask-a-question and say-why; `story-ribbon` gains listen-then-retell and tell-your-own | `/add-eval-modes` |

No canvas exists in these strands, so nothing is absorbed. Acceptance examples for each are in `audit.json`
(`convergence[].acceptance`).

Two of these have a real alternative, and the choice is yours:

- **C1:** `sentence-builder` could get pictures, per-tile audio and a K rung instead (the atlas item
  `k-sentence-builder`). It is still text tiles on the Grade 1 rung today. The word world already has library
  pictures, say-or-show answers and authored levers, which is why it is the recommendation.
- **C3:** `story-talk` could get pictures and a card and boss instead. It is audio only and still on the legacy
  script runner.

C2 is the atlas's `k-grammar-completion`, which was already named there as the next capability investment and is
still unbuilt.

## Modes to add (outside the four strands)

- `phoneme-explorer`: onset-rime blend and segment (…q4j0gp4z1, …yyruvwv8q); phonemes in order, one token per
  sound, where `segment` scores only a count today (…bjxozxpf2, LA001-03-D).
- `cvc-speller`: long or short vowel (LA001-03-C).
- `interactive-book`: a label kind and a contents page (LA006-06-E, -G).
- `word-flip`: match a singular to its plural (LA004-03-C, -G).
- `spatial-scene`: sort by relation; describe a scene the child made (LA004-05-C, -E).
- `picture-vocabulary`: meaning of a new word from the picture and sentence (LA005-02-A, -D, -H); riddles
  (LA005-02-I).

## Repairs

Each of these caps a specialist that otherwise has the action. All go to `/eval-fix`.

- `letter-sound-link`, `di-letter-sounds`: j, w, y, x and qu cannot be asked for spoken production, so Letter-Sound
  Group 4 has production evidence for v and z only.
- `letter-workshop`: copy and write submit as provisional and are excluded from adaptive updates, so the four
  Letter Formation subskills earn mastery evidence from tracing only.
- `di-letter-sounds:first_sound_in_word`: stops and short vowels are rejected, so "/c/ in cat" cannot be asked.
- `di-sentence-reading:decodable_sentence`: no comprehension question after the read (…wyqvgah7n).
- `cvc-speller`: the letter group defaults to 3, which puts the curriculum's own examples (van, wet, win, jet, fox)
  out of scope. `letter-spotter` and `letter-sound-link` default to group 1 when the objective names no letters
  (LA001-03-A, -B).
- `wordSpace/scope.ts:114`: reads only vowels written directly after "short", so the short-o subskill mixes o with
  a, not with a, e and i. "(st, pl, br)" is not parsed as a blend list.
- `word-workout:real_vs_nonsense`: vowel pairs such as map/mep are never generated because the spoken answer needs
  a different first letter; that tier needs a tap answer.
- `word-sorter`: common/proper, action/linking and location/direction sorts have model-authored keys (folds into C2's
  word-library facts).
- `word-flip`: the catalog calls the past-tense modes Grade 1-2 while the card lists K.
- `picture-vocabulary`: no season category for LA005-03-G.
- Component mastery tallies whole-word reads only. Letter names, letter sounds and spelled words never reach it
  (`service/componentMastery/registry.ts:61-72`).

## Not routable

- **Not observable on a tablet (4):** adverbs by movement (LA004-01-H), speaking audibly to a class (LA003-02-B), a
  two-minute presentation (LA003-02-H), movement or puppetry (LA006-03-F).
- **Ambiguous (3):** "participate in interactive grammar games" (LA004-01-L) and "apply vocabulary in structured
  activities" (LA005-04-F) name no learner action; stated versus inferred details (LA006-02-H) is above K reach.
  These need a decision before `/curriculum-author` touches them.
- **None (1):** draw a character and describe it (LA007-01-D): no draw surface in literacy.

## Not verified

- No generation was run: every level 2 is a code read. The scope defects above were read from the parsers, not
  reproduced.
- The agents read generators and domain, card and boss files; several component files were only searched.
- `rhyme-studio:production` and `:collection` have no code check of the child's word; the tutor is the only judge.
- Every spoken mode needs a mic, and none was exercised. `you-and-me` and `story-bridge` still owe their browser and
  mic sitting from September.
- Three level-1 specialists were named from catalog and card text only: `picture-vocabulary` opposites and
  go-together pairs, and `wonder-walk` one-versus-many.
