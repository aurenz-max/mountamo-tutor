# sentence-analyzer: failure inventory and lever table (2026-10-03)

**BUILT 2026-10-04** (`qa/eval-reports/sentence-analyzer-levers-2026-10-04.md`). `/add-support-tiers` Phases 1-2, literacy G2-6 family 1 of 4.
Rulings carried over: the child answers out loud and no lever turns the answer into a tap (DI spoken-first, x3);
help on a recognition item acts on material outside the session, never on the item's own words (handoff 22
"model pair outside the item"); a model lever's `does` text forbids extending the model to the item (10-02/10-03).

## Phase 1: failure inventory

Evidence: **no observed-real.** `logs/demonstrations` has no sentence-analyzer entries; `qa/misconception` has none;
there is no `*Remediation.ts`. Synthetic = the `spoken_miss` sweep (`qa/tutor-reports/spoken-miss/wired-all-2026-09-29.log`:
identify_pos 24/24, identify_role 28/28, label_all 24/24, parse_structure 20/20, every miss named) and the 08-17 Live
DI signature drives (scripted wrongs: Adverb for an adjective, Pronoun for a noun, Noun for a verb, "predicate" for a
subject-side determiner, Exclamatory for a declarative; all refused correctly). Documented = catalog `commonStruggles`
(4), the guidance, the script's judging contract (one signature error per action) and the `POS_ALTERNATES` note.
There is no `docs/contracts/sentence-analyzer.md` (Phase 3 derives it). Saved payloads exist for all four modes, but
all four are **grade 4 with no tier**.

