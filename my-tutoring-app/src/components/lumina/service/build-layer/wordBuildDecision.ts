/**
 * The shared literacy build judge (open build, OB-3L L0): what it is asked and how its answers become a verdict.
 * Pure, so the component, the tests and the calibration read one decision. The server half
 * (`word-build-judge.ts`) asks Jev, or flash-latest when TypeSafe is not configured.
 *
 * A literacy build has no key. "Make a word that means do it again" passes replay, redo and rewrite, so the
 * judge reads the word the learner made against the ask, as open-builder's judge reads a picture against its
 * goal. Structure (one part alone, parts out of order, the same word twice) is the primitive's own code check
 * and never reaches the judge. Thresholds come from a hand-labelled set run through the production route
 * (qa/open-build/word-build-judge-2026-10-07/).
 */

export interface WordBuildJudgeRequest {
  /** The task as the learner heard and read it. */
  ask: string;
  /** The word as built, joined. */
  made: string;
  /** How it was built ("re + play"), for context only. */
  pieces?: string;
  /** What the learner could build from, for context only. */
  board?: string;
  grade?: string;
  /** Ask flash-latest even when Jev is configured: the fallback's own check (calibration). */
  judge?: 'flash';
  /** Judge only whether it is a real word: the primitive's code already checked that it fits the ask (a spelling
   *  build: the vowel, the word family, one letter changed). */
  only?: 'real_word';
  /** A sentence build (sentence-builder): `made` is a sentence, judged for sense and for fitting the ask. */
  unit?: 'sentence';
}

export type WordBuildJudgeMiss = 'not_a_word' | 'wrong_meaning';

export interface WordBuildVerdict {
  met: boolean;
  miss?: WordBuildJudgeMiss;
  /** P(real word), 0-1. */
  realWord: number;
  /** P(the word means what the ask asks for), 0-1. */
  fits: number;
  /** Jev's probability for each fits_ask option, when Jev answered. */
  fitsOptions?: Record<string, number>;
  /** Who decided: Jev alone, flash alone (no TypeSafe), or flash's second opinion on a Jev rejection. */
  judge: 'jev' | 'flash' | 'jev+flash';
}

export const wordBuildState = (r: WordBuildJudgeRequest) => ({
  ask: r.ask,
  learner_made: r.unit === 'sentence' ? { sentence: r.made } : { word: r.made.toLowerCase(), ...(r.pieces ? { built_from: r.pieces } : {}) },
  ...(r.board ? { parts_available: r.board } : {}),
  ...(r.grade ? { grade: r.grade } : {}),
});

/** The questions for this request: both, or real_word alone. */
export const questionsFor = (r: WordBuildJudgeRequest) =>
  r.unit === 'sentence' ? SENTENCE_QUESTIONS : r.only === 'real_word' ? { real_word: WORD_BUILD_QUESTIONS.real_word } : WORD_BUILD_QUESTIONS;

/** A sentence build: the same two answers under the same names, so one decision reads both. The shape (the end mark,
 *  how a question starts) is the primitive's code check and never reaches these. */
export const SENTENCE_QUESTIONS = {
  real_word: { type: 'noul' as const, instructions:
    'Read `learner_made.sentence`, made by a young child from word tiles. Is it a complete sentence that makes sense, '
    + 'in plain grammatical English a teacher would accept from a child? Word order that breaks the meaning ("The big dog '
    + 'runs fast" is fine; "Dog the runs big" is not), a missing verb, or nonsense ("The ball eats the dog.") is not.',
    criteria: { true: 'A complete sentence that makes sense.', false: 'Not a sentence that makes sense.' } },
  fits_ask: { type: 'choice' as const, instructions:
    'Read `ask`. Does `learner_made.sentence` do what the ask asks (be about the thing it names)? Judge the topic only: '
    + 'whether it is a question or a telling sentence is checked elsewhere.',
    criteria: {
      fits: 'It is about what the ask names.',
      partly: 'It mentions it, but is mostly about something else.',
      no: 'It is about something else.',
    } },
};

export const WORD_BUILD_QUESTIONS = {
  real_word: { type: 'noul' as const, instructions:
    'Is `learner_made.word` a real English word, spelled the usual way, that a dictionary for children or adults would '
    + 'list? Plural and past forms of real words count (jumped, cats). A made-up joining of real parts (unjump, '
    + 'reslow, quickful), a misspelling (happyly) and a name are not.',
    criteria: { true: 'A real word, spelled correctly.', false: 'Not a real word as spelled.' } },
  fits_ask: { type: 'choice' as const, instructions:
    'Read `ask`. Does `learner_made.word`, in its usual meaning, mean what the ask asks for? Judge the meaning only, '
    + 'not whether it is the most common answer: many different words can fit one ask (replay, redo and rewrite all '
    + 'fit "a word that means to do something again").',
    criteria: {
      fits: 'Its usual meaning is what the ask describes.',
      partly: 'Related to the ask, but its meaning is a different one (unlock for "not locked", review for "view before").',
      no: 'Its meaning is not what the ask describes, or it is not a word.',
    } },
};

/** Cut points, from the labelled set. */
export const WORD_BUILD_THRESHOLDS = { realWord: 0.5, fits: 0.5 };

export function decideWordBuild(realWord: number, fits: number, judge: WordBuildVerdict['judge'],
    t = WORD_BUILD_THRESHOLDS): WordBuildVerdict {
  if (realWord < t.realWord) return { met: false, miss: 'not_a_word', realWord, fits, judge };
  if (fits < t.fits) return { met: false, miss: 'wrong_meaning', realWord, fits, judge };
  return { met: true, realWord, fits, judge };
}

/**
 * A rejection is a second opinion's job. In the labelled set Jev and flash-latest never rejected the same right word
 * (Jev: refill, unhappy, untrue, careful; flash: replayed, helped, playing), so a learner hears "not yet" only when
 * both judges say so. The miss stays Jev's: flash called unpaint and prepaint real words, Jev did not.
 */
export function secondOpinion(jev: WordBuildVerdict, flash: WordBuildVerdict): WordBuildVerdict {
  if (jev.met) return jev;
  if (flash.met) return { ...flash, judge: 'jev+flash', fitsOptions: jev.fitsOptions };
  return { ...jev, judge: 'jev+flash' };
}

/** A request the judge can read: a short ask and a made word of letters. */
export function wordBuildRequestError(r: Partial<WordBuildJudgeRequest> | null | undefined): string | null {
  if (!r || typeof r.ask !== 'string' || !r.ask.trim() || r.ask.length > 300) return 'ask must be a short sentence';
  if (r.unit === 'sentence') {
    return typeof r.made === 'string' && /^[A-Za-z' ,.?!]{3,160}$/.test(r.made.trim()) ? null : 'made must be a short sentence';
  }
  if (typeof r.made !== 'string' || !/^[a-z]{2,30}$/i.test(r.made.trim())) return 'made must be one word of letters';
  return null;
}
