/**
 * letterSoundLinkScript — HAND-AUTHORED judged-loop script for
 * letter-sound-link (SEVENTH literacy DI port; qa/di/BACKLOG.md item 16). The
 * exact wording IS the pedagogy; these lines are authored per pack, never
 * generated. Item CONTENT (which letters, which distractors) stays
 * generator-scoped; this module owns the cue shapes, the tier ladder and the
 * in-band judging contracts.
 *
 * ── THE PORTFOLIO QUESTION, ANSWERED ────────────────────────────────────────
 * The brief parked this primitive on a portfolio call: *"receptive
 * discrimination vs di-letter-sounds' production; it also covers stop
 * consonants and the phoneme→grapheme direction"*. The standing frame settles
 * it — a primitive is never left in the old modality because a DI pack could
 * absorb its demand — and the coverage claim turns out to be the ANSWER rather
 * than the obstacle:
 *
 *   - `di-letter-sounds` runs ONE direction (grapheme→phoneme) on ONE
 *     response class (held continuant sounds). It has no phoneme→grapheme
 *     mode and no stop consonants, because a child cannot be asked to produce
 *     an isolated /t/ into a judge that has never been benched on stops.
 *   - letter-sound-link's OTHER TWO DIRECTIONS never ask the child for a stop.
 *     In `hear-see` the TUTOR produces the stop (tutor-side production was
 *     never the gate) and the child answers with a TAP. In `keyword-match` the
 *     child says a whole WORD from a closed two-picture set. Both are benched
 *     classes today.
 *
 * So the overlap is real in exactly one place — `see-hear` on a continuant —
 * and everything the portfolio note called distinctive survives BECAUSE the
 * answer is made of something other than an isolated stop.
 *
 * ── THE SPLIT (standing gate 1 arithmetic, not a preference) ────────────────
 *
 *   see-hear      the answer is a SOUND      → VOICE   `continuant_sound`
 *   hear-see      the answer is a GRAPHEME   → GESTURE `manipulation`
 *   keyword-match the answer is a WORD       → VOICE   `short_spoken_word`
 *
 * `hear-see` taps and that is a ruling, not a softening: naming a letter aloud
 * is `letter_name`, a BLOCKED class (the LetterSpotter homophone ruling —
 * b/p/d/e/g are indistinguishable to the judge). The grapheme cannot be spoken,
 * so it is touched. It is still an honest answer surface: a child who cannot
 * map /s/ onto its letter cannot pick it out of two confusable letters.
 *
 * `see-hear` is gated to letters whose sound can be HELD (see SPOKEN_SOUNDS
 * below). Stops, affricates, glides and clusters are unbenched for child
 * production, so the generator never targets them in this mode — they get
 * their coverage through the other two directions instead. This is the
 * continuant restriction `di-letter-sounds` already ships under, applied to
 * one mode rather than to the whole primitive.
 *
 * ── THE THREE SCRIPT QUESTIONS ──────────────────────────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? In `see-hear`, yes — saying the sound IS the
 *    answer. That is what the SUPPORT TIER ladder is for, and this pack maps
 *    the shipped tier axis onto di-letter-sounds' proven L3 rungs rather than
 *    deleting it: easy = model + guide + test, medium = model + test, hard =
 *    TEST ONLY, with an explicit cold-sound guard so no second channel
 *    volunteers the sound. The tier stops being "how much on-card text" (which
 *    a pre-reader could never read) and becomes how much of the DISTAR
 *    sequence precedes the attempt.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? "What sound does this letter
 *    make?" over one printed letter has exactly one answer. `hear-see`'s
 *    hand-over restates the sound ("Tap the letter that makes sss") so it can
 *    never be a bare "your turn" over two letters. `keyword-match`'s names the
 *    relation ("which picture starts with this letter's sound") so the child
 *    is not left guessing whether to name the letter, the sound or a picture.
 *
 * 3. WHAT LOOKS LIKE AN ANSWER AND ISN'T, PER MODE?
 *    - see-hear: **the LETTER NAME said in place of the sound** — the
 *      primitive's own documented signature error ("the letter S is named ess
 *      but it sounds like sss"), and it arrives fluent and confident.
 *    - hear-see: the confusable letter (t for d, p for b) — the distractor is
 *      chosen to be exactly that.
 *    - keyword-match: the other picture's word, which starts with the
 *      confusable sound.
 *    And on the accept side: a clipped consonant with a little "uh" on the end
 *    is a RIGHT answer from a five-year-old, and a fair different name for the
 *    same picture counts — the judge affirms and echoes the target.
 *
 * ── THE KEYWORD IS NEVER SPOKEN BEFORE A VERDICT, IN ANY MODE ───────────────
 * The pre-DI component ran a per-mode `KEYWORD_SAFE_PRE_ANSWER` table because
 * the keyword ENCODES the sound in two of three modes. Under the judged loop
 * that table collapses to a single rule: the keyword arrives only in a
 * correction or an affirmation. It is the anchor being taught, so handing it
 * over pre-attempt hands over the item in all three directions. The keyword
 * PICTURE follows the same rule on screen.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by
 * validateJudgedScriptPack in this pack's test file. Two live hazards, both
 * handled: no line below opens a sentence with a KEYWORD (the letter `y` used
 * to carry the keyword "yes", which would have opened a correction sentence
 * with the affirm sentinel — the generator's keyword map now says "yo-yo", and
 * every correction keeps the keyword mid-sentence regardless), and no model or
 * guide line opens with "My turn" (only the correction branch may).
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { speakablePhoneme } from './phonemeVoice';

export type LetterSoundMode = 'see-hear' | 'hear-see' | 'keyword-match';
export type LetterSoundTier = 'easy' | 'medium' | 'hard';

// ── The continuant gate ─────────────────────────────────────────────────────

/**
 * Letters whose sound a KINDERGARTENER may be asked to produce in isolation,
 * with the stretched spelling the tutor should say. Code-owned for the same
 * reason di-letter-sounds owns its `spoken` field: a voice handed `/s/` reads
 * it acceptably but handed `/y/` reads the letter NAME ("why"), and handed
 * `/ă/` reads nothing at all. The short-vowel spellings are di-letter-sounds'
 * own, so a child hears one consistent rendering across both families.
 *
 * The set is the classic DISTAR "continuous sounds" list plus the short
 * vowels. Everything absent — stops (t p c k d g b), affricates (j), glides
 * (w y), /h/, and the clusters (x qu) — is unbenched for CHILD production and
 * is therefore never a `see-hear` target. Those letters keep full coverage in
 * `hear-see` and `keyword-match`, where the child's answer is a tap or a whole
 * word.
 */
