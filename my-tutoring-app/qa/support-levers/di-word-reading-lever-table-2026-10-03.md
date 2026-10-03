# di-word-reading: failure inventory and lever table (2026-10-03)

**DRAFT — awaiting user confirmation.** Nothing here is built.

`/add-support-tiers` Phases 1-2, DI family (literacy). Rulings carried over: DI gets in-item levers (2026-10-02);
DI's correction is a parallel-item model, never the learner's own item (2026-10-02); DI is spoken-first. Literacy
leak rules from handoff 22 apply: help on a cold read is visual only (no audio of unread print); a model acts on
words outside the session.

## State of the primitive

- **Bound:** yes. `DiWordReadingTeaching.tsx` mounts `DiTeachingStage`; all four modes are in the catalog
  `teachingWorkspace` (`catalog/di.ts:167`). The stage already takes `levers`.
- **Miss function exists:** `diWordReadingSpokenMisses` (`diWordReadingDomain.ts:225`), which calls the shared
  `wordReadingMisses` (`literacy/spokenReadingMisses.ts`, also used by phonics-blender). The catalog lists the ids with
  `sameMisses` (`di.ts:183`), all seven on every mode. cvc_reading never names `similar_word`, and sight_word never
  names a position id (build note 3).
- **Payloads:** one per mode (`w1-payloads/di-word-reading.*.json`). None has a tier, because the generator sets none.
- **No `supportTier` at all:** neither `DiWordReadingChallenge` nor the generator (`gemini-di-word-reading.ts`) reads
  `config.difficulty`. Phase 6 needs the tier harness added (build note 1).
- **No contract doc** (`docs/contracts/di-word-reading.md`); Phase 3 derives it.

## Phase 1: failure inventory

Evidence: **no observed-real.** Synthetic = the `wordReadingMisses` ids, the mounted harness's wrong answer
(`wordReadingHarnessAnswers`: a plainly different word, "dog" or "cup", which names no miss), and the JEV probes of
09-20 to 09-26 (a homophone, a spelled word, a rhyme and a blend with no word, all as tutor-judging cases). Documented =
catalog `commonStruggles` (a close-sounding word, letter-name spelling, sounds with no word, silence) and the
guidance. `logs/demonstrations` has no entry.

| Mode (β) | Failure | Class |
|---|---|---|
| cvc_reading (2.0); read_word (2.5) and word_reading_review (3.5) on a decodable item | spells it with letter names (`letter_name`) | synthetic + documented |
| same | says the sounds and never the word (`sounds_no_word`) | synthetic + documented |
| same | reads it backwards (`read_backwards`; only where the reverse is a real word: pan→nap, pot→top, tub→but) | synthetic |
| same | says a real word with one sound changed (`first_sound_changed`, `middle_sound_changed`, `last_sound_changed`) | synthetic + documented ("matt" for mat) |
| same | says an unrelated word | synthetic (harness); no miss id, so the ladder goes help-first |
| sight_word (3.0); read_word and review on a sight item | spells it or sounds it out (`letter_name`, `sounds_no_word`) | synthetic + documented ("sounding it out teaches the wrong thing") |
| same | says a look-alike (`similar_word`: the→they, see→she, and→end) | synthetic + documented |
| same | does not know the word (silent, or a guess with no pattern) | documented (silence) + inferred |
| every mode | a homophone affirmed as correct (son for sun) | synthetic (JEV probes); a judging problem, not a learner failure, so no lever |

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all four, decodable items | `letter_name`, `sounds_no_word`, `read_backwards`, the three position misses | `model_word` (decodable): a small card beside the gold-ringed word with a DIFFERENT decodable word, printed, with its picture. The tutor says "My turn: sss-uuu-nnn, sun", sweeping left to right, then asks for the child's word again | help | both | The model is no session word (current, past or coming: the guidance already forbids naming a word still to come). It shares no letter with the item, so the tutor's blend says none of the item's sounds; in a single-vowel session the model therefore has another vowel. It is not the item reversed and never a rime or one-letter neighbour of it (mat beside cat is read by analogy). `does` forbids sounding out, naming or rhyming the child's word | no. The tutor can mark the item's letters, and today's `soundOut` fact and guidance invite it to blend the child's own word | picker over cvc-speller's `PRACTICE_WORDS` (32 picturable CVC words) + leak check + card render |
| all four, sight items | `letter_name`, `sounds_no_word`, `similar_word` | `model_word` (sight): the same card with a different sight word, printed, no picture. The tutor says it once, whole: "My turn: this word is go" | help | both | No session word; not a look-alike of the item in either direction (`SIGHT_LOOKALIKES`); shares no letter with it, so never one letter off (to/go). The tutor never sounds the model out | no | same picker over a sight pool (the menu's 8 plus a few: you, are, was, said, of) |
| all four, decodable items | `sounds_no_word` | `blend_slide`: the printed letters slide together over an arrow; nothing plays | help | shown | Moves only the item's own letters. No audio. Never on a sight word | no here; phonics-blender has it | port the render |
| all four, decodable items | `first_sound_changed`, `middle_sound_changed`, `last_sound_changed` | `sound_dots`: a dot under each letter, one stop per sound for a finger | help | shown | Visual only. Never on a sight word, which is not sounded out | the overlay exists (`ui/LuminaPrintSupport` `soundDots`) | render inside the stage's per-letter spans (they are the tutor's letter mark targets) |
| all four, decodable items | `read_backwards` | `tracking_arrow`: an arrow under the word pointing left to right | help | shown | Draws no letter; plays nothing | the overlay exists (`trackingUnderline`) | render |
| cvc_reading; decodable items in read_word and review | `sounds_no_word`, `letter_name`, the three position misses | `short_word`: an ungraded two-letter decodable word (at, up, in, on, it, am, an, if, us). Same act, read the letters and say the word, with one sound fewer. Then the full word comes back and only it is credited | simplify | shown | Never a session word, and never the start or end of the item or any session word (at for cat, an for pan: phonics-blender `practiceLeak`). Refused on a sight item and when nothing passes. Valid as an item: `wordType: 'cvc'`, two graphemes that spell it | the builder exists in phonics-blender (`shortWordFor`) | reuse the runtime builder; the stage's practice path already exists |

