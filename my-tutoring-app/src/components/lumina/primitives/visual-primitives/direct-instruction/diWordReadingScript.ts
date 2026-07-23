/**
 * diWordReadingScript — HAND-AUTHORED Direct Instruction script for the
 * di-word-reading primitive. The exact wording IS the pedagogy (DISTAR
 * discipline), so these lines are authored per pack, never generated. Item
 * CONTENT (which words, graphemes, reward pictures) is generator-scoped to the
 * objective; this module owns only the model/guide/test/verify/correction
 * cue SHAPE and the in-band judging contract.
 *
 * DISTAR word reading, two branches:
 * - Decodable CVC: model a slow sound-out blend then the whole word said fast
 *   ("sss-aaa-mmm… sam"), guide it together, test "What word?".
 * - Sight words: whole-word recall — modeled and recalled, never sounded out
 *   (they are irregular).
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn") —
 * collision-checked against every line below. NOTE: classic DISTAR opens the
 * model phase with "My turn." — that opener is FORBIDDEN here (it is the
 * correction sentinel; standing gate 2), so the model line opens with
 * "Listen."/"I'll" instead. Same move letter-sounds made; corrections alone
 * keep the "My turn:" opener (standing gate 3: every correction re-models
 * then re-elicits).
 *
 * ANSWER-LEAK RULE (differs from letter-sounds): the answer IS the printed
 * word, so no picture, emoji, or audio pre-cue of the word may appear before
 * the child reads it. The challenge's `emoji` is a POST-affirmation reward
 * only; sight words with no picture just affirm.
 *
 * The single-word response class is UNBENCHED (gate 1 waived 2026-07-22 by
 * user ruling — modality validated via letter-sounds; near-neighbour
 * over-affirmation risk deferred to the primitive's live-loop human check).
 * The judging contract below is therefore written STRICT: a close-but-
 * different word (sun/son, red/read) must be corrected, not affirmed.
 */

import type { TutoringScaffold } from '../../../types';

/**
 * The single L0 task identity. Ladder candidates for a LATER /add-eval-modes
 * (do NOT build now): `cvc_reading` (decodable only) / `sight_word`
 * (irregular high-frequency) / `word_reading_review` (mixed spaced set).
 */
export type DiWordReadingChallengeType = 'read_word';

/** One printed word the tutor drills. Mirrors the generator output shape. */
export interface DiWordReadingChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills — one identity at birth. */
  challengeType: DiWordReadingChallengeType;
  /** The printed word shown on screen and read aloud, e.g. "sam". */
  word: string;
  /** Decodable (sound-out blend) vs irregular high-frequency (whole-word recall). */
  wordType: 'cvc' | 'sight';
  /** Graphemes for the sound-out model, e.g. ["s","a","m"]. CVC only. */
  graphemes?: string[];
  /** POST-affirmation reward picture ONLY — never shown before the read
   *  (the answer IS the printed word). Sight words usually have none. */
  emoji?: string;
  /** Whole-token ASR aliases — passive cross-check only, never the judge.
   *  Near-neighbour homophones (son/sun) live here for reporting. */
  asrAliases?: string[];
}

