# Add the DI Judged Loop to a Primitive

This skill converts a click-to-advance or timer-advanced primitive to the **Direct Instruction modality**: the Live tutor owns the clock — it asks, waits, judges the child's answer from the audio in-band, corrects contrastively, and **its own affirmation is the advance**. When you are done there is no advance timer, no Next button, no push-to-talk mic, and no printed answer anywhere in the path.

## The outcome you're designing for

> **The tutor asks. The child answers OUT LOUD. The tutor's verdict moves the lesson. The screen only follows.**

Say it that way round every time. Voice and hands are not two equal options — **speaking is the modality, and a tap is the exception you have to earn.** A DI session where the child never says anything is a tutor talking at a child who operates a UI, and it does not matter how correct the loop wiring is. If you find yourself writing a pack whose every answer is a tap, you have not built a DI port; stop and re-read Step 1.

User verdict on the shipped ports, for calibration: *"an incredibly strong modality from a learning standpoint."* The user has driven the runner template on multiple surfaces with deliberate wrong answers, and the judge refused them — you are extending a proven pattern, not experimenting.

## What you write vs. what already exists

A port costs **a script + a stage** — nothing else. The mechanics live in code and you must NOT re-roll them:

- `hooks/judgedScriptContract.ts` — the pack contract + the standing gates AS CODE: the benched response-class registry, the sentinel-collision validator, `validateJudgedScriptPack`, `spokenSpanOf` (the ONE spoken-line parser — never write a local regex), `opensWithSentinel` (per-sentence; the string-START form is the weaker fork that shipped), `findPerformedStageDirections` + `findRepeatedConsecutiveAsks` (the two defect classes only live drives used to catch), and `JUDGED_AUDIO_INPUT`.
- `hooks/judgedScriptContract.testkit.ts` — `checkPackGates` + `checkDiCatalogEntry`: the di-script test plumbing, once (Step 6). Your test asserts both return `[]`.
- `hooks/useJudgedScriptRunner.ts` — the component half every port repeated: connect (`owns_opening`) → mic → opening cue → arm; affirm advances; corrections cap (2) then move on; gesture rules; resync; tap-to-hear; Tier-A diagnosis; context sync.
- `primitives/.../literacy/phonemeVoice.ts` — written phoneme → sayable form. Every phoneme in a spoken line goes through it (plus the bare-vowel rule below).

**You hand-author:** `<primitive>Script.ts` (every cue, every judging contract — the exact wording IS the pedagogy, DISTAR discipline), the component's stage render, the generator's answer fields + gates, the catalog's DI block, and the tests. **The runner carries NO cue template deliberately** — the shipped ports produced different cue shapes, and a template carrying any one of them would ship the answer inside the ask on the others.

**Worked examples, freshest first:** `letterSpotterScript.ts` (a spoken mode beside two honestly-unsayable tap modes — and the conversion that got it there, including what a deleted menu costs), `tenFrameScript.ts` (the first MATH port: spoken counts beside two placements, a fork that splits by BAND, and the two content gates a number answer needs), `phonemeExplorerScript.ts` (4 spoken modes incl. a count answer), `pictureVocabularyScript.ts` (spoken + tap modes side by side), `letterSoundLinkScript.ts` (a sound answer + the content gates), `countingBoardScript.ts` (gesture anchor). Read the one closest to your primitive's shape before writing a line.

**Outside literacy, read the contract before you call anything a costume.** The costume test is about the ACTION, and in math the manipulative is frequently the skill itself — placing five counters IS building five, so ten-frame's steppers were costumes and its frame was not. Twice now `/primitive-contract <id> --check` has returned a requirement that had already deleted the button you were about to delete, for a better reason than yours; re-base those onto what they protected instead of forking around them.

## The frame — three user rulings, do not re-litigate

1. *"if the existing primitive asks the student to click the mic, then answer, the existing primitive is wrong."* A primitive is never exempted from the modality because its interaction is manipulative, and never left broken because another pack could absorb its demand.
2. *"the exercise should be purely verbal using the DI capability, not a combination of clicking on tiles and speaking."* Where the skill is verbal, the whole task is verbal. **The test: can a child who cannot do the skill still perform this action correctly?** If yes, the action is a costume — delete it.
3. *"in real life if i have a sentence with a missing letter, and i ask the student to use context clues and the word to say the missing letter, they should be able to translate the sentence and missing letter verbally. they dont need to click a button."* (2026-08-13, letter-spotter drive.) **The real-life test:** picture a teacher doing this at a table with one child. Is there a menu of four cards in that picture? If not, there is no menu on the screen either. A tap that exists because the JUDGE found the answer hard is not a pedagogic choice — it is a limitation wearing one.

ROUTE/CONVERT/LEAVE bucketing was proposed once and REJECTED. Do not re-derive it.

## ⭐ The defect classes that REPEAT — read before Step 1

*Routed here 2026-08-16 from the portfolio index, where they were unreachable by the
person who needed them. Every one was found by a shipped port; each has cost at least
one slice. Check them against your primitive before you write a line.*

