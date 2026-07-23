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

/**
 * The eval-mode task identities this pack teaches (L1 ladder, all within the
 * benched continuant response class — the produced audio is a held sound in
 * every mode):
 * - `letter_sound`         — isolated grapheme→phoneme (the base skill).
 * - `letter_sound_review`  — mixed-set cumulative/spaced review of taught sounds
 *                            (same production, a WIDE cross-menu spread not a
 *                            focused teaching cluster).
 * - `first_sound_in_word`  — onset isolation: the tutor says a whole word and
 *                            the child produces its FIRST sound (phonemic
 *                            awareness). Continuant keywords only (a short-vowel
 *                            onset distorts for a K child). Letter NAMES stay
 *                            BLOCKED; blends/digraphs/stops bench first.
 */
export type DiLetterSoundChallengeType =
  | 'letter_sound'
  | 'letter_sound_review'
  | 'first_sound_in_word';

/** One letter-sound item the tutor drills. Mirrors the generator output shape. */
export interface DiLetterSoundChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills (see DiLetterSoundChallengeType).
   *  Drives the cue SHAPE (onset items get word-first lines) and the kid-facing
   *  display (onset items show the picture/word, never the isolated grapheme). */
  challengeType: DiLetterSoundChallengeType;
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

/** Onset-isolation items (first_sound_in_word) drill the SAME continuant sound
 *  but from a whole spoken word, so every cue leads with the word and isolates
 *  its first sound. Checked before elicitation because these items are always
 *  continuants (isolated elicitation) yet need the word-first phrasing. */
const isOnset = (it: DiLetterSoundChallenge) => it.challengeType === 'first_sound_in_word';

/** MODEL: the tutor says the sound first (DISTAR "my turn"). Single repetition —
 *  bench run-2 timing showed tutor talk-time dominates the per-item cycle; brisk
 *  pacing is the product at this age. */
export const modelLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Listen: ${it.keyword}. ${sentenceCase(it.keyword)} starts with ${it.spoken}.`
    : it.elicitation === 'keyword'
      ? `The first sound in ${it.keyword} is short ${it.letter}. Listen: ${it.keyword}.`
      : `This sound is ${it.spoken}, as in ${it.keyword}. Listen: ${it.spoken}.`;

/** GUIDE: the tutor and learner say it together ("say it with me"). */
export const guideLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Together: ${it.keyword} starts with ${it.spoken}.`
    : it.elicitation === 'keyword'
      ? `Together, say ${it.keyword}: ${it.keyword}.`
      : `Together: ${it.spoken}, as in ${it.keyword}.`;

/** TEST: the learner produces it alone ("your turn"). */
export const testLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Your turn. What is the first sound in ${it.keyword}?`
    : it.elicitation === 'keyword'
      ? `Your turn. Say ${it.keyword}.`
      : 'Your turn. What sound?';

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `Yes, ${it.spoken}.`
    : it.elicitation === 'keyword'
      ? `Yes. ${sentenceCase(it.keyword)} starts with short ${it.letter}.`
      : `Yes, ${it.spoken}.`;

/** Correction branch. MUST begin with "My turn" — the engine scans that
 *  sentinel. Standing gate 3: every correction re-models then re-elicits. */
export const correctionLine = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `My turn: ${it.keyword} starts with ${it.spoken}. Your turn. What is the first sound in ${it.keyword}?`
    : it.elicitation === 'keyword'
      ? `My turn: ${it.keyword}. Your turn. Say ${it.keyword}.`
      : `My turn: ${it.spoken}, as in ${it.keyword}. Your turn. What sound?`;

const targetDescription = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `the first sound in "${it.keyword}" (the continuous sound ${it.spoken})`
    : it.elicitation === 'keyword'
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

// The DI tutoring block (judging directives, sentinel discipline, struggles)
// lives on the CATALOG entry — catalog/di.ts — since the L2 layer, so both the
// standalone connect fallback and the lesson auth/switch paths resolve it from
// the single source of truth. Any wording change there must be re-checked
// against the sentinel-collision rule this script's cues depend on.