const sentenceCase = (value: string | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

/** Stretched sound per grapheme for the sound-out model. Continuants and
 *  vowels stretch; stop consonants stay short (they can't be held). */
const GRAPHEME_SOUNDS: Record<string, string> = {
  a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu',
  m: 'mmm', s: 'sss', f: 'fff', r: 'rrr', n: 'nnn', l: 'lll', v: 'vvv', z: 'zzz',
  b: 'b', c: 'k', d: 'd', g: 'g', h: 'h', j: 'j', k: 'k', p: 'p', q: 'kw',
  t: 't', w: 'w', x: 'ks', y: 'y',
};

const isCvc = (it: DiWordReadingChallenge) =>
  it.wordType === 'cvc' && (it.graphemes?.length ?? 0) > 0;

/** The slow blend for a decodable word: "sss-aaa-mmm". */
export const soundOutFor = (it: DiWordReadingChallenge) =>
  (it.graphemes ?? []).map((g) => GRAPHEME_SOUNDS[g.toLowerCase()] ?? g).join('-');

/** MODEL: the tutor reads the word first. CVC gets the sound-out-then-say-fast
 *  model; sight words are modeled whole (irregular — recalled, not sounded
 *  out). Single repetition — brisk pacing is the product at this age. */
export const modelLine = (it: DiWordReadingChallenge) =>
  isCvc(it)
    ? `I'll sound it out: ${soundOutFor(it)}… ${it.word}. Listen: ${it.word}.`
    : `This word is ${it.word}. Listen: ${it.word}.`;

/** GUIDE: the tutor and learner read it together ("say it with me"). */
export const guideLine = (it: DiWordReadingChallenge) =>
  isCvc(it)
    ? `Together: ${soundOutFor(it)}… ${it.word}.`
    : `Together: ${it.word}.`;

/** TEST: the learner reads it alone. Same ask for both branches. */
export const testLine = (_it: DiWordReadingChallenge) =>
  'Your turn. What word?';

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (it: DiWordReadingChallenge) =>
  `Yes, ${it.word}.`;

/** Correction branch. MUST begin with "My turn" — the engine scans that
 *  sentinel. Standing gate 3: every correction re-models (sound-out for a
 *  decodable word) then re-elicits. */
export const correctionLine = (it: DiWordReadingChallenge) =>
  isCvc(it)
    ? `My turn: ${soundOutFor(it)}… ${it.word}. Your turn. What word?`
    : `My turn: ${it.word}. Your turn. What word?`;

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt ITSELF; the engine reads which branch it took
 * from the output transcript (sentinel scan) and alone decides progression.
 * Written STRICT on near-neighbours — the one real risk in the unbenched
 * single-word class is over-affirming a close-but-different word.
 */
export const judgingContract = (it: DiWordReadingChallenge) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against the printed word "${it.word}":
- The learner read the word ${it.word} — straight through, or sounded out and then said fast: say exactly "${verifyLine(it)}" and stop.
- Anything else — a different word (even one that sounds close to ${it.word}), only part of the word, or a sound-out that never ends in the whole word: say exactly "${correctionLine(it)}" and stop, then wait again.
Judge strictly: a near-sounding DIFFERENT word is wrong, not close enough.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/** Present one item: model, guide, test, then judge in-band until told otherwise. */
export const itemCue = (it: DiWordReadingChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk word-reading practice for a young reader. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${modelLine(it)} ${guideLine(it)} ${testLine(it)}"
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A hard word resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
export const moveOnCue = (it: DiWordReadingChallenge, next?: DiWordReadingChallenge) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${modelLine(next)} ${guideLine(next)} ${testLine(next)}"
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our reading practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our reading practice. Great reading today!"`;

/**
 * The DI tutoring block. Hand-authored per pack (the "custom-made" rule):
 * exact wording is the pedagogy. This ships WITH the primitive at birth
 * because the DI mechanism IS the in-band judging contract — the generic
 * tutor cannot judge or hold the sentinel discipline. (The DI family's
 * justified departure from the L0 "defer the tutoring block" default.)
 */
export const DI_WORD_READING_TUTORING: TutoringScaffold = {
  taskDescription:
    'Live-judged Direct Instruction word-reading practice for a beginning reader. You speak the ' +
    'exact scripted lines from each bracketed application message and judge each learner attempt from ' +
    'the audio you heard, using only the two allowed reply branches.',
  scaffoldingLevels: {
    level1: 'Repeat the prompt once, slowly.',
    level2: 'Model the word (sound it out if decodable), then ask for one retry.',
    level3: 'Accept the attempt warmly and continue as instructed.',
  },
  aiDirectives: [
    {
      title: 'LIVE-JUDGED DIRECT INSTRUCTION',
      instruction:
        'Messages tagged [DI_ITEM], [DI_MOVE_ON], or [DI_COMPLETE] contain the only lesson words you may ' +
        'speak. The square-bracket label is private metadata: never speak, reproduce, or invent it. Each ' +
        '[DI_ITEM] message includes a two-branch judging rule: affirmations must begin with "Yes" and ' +
        'corrections must begin with "My turn", using the exact quoted lines. Never begin any other ' +
        'sentence with those words. Judge honestly from the audio: affirm a real read of the target word; ' +
        'correct a wrong, missing, or different word. EVERY correction re-models the word (sounding it ' +
        'out when the correction line does) and begins with "My turn". Do not praise to be kind. The ' +
        'application decides which word comes next; never introduce one yourself.',
    },
    {
      title: 'WORD READING',
      instruction:
        'The target is a whole printed word read aloud. A hyphenated stretch like "sss-aaa-mmm" is a ' +
        'slow sound-out blend: say each sound smoothly and then the whole word fast. Never spell with ' +
        'letter names. Affirm a correct read whether it was fluent or sounded out first — but judge the ' +
        'FINAL word strictly: a close-sounding different word (like "son" for "sun" or "read" for "red") ' +
        'is wrong and gets the correction branch.',
    },
    {
      title: 'BREVITY',
      instruction:
        'Speak only the exact quoted lesson text. Never narrate judging, scoring, or application state. ' +
        'Keep pacing brisk: no filler, no chit-chat.',
    },
  ],
};