const SPOKEN_SOUNDS: Record<string, string> = {
  s: 'sss', n: 'nnn', m: 'mmm', f: 'fff', l: 'lll', r: 'rrr', v: 'vvv', z: 'zzz',
  a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu',
};

/** May a child be asked to PRODUCE this letter's sound alone? Standing gate 1. */
export const canProduceSound = (letter: string): boolean =>
  letter.trim().toLowerCase() in SPOKEN_SOUNDS;

/** Every letter `see-hear` may target. Exported so the generator constrains its
 *  own draw rather than trusting the prompt (the pool is code's business). */
export const PRODUCIBLE_LETTERS: readonly string[] = Object.keys(SPOKEN_SOUNDS);

/**
 * What the TUTOR should say for this letter's sound. Stretched where the sound
 * can be held; otherwise the generator's slash notation run through
 * `phonemeVoice` (proven on this primitive's live lesson: `/t/` reads fine as
 * long as the cue also forbids the letter name).
 */
export const spokenSoundFor = (letter: string, sound: string): string =>
  SPOKEN_SOUNDS[letter.trim().toLowerCase()] ?? speakablePhoneme(sound);

// ── The keyword anchor: the WORD and the PICTURE, in one place ──────────────

/**
 * ⭐ ONE MAP, because the two halves used to disagree silently (19h-i-b port 7).
 *
 * The anchor WORD lived in the generator (`KEYWORD_MAP`) and the anchor PICTURE
 * lived in the component (`KEYWORD_IMAGES`). Nothing joined them, so a word with
 * no entry on the other side rendered the `📝` fallback — a card showing a memo
 * emoji in the mode whose ask is *"say the picture word"*.
 *
 * `namesItsPicture` is the keyword-match gate, and it is the `x` rule
 * generalised rather than a new one. That mode asks the child to SAY THE WORD
 * THE PICTURE SHOWS, so an anchor whose picture does not read as its word makes
 * the ask undecidable — not harder, undecidable. The probe drew `i` → "itch"
 * → 🤏 and `g` → "go" → 🟢: no five-year-old names those, and the tutor then
 * refuses every answer they can give. Six anchors were re-chosen so the picture
 * reads as the word; `i` and `x` have no short-sound-initial word a child names
 * from a picture at all, so they are barred from keyword-match and keep their
 * full coverage in the other two directions (where the answer is a held sound
 * or a tap).
 *
 * `y` reads "yo-yo", never "yes": a correction says "…and the word <keyword>
 * starts with…", and a keyword that can open a sentence with the affirm
 * sentinel would be read as a VERDICT by the engine's sentence scan.
 */
export interface LetterKeyword {
  word: string;
  emoji: string;
  /**
   * Does the picture read as the word to a pre-reader? False ⇒ this letter is
   * unaskable in keyword-match (the generator retargets), and the anchor is
   * used only as the post-verdict reveal in the other two directions.
   */
  namesItsPicture: boolean;
}

