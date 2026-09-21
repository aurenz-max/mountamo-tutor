/**
 * diLetterSoundsDomain — what the letter-sounds pack TEACHES, with no teaching
 * engine attached: the item shape, the validity gates, what the child is asked,
 * and what counts as having produced the sound.
 *
 * Sunset slice for the FIRST DI primitive (di-letter-sounds, born 2026-07-20),
 * following `countingBoardDomain`, `shapeSorterDomain` and `numberSequencerDomain`
 * (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md). The split is by
 * ownership:
 *
 *   - HERE: the assignment. Which items can be asked at all, the question the
 *     child hears, what counts as the answer, and the success condition stated
 *     plainly enough for a tutor to judge against.
 *   - `diLetterSoundsScript`: the retiring control protocol — the model/guide/test
 *     lead-in, the sentinel-opened affirm and correction lines, the in-band
 *     judging contract and the bracketed cues. It re-exports this module, so the
 *     generator, the tester, the Pip pose and the lesson-bench extractor keep one
 *     address.
 *
 * The DISTAR content that survives the sunset is here: the keyword route, the
 * elicitation fork (a short vowel distorts in isolation, so it is elicited
 * through its keyword), the clipped-stop ruling, and the standing block on
 * letter NAMES. What does not survive is the wording that decided progression.
 */
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import { diLetterSoundModePlan, DI_LETTER_SOUNDS_MODES, type DiLetterSoundChallengeType }
  from './diLetterSoundsModes';

export type { DiLetterSoundChallengeType } from './diLetterSoundsModes';

/**
 * The within-mode SUPPORT tier (L3). `challengeType` = WHICH sound skill,
 * `supportTier` = HOW MUCH of the DISTAR sequence precedes the attempt. The
 * tier composes the legacy lead-in; on the teaching workspace the tutor decides
 * how much to model, and the tier survives as the item fact it reads.
 */
export type DiLetterSoundsSupportTier = 'easy' | 'medium' | 'hard';

/** One letter-sound item the tutor drills. Mirrors the generator output shape. */
export interface DiLetterSoundChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills. Drives the cue SHAPE (onset items
   *  get word-first lines) and the kid-facing display (onset items show the
   *  picture/word, never the isolated grapheme). */
  challengeType: DiLetterSoundChallengeType;
  /** How much of the DISTAR sequence precedes the child's attempt. Absent =
   *  easy (the L0 shape), so a session generated before L3 behaves as it did. */
  supportTier?: DiLetterSoundsSupportTier;
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
  /**
   * How an isolated sound is made: `held` (a continuant the child stretches —
   * the L0 benched class) or `clipped` (a stop — t p c k h d g b — released
   * once; a small "uh" after it is tolerated, and the keyword or any word
   * starting with the sound also counts). Absent = held.
   */
  articulation?: 'held' | 'clipped';
  /** Whole-token ASR aliases — passive cross-check only, never the judge. */
  asrAliases?: string[];
}

/** Onset-isolation items drill the SAME sound but from a whole spoken word, so
 *  every ask leads with the word. Checked before elicitation because these items
 *  are always continuants yet need the word-first phrasing. */
export const isOnset = (it: Pick<DiLetterSoundChallenge, 'challengeType'>) =>
  it.challengeType === 'first_sound_in_word';