Every mode has a miss list (`sentenceSpokenMisses`, `sentenceAnalyzerWorkspace.ts`; catalog `missLists`, literacy.ts:689).
Two facts about the lists from the grade walls: `confusable_label` cannot fire at grade 2 (Adverb and Pronoun are not on
the wall), and on identify_role it fires only at grade 5+ (grade 4's role wall has Direct Object and no other object).

| Mode (β) | Failure | Class |
|---|---|---|
| identify_pos (2.0), label_all (5.5) | says the confusable twin: adverb for adjective, noun for pronoun (`confusable_label`) | synthetic + documented |
| identify_pos, label_all | says another wall label (`other_label`) | synthetic |
| identify_pos, label_all | labels the word by what it is elsewhere, not in this sentence ("run" as a noun) | documented (the script's model line); lands as `other_label` |
| identify_pos, label_all | says "describing word", which names both adjective and adverb and is deliberately not accepted | documented (`POS_ALTERNATES` note); **no miss id** (lands as no match) |
| identify_pos, label_all | says a job ("subject", "modifier") for a part of speech, grade 3+ | inferred; no miss proposed (not on the pos wall, lands as no match) |
| label_all | loses track across four asks on one sentence | inferred; no lever (the highlight moves, each ask is single) |
| identify_role (3.5) | says the part of speech instead of the job (`part_of_speech`) | synthetic + documented |
| identify_role | object confusions: direct / indirect / object of preposition (`confusable_label`) | documented; grade 5+ only |
| identify_role | names the side the word sits in: "subject" for "brown", "predicate" for "leaves" | inferred from the key convention (identify_role keys "The" and "brown" as Modifier; parse_structure puts them in the subject); lands as `other_label` today |
| identify_role | another wall label (`other_label`) | synthetic |
| parse_structure name-side (6.5) | the other side on a determiner or a subject-side modifier (`other_side`) | synthetic + documented (the signature error) |
| parse_structure name-side | the other side on the object noun ("ball" read as subject because it names a thing) | inferred; same miss id |
| parse_structure name-type | says Declarative, the default every sentence looks like unread, or another kind (`other_label`) | synthetic + documented |
| all | stays silent after the ask | documented; no lever of its own (the tutor waits; "I'm stuck" pulls a model) |
| all | asks to hear the question again | documented; not a failure (the tutor repeats the ask) |

**Content defects on the saved payloads (fix under `/eval-fix` before measuring any lever; D1 and D3 corrupt evidence):**

| # | Payload | Defect |
|---|---|---|
| D1 | label_all | "down" in "Cold water flows down quickly." is keyed Preposition; it has no object, so it is an adverb. Preposition is a rare label on the grade-4 wall, so `pickSpread` is likely to ask it, and the tutor would refuse a correct "adverb". |
| D2 | parse_structure | "night." in "Bright stars shine every night." is keyed Object of Preposition with no preposition in the sentence. Not asked in this mode, but the same generator writes the role keys identify_role asks; role keys are not validated against the sentence. |
| D3 | identify_pos, label_all, parse_structure | Number words "Three", "Four" are keyed Adjective. Many grade-4 programs call them determiners, and the wall's Determiner gloss ("points out which one") fits; a child saying "determiner" is refused. Keep-or-drop number words as part-of-speech targets. |
| D4 | all four | 17 sentences share one template ([Det/Num] Adj Noun Verb [Adv/Obj]): no pronoun, conjunction, question or command. parse_structure is four Declaratives, so the session has one sentence-kind ask; every complete subject ends at its noun. The prompt asks for varied sentence kinds only at grade 6. |
| D5 | config | `supportTier` reaches only `leadInFor`, which only the retired script cue and the DI bench (`diDrivePlan.ts`) read; `sentenceAssignment` drops it. On the workspace path config.difficulty changes nothing the learner sees or the tutor gets. (Phase 6 finding, not `/eval-fix`.) |

## Phase 2: lever table

Every model and practice sentence comes from one hand-labelled pool (`sentenceModels.ts`, new): short sentences with
part of speech, job, complete-subject end and kind keyed by hand, plus one example phrase per wall label. Hand keys,
not generated ones: D1-D3 show the generator's keys are not reliable enough to model from.

**Selection never reads the item's answer** (R2). Each pool pick is a function of grade, the session's words and a
seed. That is the leak rule, and it is checkable: the builders take no `answer` argument, and a unit test shows two
items whose answers are the two members of one pair (Adjective/Adverb, subject/predicate) get the same distribution.

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| identify_pos, label_all | confusable_label, describing_word (proposed) | `model_sentence`: a card beside the sentence with a DIFFERENT short sentence, every word labelled with its part of speech, an arrow from each describing word to the word it describes. The tutor may walk the card | help | both (card shown; the tutor voices it) | Picked by grade and session words only. No model word (case-folded, punctuation stripped) in any session sentence. The model contains BOTH members of every confusable pair on the grade wall (Adjective+Adverb, Noun+Pronoun at grade 3+), so it cannot point at one. `does` forbids saying which model word is like the asked word | no (the stage draws the item sentence and the wall only) | pool + picker + leak check; card render with label chips and arrows |
| identify_pos, label_all | other_label, confusable_label | `wall_examples`: every wall label gains one example phrase under its gloss, the example word underlined ("a *tall* tree", "ran *fast*") | help | shown (print, for readers; at grade 2 the tutor reads an example when asked) | All wall labels get an example in the same pull, never a subset. No example word in any session sentence. Examples are fixed per label and never chosen from the item | no (wall prints label + gloss) | example pool (2 per label for session exclusion) + one line per wall card |
| identify_role | part_of_speech, named_the_side (proposed) | `two_row_model`: a DIFFERENT short sentence, each word with two stacked labels, part of speech above and job below; its subject opens with a small word and a describing word, so "a word in the subject has its own job" is drawn | help | both | Picked by grade and session words only. The model carries every role on the grade wall (no role can be eliminated). No session word. `does` forbids naming the job of the asked word or pointing to the model word that matches it | no | pool + picker; card render (reuses the `model_sentence` card with a second row) |
| identify_role | confusable_label, other_label | `wall_examples` on the role wall ("Direct Object: kicked *the ball*", "Modifier: the *red* kite") | help | shown | Same as above, on the role wall | no | same module |
| parse_structure name-side | other_side | `split_model`: a DIFFERENT sentence with its complete subject bracketed and labelled "subject", the rest bracketed and labelled "predicate". Its subject starts with a determiner and has a describing word, so the signature words are drawn inside the subject | help | both | Picked by grade only. Model subject has a determiner and a pre-modifier. No session word. Nothing is drawn on the item sentence | no | pool + bracket render on the card |
| parse_structure name-type | other_label | `wall_examples` on the kinds wall: one example sentence under each kind, end mark included ("Is the bus late?") | help | shown | All four kinds every pull; no session word; fixed per kind | no | same module |
| identify_pos, label_all | confusable_label, other_label, describing_word | `short_sentence`: an ungraded practice item, a 3-4 word pool sentence with no stacked modifiers and the asked word next to the word it goes with; then the full item returns | simplify | both (printed; the tutor asks it) | Practice sentence shares no word with a session sentence. Target drawn by seed: from the pair after a `confusable_label` miss (the pair is the same set for both members), else from any on-wall word. Builder takes no answer. Answer recomputed from the pool key | no | runtime builder + practice state in the component (phonics-blender `short_word` pattern) |
| identify_role | part_of_speech, confusable_label, other_label, named_the_side | `short_sentence` on roles: a 3-word subject-verb-object pool sentence ("Dogs chase cats."), one word asked | simplify | both | Same rules; target drawn by seed over the practice sentence's on-wall roles | no | same builder |
| parse_structure name-side | other_side | `short_subject`: a pool sentence whose complete subject is two words (determiner + noun) where the item's has three or more; one word asked | simplify | both | No session word; asked word drawn by seed over all words, never from the item's side. Refused when the item's complete subject is already two words or fewer (nothing to drop) | no | same builder, refusal string |
| parse_structure name-type | other_label | `plain_kind`: a 3-4 word pool sentence in canonical form (a question opens with a question word or helping verb, a command with its verb), kind drawn by seed from the four | simplify | both | No session word; kind drawn by seed, never from the item's kind | no | same builder |

`label_all`'s simplify is a single ask. Each label_all item is already one `name-pos` ask; the walk is the session's
shape, and the practice item does not shorten it. The walk resumes on the same word after the practice.

### Rejected and no-lever rows

- **Marks on the item sentence** (an arrow from the asked word to its head, the simple subject underlined, the item's
  subject bracketed, the verb marked). The relation between the word and its label is the answer. On name-side any
  mark at the boundary gives the side by position: on every saved sentence the complete subject ends at the noun, so
  marking the noun marks the boundary.
- **Narrowing the wall** (dimming far labels, two or three left). R1.
- **Spotlight on the item's end mark** (name-type). "?" to Interrogative is the whole step; it acts on the item's
  answer-bearing evidence.
- **Colouring words by part of speech**, on the item or the model. A colour is a printed label (component header); the
  model uses label chips, which the tutor can read and the scene fact can state.
- **A model of the twin only** ("quickly is an adverb" beside an adjective item). Elimination on a two-member set; the
  coverage rule puts both members in every model.
- **A shorter walk** (label_all with fewer words). Session shape, not item shape; no pull can change it mid-walk.
- **Silence:** no lever of its own. "I'm stuck" before a try pulls help (trigger ladder), which is the model card.

### Miss list change (build work)

- `describing_word` (identify_pos, label_all; only items whose answer is Adjective or Adverb): "The learner's answer is
  'describing word', which names both adjective and adverb." Documented; today it lands as no match.
- `named_the_side` (identify_role; only items whose answer is not Subject or Predicate): "The learner's answer is
  'subject' or 'predicate', the part of the sentence the word sits in, not its own job." Put it before `other_label`
  in `sentenceSpokenMisses` precedence. It splits a pattern that `other_label` names today, because it needs a
  different lever (`two_row_model`).

Add both to `sentenceSpokenMisses` and the catalog `missLists` in the same change. No miss is left unanswered, so the
J9 unanswered list stays empty.

## Phase 6: starting positions

| Tier | Starts on screen (not a pull, never recorded) |
|---|---|
| easy | `wall_examples` |
| medium, hard, or no tier | none |

Model cards and simplify items are pulls at every tier. D5 means the tier does nothing today; this mapping is the
first thing it would do on the workspace path. `leadInFor` stays for the DI bench only.

## Guidance cap

Guidance 733 + `WORKSPACE_DOCTRINE` 948 + `LEVER_DOCTRINE` 213 = **1896 of 2000** once `levers: true` is set: 104
characters of headroom. Two edits are needed: "No word is coloured or labelled until credit." must become "No word of
the sentence is labelled until credit." (the model card labels other words), and one sentence fencing the models
("Models are other sentences; never say which model word matches the asked one.", 79). Together they add 84, to
1980: 20 to spare. Any further sentence needs a trim first; "You cannot point at or highlight words." (39) is the
candidate. Run the live-activity suite after the edit (offer-cap memory).

## Rulings needed

| # | Question | Recommendation |
|---|---|---|
| R1 | Handoff 22 "Later" says the G2-6 primitives use "spotlight help and fewer or farther choices". sentence-analyzer has no choices: the wall is reference, the answer is produced from memory. Does narrowing the wall count as a lever? | **No wall narrowing.** Narrowing it on the current item is chosen with the answer in hand (elimination) and turns production into a pick among three (the skill's mode floor, handoff 22 R2). The help is examples and models; the simplify is a shorter sentence. |
| R2 | The DI tables pick models and practice items that EXCLUDE the item's answer (di-shapes: model shape is not the item's shape). Here the sets are tiny (subject/predicate; Adjective/Adverb), so excluding the answer tells the child the answer by elimination. | **Answer-independent selection for this primitive:** builders never read the item's answer; model cards show every label in the asked set; practice targets are drawn by seed. A practice item may share the item's label; it is assisted work and the full item is credited only without the lever. |

## Build notes

- **New:** `sentenceModels.ts` (hand-labelled pool: about 16 short sentences across grades 2-6 with pos, role,
  subject end and kind, plus two example phrases per label for 9 parts of speech, 6 roles and 4 kinds) and
  `sentenceAnalyzerLevers.ts` (declarations with `answers`, `modelFor`, `practiceFor`, leak checks, `leversOnScreen`).
  The model card is new render; the wall example line is a small addition to `renderWall`.
- **Reuse:** the shared lever mechanism (`pullLever` / `endPractice`, `{ practice: TeachingAssignment }`,
  `useWorkspaceRunner.checkPractice`), phonics-blender's practice-state pattern in the component, and
  `sentenceAssignment` for the practice item (a pool sentence through the same build path, so the judging contract and
  misses are the real ones).
- **Order:** `/primitive-contract sentence-analyzer` first (no contract doc exists). Then `/eval-fix` D1-D4 (generator
  validation of role and part-of-speech keys, number words, sentence-kind variety for parse_structure). Then build.
- **Size: M.** About 350-450 production lines (pool ~150, levers module ~120, component ~100, catalog and misses ~20),
  plus unit and mounted tests.
- **Payloads to generate before building** (one Flash generation each): identify_pos grade 2 (no confusable on the
  wall) and grade 3; identify_role grade 3 and grade 5 or 6 (so `confusable_label` fires); parse_structure after the
  D4 fix, with mixed kinds; one easy-tier payload for the starting position. Keep the four grade-4 payloads.
- **Unit tests to write:** model and practice never share a word with a session sentence; model coverage of each
  confusable pair and of every wall role; builder distribution is the same for both members of a pair; `short_subject`
  refusal; miss to `nextLever` table including the two new misses.
- **Class gate:** no Live run for this primitive. The class Live pair waits until all four G2-6 primitives have
  every mode levered (ruling 09-28).