export const LETTER_KEYWORDS: Record<string, LetterKeyword> = {
  s: { word: 'sun', emoji: '☀️', namesItsPicture: true },
  a: { word: 'apple', emoji: '🍎', namesItsPicture: true },
  // Was "top" → 🔝, which is a TEXT BADGE rather than a picture.
  t: { word: 'tent', emoji: '⛺', namesItsPicture: true },
  // No short-/ĭ/-initial word a five-year-old names from a picture: igloo has
  // no emoji, iguana reads "lizard", insect reads "ant". Barred, like `x`.
  i: { word: 'itch', emoji: '🤏', namesItsPicture: false },
  p: { word: 'pig', emoji: '🐷', namesItsPicture: true },
  n: { word: 'net', emoji: '🥅', namesItsPicture: true },
  c: { word: 'cat', emoji: '🐱', namesItsPicture: true },
  k: { word: 'kite', emoji: '🪁', namesItsPicture: true },
  e: { word: 'egg', emoji: '🥚', namesItsPicture: true },
  h: { word: 'hat', emoji: '🎩', namesItsPicture: true },
  r: { word: 'run', emoji: '🏃', namesItsPicture: true },
  m: { word: 'map', emoji: '🗺️', namesItsPicture: true },
  d: { word: 'dog', emoji: '🐶', namesItsPicture: true },
  // Was "go" → 🟢, a green circle.
  g: { word: 'goat', emoji: '🐐', namesItsPicture: true },
  o: { word: 'octopus', emoji: '🐙', namesItsPicture: true },
  u: { word: 'up', emoji: '⬆️', namesItsPicture: true },
  // Was "lip" → 👄, which reads "lips" or "mouth".
  l: { word: 'leaf', emoji: '🍃', namesItsPicture: true },
  // Was "fan" → 🌬️, which is a wind-blowing face.
  f: { word: 'fish', emoji: '🐟', namesItsPicture: true },
  b: { word: 'bat', emoji: '🦇', namesItsPicture: true },
  // Was "jam" → 🍯, a honey pot.
  j: { word: 'juice', emoji: '🧃', namesItsPicture: true },
  // Was "zip" → ⚡, a lightning bolt.
  z: { word: 'zebra', emoji: '🦓', namesItsPicture: true },
  w: { word: 'web', emoji: '🕸️', namesItsPicture: true },
  v: { word: 'van', emoji: '🚐', namesItsPicture: true },
  y: { word: 'yo-yo', emoji: '🪀', namesItsPicture: true },
  // /ks/ never begins an English word, so `box` is a false anchor here — it was
  // already barred from keyword-match before this map existed.
  x: { word: 'box', emoji: '📦', namesItsPicture: false },
  qu: { word: 'queen', emoji: '👑', namesItsPicture: true },
};

/** The anchor word for a letter. */
export const keywordFor = (letter: string): string =>
  LETTER_KEYWORDS[letter.trim().toLowerCase()]?.word ?? 'sun';

/** The picture for an anchor WORD (the direction the component needs). */
export const emojiForKeyword = (word: string): string => {
  const needle = word.trim().toLowerCase();
  for (const entry of Object.values(LETTER_KEYWORDS)) {
    if (entry.word === needle) return entry.emoji;
  }
  return '📝';
};

/** May keyword-match target this letter? The picture has to name the word. */
export const keywordNamesItsPicture = (letter: string): boolean =>
  LETTER_KEYWORDS[letter.trim().toLowerCase()]?.namesItsPicture ?? false;

const NAMEABLE_ANCHOR_WORDS = new Set(
  Object.values(LETTER_KEYWORDS).filter((a) => a.namesItsPicture).map((a) => a.word),
);

/** The same bar applied to an option WORD — a keyword-match card the child
 *  cannot name is unusable whether it is the answer or the distractor. */
export const anchorWordNamesItsPicture = (word: string): boolean =>
  NAMEABLE_ANCHOR_WORDS.has(word.trim().toLowerCase());

// ── The item ────────────────────────────────────────────────────────────────

export interface LetterSoundOption {
  /** hear-see: the letter. keyword-match: the keyword word. */
  value: string;
  /** keyword-match only — the picture. */
  emoji?: string;
  isCorrect: boolean;
}

export interface LetterSoundItem extends JudgedScriptItem {
  mode: LetterSoundMode;
  /** The target grapheme, as printed. */
  letter: string;
  /** Display phoneme (`/s/`) — screen only, never handed to a voice raw. */
  sound: string;
  /** The utterable rendering of `sound`. */
  spoken: string;
  keyword: string;
  keywordEmoji: string;
  tier: LetterSoundTier;
  sharedSoundLetters?: string[];
  /** hear-see / keyword-match: the two on-screen choices. */
  options: LetterSoundOption[];
  /** The correct option's value — a letter (hear-see) or a word (keyword-match). */
  answer: string;
  /** The wrong option's value, named in the contract as what is NOT the answer. */
  distractor: string;
}

/** The one mode answered with the hands: a grapheme cannot be spoken, because
 *  `letter_name` is BLOCKED. */
export const answerKindFor = (mode: LetterSoundMode): 'voice' | 'gesture' =>
  mode === 'hear-see' ? 'gesture' : 'voice';

/** Standing gate 1: `see-hear` produces a held sound, `keyword-match` produces
 *  one short word from a closed two-picture set, `hear-see` manipulates. */
export const responseClassFor = (mode: LetterSoundMode): ResponseClassId =>
  mode === 'hear-see'
    ? 'manipulation'
    : mode === 'see-hear'
      ? 'continuant_sound'
      : 'short_spoken_word';

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface LetterSoundChallengeLike {
  id: string;
  mode: LetterSoundMode;
  targetLetter: string;
  targetSound: string;
  keywordWord: string;
  sharedSoundLetters?: string[];
  options?: Array<{ letter?: string; sound?: string; isCorrect: boolean }>;
}

/** hear-see options carry `letter`; keyword-match options carry the word in
 *  `sound` (the generator's field name predates the mode split). see-hear has
 *  no on-screen choices at all under the judged loop — the child speaks. */
const optionValue = (
  mode: LetterSoundMode,
  option: { letter?: string; sound?: string },
): string => (mode === 'hear-see' ? option.letter ?? '' : option.sound ?? '');

