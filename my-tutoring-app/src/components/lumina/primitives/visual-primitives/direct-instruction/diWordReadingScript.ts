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

/** The L1 task identities: decodable, base mixed, sight-word, and review. */
import type { DiActionContract } from '../../../hooks/judgedScriptContract';
import { diWordReadingModePlan } from './diWordReadingModes';
import { isCvc, soundOutFor, type DiWordReadingChallenge } from './diWordReadingDomain';

/**
 * The assignment — item shape, validity gates, the ask, the accepted answer and
 * the success condition — moved to `diWordReadingDomain` in the sunset slice, so
 * the tutor/JEV binding can read what this pack teaches without importing the
 * sentinel engine. This module keeps the retiring control protocol and
 * re-exports the domain, so the generator, the DI tester, the Pip pose and the
 * lesson-bench extractor keep one address.
 *
 * `isCvc` moved with it and gained one gate: a decodable item's graphemes must
 * spell its word. A pool where they do not is a content defect, and the model
 * line below would otherwise blend to a word that is not on the card. The
 * generator splits the word itself, so no generated pool changes branch.
 */
export * from './diWordReadingDomain';
export type { DiWordReadingChallengeType } from './diWordReadingModes';

export type ActionableDiWordReadingChallenge = DiWordReadingChallenge & {
  answerKind: 'voice';
  actionContract: DiActionContract;
};

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
export const testLine = (it: DiWordReadingChallenge) =>
  diWordReadingModePlan(it).answerStep.actionContract.instruction;

export const withWordReadingAction = (
  item: DiWordReadingChallenge,
): ActionableDiWordReadingChallenge => {
  const actionContract = diWordReadingModePlan(item).answerStep.actionContract;
  if (actionContract.answerKind !== 'voice') throw new Error('Word reading must use voice');
  return { ...item, answerKind: 'voice', actionContract };
};

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

// The DI tutoring block (judging directives, sentinel discipline, struggles)
// lives on the CATALOG entry — catalog/di.ts — since the L2 layer, so both the
// standalone connect fallback and the lesson auth/switch paths resolve it from
// the single source of truth. Any wording change there must be re-checked
// against the sentinel-collision rule this script's cues depend on.