**1. One challenge is NOT one item.** (decodable-reader, then word-workout, word-sorter,
word-builder.) A click-era "challenge" is a screenful; a judged item is one ask with one
answer. A word chain is one judged read PER WORD, a sort is one ask per word, a match one
per pair. **This is usually the port's biggest measurement change** — word-workout's click
era scored EVERY chain `correct: true, score: 100` whatever the child said. Expand in
`itemsFromChallenges`, cap the session length, and **SELECT rather than truncate**: a
blind slice can strand a whole mat, which on a binary sort makes one label right forever.

**2. The answer may be answered ONCE per session — and it has two halves.**
(letter-spotter, then letter-sound-link, word-builder.) Every item closes by naming its
answer aloud, so a later item on the same target is recall, not skill. Half two: **an
answered thing may not come back as a WRONG CHOICE** — a distractor the tutor already
named is eliminated for free. **Keep the two sets separate** (port 7 merged them and ran
the pool dry, stranding an item). It lives in `itemsFromChallenges` — the only builder
that sees the whole session. ⚠️ **Check whether your eval mode makes this the DEFAULT
state**: where the mode pins the answer (text-structure-analyzer), every item shares one
answer by construction.

**3. The elimination leak a tap surface hides.** (word-sorter.) The click-era match column
CONSUMED its entries, so the last pair of every challenge had one option left and needed
no reading at all. Keep the bank WHOLE for the whole challenge — uniform N, no
elimination — and let a support tier withdraw the *information*, not the options.