export const itemFromChallenge = (
  ch: LetterSoundChallengeLike,
  tier: LetterSoundTier = 'medium',
): LetterSoundItem => {
  const mode = ch.mode;
  // The anchor is CODE-OWNED (`LETTER_KEYWORDS`), not read off the payload: the
  // generator stamps the same value post-parse, and deriving it here is what
  // keeps a CACHED payload carrying a retired anchor ("jam" → 🍯) consistent
  // with the picture the stage renders.
  const keyword = keywordFor(ch.targetLetter);
  const options: LetterSoundOption[] = mode === 'see-hear'
    ? []
    : (ch.options ?? []).map((option) => {
        const raw = optionValue(mode, option);
        const value = mode === 'keyword-match' && option.isCorrect ? keyword : raw;
        return {
          value,
          emoji: mode === 'keyword-match' ? emojiForKeyword(value) : undefined,
          isCorrect: option.isCorrect,
        };
      });

  const correct = options.find((o) => o.isCorrect);
  const wrong = options.find((o) => !o.isCorrect);

  return {
    id: ch.id,
    mode,
    answerKind: answerKindFor(mode),
    responseClass: responseClassFor(mode),
    // Mixed sessions interleave speaking and tapping: `action` drives the
    // runner's how-to-play re-speak whenever the thing-to-do changes
    // (cvc-speller rule).
    action: mode,
    letter: ch.targetLetter,
    sound: ch.targetSound,
    spoken: spokenSoundFor(ch.targetLetter, ch.targetSound),
    keyword,
    keywordEmoji: emojiForKeyword(keyword),
    tier,
    sharedSoundLetters: ch.sharedSoundLetters,
    options,
    // see-hear answers with the SOUND — it has no options and its `answer` is
    // the anchor only so the field is never empty; `targetFor`, the affirm and
    // the correction all read `spoken` there. hear-see answers with the letter,
    // keyword-match with the anchor word.
    answer: mode === 'hear-see' ? (correct?.value ?? ch.targetLetter) : (correct?.value ?? keyword),
    distractor: wrong?.value ?? '',
  };
};

/**
 * ⭐ THE SESSION INVARIANT: A LETTER MAY BE ANSWERED ONCE, AND ONCE ANSWERED IT
 * MAY NOT COME BACK AS THE WRONG CHOICE (19h-i-b port 7, sweep §4(d)).
 *
 * No single item can violate this and no per-item gate can see it. Every item
 * closes on an affirmation or a capped move-on, and BOTH put the item's whole
 * triple into the room: see-hear prints the letter, models the sound and
 * reveals the anchor picture the moment the tutor affirms; hear-see names the
 * sound and the child's own correct tap identifies the letter; keyword-match
 * prints the letter and SPEAKS the anchor word in its affirmation. So after one
 * item on `s` has closed, (s, sss, sun) is no longer retrievable knowledge —
 * it is something the child was just told.
 *
 * Two ways that leaks into a later item, and the probe drew BOTH in one draw:
 *
 *  1. **The same letter asked twice.** Recall, not production — and at the easy
 *     and medium tiers the DISTAR model re-hands it over anyway, so the second
 *     ask measures nothing at all.
 *  2. **An answered letter or anchor offered as the DISTRACTOR.** The choice is
 *     binary here. The keyword-match draw came back with ch1 "sun vs net" →
 *     *"Yes, sun."*, then ch6 "net vs sun": the child has been told which
 *     picture is the sun and eliminates it without hearing the sound at all.
 *     Three of six items in that draw were solvable by elimination, and each
 *     one passed every per-item gate.
 *
 * This lives here rather than generator-side for the reason the sweep gives:
 * `itemsFromChallenges` is the boundary the RUNNER reads, so it also covers
 * hand-authored and cached payloads a prompt fix cannot reach. The generator is
 * fixed too — it retargets duplicates and excludes named words when it picks a
 * distractor — so the gate rarely has to bite.
 */
