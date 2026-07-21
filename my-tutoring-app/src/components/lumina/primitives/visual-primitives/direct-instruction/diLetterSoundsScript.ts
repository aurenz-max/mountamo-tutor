/**
 * diLetterSoundsScript — HAND-AUTHORED Direct Instruction script for the
 * di-letter-sounds primitive. The exact wording IS the pedagogy (DISTAR
 * discipline), so these lines are authored per pack, never generated. Item
 * CONTENT (which letters, keywords, pictures) is generator-scoped to the
 * objective; this module owns only the model/guide/test/verify/correction
 * cue SHAPE and the in-band judging contract.
 *
 * Ported SHAPE from the DI bench's diScript.ts (proven across four bench runs:
 * open-mic, probe, hook-parity, engine-gate). Differences from the bench:
 * - No hardcoded DEFAULT_ITEMS — items arrive from the generator as challenges.
 * - Scope is continuous letter SOUNDS only. Letter NAMES stay BLOCKED
 *   (LetterSpotter homophone ruling); digraphs/blends/stop consonants are
 *   deliberately excluded (a later benched item).
 *
 * Sentinels are the engine defaults (DI_SENTINELS: affirm "Yes", correct
 * "My turn") — collision-checked against every line below: no model/guide/test
 * line opens with either sentinel, so the sentence-scoped verdict scan is safe.
 */

import type { TutoringScaffold } from '../../../types';

/** One letter-sound item the tutor drills. Mirrors the generator output shape. */
export interface DiLetterSoundChallenge {
  id: string;
  /** Core task identity — the field exists from day one so /add-eval-modes can
   *  widen the union cheaply (e.g. a future 'letter_name' or 'blend' tier). */
  challengeType: 'letter_sound';
  /** The grapheme shown on screen, e.g. "m". */
  letter: string;
  /** The stretched continuous sound the learner must produce, e.g. "mmm". */
  spoken: string;
  /** A picturable keyword whose FIRST sound is the target, e.g. "moon". */
  keyword: string;
  /** Emoji picture support for the pre-reader (attached in code by the generator). */
  emoji: string;
  /** Vowels elicit through the keyword ("say apple"); continuants elicit the
   *  isolated sound ("what sound?"). */
  elicitation: 'isolated' | 'keyword';
  /** Whole-token ASR aliases — passive cross-check only, never the judge. */
  asrAliases?: string[];
}

const sentenceCase = (value: string | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

/** MODEL: the tutor says the sound first (DISTAR "my turn"). Single repetition —
 *  bench run-2 timing showed tutor talk-time dominates the per-item cycle; brisk
 *  pacing is the product at this age. */
export const modelLine = (it: DiLetterSoundChallenge) =>
  it.elicitation === 'keyword'
    ? `The first sound in ${it.keyword} is short ${it.letter}. Listen: ${it.keyword}.`
    : `This sound is ${it.spoken}, as in ${it.keyword}. Listen: ${it.spoken}.`;

/** GUIDE: the tutor and learner say it together ("say it with me"). */
export const guideLine = (it: DiLetterSoundChallenge) =>
  it.elicitation === 'keyword'
    ? `Together, say ${it.keyword}: ${it.keyword}.`
    : `Together: ${it.spoken}, as in ${it.keyword}.`;

/** TEST: the learner produces it alone ("your turn"). */
export const testLine = (it: DiLetterSoundChallenge) =>
  it.elicitation === 'keyword'
    ? `Your turn. Say ${it.keyword}.`
    : 'Your turn. What sound?';

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (it: DiLetterSoundChallenge) =>
  it.elicitation === 'keyword'
    ? `Yes. ${sentenceCase(it.keyword)} starts with short ${it.letter}.`
    : `Yes, ${it.spoken}.`;

/** Correction branch. MUST begin with "My turn" — the engine scans that
 *  sentinel. Standing gate 3: every correction re-models then re-elicits. */
export const correctionLine = (it: DiLetterSoundChallenge) =>
  it.elicitation === 'keyword'
    ? `My turn: ${it.keyword}. Your turn. Say ${it.keyword}.`
    : `My turn: ${it.spoken}, as in ${it.keyword}. Your turn. What sound?`;

const targetDescription = (it: DiLetterSoundChallenge) =>
  it.elicitation === 'keyword'
    ? `the word "${it.keyword}"`
    : `the continuous sound ${it.spoken}`;

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt ITSELF; the engine reads which branch it took
 * from the output transcript (sentinel scan) and alone decides progression.
 */
export const judgingContract = (it: DiLetterSoundChallenge) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against ${targetDescription(it)}:
- Correct or reasonably close for a kindergartener: say exactly "${verifyLine(it)}" and stop.
- Wrong, missing, or a different sound: say exactly "${correctionLine(it)}" and stop, then wait again.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/** Present one item: model, guide, test, then judge in-band until told otherwise. */
export const itemCue = (it: DiLetterSoundChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk kindergarten letter-sounds practice. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${modelLine(it)} ${guideLine(it)} ${testLine(it)}"
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A weak sound resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
export const moveOnCue = (it: DiLetterSoundChallenge, next?: DiLetterSoundChallenge) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${modelLine(next)} ${guideLine(next)} ${testLine(next)}"
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our practice. Great work today!"`;

/**
 * The DI tutoring block. Hand-authored per pack (the "custom-made" rule):
 * exact wording is the pedagogy. This ships WITH the primitive at birth
 * because the DI mechanism IS the in-band judging contract — the generic
 * tutor cannot judge or hold the sentinel discipline. (This is the DI family's
 * justified departure from the L0 "defer the tutoring block" default.)
 */
export const DI_LETTER_SOUNDS_TUTORING: TutoringScaffold = {
  taskDescription:
    'Live-judged Direct Instruction letter-sounds practice for a kindergarten learner. You speak the ' +
    'exact scripted lines from each bracketed application message and judge each learner attempt from ' +
    'the audio you heard, using only the two allowed reply branches.',
  scaffoldingLevels: {
    level1: 'Repeat the prompt once, slowly.',
    level2: 'Model the requested sound, then ask for one retry.',
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
        'sentence with those words. Judge honestly from the audio: affirm a reasonable kindergarten ' +
        'production of the target; correct a wrong, missing, or different production. Every correction ' +
        're-models the sound and begins with "My turn". Do not praise to be kind. The application decides ' +
        'which item comes next; never introduce one yourself.',
    },
    {
      title: 'SOUND PRONUNCIATION',
      instruction:
        'A stretched letter sequence like "mmm", "sss", or "fff" is a continuous letter sound held for ' +
        'about two seconds. Never say a letter name and never spell it out — the sound, not the name.',
    },
    {
      title: 'BREVITY',
      instruction:
        'Speak only the exact quoted lesson text. Never narrate judging, scoring, or application state. ' +
        'Keep pacing brisk: no filler, no chit-chat.',
    },
  ],
};
