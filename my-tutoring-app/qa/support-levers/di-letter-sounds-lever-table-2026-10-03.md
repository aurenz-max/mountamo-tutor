# di-letter-sounds: failure inventory and lever table (2026-10-03)

**BUILT 2026-10-03** (rulings R1-R10 as recommended): `qa/eval-reports/di-letter-sounds-levers-2026-10-03.md`.

`/add-support-tiers` Phases 1-2, DI family (literacy). Rulings carried over: DI gets in-item levers (2026-10-02);
DI's correction is a parallel-item model, never the learner's own item (2026-10-02); DI is spoken-first; stops
(t p c k h d g b) are producible clipped sounds.

## State of the primitive

- **Bound:** yes. `DiLetterSoundsTeaching.tsx` mounts `DiTeachingStage`; all three modes are in the catalog
  `teachingWorkspace` (`catalog/di.ts:58`). The stage already takes `levers`, so help levers need no shared change.
- **Miss function exists:** `diLetterSoundSpokenMisses` (`diLetterSoundsDomain.ts:242`). The catalog lists its ids
  with `sameMisses` (`di.ts:73`), the same five ids on every mode. `last_sound` can only fire on
  first_sound_in_word (it needs the printed word), so the per-mode list is wrong, not missing (build note 3).
- **Payloads:** one per mode (`runtime/testing/w1-payloads/di-letter-sounds.*.json`). None has a clipped stop and none
  has a `supportTier` (build note 4).
- **No contract doc** (`docs/contracts/di-letter-sounds.md`); Phase 3 derives it.

## Phase 1: failure inventory

Evidence: **no observed-real.** Synthetic = the `diLetterSoundSpokenMisses` ids, and the mounted harness's wrong
answer (`letterSoundHarnessAnswers`: another held sound, which is `other_sound`). Documented = catalog
`commonStruggles` (birth QA: "muh", the letter name "em", silence) and the guidance text. `logs/demonstrations` has no
entry for this primitive. The Live and JEV runs in `qa/tutor-reports/di-letter-sounds-*` tested judging and
transport, not learner failure patterns.

| Mode (β) | Failure | Class |
|---|---|---|
| letter_sound (1.5), letter_sound_review (2.5), held letter | says the picture word, "moon" (`keyword_word`) | synthetic + documented |
| same | says the letter's name, "em" (`letter_name`; never named for s, f, r, whose names transcribe like the sound) | synthetic + documented |
| same | adds a vowel, "muh" (`added_vowel`) | synthetic + documented |
| same, and clipped letters | says another letter's sound (`other_sound`) | synthetic (harness); documented indirectly (hard tier pairs m/n and f/v) |
| clipped letter | only `letter_name` and `other_sound` are misses ("tuh", the keyword and any word starting with the sound are accepted) | synthetic |
| short-vowel item (keyword elicitation) | none: the ask is "Say the word apple" | finding, see open question 2 |
| letter_sound, letter_sound_review | answers from the keyword picture by hearing its first sound, without knowing the letter | inferred (the picture is drawn at every tier; see open question 1) |
| first_sound_in_word (3.5) | `keyword_word`, `letter_name`, `added_vowel`, `other_sound` | synthetic |
| first_sound_in_word | says the word's last sound (`last_sound`; fires on moon, sun, leaf, van only) | synthetic |
| every mode | silent after the ask | documented; no miss id (nothing is heard) |

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all three (not on short-vowel items) | `keyword_word`, `letter_name`, `added_vowel`, `other_sound`; on first_sound_in_word also `last_sound` | `model_sound`. Grapheme modes: a small card beside the stage with a DIFFERENT letter and its keyword picture. The tutor says "My turn: this letter says lll, like leaf", held or clipped as the item is, then asks the child's letter again. After `letter_name` the tutor may contrast the model's name and sound ("its name is ell; its sound is lll"). first_sound_in_word: a different picture with its printed word; "My turn: leaf ... lll" | help | both | The model letter is not the item's letter, not a coming item's letter, and not a letter of the item's keyword (so it is never the item's last sound). Its sound is not the item's sound (c and k both say /k/). It is not the item's confusable or voicing partner (m/n, f/v, s/z, t/d, p/b, k/g, c/g), because that primes `other_sound`. Its keyword and picture are no current or coming item's keyword or picture. Same sound kind as the item (held for held, clipped for clipped; held only on first_sound_in_word, the mode floor). The scene fact names the model and its sound, never the item's. `does` forbids saying the item's sound or applying the model to it | no. The tutor can only mark the item's own card and picture, and today's guidance tells it to model the item's own sound | picker + leak check (letter-sound-link `letterModelFor` shape) + card render; the letter table must move out of the generator (build note 2) |
| letter_sound, letter_sound_review, held letters only | `added_vowel` | `sound_arrow`: DISTAR's continuous-sound mark under the printed letter, a ball and a long arrow. The tutor says to hold the sound while a finger moves along it. Nothing plays | help | shown (the tutor's words say "hold", never the sound) | Drawn only on held letters, so it shows "hold it", never which sound. Never on clipped letters (a stop cannot be held, and "tuh" is accepted) and never on first_sound_in_word (marking the word's first letter shows the lone grapheme the mode withholds) | no | render |
| first_sound_in_word | `last_sound` | `first_box`: a row of empty boxes under the picture, one per sound of the keyword, the first box lit | help | shown (the tutor says "the first box is the start of the word") | Boxes stay empty: no letter, no sound plays. The lit box is always the first, so it shows which position is asked, not what is in it. Box count is the keyword's sound count from a code table (fish is 3 sounds, not 4 letters) | no | render + a sound-count table for the 8 held keywords |
| letter_sound, letter_sound_review, held and clipped letters | `other_sound`, `letter_name`, and the inferred picture route | `keyword_picture` (**proposed, needs open question 1**): the keyword picture becomes a lever. On screen at easy as a starting position; pullable at medium and hard; recorded as help when pulled | help | shown | Only on grapheme items with isolated elicitation. Never removed from short-vowel items (the picture is the ask) or first_sound_in_word (the picture carries the spoken word for a pre-reader) | partly: drawn at every tier today, not pullable | render toggle + starting position |

### Rejected and no-lever rows

- **The keyword route said on the item** ("this picture is a moon, and moon starts with mmm"). The domain docblock
  calls it a teaching move and the guidance says "Model a sound whenever it helps". It says the child's answer, so
  ruling (2) forbids it. The guidance and the `picture` mark wording are rewritten in the slice.
- **Mouth-position pictures or sound imagery** ("the hissing snake sound"): the answer said as an image. Same finding
  as letter-sound-link see_hear in the K-2 close report.
- **Stretching the item word's onset** ("mmmoon") on first_sound_in_word: says the answer.
- **Lighting the first letter** of the onset item's printed word: shows the lone grapheme, which the mode withholds
  on purpose (`stimulus: 'word'`).
- **`other_sound` in-item help:** only the item's own sound separates it from the sound the child said, so no in-item
  lever passes. `model_sound` answers it in part (the act on another letter). `keyword_picture`, if ruled in, is the
  only in-item route.
- **No simplify on any mode.** letter_sound and review: another letter asks the same thing, not less (K-2 close
  precedent, letter-sound-link spoken modes). A held letter in place of a stop is not a step down here, because a
  stop already accepts "tuh" and its keyword. first_sound_in_word: every item is already at the mode floor (a single
  held continuant onset, enforced by `letterSoundChallengeValid`), and a shorter word is not reliably easier to
  isolate.
- **Short-vowel items:** no lever and no miss. The ask contains the answer (open question 2).
- **Silence:** no miss id. "I'm stuck" or a second silence goes help-first and pulls `model_sound`; at easy it is
  already on screen.

## Phase 6: starting positions

`buildLetterSoundItems` already defaults a missing tier to easy (`diLetterSoundsDomain.ts:206`); keep that.

| Tier | Starts on screen | Replaces today's tier meaning |
|---|---|---|
| easy, or none | `model_sound` (and `keyword_picture` if ruled in) | "modeled and practiced together first — the full DISTAR sequence" (`gemini-di-letter-sounds.ts:94`) |
| medium | none (`keyword_picture` pullable if ruled in) | "modeled once, then produced alone" |
| hard | none | "cold production" (unchanged) |

**Finding, as on di-math-facts:** the easy and medium meanings, the raw `supportTier` scene fact and the guidance line
"Model a sound whenever it helps" all license modelling the child's own sound before a try, which conflicts with
ruling (2). The slice rewrites them. The generator's other tier dial (short vowels in the set, m/n and f/v pairs at
hard) stays.