export const itemsFromChallenges = (
  challenges: LetterSoundChallengeLike[],
  tier: LetterSoundTier = 'medium',
): LetterSoundItem[] => {
  /** Everything the tutor has already said out loud, or the screen has shown,
   *  as an ANSWER: letters and anchor words share the set because they never
   *  collide (no anchor is one or two characters long). */
  const named = new Set<string>();
  const items: LetterSoundItem[] = [];

  for (const ch of challenges) {
    const item = itemFromChallenge(ch, tier);
    const letter = item.letter.trim().toLowerCase();
    if (named.has(letter)) continue;
    if (item.options.some((o) => named.has(o.value.trim().toLowerCase()))) continue;
    // A "say the picture word" item is unaskable unless BOTH cards can be
    // named. The answer card is obvious; the DISTRACTOR matters just as much,
    // because a child who cannot name the wrong picture answers by picking the
    // one they can — a picture-recognition task wearing a phonics ask. The
    // generator draws both from the nameable pool now, so this reaches only
    // cached payloads.
    if (item.mode === 'keyword-match'
        && (!keywordNamesItsPicture(letter)
            || item.options.some((o) => !anchorWordNamesItsPicture(o.value)))) continue;

    named.add(letter);
    // hear-see is the one direction that never names its anchor: no correction
    // says it, and the stage prints no keyword reveal. Its letter is enough.
    if (item.mode !== 'hear-see') named.add(item.keyword.trim().toLowerCase());
    named.add(item.answer.trim().toLowerCase());
    items.push(item);
  }

  return items;
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** The sound as a CHILD voices it: held sounds stretched, every other one with
 *  the schwa a five-year-old cannot help adding ("puh" for /p/). Used both in
 *  the judging contract, which must name that utterance as a miss, and as the
 *  harness's signature wrong, which is the same utterance. */
const childVoicedSound = (item: LetterSoundItem): string =>
  canProduceSound(item.letter)
    ? item.spoken
    : `${item.sound.replace(/\//g, '').trim()}uh`;

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

/**
 * ⭐ WHY hear-see does not say "I say a sound" (19h-i-b port 7, blended drive).
 *
 * `hear-see`'s answer is ONE CHARACTER, and the harness scans a tutor turn for
 * `\b<token>\b` over text stripped of punctuation — so a target of `i` matches
 * the pronoun and a target of `a` matches the article. The line here carried
 * BOTH ("**I** say **a** sound"), and it fired live the first time an item on
 * `i` followed a different direction: the how-to-play is re-spoken when the
 * action changes, so a pinned session never showed it and a blended one did on
 * its first pass.
 *
 * letter-spotter settled which way this goes: remove the collision from OUR
 * prose rather than exempt a span, because an exemption switches the oracle off
 * over exactly the half most likely to leak. The rewrite costs nothing — it
 * reads as the child's job, like the other two lines already did.
 */
export const howToPlayFor = (item: LetterSoundItem): string => {
  switch (item.mode) {
    case 'see-hear':
      return 'A letter pops up — you say the sound it makes! ';
    case 'hear-see':
      return 'Listen for the sound, then tap the letter that makes it! ';
    case 'keyword-match':
      return 'You will see a letter and two pictures. Say the picture word that starts with the letter’s sound! ';
  }
};

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// di-letter-sounds' L3 rungs, fourth use. `easy` hands over model + guide,
// `medium` the model only, `hard` nothing at all. What a tier changes is how
// much of the sequence precedes the attempt — never the ask, never the
// judging, and never the CORRECTION's re-model (standing gate 3).

const modelLine = (item: LetterSoundItem): string => {
  switch (item.mode) {
    case 'see-hear':
      // The model IS the answer here — deliberately, and only at easy/medium.
      // `hard` withdraws it and the item becomes a real retrieval probe.
      return `This letter says ${item.spoken}. Listen: ${item.spoken}.`;
    case 'hear-see':
      // ⭐ NO MODEL RUNG, and the empty string is the finding rather than an
      // omission (19h-i-b port 7 probe). The ASK already presents the sound —
      // "Listen: sss. Your turn. Tap the letter that makes sss." — so a model
      // line in front of it made the tutor say *"Listen closely: sss. Listen:
      // sss."*: the same imperative twice in a row, at the top of the item.
      // hear-see's stimulus can never be withdrawn either (withdrawing it
      // deletes the question), so this direction's ladder is honestly TWO
      // rungs: `easy` folds a say-it-with-me into the ask, `medium` and `hard`
      // go straight to it.
      return '';
    case 'keyword-match':
      // The sound is the bridge to the answer, not the answer (the WORD is).
      // The keyword itself stays unspoken at every tier.
      return `This letter says ${item.spoken}.`;
  }
};

/** Only the two directions with a model rung reach this. */
const guideLine = (item: LetterSoundItem): string => `Together: ${item.spoken}.`;

const leadInFor = (item: LetterSoundItem): string => {
  if (item.tier === 'hard') return '';
  const model = modelLine(item);
  if (!model) return '';
  return item.tier === 'easy' ? `${model} ${guideLine(item)} ` : `${model} `;
};

/**
 * At `hard` the tutor must not voice the target sound before the child answers
 * — that is the whole point of the rung. The omitted lines already withhold it,
 * but the catalog's scaffolding levels and struggle responses are a second
 * channel that could volunteer it (the tier gotcha: a tier withheld by the
 * script and revealed by the tutor is only half applied). `hear-see` is
 * exempt: there the sound is the STIMULUS and withdrawing it would delete the
 * question rather than withdraw support.
 */
const coldSoundGuard = (item: LetterSoundItem): string =>
  item.tier === 'hard' && item.mode !== 'hear-see'
    ? ' The learner is answering this one cold on purpose: do not say, stretch, hint at or model the sound before they answer. '
    : ' ';

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// (drive-2 ruling: an ask must SAY its problem — a pre-reader cannot read the
// screen, and every correction re-ask inherits the ask.)

const askFor = (item: LetterSoundItem): string => {
  switch (item.mode) {
    case 'see-hear':
      return 'Your turn. What sound does this letter make?';
    case 'hear-see': {
      // The `easy` echo lives INSIDE the ask, after the stimulus and before the
      // hand-over, because that is the only order in which "say it with me"
      // follows something to say. It is this direction's whole tier ladder —
      // see `modelLine`.
      const echo = item.tier === 'easy' ? ` Say it with me: ${item.spoken}.` : '';
      return `Listen: ${item.spoken}.${echo} Your turn. Tap the letter that makes ${item.spoken}.`;
    }
    case 'keyword-match':
      return 'Your turn. Which picture starts with this letter’s sound? Say the word.';
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────
// The answer is EARNED here: this is the first place the tutor may say it.

const correctionFor = (item: LetterSoundItem): string => {
  switch (item.mode) {
    case 'see-hear':
      return `My turn: this letter says ${item.spoken}. ${cap(item.spoken)}. Your turn. What sound does this letter make?`;
    case 'keyword-match':
      // The keyword stays MID-SENTENCE — never opening one (sentinel rule).
      return `My turn: this letter says ${item.spoken}, and the word ${item.keyword} starts with ${item.spoken}. Your turn. Which picture starts with this letter’s sound?`;
    default:
      // hear-see corrects through tapVerdictCue, never through this contract.
      return '';
  }
};

// ── Judging contracts (spoken modes) ────────────────────────────────────────

const targetFor = (item: LetterSoundItem): string =>
  item.mode === 'see-hear'
    ? `the sound ${item.spoken}`
    : `the word "${item.answer}"`;

const acceptClauseFor = (item: LetterSoundItem): string =>
  item.mode === 'see-hear'
    ? `A short, clipped try counts, and so does a little "uh" on the end — a five-year-old's mouth is still learning. `
    // The leniency is about WHICH WORD, never about whether a word was said —
    // see `wrongClauseFor`. Unbounded, this clause is what made the tutor read
    // "tuh" as a shot at "tent".
    : `The answer is a WORD for the thing in the picture, so a different fair name for that SAME picture also counts; affirm it and echo "${item.answer}". `;

/**
 * ⭐ THE SECOND MISS WAS MISSING, AND THE LIVE DRIVE FOUND IT (19h-i-b port 7).
 *
 * `keyword_match --di-wrong signature` said the letter's own sound back instead
 * of the picture word. The stretched ones were refused — "sss" and "aaa" do not
 * look like a word — but "tuh" and "puh" were AFFIRMED, 2 for 2, and each false
 * affirm then took the following correct answer down with it (`di-no-verdict`:
 * the item was already closed, so the tutor celebrated instead of judging).
 *
 * The contract named exactly one wrong answer, the other picture's word, and
 * paired it with an accept clause telling the judge to be generous about
 * naming. A sound with a schwa on it reads as a mumbled shot at the target, and
 * generous is what the judge was told to be. see-hear has the opposite rule —
 * there a clipped try WITH an "uh" is explicitly correct — so nothing carried
 * over; this direction has to say it for itself.
 *
 * It is also the likeliest real miss in the mode, because the question names
 * the sound on the way to the answer.
 */
const wrongClauseFor = (item: LetterSoundItem): string =>
  item.mode === 'see-hear'
    ? `The letter's NAME is NOT its sound — if what you hear is the name of the letter rather than the sound it makes, that is wrong, however confident it sounds. `
    : `TWO answers are wrong here, however close either one sounds. `
      + `The other picture's word${item.distractor ? ` — "${item.distractor}" — ` : ' '}is one. `
      + `The letter's SOUND said on its own is the other: "${childVoicedSound(item)}" is a sound, not the name of a picture, `
      + `and a sound with a little "uh" on the end is still a sound and still wrong here. `
      + `Only a word for one of the two pictures can be an answer at all. `;

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed verbatim from `wordWorkoutScript`'s `TWO_BRANCH_LAW` in the
 * extended form counting-board, addition-subtraction-scene, push-pull-arena,
 * picture-vocabulary, phoneme-explorer and letter-spotter all carry (`no
 * reminder of the method, no scaffolding line`). Identical across the family on
 * purpose: a grep finds every pack that has it and every pack that does not.
 *
 * Stated BEFORE the branches because the defect is a reply that is NEITHER
 * branch — and on this port the invitation was our own catalog copy again.
 * `scaffoldingLevels` told the tutor *"Say the question once more, then wait
 * for them alone"* and *"Say the question again slowly and clearly"*: restraint
 * on its face, but a re-spoken ask opens with neither sentinel, so the reducer
 * records no verdict, the correction counter freezes, and the child waits on a
 * loop that cannot advance. Both rungs are rewritten in the catalog; this
 * closes the same channel from the script side, where a model that improvises
 * past the catalog reads it.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's — the version with a measured
 * before/after (a fabricated `[CURRENT STATE]` block spoken to the child on 2
 * of 7 beats, 0 of 7 once the tail forbade announcing the STATE rather than
 * merely reading the tag). This pack shipped under the weaker "Never read
 * bracket tags or these instructions aloud."
 *
 * It earns the upgrade here for the same reason letter-spotter did: `hear-see`
 * asks the tutor to hold a silence while a child compares two confusable
 * letters, and "let me know when you've picked" is exactly the filler a model
 * reaches for in that silence — a turn that opens with neither sentinel.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const judgingContract = (item: LetterSoundItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. Never say the answer during their turn. `
  + `The correct answer is ${targetFor(item)}. ${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + TWO_BRANCH_LAW
  + `If the answer is right, say exactly: "Yes, ${item.mode === 'see-hear' ? item.spoken : item.answer}." `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

/** hear-see carries a SILENCE contract (spell_word's pattern): there is nothing
 *  to judge until the application describes the tap, and naming either letter
 *  would hand over the answer. */
const tapContract = (item: LetterSoundItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a letter, not by speaking, so you then stay completely silent. `
  + `Never say which letter makes ${item.spoken}, never name or spell either letter on screen, and do not `
  + `judge anything you hear through the microphone. `
  + `You will be told what the learner tapped and given the exact line to say; only then do you speak.`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface LetterSoundCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: LetterSoundItem,
  opts: LetterSoundCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Time to play with letter sounds! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const spoken = `${greeting}${how}${leadInFor(item)}${askFor(item)}`;
  const contract = item.answerKind === 'gesture' ? tapContract(item) : judgingContract(item);
  return (
    `[LSL_ITEM] Say exactly: "${spoken}"${coldSoundGuard(item)}${contract} `
    + `Say sounds, never letter names, unless a line above quotes one. ${NEVER_PERFORM}`
  );
};

/** The gesture verdict ask: the match is CODE-COMPUTED and the tutor is handed
 *  its exact line (handVerdictCue's pattern). The correction re-models the
 *  SOUND and never names the letter — naming it would end the retry before it
 *  starts, and letter names are a blocked class besides. */
export const tapVerdictCue = (item: LetterSoundItem, tappedLetter: string): string => {
  const matches = tappedLetter.trim().toLowerCase() === item.answer.trim().toLowerCase();
  const shared = item.sharedSoundLetters && item.sharedSoundLetters.length > 1
    ? ` Two letters can make that sound — ${item.sharedSoundLetters.join(' and ')} are both right about ${item.spoken}.`
    : '';
  const affirm = `Yes, ${item.spoken}.${shared}`;
  const correction = `My turn: listen again. ${cap(item.spoken)}. Your turn. Tap the letter that makes ${item.spoken}.`;
  return (
    `[LSL_TAP] The learner tapped the letter "${tappedLetter}"; the letter that makes ${item.spoken} is `
    + `"${item.answer}" — that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirm}" ` : `Say exactly: "${correction}" `)
    + `Say nothing else. ${NEVER_PERFORM}`
  );
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward.
 *  hear-see closes its loop by NAMING the letter — its corrections never did,
 *  and a capped item must not end with the link still unmade. The spoken modes'
 *  corrections already modeled their answer twice. */
export const moveOnCue = (
  item: LetterSoundItem,
  next: LetterSoundItem | null,
  opts: LetterSoundCueOptions = {},
): string => {
  const closeLine = item.mode === 'hear-see'
    ? `The sound ${item.spoken} comes from the letter ${item.answer.toUpperCase()}. `
    : '';
  if (!next) {
    return (
      `[LSL_MOVE] Say exactly: "Good try! ${closeLine}Letter sounds take practice — we will see that one again another day." `
      + `Then stop.`
    );
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  const contract = next.answerKind === 'gesture' ? tapContract(next) : judgingContract(next);
  return (
    `[LSL_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${leadInFor(next)}${askFor(next)}"`
    + `${coldSoundGuard(next)}${contract} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[LSL_COMPLETE] Say exactly: "What great letter-sound work today! You are learning the sounds that letters make. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer. In `hear-see` the
 *  sound IS the question, so it is repeated in full; in the other two modes the
 *  sound is (or gives away) the answer, so this channel gets no ladder at all —
 *  the old on-demand [ISOLATE]-style reveal never returns. */
export const pronounceCue = (item: LetterSoundItem): string => {
  const line = (() => {
    switch (item.mode) {
      case 'see-hear':
        return 'What sound does this letter make?';
      case 'hear-see':
        return `${cap(item.spoken)}. Tap the letter that makes ${item.spoken}.`;
      case 'keyword-match':
        return 'Which picture starts with this letter’s sound? Say the word.';
    }
  })();
  return (
    `[LSL_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. ${NEVER_PERFORM}`
  );
};

/** Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 *  (di-math-facts rule). `see-hear` pushes no letter at all, because the letter
 *  determines the sound that IS the answer; the other two push the answer-free
 *  question side. */
export const stimulusFor = (item: LetterSoundItem): string => {
  switch (item.mode) {
    case 'see-hear':
      return 'the letter printed on screen';
    case 'hear-see':
      return `the sound ${item.spoken}, with two letters to choose between`;
    case 'keyword-match':
      return 'the letter printed on screen, with two pictures to choose between';
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

/** Attempts before an item is closed when the payload does not say. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** `maxAttempts` counts ELICITATIONS; the runner counts CORRECTIONS, so the
 *  first ask is not one of them. Tier `hard` ships 2 ⇒ one correction. Shared
 *  so the drive plan caps where production caps — the two used to disagree
 *  whenever the tier stamped a non-default `maxAttempts`. */
export const maxCorrectionsFor = (maxAttempts?: number): number =>
  Math.max(1, (maxAttempts ?? DEFAULT_MAX_ATTEMPTS) - 1);

/**
 * Everything of this pack that can reach the tutor, in one value.
 *
 * The component spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`, which closes over tap state); the drive-plan endpoint
 * hands it to `run_tutor_live.py --di`. A harness that re-typed these cues would
 * test a fiction.
 */
export const letterSoundLinkPackBase = (
  items: LetterSoundItem[],
  maxAttempts?: number,
): JudgedCueSurface<LetterSoundItem> => ({
  primitiveType: 'letter-sound-link',
  activityLine: 'live direct instruction letter-sound practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeMode: item.mode,
    stimulus: stimulusFor(item),
  }),
  maxCorrections: maxCorrectionsFor(maxAttempts),
});

// ── Harness answer material — what a right and a wrong child sound like ──────

/**
 * ⭐ THE EXEMPTION IS THE DISTAR MODEL, AND ONLY WHERE THE TIER SHIPS ONE.
 *
 * `see-hear`'s answer is the SOUND, and at `easy` and `medium` the lead-in says
 * it out loud on purpose — that IS the model, the thing standing gate 3 refuses
 * to withdraw. So the flat rule ("the ask must not contain the answer") and the
 * real rule ("the tutor must not give the answer away") come apart here exactly
 * the way they do on story-talk, and the exemption is the lead-in itself,
 * issued from the same builder the ask uses (phoneme-explorer's precedent).
 *
 * At `hard` the lead-in is empty and the oracle is FLAT — which is the rung's
 * whole point, and the one place the scan can catch a tutor volunteering the
 * sound through the catalog or a struggle response. The greeting, the
 * how-to-play, the ask and the hand-over stay governed at every tier.
 *
 * The other two modes need no exemption: `keyword-match`'s answer is the anchor
 * word, which no line says before a verdict at any tier, and `hear-see`'s is a
 * letter the tutor is never told.
 */
export const leakExemptSpanFor = (item: LetterSoundItem): string | undefined => {
  if (item.mode !== 'see-hear') return undefined;
  const lead = leadInFor(item).trim();
  return lead.length > 0 ? lead : undefined;
};

/**
 * The letter NAME as a five-year-old says it. Producible letters only, because
 * `see-hear` is the only mode that needs it — and it needs it because the name
 * IS this primitive's documented signature error.
 *
 * Written out rather than sent as the bare glyph: over the DI wire the child's
 * turn crosses as TEXT, and a lone "S" is not decidably the NAME rather than
 * the sound. "ess" is.
 */
const LETTER_NAMES: Record<string, string> = {
  s: 'ess', n: 'en', m: 'em', f: 'eff', l: 'ell', r: 'ar', v: 'vee', z: 'zee',
  a: 'ay', e: 'ee', i: 'eye', o: 'oh', u: 'you',
};

/** Held sounds a wrong child reaches for. Off the target by construction. */
const SOUND_DECOYS = ['mmm', 'fff', 'lll', 'sss'];

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each
 * of these; this is that claim made testable. Change one, change both.
 *
 * The signature wrong per direction:
 *
 *  - see-hear: **the letter NAME said in place of the sound** — the primitive's
 *    own documented miss ("the letter S is named ess but it sounds like sss"),
 *    and `wrongClauseFor` names it explicitly. It arrives fluent and confident,
 *    it is a real response to a letter, and a judge grading on "did they say
 *    something about this letter" affirms it. This is the port's sharpest
 *    drive, because refusing it is the entire lesson.
 *  - keyword-match: **the letter's SOUND said back instead of the picture
 *    word.** The ask itself names the sound as the route to the answer ("which
 *    picture starts with this letter's sound"), and at easy and medium the
 *    tutor modelled it seconds earlier — so it is the tutor's own words,
 *    on-topic, and names no picture at all.
 *  - hear-see answers with the HANDS, so its material is `tapped`
 *    (interactive-book's shape) and the verdict is code-computed; there is no
 *    signature wrong to name because nothing is judged from what the child says.
 */
/** Structurally `DiHarnessAnswers`, declared here so the script module never
 *  imports the service layer that consumes it (`diDrivePlan` imports US). */
export interface LetterSoundHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Text-committed gestures: what the tapped letter reads. */
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
  leakExemptSpan?: string;
}

export const letterSoundLinkHarnessAnswers = (
  item: LetterSoundItem,
): LetterSoundHarnessAnswers => {
  const letter = item.letter.trim().toLowerCase();

  if (item.mode === 'hear-see') {
    const wrongTap = item.distractor
      || item.options.find((o) => !o.isCorrect)?.value
      || (letter === 'm' ? 'n' : 'm');
    return {
      correct: item.answer.toUpperCase(),
      plainWrong: wrongTap.toUpperCase(),
      tapped: { correct: item.answer, wrong: wrongTap },
      // ⭐ THE ONE-CHARACTER ANSWER, and why this oracle is not flat. The
      // harness scans `\b<token>\b` over text `_norm` has stripped of
      // punctuation, so the STIMULUS "/t/" normalises to the bare token "t" —
      // which is the answer letter. For the thirteen letters whose sound is
      // spoken stretched ("sss", "aaa") there is no collision and the scan is
      // exact: a tutor that says "tap the letter S" trips it. For the other
      // thirteen the notation and the answer are the same token and no scan
      // can tell them apart, so the oracle is declared off rather than left to
      // fire on every ask. It is a narrow gap: the tutor is never TOLD which
      // letter is the answer (`tapContract` withholds it and `stimulusFor`
      // pushes only the sound), so a leak here has to be inferred rather than
      // repeated.
      leakTokens: canProduceSound(letter) ? [item.answer] : [],
    };
  }

  if (item.mode === 'see-hear') {
    const name = LETTER_NAMES[letter];
    return {
      correct: item.spoken,
      plainWrong: SOUND_DECOYS.find((s) => s !== item.spoken) ?? 'mmm',
      ...(name
        ? {
            signatureWrong: {
              text: name,
              why: 'the letter NAME said in place of its sound — this primitive\'s own '
                + 'documented signature error, fluent and confident and genuinely about '
                + 'the letter on screen. The contract names it, so a false affirm here is '
                + 'the judge failing the lesson\'s central distinction',
            },
          }
        : {}),
      leakTokens: [item.spoken],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  // keyword-match
  return {
    correct: item.answer,
    plainWrong: item.distractor || 'net',
    signatureWrong: {
      // The child's rendering, not the notation: over the DI wire the turn
      // crosses as TEXT, and "/p/" is a thing no child says. The SAME builder
      // the contract's wrong clause names it with, so the claim and the drive
      // cannot drift apart — this is the pair that caught the false affirm.
      text: childVoicedSound(item),
      why: 'the letter\'s SOUND said back instead of the picture word — the ask names '
        + 'the sound as the route to the answer, and at easy and medium the tutor '
        + 'modelled it seconds earlier, so a judge grading on "did they engage with the '
        + 'sound" affirms an answer that names no picture',
    },
    leakTokens: [item.answer],
  };
};