### Rejected and no-lever rows

- **Any voice on the child's word:** blending it, saying its first sound, "it rhymes with hat". The voice would read the
  print the child must decode (literacy rule) and model the child's own item (ruling 2). Today's scene fact
  `soundOut: "sss-aaa-mmm"` is a ready script for exactly that, and the guidance line "a word you model is not their
  read, so hand it back and wait" licenses it. Remove the fact (nothing else reads it) and rewrite the line.
- **A picture of the item word:** the domain's answer-leak rule. The emoji stays in the post-read trail.
- **A model one step from the item** (same rime, one letter changed, the item reversed): the child reads the item by
  analogy.
- **sight_word, "does not know this word": no lever.** A sight word has no decodable path, so no letter or sound lever
  helps, and sounding it out teaches the wrong thing. The only thing that helps is hearing the word, which ruling (2)
  forbids on the item. `model_word` shows the act (look at the whole word and say it), not this word. See open
  question 1.
- **Word-shape outlines, or the word in a sentence with a picture:** shape is an unreliable cue, a sentence trains
  guessing from context, and the voice cannot read either.
- **`similar_word` in-item help:** only the item's own print separates "the" from "they". Model only.
- **No simplify on sight items:** another sight word asks the same recall, not less (K-2 close precedent).
- **`touch_letters`** (tap each letter, like di-dice-roll's `touch_dots`): the tutor's letter marks and `sound_dots`
  already give one stop per sound. A tap adds nothing that changes the read.
- **Homophone over-affirmation:** a judging issue (LA-13), not a learner failure.

## Phase 6: starting positions

| Tier | Starts on screen |
|---|---|
| easy, or none | `model_word` |
| medium | none |
| hard | none |

Absent = easy follows the DI precedent (di-math-facts, di-dice-roll). Because the generator sets no tier today, every
session would start with the model card until it does. The tier harness (build note 1) fixes that for lessons whose
manifest passes a difficulty.

**Screen risk at easy:** a second printed word on screen before the read. A K reader may read the model instead of
the gold-ringed word, and the observer would judge that as a different word. The model card must be smaller, carry its
picture (so it reads as already done), and be voiced first by the tutor's "My turn". Add a row to HUMAN-CHECKS #183.

## Build notes

1. **Tier harness:** add `supportTier?` to `DiWordReadingChallenge` and `WordReadingItem` (default easy in
   `buildWordReadingItems`), and the `normalizeSupportTier` harness at the end of `gemini-di-word-reading.ts`, stamping
   each challenge only when a tier is present. No other generator change.
2. **Shared stage:** no change. The stimulus draws dots, arrow and slide from `view.pulled` inside its per-letter spans,
   and the model card beside them. The pack closes over `items` for the "no session word" rule.
3. **Miss lists:** change `sameMisses` to `missLists`. cvc_reading: `letter_name`, `sounds_no_word`, `read_backwards`,
   the three position ids. sight_word: `letter_name`, `sounds_no_word`, `similar_word` (no menu sight word reverses
   to a real word). read_word and word_reading_review: all seven. Add `it.each` over miss → `nextLever` and the J9
   every-id-answered test.
4. **Model pool test:** every askable menu word (30 CVC, 8 sight) has a non-leaking model in a worst-case session of
   six. Some pairs will be tight (a sight item in a six-sight session leaves two of eight menu words), which is why the
   sight pool adds a few words outside the menu.
5. **Payloads:** all four modes are saved. After build note 1, save one hard-tier payload so the no-model start is
   visible in J9 and replay. The cvc_reading payload (cat, mat, pan, hat) shows `read_backwards` on pan only.
6. **Catalog:** set `levers: true`; rewrite the guidance (model a different word with `model_word`, never the child's)
   within 2000 characters; `description` still describes the deleted model-lead-test drill on the child's own word.
7. **Remove `soundOut`** from the scene facts (`diWordReadingDomain.ts:242`); the domain is its only reader.

**Estimated size:** M. Most of the cost is the tier harness, the model picker with its pool test, and three print
renders; the renders and `short_word` reuse phonics-blender code.

## Open questions for the user

1. **sight_word has no help for a word the child does not know.** DI's own correction for a sight word is
   model, test, delayed test: say the word, ask it again later in the session, credit only the later read. That needs
   a re-ask in the stage, which is not a lever and does not exist. Accept "no lever" (the item is scored missed), or
   queue the delayed re-ask?
2. **`short_word` is a two-letter VC word, not CVC.** It is the same act with one sound fewer (phonics-blender's cvc
   mode uses the same builder, approved 09-28). If "every item is CVC" is the mode's defining property, the
   alternative is a CVC practice word with a held first sound, which is not clearly simpler.