**4. The MATS are not a costume.** (word-sorter, ten-frame R6, word-builder's cards.) The
costume test is about the ACTION, never the paper. A sort whose groups are unknowable is a
*broken* task, not a harder one — so the ask NAMES the groups and the answer sits inside
the question by construction (`leakExemptSpan` on the menu clause and nothing else).
**Make the exemption TIER-CONDITIONAL** and `hard` becomes a real spoken lever: the ask
names nothing, the oracle goes flat, and a K band floor still beats the tier.

**5. `VERDICT_ENDS_THE_TURN` — the affirmation that runs on into a FABRICATED next ask.**
(word-sorter: **11 of 12 affirmations.**) *"Yes, spoon belongs with Hard. Your turn.
Listen: teddy bear…"* — a real word from the challenge that is **not** the item the runner
is about to send. `TWO_BRANCH_LAW` and `NEVER_PERFORM` both miss it because neither names
*continuing the lesson*. It bites hardest where the ask is one rigid template and the
affirmation is short. Put the clause on every cue **and** in the catalog directive.

**6. A near-empty ask makes the `[CURRENT STATE]` block a live audio channel.**
(decodable-reader: the tutor read the printed line aloud before the child decoded it, three
consecutive asks.) Where the ask names nothing BY DESIGN because the cold read IS the mode,
the model fills the silence from the state block. `NEVER_PERFORM` does not prevent it.
**Push a DESCRIPTION and let the judging contract carry the value**; audit the catalog
`taskDescription` in the same pass. And copy `NO_FLOOR_HANDBACK` **separately** — *"Do you
want to read another line?"* is not praise, so the two-branch law misses it, and a pack
with more than one item KIND has phase boundaries that invite it.

**7. 18d lives on the ACCEPT side too, and that version is worse.** (letter-sound-link.)
Every census hunts a re-spoken ASK, i.e. the wrong branch. *"Count it as correct and warmly
echo the clean sound"* tells the tutor to affirm without giving it the affirmation, so the
turn opens with neither sentinel and a **CORRECT child stalls**. No grep for a re-spoken
ask finds it. **Read every `commonStruggles` row and ask: does this produce a VERDICT, or
only a sentiment?** *(A "goes quiet" response is NOT 18d — silence is not an attempt.)*

**8. Writing the spoken ask AUDITS THE CONTENT — assume the answer key is wrong.**
(letter-sound-link's `x`→"box"; letter-spotter's *"say the letter that **sheep** starts
with"*, answer key `S`.) A relation a tap never had to justify may be false out loud. Gate
digraph/cluster classes (`sh ch th ph kn wr gn`) in CODE, never the prompt. Same family:
syllable-clapper's `hard` band ASKED for dialect-ambiguous words, i.e. instructed the tutor
to refuse a child who was right.

**9. The reveal/model policy is often BACKWARDS in the click era.** (syllable-clapper: the
policy said never state the number of parts before the child claps, then told the easy tier
to say the word *"broken into its parts with clear pauses"* — three beats IS three.)
**Purposeful enunciation is a ladder**: a chanted-in-parts model hands the count over, so it
is legal ONLY in the correction and on a **code-picked model word the session never asks
about**.

**10. The token ceiling is per-MODEL, and a fan-out makes it fatal for one mode only.**
phoneme-explorer truncated at `maxOutputTokens: 4096` — the widest schema in the family died
mid-object, `JSON.parse` failed, and a hardcoded fallback **shipped silently, graded as
success**. ⚠️ **Then word-builder proved the fix is not a constant: 8192 is a NON-THINKING
number** — on `gemini-flash-latest` it is shared with the reasoning budget and truncated
the payload at ~850 chars, killing two of four eval modes while the other two came back
clean. **Bound the schema ARRAYS first**, then pick the ceiling from the model actually
configured. A per-mode fan-out lets a ceiling be invisible in three modes and fatal in one.

**11. THE STIMULUS'S OWN LABEL CAN BE THE ANSWER — and only reading the live draw
aloud finds it.** (compare-objects, port 21.) Its first live `order_three` draw returned
*"small green bush" / "tall oak tree" / "high kitchen chair" / "miniature coffee mug"*.
Every machine gate passed: the key was right, the drawing agreed with it, the menu was
clean. The fault was in the **noun** — the tutor says *"Put the small green bush, the
tall oak tree and the garden flower in order, from tallest to shortest"* and the child
never has to look at the screen. **A label on a button is scenery; a label the tutor
READS ALOUD is the question.** Any port whose stimulus carries GENERATED labels (object
names, character names, category names) owes a refuse-list gate on words that name the
answer's dimension, prompt-side AND build-side. ⚠️ **And re-draw the exemption you are
about to grant:** the first version of that gate exempted the mode whose answer was a
CATEGORY rather than a magnitude, and the very next draw refuted it (*"heavy backpack"*
names the attribute, which was that mode's whole answer). Related: the leak scan is
`leakExemptSpan`-blind here, because the leak is a legal part of the ask.

**12. DEFECT 6 HAS A SECOND HALF, AND IT IS WHERE `{{stimulus}}` SITS.** (states-of-matter,
port 22.) Solar-system's fix — the stimulus stating its own non-speakability — took an
observe mode from **3 of 6** asks reading the `[CURRENT STATE]` preamble aloud (its own
*"never read it aloud"* sentence included) to **2 of 6**, and no further. What closed it to
**0 of 6** was the catalog placement: **`{{stimulus}}` goes LAST in `taskDescription`, with
the never-read-aloud clause IMMEDIATELY before it** (*"The question side of what is on
screen, described for you alone and never read aloud: {{stimulus}}."*). Split that clause
into its own sentence higher up and the block stops identifying itself as not-content at
the point it arrives. Copy the whole shape, not just the stimulus half.

**13. THE DRAW IS A THIRD RECITATION CHANNEL, and no gate can see it.** (states-of-matter.)
The runner re-speaks the how-to-play on every ACTION change, so a draw that ALTERNATES two
facets of one mode per item makes every item an action change and re-recites ~14s of
protocol every round — the 2026-08-13 recitation ruling arriving through the generator
instead of through `leadInFor`. `findRepeatedConsecutiveAsks` is structurally blind to it:
consecutive items have different actions by construction. Fix is one constant in the draw
(group each facet into RUNS of ~2), and the tell is in the drive transcript, never in a
test — read consecutive asks of the same MODE and count how many open with the protocol.

## Step 1 — the answer-material fork (the creative core)

**The whole fork is one picture (user ruling, 2026-08-13): a teacher sitting at a table with ONE student, and the primitive mirrors whatever the student would naturally do at that table.** If the student would answer OUT LOUD, the mode is spoken — the mic is the student's voice, and the screen never impersonates it with buttons. If the student would do the work ON THE PAGE — arrange the counters, write the letters in the boxes, point to the one they mean — **the screen IS that page**, and a gesture mode is honest work, not a concession the judge extracted. The screen plays the page; it never plays the voice, and it never grows apparatus the table doesn't have (menus, checkers, Next buttons). Both of this skill's historical failure modes are this picture violated from opposite sides: tiles added because the JUDGE was weak put a menu on a table that has none (letter-spotter), and reading "spoken is the modality" as a reason to take away the page would have deleted ten-frame's frame along with its steppers — the contract check is what kept the student's paper on the table (R6).

For **each eval mode**, decide what the answer is MADE of. Two questions, and the ORDER matters — getting it backwards is how this skill has shipped its worst packs:

**First: could a child SAY this answer to a teacher across a table?** A letter, a sound, a word, a count, a yes/no, a whole sentence read aloud — all sayable. If it is sayable, it is SPOKEN, and you are done with this fork. Do not consult the class table to talk yourself out of it.

**Only if it genuinely is not sayable** does the answer become a gesture — the work the student would do on the page. There are exactly three shapes that qualify, and each names what has no spoken form:

| the answer is… | example | why it can't be said |
|---|---|---|
| a POSITION | which cell of sixteen holds the letter | "third box, second row" is not the answer, it is a description of one |
| a FORM | which lowercase letter matches this capital | saying "S" would not show they know the letterform |
| a BUILD / PLACEMENT | the letters in the boxes, the counters on the frame | the arrangement IS the answer; naming it is a different task |

Anything else that arrived as a tap is a conversion, not a mode.

**Then** run the response-class arithmetic against `RESPONSE_CLASSES` in `judgedScriptContract.ts` to find what you owe the class:

| The child's answer is… | class | status | precedent |
|---|---|---|---|
| one short word from a closed per-item set | `short_spoken_word` | benched | sound-swap, word-flip, naming/opposite, blend |
| a count (say how many; 1–20, never zero) | `number_word_to_20` | benched | counting-board; phoneme-explorer segment |
| a HELD continuous sound (`s n m f l r v z` + short vowels) | `continuant_sound` | benched, held sounds ONLY | letter-sound-link see-hear |
| a committed manipulation (tap/build) | `manipulation` | benched | cvc spell_word, receptive taps |
| a letter NAME (or its sound) | `letter_name` | accepted-build-ahead | letter-spotter name-it |
| which of N choices ON SCREEN — a whole proposition, named aloud | `closed_set_choice` | accepted-build-ahead | decodable-reader sequence/inference/main_idea |
| open-set production (any of countless right answers) | `open_set_word` | **BLOCKED** | why association TAPS |
| an isolated STOP sound produced by the child | — | **unbenched** | why isolate elicits a word |

### A blocked class is not a licence to add buttons

**This is the instruction this skill got wrong, so read it before you reach for a menu.** The old text told you a blocked class "gets closed by on-screen cards" — it stood through eleven ports, and letter-spotter is where it did real damage: all three modes tapped, and a five-year-old sat through a DI session with nothing to say, in front of a mic orb reading "I'm listening". A blocked or awkward class means the JUDGE has a problem. It says nothing about what the child should do.

When you hit one, in order:

1. **Reframe the ask** so the answer is a different sayable thing (a task that would elicit a stop consonant is restructured so the child says a **word** or a **count**).
2. **Narrow the judge's job.** Most "we can't judge this" is really "we can't classify this open-set" — but the judge is never classifying, it is handed ONE target and asked whether the child said it. Add an **accept clause** naming the honest variants and a **second channel** where one exists (letter-spotter accepts the letter's name *or* its sound, so a homophone confusion has to beat both).
3. **Ask for the class to be ruled or benched.** `accepted-build-ahead` exists for this; it needs a user ruling or a ~30-min sitting, recorded in `evidence` with an acceptance drive owed. `yes_no` and `letter_name` both arrived this way.
4. **Only then** consider a gesture — and only if the answer now fits one of the three unsayable shapes above.

A menu of options is never step 1. Count what it costs before you write one: it converts **production into recognition**, floors a guess at **1/N**, hands over **the answer set** the child was supposed to generate, and — the part that bites — a distractor pool assembled for the SCREEN is not acoustically separable anyway. letter-spotter's tiles offered *n / s / i / a* while the block that justified them was about homophony; `n` and `s` are the same /ɛ/ cluster.

**And when a menu genuinely IS the ask** — the answer is a whole proposition (which part came first, what the story is mostly about), so free production would be `open_set_word` — the menu stays and the BUTTON goes: the child SAYS which choice it is (`closed_set_choice`). This is the third time the user has had to rule it (rhyme-studio 👍/👎, letter-spotter tiles, decodable-reader cards): *"i need to click on the button even though im speaking."* Two things the pack owes that class: the contract **accepts the SHORT form** — the distinguishing part ("the mat"), the picture, or the position ("the second one"), because a five-year-old never recites the proposition back — and a build gate on **ear-separability**: every option must carry a word no other option has, or an utterance fits two of them and there is no honest verdict. Drop that ask; do not judge it leniently (`optionsEarSeparable` in `decodableReaderScript.ts` is the reference, run on both the pack and the generator side).

*"An ambiguous ask is not a harder task, it is a broken one"* — if a mode cannot be given one defensible answer, restructure the ask, never the judging leniency. And where a printed word would let a reader shortcut the skill (counting letters instead of sounds), **the word never prints**.

## Step 2 — write the script (`<primitive>Script.ts`)

Answer these per mode — the answers vary and that variance is the pedagogy:

- **Is the model the answer?** If modeling would say the answer (naming, counting), model NOTHING before the ask — the answer is earned in the correction. If the RULE can be modeled on content the session never asks about, pick that content IN CODE (`pickModelNoun` / `pickModelOppositePair` pattern).
- **Can the stimulus answer the hand-over?** *"What word?"* after *"now there are three"* is honestly answered with the picture's name. End the ask so exactly one completion is right.
- **The ask STATES its problem aloud.** A pre-reader cannot read the screen, and every correction re-ask inherits the ask. Stimuli that must be heard (a scale, a sentence frame, a sound walk) are spoken with the answer slot as "hmm".
- **The judging contract names the signature error** — the wrong answer that is fluent, confident, and most likely to be wrongly affirmed (the base word said back; the separate sounds with no word; the word said back where a count was asked) — **and the accept clause** — the right answer that doesn't look right ("puppy" for a dog; counting aloud that LANDS on the total; the word inside a phrase). Affirm lines echo the canonical word.
- **Corrections open `"My turn:"`, re-model, then re-elicit** (standing gate 3). Affirmations open `"Yes,"`. Nothing else may open a sentence with either — including generated content: **refuse the word token "yes" in every pool** (a `y`-keyword became "yo-yo" for exactly this), and `validateJudgedScriptPack` runs the scan over every cue you can emit.
- **Build gates DROP unaskable items** (`itemFromChallenge` returns null): unsayable walk (the walk IS the ask), the answer inside the operation/frame prose, an example word sitting in the menu, a count outside the benched range. Ship nothing over a broken ask — never degrade it.
- **Voice safety:** every phoneme through `phonemeVoice`; bare vowel LETTERS get di-letter-sounds spellings (`a` → "aaa" — left raw it reads as the letter name); see `spokenPhonemeToken` in `phonemeExplorerScript.ts`.
- **The lead-in belongs to the INTRODUCTION of an action, not to every ask — and check what two consecutive asks actually sound like.** *(Ruled twice on the same day, 2026-08-13: rhyme-studio first — "she asks every time 'words rhyme when they end the same way, bee tree'… we can remove that after the first example" — then letter-spotter, which shipped the identical defect hours later because the rule was written in a BACKLOG block instead of here. **If the model line does not change when the item changes, it is established once, not recited.**)* The `leadInFor` tier ladder every pack copies (easy = model + guide, medium = model, hard = nothing) is written per item and therefore speaks per item; the ladder is a property of the RUN being read as a property of the ITEM. Where the ask carries varying content (a new sentence, a new letter, a new fact) that is survivable; where it does not, **the entire utterance comes out byte-identical every round.** letter-spotter's match-it spoke the same 26 words six times — ~14s of speech against a ~13s answer — because that mode may not name anything on screen (the letter IS the answer). The gate is CODE now — `findRepeatedConsecutiveAsks` runs inside `checkPackGates` and fails byte-identical consecutive same-action asks; your job is the design half below, not the assert. The fix is to pass `leadInFor` only where the how-to-play goes (`opening || howToPlay`) and give the invariant mode a SHORT repeat ask; keep the action stated in it, since an ask that says nothing is broken rather than terser. DISTAR fades the model — it does not re-read it. The tier ladder survives intact: it sets how rich the introduction is, and the most-supported tier can keep the full frame on repeats as its per-item lever.
- **Write the contract as FACTS about the turn, never as ORDERS — an imperative aimed at the tutor gets PERFORMED.** Ten-frame's contract opened *"Then WAIT silently — …"*; the tutor wrapped it in a bracket tag mimicking `[TF_ITEM]` and said **"[WAIT silently]"** aloud to the child, and the cue's own *"never read bracket tags aloud"* did not save it because the model had invented the tag itself. Write *"The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner works"*, and end every contract-carrying cue by naming the failure: *"never announce that you are waiting or listening — simply stop speaking."* Same family as letter-spotter's fabricated `[LSP_TAP]`, reached from the opposite direction. **This class is linted now** — `findPerformedStageDirections` (inside `checkPackGates`) flags imperative WAIT forms outside the spoken span, so a new pack cannot ship it. **The sweep is DONE (19a, 2026-08-13): the gate caught nine packs — every judged pack in the repo except the ten-frame pilot — plus `"and stop, then wait again"` and the pre-runner ports' `"Then wait for the learner to speak."`, all now on the fact-form.** The ear-check rides the open mic rows rather than a new one.
- **Tap-to-hear speaks question-side audio only** — the stimulus word, one sound, or the whole question again. Never a hint ladder (cvc's `[ISOLATE_VOWEL]` was an answer leak on demand).
- `stimulusFor(item)` is the single builder for the context channel, **answer-free by construction** (a mode whose stimulus IS the answer pushes a placeholder or nothing).

## Step 3 — the component (whole-file rewrite)

Build the pack (`JudgedScriptPack`) in a `useMemo` over items from `itemsFromChallenges`, hand it to `useJudgedScriptRunner`, and render the stage. Reveal-on-affirm only (`onAffirmed` → the first moment the answer may appear on screen). Gesture modes call `runner.submitGestureAttempt(<verdictCue>)` with the match CODE-COMPUTED.

### A hands turn needs a CLOSE — and most primitives don't have one

`submitGestureAttempt` is the easy half; deciding WHEN to call it is the design, and this skill used to say nothing because the first two ports never had to ask. Their shapes handed them the answer: cvc-speller's third letter fills the last slot, counting-board's single tap IS the whole answer. Ten-frame's `build` broke that — ten cells, a target of five, **no terminal state** — leaving only a button (deleted by doctrine) or the voice (unbenched for a placement).

**A voice turn closes on SILENCE; a hands turn closes on STILLNESS.** When the surface stops changing for ~3s, commit it and let the tutor judge. It is the mic's amplitude bracket with a different sensor, and it is what a teacher does when the child's hands stop.

**The window is the runner's — call `runner.armStillness(commit, ms)` at the interaction site and never hand-roll a `setTimeout`** (19c, 2026-08-15). Every touch re-arms it; the runner cancels it at item open, at a correction retry, at the gesture commit, at run end and on unmount. That cancel list is the whole reason it moved: four ports wrote their own and each had to keep the same five sites in step by hand, where a missed one commits the PREVIOUS item's board into this item's turn. `ms` stays per call because the window is a property of the SHAPE being built — a five-tap equation tray waits longer than a two-part split, and a terminal shape shortens it. `runner.clearStillness()` cancels without committing (starting over is thinking, not an answer).

**The property that matters is that it is NOT correctness-gated.** A commit that fires only when the board is right is a Check button that presses itself — it cannot produce a wrong answer, so the tutor never gets to teach. Ten-frame's K make-ten was exactly that shape (fill until full = always right, so "wrong" was unreachable); the stillness close is what made the item judgeable at all. Use a structural close where the shape gives you one, stillness otherwise, name which in the docblock, and keep the window generous — a five-year-old pauses to think, and a premature commit spends one of the two corrections.

### The tutor owns the STIMULUS clock, not just the advance

If your stage PRESENTS something the ask refers to — a flash, a reveal, an animation — it waits on her voice, never on a beat measured from item-open. Her line takes as long as it takes: ten-frame flashed 800ms in against a ~4s opening, so the counters came and went while she was still saying *"watch the frame"* and the ask arrived about a frame the child had never been told to look at. Both halves were correct; the composition was incoherent.

**Do not build this gate. Declare it** (19c, 2026-08-15): pass **`onPresentStimulus(item, index)`** plus **`stimulus: { when, prepMs, fallbackMs }`** to the runner, and write only the presentation itself. The runner fires it once per arm, on the first ask, on every subsequent item, and on every correction re-ask — which is what **deletes** the hand-tuned "wait N seconds for the correction to finish" window instead of leaving you to tune it by ear. Take the item from the callback argument, not from `runner.currentItem`, so your presenter holds no runner identity.

*What the gate is, for when you need to reason about it rather than call it:* a FALLING edge on `runner.tutorSpeaking` (`ctx.isAudioPlaying`, which outlives `isAIResponding` by the audio tail), **plus `runner.cuedItemId === item.id`**, plus a silence fallback. Both extra clauses are drives, not caution. "Not speaking" is also true in the gap *before* her audio starts. And a falling edge alone catches the WRONG utterance: on an affirm the runner queues the next item's cue and opens the item in the same dispatch, but a queued cue waits for the floor, so the new item is on screen for the whole tail of the previous item's affirmation — the user heard exactly that as *"when i get it wrong, the very next one flashes way too fast"*. `runner.tutorSpeaking` remains exported for stages that need the raw signal; **never gate a stimulus on it alone.**

### Two runner footguns — both shipped as blocking bugs, both invisible to the test suite

- **Never gate interaction on `runner.stage`.** It goes to `'affirmed'` and the runner opens the next item in the SAME dispatch; nothing returns it to `'asking'` on the happy path (only a correction, a move-on, a resync, or a fresh run). The runner exports the safe gates — **`runner.canAttempt`** (may the child act right now: running, item open, no verdict pending) and **`runner.currentSolved`** (is THIS item already answered) — use those instead of composing `solvedIds`/`stage`/`isAwaitingGesture` by hand. Ten-frame gated on the stage word and every item after the first had a dead board — which **healed itself the moment the child answered wrong**, because a correction resets the stage.
- **The REVEAL is a third gate, and it is `runner.revealHeld` — not `currentSolved`, not `stage`** (18b, ruled 2026-08-15). Set your reward payload in `onAffirmed`, render it behind `revealHeld`, and **do not clear it in `onItemOpened`**. That same-dispatch advance means the item on screen by render time is the NEXT one, which is unsolved — so both of the obvious gates are false and the payload has already been cleared. The reveal therefore painted **on the last item and nowhere else, in four ports, for a month**, with no test and no drive catching it: everything looked right on the item people actually watched. `revealHeld` opens on the affirmation and closes when her cue for the next item is SENT, so the answer is visible for exactly as long as she is saying it, with no tuned constant.
- **Never let a timer effect depend on `runner`.** It returns a fresh object every render, so a callback closing over it changes identity continuously and an effect keyed to that callback tears down and re-arms its timer faster than the timer can fire. Ten-frame's subitize flash therefore never ran **whenever the mic was open, i.e. always** — while passing 42 tests, a 6-run live probe and a clean `tsc`. Both of the timers that used to trip this are the runner's now (above), where every gate dep is a primitive; if you write a third, depend on `currentItem` (stable, out of the items memo) or a ref, and give it the re-render test below. `armStillness`/`clearStillness` are identity-stable and safe anywhere.

**And hunt the leak in PIXELS, not just strings.** Every gate in this family scans text, but a readout can BE the answer once the answer is spoken: ten-frame's running counter equalled the sum the child was about to say aloud — harmless for as long as a button graded it. Walk the stage asking *"does anything on screen equal what I am about to ask them to say?"*, and where the answer is yes, stop rendering it rather than trusting a generator flag to be false.

**A gesture item's silence is TRANSPORT, never prose.** The runner holds the activity bracket for the whole item (`listenForVoice`, derived from `answerKind`) — mic open, capture running, level meter live, but no turn ever committed, so the model is never handed something it owes a reply to. You get this for free; what you must not do is *rely on asking*. Writing "WAIT in complete silence, do not judge anything you hear" into a tap contract is fine as intent and worthless as enforcement: a closed Gemini turn owes a reply, `proactive_audio` is not available on our model, and on 2026-08-13 letter-spotter's tutor answered a stray turn by **fabricating an `[LSP_TAP]` control message and reading it aloud, instructions and all**. Filtering the emission client-side (which the runner also does) muzzles our reaction, not the tutor's mouth. If your stage has a mic orb, make its label answer-kind-aware too — "I'm listening" over an item whose answer is a tap is the same lie in the UI. **Delete on sight:** every advance `setTimeout`, `MAX_ATTEMPTS` reveal ladders, Next/Finish, Check buttons, push-to-talk beats, voice-mode forks, answer chips, and all `sendText` choreography — the cues carry the entire spoken surface. Support-tier RENDER levers survive; tier levers that governed improvised tutor turns move into the scripted ask.

## Step 4 — the generator

Answers become FIELDS (`word`, `resultWord`, `segments`), not a correct flag in a choices array. Validation is **KEEP-OR-DROP, never backfill** — a placeholder item in a judged loop becomes a spoken ask the tutor must judge. Run the same leak gates generator-side that the script runs build-side (belt and suspenders on both sides of the wire) — and **IMPORT them from the script module, never copy them**: export the gates (and their constants) from `<primitive>Script.ts` and have the generator consume those exports, the decodable-reader/letter-spotter pattern. Hand-synced copies drift — letter-spotter's two sides of the wire disagreed live on what a sayable sentence was (90 vs 100 chars) until the copies were deleted. And **writing the spoken ask audits the content**: a relation a tap never had to justify may be false when said aloud (`x` anchored to "box" for months — /ks/ never begins an English word). Re-check every code-owned pool.

## Step 5 — the catalog entry

- `audioInput: { manual_activity: true }` (bench ruling — Gemini's VAD is unusable for short answers). The canonical value is `JUDGED_AUDIO_INPUT` in `judgedScriptContract.ts`; `checkDiCatalogEntry` pins the entry against it.
- `contextKeys: ['challengeType', 'stimulus']` — exactly what the pack pushes; `checkDiCatalogEntry` asserts the match and that every template key resolves.
- Rewrite `description`/`constraints` — they are manifest steering; "tap the tiles" prose routes the primitive wrong forever. Note the mic requirement.
- The `tutoring` block is the session frame (the freshest ports are the template): LIVE-JUDGED DI (tags + sentinel rule), THE OPENING LINE ALREADY TEACHES THE GAME, WHAT COUNTS AS AN ANSWER (+ the never-say-the-answer LAW), WAIT (the silence is theirs), X-ON-DEMAND (`[*_HEAR]`). In a MIXED pack, WHAT COUNTS AS AN ANSWER says so per direction rather than declaring one answer surface for the whole primitive — letter-spotter's block claimed "every answer is a touch" while one of its modes is spoken, and `taskDescription` interpolates `{{challengeType}}` precisely so the tutor knows which it is on. `commonStruggles` responses must be PERFORMABLE script moves — meta-commentary in that field gets recited verbatim to a child (proven live).
- Sentinel-check every catalog sentence; your di-script test runs `findSentinelCollisions` over the prose.
- Eval modes keep their identities and βs — change a β only when the STRUCTURE changed (a 1-of-2 tap becoming unaided production), with the rationale in the description.

## Step 6 — tests

One pure `__tests__/<Primitive>.di-script.test.ts`. **The plumbing is one import now — do not re-type it** (12 files hand-copied it and grew three divergent spoken-line parsers before `hooks/judgedScriptContract.testkit.ts` existed): `expect(checkPackGates(pack)).toEqual([])` (= `validateJudgedScriptPack` PLUS the performed-stage-direction scan and the byte-identical-consecutive-ask gate — the two defects only live drives used to catch) and `expect(checkDiCatalogEntry(entry, pack, sampleItem)).toEqual([])` (audio mode, contextKeys, template keys, catalog sentinel scan, `commonStruggles` included). Parse spoken lines with `spokenSpanOf` from the contract, never a local regex — the naive single-anchor form reads the wrong span on dual-anchor cues, and the shared one knows all four anchors the family ships (`Say exactly:` / `Speak exactly:` / `then wait:` / `Say ONLY this …:`).

⚠️ **BUILD A SECOND PACK IN THE REAL SESSION SHAPE, or the repeat-ask gate is on and asleep.** `findRepeatedConsecutiveAsks` compares consecutive items of the SAME action, and the fixture pack you will naturally write — one item per mode, to cover the fork — is the one shape that can never trigger it. All 12 ports had exactly that shape, so the gate was a no-op on every suite until the 19a sweep added a `[X, X']` pack per port. A real session runs several items of one mode back to back; that is the pack this gate is for. (Length matters, not sameness: the gate flags a repeated ask over 12 words — recitation — and passes a short invariant DI signal like *"Your turn. Read it."*, which is the method, not a defect.)

**You still hand-write the pedagogy pins** — they are the test file's whole point: the answer-material fork (`answerKindFor`/`responseClassFor` per mode, both directions), the leak asserts (spoken line never contains the answer; stated-problem asserts), build-gate drops, voice-safety, correction/affirm wording, catalog-steering regressions.

**Test under RE-RENDER, not at rest.** Every test in this family renders the component and lets it sit still — which is exactly how a subitize flash that could never fire passed 42 of them, a live probe and a clean `tsc`. The mic re-renders a judged component many times a second, so any timed stimulus owes one test that re-renders continuously through the wait.

**And test each clock at the seam that OWNS it** (19c). Since the gate and the stillness window moved into the runner, their semantics are pinned once against the real hook in `hooks/useJudgedScriptRunner.test.tsx`; a port suite that re-asserts them is only asserting its own runner mock. Your stage suite drives `onPresentStimulus` directly and pins WHAT is presented, WHICH items own a stimulus (the `when` predicate — the half a second copy gets wrong), and that a hidden stimulus cannot be tapped.

**Pin the split, both directions.** Assert `answerKindFor`/`responseClassFor` per mode, and assert each cue carries the contract its answer kind needs — a spoken item gets the target + accept clause + both verdict lines and is *never* told to ignore the microphone; a tap item gets the silence contract and no `If the answer is right`. Crossing those two is the exact defect the 2026-08-13 drive found. Where you deleted a menu, assert the items build with `options: []` even when the generator still sends some, so a stale cached challenge cannot put the tiles back. Rewrite legacy render suites onto the new surface — never delete a pinned intent unreplaced; leak rules that hold at every tier get their own describe. Revert-bite the gates that matter.

## Step 7 — gates (all of them, every port)

1. `npm run typecheck:lumina` → **0**; full project-local `tsc --noEmit` → zero NEW vs. baseline.
2. §1 census greps on the component → 0 hits — **comments count**, don't name the deleted hooks or `AUTO_ADVANCE` in prose:
   `grep -cE "useSpokenWordCapture|useVoiceAnswer|useVoiceChoice|useVoiceCapture|useJudgedSpeechLoop" <Primitive>.tsx`
   `grep -cE 'setTimeout\(\(\) =>[^;]*(ext|dvance)|AUTO_ADVANCE' <Primitive>.tsx`
3. **Live real-pipeline probes, one per eval mode**: a TEMPORARY vitest file that calls the real generator (`GEMINI_API_KEY` from `.env.local`), builds items via `itemsFromChallenges`, asserts drops are rare, and runs `validateJudgedScriptPack` over packs built from LIVE content — the sentinel scan over generated words is the point. Probe both BANDS and both frame/scope sizes where the primitive forks, not just one of each. **Delete the probe file after the run**; record the drawn words in the queue block.
   *Two harness facts that cost a run:* `vitest.setup.ts` stamps a dummy `GEMINI_API_KEY` before any test module loads, and ES imports HOIST above your `.env.local` read — so read the key at the top of the file and `await import()` the generator **inside** the test. (`server-only` is already aliased away in `vitest.config.ts`.)
   *Registering a drive adapter (next gate) gives you this for free:* the plan endpoint runs `checkPackGates` over a pack built from live content and reports it, so the sentinel scan re-runs on every drive instead of once behind a deleted file.
4. **The headless judged drive — `/tutor-test --di`.** Export your cue surface (`<primitive>PackBase`, spread by the component so there is one source) and register a `DiPortAdapter` in `service/qa/di/diDrivePlan.ts` naming it plus your answer material: for every item, the correct answer, an unambiguously wrong one, and — the one that earns its keep — the **signature wrong** your `discriminationFor` clause CLAIMS the judge refuses. Then:
   ```bash
   cd backend/tests/tutor_live
   python run_tutor_live.py --component <id> --di --eval-mode <mode> --runs 3
   python run_tutor_live.py --component <id> --di --di-cap    # past the corrections cap
   ```
   It answers every spoken item WRONG on purpose, then right, as TEXT — so it tests the judge's semantics without TTS. **It does not test acoustics, the mic, or VAD, so it does not close your mic row**; it closes the half of that row a machine can hold, which is why #82–#98 accumulated. Read the judgment matrix in `qa/tutor-reports/<id>-live-di-*.md`, then the transcript — the oracles are tripwires, the transcript is the evidence. Full oracle table in `/tutor-test`.
5. Full vitest — expect concurrent-port noise in this lane; own only your suites.

## Step 8 — close the slice (PM discipline)

Dated block in `qa/di/BACKLOG.md` — **item 16 for literacy, item 18 for math** (files, deletions, findings, gates, probe words). **HUMAN-CHECKS row** with per-mode wrong answers to say — *re-grep the register immediately before filing; concurrent sessions in this lane are normal and IDs move.* Update the WORKSTREAMS row. Report honestly: the machine gates prove the pack, the headless drive proves the judge's SEMANTICS, and **only a mic run proves the LOOP a child is actually in** — "shipped, semantics green on N items, mic row #N" — and never mark the port verified yourself. A drive that answers everything correctly does not advance anything: the criteria say answer WRONG on purpose, which is why step 7.4 does it by construction.

## Standing doctrine (ruled; carry, don't re-derive)

Open mic, never push-to-talk; the mic is never gated on tutor-busy; no force-mutes from the primitive — **and treat that last clause as a canary, not a constraint.** A pack that wants to mute has picked the wrong answer modality; go back to Step 1. When an item's answer genuinely is unsayable, the sanctioned tool is the bracket hold (Step 3), which is not a mute: the child is never cut off, they simply are not being asked a question. The tutor is quiet by default and speaks only scripted lines. No visible timers anywhere; response time is captured silently. **`tutor-owns-the-clock` governs PRESENTATION as well as progression** — a stimulus the ask refers to waits on her voice, not on a wall clock (Step 3). `owns_opening` rides through the runner — no improvised greeting turn. Contract-first: run `/primitive-contract <id> --check` if a contract exists; click-era requirements that pin buttons are RE-BASED onto what they protected, not forked around. Full doctrine: `my-tutoring-app/src/components/lumina/docs/SPOKEN_INTERACTION_DOCTRINE.md` · queue of record: `qa/di/BACKLOG.md` item 16 · brief: `qa/HANDOFF-di-literacy-modality-2026-08-09.md`.