export const sentenceCase = (value: string | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

/**
 * What the child must produce, said in full. This is the item's success
 * condition, and it is the one piece of DISTAR content the judging side cannot
 * lose: it carries the letter-NAME block, the keyword-elicitation fork and the
 * clipped-stop tolerance that a five-year-old's schwa depends on.
 */
export const targetDescription = (it: DiLetterSoundChallenge) =>
  isOnset(it)
    ? `the first sound in "${it.keyword}" (the continuous sound ${it.spoken})`
    : it.elicitation === 'keyword'
      ? `the word "${it.keyword}"`
      : it.articulation === 'clipped'
        // A stop cannot be held: the judge hears one short release. The
        // curriculum wants it crisp ("not tuh"), but a five-year-old's schwa
        // is not a wrong sound, and a word that starts with the sound proves
        // the same grapheme-to-phoneme link (the 2026-09-05 ruling).
        ? `the short, clipped sound ${it.spoken} as at the start of "${it.keyword}" — a little "uh" after it counts, and so does "${it.keyword}" or another word that starts with that sound; the letter's NAME does not`
        : `the continuous sound ${it.spoken}`;

/** The eval modes this primitive binds to the shared teaching workspace. */
export const DI_LETTER_SOUNDS_WORKSPACE_MODES =
  DI_LETTER_SOUNDS_MODES.map(definition => definition.evalMode);

/** One workspace assignment. Extends the DOMAIN item base (what the answer is
 *  made of); the runtime's own `TeachingItem` (task/expectedAnswer/checker) is a
 *  different layer, and `DiLetterSoundsTeaching` maps onto it explicitly. */
export interface LetterSoundItem extends TeachingItem {
  challengeType: DiLetterSoundChallengeType;
  supportTier: DiLetterSoundsSupportTier;
  letter: string;
  spoken: string;
  keyword: string;
  emoji: string;
  elicitation: 'isolated' | 'keyword';
  articulation: 'held' | 'clipped';
  /** What is actually DRAWN as the stimulus: the printed grapheme, or the
   *  keyword in print. An onset item never shows the lone grapheme — that would
   *  hand over the sound the child is meant to hear out of the word. */
  stimulus: 'letter' | 'word';
  /** The question the child hears, stable for the whole item. */
  ask: string;
  /** The accepted answer, short enough to compare a tutor's affirmation against. */
  accepted: string;
  /** The success condition in full, for the tutor's scene facts. */
  assignment: string;
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

/**
 * Independent key check, run on both sides of the wire. An item missing its
 * stimulus or its target sound cannot be ASKED, and is dropped rather than
 * repaired: a repaired letter-sound item would drill a sound nobody chose.
 */
export function letterSoundChallengeValid(c: DiLetterSoundChallenge): boolean {
  if (!c || !nonEmpty(c.id) || !nonEmpty(c.spoken) || !nonEmpty(c.keyword)) return false;
  if (!DI_LETTER_SOUNDS_WORKSPACE_MODES.includes(c.challengeType)) return false;
  if (c.elicitation !== 'isolated' && c.elicitation !== 'keyword') return false;
  if (c.articulation && c.articulation !== 'held' && c.articulation !== 'clipped') return false;
  // A grapheme mode draws the letter; onset isolation draws the word instead.
  if (!isOnset(c) && (!nonEmpty(c.letter) || c.letter.length > 2)) return false;
  // A stop released once cannot be held long enough to isolate from a spoken
  // word at this age, and a short-vowel onset distorts: continuants only.
  if (isOnset(c) && (c.articulation === 'clipped' || c.elicitation === 'keyword')) return false;
  return true;
}

/** The ask, in the child's own terms. No bracket tag, no "Speak exactly", no
 *  model line: the tutor decides how much to model before the child tries. */
export function askFor(item: Pick<LetterSoundItem, 'challengeType' | 'elicitation' | 'letter' | 'keyword'>): string {
  if (isOnset(item)) return `What is the first sound in "${item.keyword}"?`;
  return item.elicitation === 'keyword'
    ? `Say the word "${item.keyword}".`
    : `What sound does the letter "${item.letter}" make?`;
}

/** The accepted answer, short. The nuance lives in `assignment`, so a tutor's
 *  affirmation is compared against a token rather than a paragraph. */
function acceptedFor(c: DiLetterSoundChallenge): string {
  if (isOnset(c)) return c.spoken;
  if (c.elicitation === 'keyword') return c.keyword;
  return c.articulation === 'clipped' ? `${c.spoken} or ${c.keyword}` : c.spoken;
}

/**
 * The success condition, and what is NOT it — short, because this sentence is
 * what a tutor's feedback gets judged against. The keyword picture sits on the
 * stage at every tier, so naming it is the near miss this primitive has to
 * distinguish: for a grapheme item, saying "moon" is progress toward mmm and
 * not the answer, while for a short vowel the keyword IS the answer.
 *
 * Each branch states the target once. `targetDescription` already carries the
 * name block for a clipped stop, so the generic suffix is not appended there —
 * a success condition that says the same thing twice reads as two conditions.
 */
function assignmentFor(c: DiLetterSoundChallenge): string {
  if (isOnset(c)) return `The learner must say the first sound in "${c.keyword}": ${c.spoken}. `
    + `Saying the whole word "${c.keyword}" back, or naming a letter, is a step toward the answer and is not it.`;
  if (c.elicitation === 'keyword') return `The learner must say the word "${c.keyword}". `
    + 'Saying that word is the whole answer for this short vowel; the isolated vowel is not asked for.';
  if (c.articulation === 'clipped') return `The learner must say the clipped sound ${c.spoken}. `
    + `A small "uh" after it counts, and so does "${c.keyword}" or another word starting with that sound. `
    + `The letter's name is not the answer.`;
  return `The learner must say the continuous sound ${c.spoken}. The letter's name is not the answer, `
    + `and naming the picture "${c.keyword}" is a step toward the sound rather than the sound itself.`;
}

/** Expand a generated pool into the assignments the workspace actually asks.
 *  Unaskable items are DROPPED, never repaired. */
export function buildLetterSoundItems(challenges: DiLetterSoundChallenge[] = []): LetterSoundItem[] {
  const seen = new Set<string>();
  return challenges.filter(c => {
    if (!letterSoundChallengeValid(c) || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).map(c => ({
    id: c.id,
    challengeType: c.challengeType,
    supportTier: c.supportTier ?? 'easy',
    letter: c.letter,
    spoken: c.spoken,
    keyword: c.keyword,
    emoji: c.emoji,
    elicitation: c.elicitation,
    articulation: c.articulation ?? 'held',
    stimulus: isOnset(c) ? 'word' : 'letter',
    ask: askFor(c),
    accepted: acceptedFor(c),
    assignment: assignmentFor(c),
    answerKind: diLetterSoundModePlan(c).answerStep.actionContract.answerKind === 'voice' ? 'voice' : 'gesture',
    responseClass: 'continuant_sound',
  }));
}

/** What the mounted journey driver SAYS for this item. The wrong answer is a
 *  different held sound rather than the letter name: the name is a real
 *  misconception this pack blocks, but a transport harness must not score the
 *  tutor's handling of it as a transport failure. */
export function letterSoundHarnessAnswers(item: LetterSoundItem): { correct: string; plainWrong: string } {
  const correct = item.elicitation === 'keyword' ? item.keyword : item.spoken;
  const wrong = ['sss', 'mmm', 'fff'].find(sound => sound !== item.spoken && sound !== correct) ?? 'sss';
  return { correct, plainWrong: wrong };
}