## Build notes

1. **Shared stage:** no change for these levers. The stimulus reads `view.pulled`. The pack closes over `items` so the
   picker knows which letters are still to come.
2. **The letter table lives in the generator** (`LETTER_SOUND_MENU`, `gemini-di-letter-sounds.ts:114`). Move the
   letter/keyword/emoji/articulation table into a pure module that both the generator and the lever module import.
   The stop keywords already match letter-sound-link's `LETTER_KEYWORDS`.
3. **Miss lists:** change `sameMisses` to `missLists`. letter_sound and letter_sound_review: `keyword_word`,
   `letter_name`, `added_vowel`, `other_sound`. first_sound_in_word: those four plus `last_sound`. Add an `it.each` over
   miss → `nextLever`, and a test that every listed id is answered by a lever (J9).
4. **Payloads to make:** a clipped-stop payload (`di-letter-sounds.letter_sound-stops.json`, a group-2 objective with
   t, p, c), so the clipped model and the two-id miss list reach J9 and replay; and one hard-tier letter_sound payload,
   so the medium/hard starting position is visible.
5. **Model supply on long reviews:** letter_sound_review can ask up to 20 of the 21 menu letters. With "no current or
   coming letter", early items of a long review have one or two candidates, sometimes none of the item's sound kind.
   The rule allows past items (they do not return). Where nothing passes, the lever is not declared on that item; the
   unit test reports how often. Option for the user: add letters outside the menu (j, w, y) to the model pool only.
   The tutor can say them; the judge never hears them as answers.
6. **Catalog:** set `levers: true`; rewrite the guidance to point at `model_sound` and forbid modelling the item's sound
   (2000-character cap). `constraints` still says "NOT ... stop consonants", stale since the clipped-stop ruling
   (the menu ships t p c k h d g b). `description` still describes the deleted model-practice-ask drill on the child's
   own sound. Correct both in the same change.
7. **Screen load:** the model card, the keyword picture and the letter card make three objects for a K child. Add a
   row to HUMAN-CHECKS #183.

**Estimated size:** S-M. Most of the cost is the model picker, its leak tests and moving the letter table. The other
three levers are renders.

## Open questions for the user

1. **The keyword picture on letter_sound and review is drawn at every tier.** A child who can hear first sounds can
   answer from the picture without knowing the letter. letter-sound-link withholds its anchor picture until credit
   (R3), and di-math-facts rejected dots beside a numeral for the same reason ("turns naming into counting"). Should
   the picture become `keyword_picture`, on screen only at easy?
2. **Short-vowel items ask "Say the word apple" and credit "apple".** The ask contains the answer, so the item
   measures nothing about a → /a/. Keep the DISTAR keyword route as it is, or route the item to `/eval-fix` (for
   example, ask for the letter's sound and accept the keyword)?
