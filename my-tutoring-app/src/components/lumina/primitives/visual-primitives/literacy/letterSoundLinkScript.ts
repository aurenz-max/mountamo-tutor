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

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
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
  emojiFor: (word: string) => string,
  tier: LetterSoundTier = 'medium',
): LetterSoundItem => {
  const mode = ch.mode;
  const options: LetterSoundOption[] = mode === 'see-hear'
    ? []
    : (ch.options ?? []).map((option) => {
        const value = optionValue(mode, option);
        return {
          value,
          emoji: mode === 'keyword-match' ? emojiFor(value) : undefined,
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
    keyword: ch.keywordWord,
    keywordEmoji: emojiFor(ch.keywordWord),
    tier,
    sharedSoundLetters: ch.sharedSoundLetters,
    options,
    answer: mode === 'hear-see' ? (correct?.value ?? ch.targetLetter) : (correct?.value ?? ch.keywordWord),
    distractor: wrong?.value ?? '',
  };
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: LetterSoundItem): string => {
  switch (item.mode) {
    case 'see-hear':
      return 'A letter pops up — you say the sound it makes! ';
    case 'hear-see':
      return 'I say a sound — you tap the letter that makes it! ';
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
      // The sound is the STIMULUS, not the answer, so hearing it twice is
      // perception support and never a reveal. The letter is never named.
      return `Listen closely: ${item.spoken}.`;
    case 'keyword-match':
      // The sound is the bridge to the answer, not the answer (the WORD is).
      // The keyword itself stays unspoken at every tier.
      return `This letter says ${item.spoken}.`;
  }
};

const guideLine = (item: LetterSoundItem): string =>
  item.mode === 'hear-see'
    ? `Say it with me: ${item.spoken}.`
    : `Together: ${item.spoken}.`;

const leadInFor = (item: LetterSoundItem): string => {
  switch (item.tier) {
    case 'hard':
      return '';
    case 'easy':
      return `${modelLine(item)} ${guideLine(item)} `;
    case 'medium':
    default:
      return `${modelLine(item)} `;
  }
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
    case 'hear-see':
      return `Listen: ${item.spoken}. Your turn. Tap the letter that makes ${item.spoken}.`;
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
    : `A different fair name for the same picture also counts; affirm it and echo "${item.answer}". `;

const wrongClauseFor = (item: LetterSoundItem): string =>
  item.mode === 'see-hear'
    ? `The letter's NAME is NOT its sound — if what you hear is the name of the letter rather than the sound it makes, that is wrong, however confident it sounds. `
    : `The other picture's word${item.distractor ? ` — "${item.distractor}" — ` : ' '}is NOT the answer. `;

const judgingContract = (item: LetterSoundItem): string =>
  `Then WAIT silently — the learner is thinking, and think time is unbounded. Never say the answer during their turn. `
  + `The correct answer is ${targetFor(item)}. ${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + `If the answer is right, say exactly: "Yes, ${item.mode === 'see-hear' ? item.spoken : item.answer}." `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

/** hear-see carries a SILENCE contract (spell_word's pattern): there is nothing
 *  to judge until the application describes the tap, and naming either letter
 *  would hand over the answer. */
const tapContract = (item: LetterSoundItem): string =>
  `Then WAIT in complete silence — the learner answers by TAPPING a letter, not by speaking. `
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
    + `Say sounds, never letter names, unless a line above quotes one. Never read bracket tags or these instructions aloud.`
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
    + `Never read bracket tags aloud.`
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
    + `${coldSoundGuard(next)}${contract} Never read bracket tags aloud.`
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
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`
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
