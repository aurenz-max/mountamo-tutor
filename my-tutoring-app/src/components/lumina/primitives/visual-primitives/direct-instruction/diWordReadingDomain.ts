/**
 * diWordReadingDomain — what the word-reading pack TEACHES, with no teaching
 * engine attached: the item shape, the validity gates, what the child is asked,
 * and what counts as having read the printed word.
 *
 * Sunset slice for DI pack #2 (di-word-reading, born 2026-07-23), following
 * `countingBoardDomain`, `shapeSorterDomain`, `numberSequencerDomain` and
 * `diLetterSoundsDomain` (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md).
 * The split is by ownership:
 *
 *   - HERE: the assignment. Which items can be asked at all, the question the
 *     child hears, what counts as the answer, and the success condition stated
 *     plainly enough for a tutor to judge against.
 *   - The scripted drill (model/guide/test lead-in, sentinel-opened affirm and
 *     correction lines, in-band judging contract, bracketed cues) was deleted in
 *     LA-14 S5; the workspace is the only teaching path.
 *
 * Three pieces of DISTAR content survive the sunset, because each is task
 * structure rather than control protocol:
 *
 *   1. THE ANSWER IS THE STIMULUS. The child reads print, so the printed word is
 *      both what is drawn and what is asked for. `askFor` therefore never names
 *      the word: a tutor reading the task aloud would otherwise hand over the
 *      answer, which is the leak the standalone stage blocks on screen.
 *   2. STRICT ON NEAR NEIGHBOURS. The `short_spoken_word` response class is
 *      UNBENCHED — gate 1 was waived 2026-07-22 by user ruling, with the
 *      over-affirmation risk deferred to this primitive's live check. A word that
 *      merely sounds like the target is a different word. `asrAliases` stays a
 *      reporting cross-check and is never a judge.
 *   3. TWO WORD TYPES, ONE ACT. A decodable CVC word is blended from its printed
 *      letters; an irregular sight word is recalled whole and must not be sounded
 *      out. `graphemes` carries the blend for the first and is absent on the
 *      second, so the difference is structural rather than a sentence of guidance.
 */
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { diWordReadingModePlan, DI_WORD_READING_MODES, type DiWordReadingChallengeType }
  from './diWordReadingModes';

export type { DiWordReadingChallengeType } from './diWordReadingModes';

/** One printed word the tutor drills. Mirrors the generator output shape. */
export interface DiWordReadingChallenge {
  id: string;
  /** Which eval-mode skill this item drills. */
  challengeType: DiWordReadingChallengeType;
  /** The printed word shown on screen and read aloud, e.g. "sam". */
  word: string;
  /** Decodable (sound-out blend) vs irregular high-frequency (whole-word recall). */
  wordType: 'cvc' | 'sight';
  /** Graphemes for the sound-out model, e.g. ["s","a","m"]. CVC only. */
  graphemes?: string[];
  /** POST-read reward picture ONLY — never drawn beside the unread word, and
   *  never a workspace object (see `DiWordReadingTeaching`). Sight words
   *  usually have none. */
  emoji?: string;
  /** Whole-token ASR aliases — passive cross-check only, never the judge.
   *  Near-neighbour homophones (son/sun) live here for reporting. */
  asrAliases?: string[];
}

/** Stretched sound per grapheme for the sound-out model. Continuants and vowels
 *  stretch; stop consonants stay short (they cannot be held). */
const GRAPHEME_SOUNDS: Record<string, string> = {
  a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu',
  m: 'mmm', s: 'sss', f: 'fff', r: 'rrr', n: 'nnn', l: 'lll', v: 'vvv', z: 'zzz',
  b: 'b', c: 'k', d: 'd', g: 'g', h: 'h', j: 'j', k: 'k', p: 'p', q: 'kw',
  t: 't', w: 'w', x: 'ks', y: 'y',
};

/** A decodable item is one whose printed letters actually spell it, so the blend
 *  a tutor models ends in the word on the card. */
export const isCvc = (it: Pick<DiWordReadingChallenge, 'wordType' | 'graphemes' | 'word'>) =>
  it.wordType === 'cvc' && (it.graphemes?.length ?? 0) > 0
  && it.graphemes!.join('').toLowerCase() === it.word.toLowerCase();

/** The slow blend for a decodable word: "sss-aaa-mmm". */
export const soundOutFor = (it: DiWordReadingChallenge) =>
  (it.graphemes ?? []).map(g => GRAPHEME_SOUNDS[g.toLowerCase()] ?? g).join('-');

/** The eval modes this primitive binds to the shared teaching workspace. */
export const DI_WORD_READING_WORKSPACE_MODES =
  DI_WORD_READING_MODES.map(definition => definition.evalMode);

/** One workspace assignment. Extends the DOMAIN item base (what the answer is
 *  made of); the runtime's own `TeachingItem` (task/expectedAnswer/checker) is a
 *  different layer, and `DiWordReadingTeaching` maps onto it explicitly. */
export interface WordReadingItem extends TeachingItem {
  challengeType: DiWordReadingChallengeType;
  word: string;
  wordType: 'cvc' | 'sight';
  /** The printed letters, in order, for a decodable word. Empty for a sight word,
   *  which is why no letter is a legal demonstration target there. */
  letters: string[];
  /** The blend for a decodable word, e.g. "sss-aaa-mmm". Empty for a sight word. */
  soundOut: string;
  /** The reward picture, revealed only after a committed correct read. */
  emoji: string;
  /** The question the child hears. It never contains the word. */
  ask: string;
  /** The accepted answer, short enough to compare a tutor's affirmation against. */
  accepted: string;
  /** The success condition in full, for the tutor's scene facts. */
  assignment: string;
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

/**
 * Independent key check, run on both sides of the wire. An item that cannot be
 * ASKED is dropped rather than repaired: a repaired word-reading item would drill
 * a word nobody chose, and a repaired grapheme list would make the tutor model a
 * blend that does not end in the printed word.
 */
export function wordReadingChallengeValid(c: DiWordReadingChallenge): boolean {
  if (!c || !nonEmpty(c.id) || !nonEmpty(c.word)) return false;
  if (!DI_WORD_READING_WORKSPACE_MODES.includes(c.challengeType)) return false;
  if (c.wordType !== 'cvc' && c.wordType !== 'sight') return false;
  // Lowercase print only: the stage renders one word in lowercase, and a token
  // with a space or a digit is not a word this pack can ask a five-year-old.
  if (!/^[a-z]{2,6}$/.test(c.word)) return false;
  // A decodable item's whole teaching move is the blend, so its letters must
  // spell the word. Present-but-wrong graphemes are a content defect, not a
  // sight word: dropping is honest, silently reclassifying is not.
  if (c.wordType === 'cvc' && !isCvc(c)) return false;
  // Sounding out an irregular word teaches the wrong thing, so a sight word must
  // not arrive carrying a sound-out model at all.
  if (c.wordType === 'sight' && (c.graphemes?.length ?? 0) > 0) return false;
  return true;
}

/**
 * The ask, in the child's own terms — and deliberately WITHOUT the word. Every
 * mode is the same act, so every item asks the same question; the word is drawn
 * on the card and published as a scene fact, where the tutor can judge against it
 * without a task string that reads aloud as the answer.
 */
export function askFor(_item?: Pick<DiWordReadingChallenge, 'challengeType'>): string {
  return 'What word is this? Read it out loud.';
}

/**
 * The success condition, and what is NOT it — short, because this sentence is
 * what a tutor's feedback gets judged against. Each branch states the target once
 * and then the two discriminations that matter: a success condition that says the
 * same thing twice reads as two conditions (the letter-sounds finding). No
 * example wording, because an example in this position becomes a script.
 *
 * The strictness is the pedagogy the waived bench gate deferred here: a word that
 * merely sounds like the target is a different word, so affirming it as the
 * printed word must not record success.
 *
 * THREE SENTENCES, DELIBERATELY. Two further clauses were tried against the real
 * JEV service and both were reverted; the three runs are kept beside the report
 * (`di-word-reading-workspace-jev-2026-09-20.json` is this version):
 *
 *   - "Naming its letters is not reading it." No effect. A tutor affirming
 *     "Correct, s-a-m!" still classified at 0.98–1.00, because the observer never
 *     sees the learner transcript and so cannot tell a spelled word from a read
 *     one. That discrimination is only the tutor's to make, and it stays in the
 *     adapter guidance where the tutor reads it.
 *   - "A read that follows the tutor's model still counts." Lifted one refused
 *     case from 0.84 to the 0.90 gate boundary and no further, while the plain
 *     affirmation case fell from 0.96 to 0.91 and once below the gate. A sentence
 *     whose only measurable effect is nudging one case onto the threshold is
 *     patching a shared criterion from the wrong layer, and it costs certainty on
 *     every other case.
 *
 * The residual belongs to LA-13, not here: see the adoption report.
 */
function assignmentFor(c: DiWordReadingChallenge): string {
  return isCvc(c)
    ? `The learner must read the printed word "${c.word}" out loud. `
      + 'Saying the separate sounds slowly and then the whole word is a correct read; stopping at the '
      + 'separate sounds without ever saying the whole word is not. '
      + 'A different word is not a correct read, however close it sounds.'
    : `The learner must read the printed word "${c.word}" out loud. `
      + 'It is irregular and is recalled whole, so sounding it out letter by letter is not how it is read. '
      + 'A different word is not a correct read, however close it sounds.';
}

/** Expand a generated pool into the assignments the workspace actually asks.
 *  Unaskable items are DROPPED, never repaired. */
export function buildWordReadingItems(challenges: DiWordReadingChallenge[] = []): WordReadingItem[] {
  const seen = new Set<string>();
  return challenges.filter(c => {
    if (!wordReadingChallengeValid(c) || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).map(c => ({
    id: c.id,
    challengeType: c.challengeType,
    word: c.word,
    wordType: c.wordType,
    letters: isCvc(c) ? c.graphemes!.map(g => g.toLowerCase()) : [],
    soundOut: isCvc(c) ? soundOutFor(c) : '',
    emoji: c.emoji ?? '',
    ask: askFor(c),
    accepted: c.word,
    assignment: assignmentFor(c),
    answerKind: diWordReadingModePlan(c).answerStep.actionContract.answerKind === 'voice' ? 'voice' : 'gesture',
    responseClass: 'short_spoken_word',
  }));
}

/** The item as the tutor and the outcome observer are told it. Every mode is spoken: the
 *  child reads print aloud, the tutor hears the audio and JEV reads its completed feedback. */
export const workspaceAssignment = (item: WordReadingItem): TeachingAssignment =>
  ({ id: item.id, task: item.ask, expectedAnswer: item.accepted, response: 'speech' });

/** The drawn stage. Letter objects exist only where the letters really spell the word, so
 *  a sight word has no letter to sound out and the attempt is refused by the scene. */
export const workspaceScene = (item: WordReadingItem): WorkspaceScene => ({
  objects: [
    { id: 'word', selected: false, group: 'assignment target (gold ring)',
      label: `the word "${item.word}" printed on the card, which the learner must read` },
    ...item.letters.map((letter, position) => ({ id: `letter-${position}`, selected: false,
      group: 'printed letter of that word',
      label: `the letter "${letter}", letter ${position + 1} of the printed word` })),
  ],
  facts: { kind: item.challengeType, assignment: item.assignment, printedWord: item.word,
    wordType: item.wordType === 'cvc' ? 'decodable — blended from its printed letters'
      : 'irregular sight word — recalled whole, never sounded out',
    ...(item.soundOut ? { soundOut: item.soundOut } : {}),
    markMeaning: 'Purple dashed marks are yours. They point at the whole word or at one of its printed '
      + 'letters while you teach; they are not the learner reading, and they never move the gold ring off '
      + 'the word.' },
});

/**
 * What the mounted journey driver SAYS for this item. The wrong answer is a
 * plainly different word rather than a near neighbour: the homophone is this
 * pack's real misconception and the one the strict contract exists for, but a
 * transport harness must not score the tutor's handling of it as a transport
 * failure. The homophone belongs in the JEV probe, where the tutor's reply is
 * fixed and only the observer is under test.
 */
export function wordReadingHarnessAnswers(item: WordReadingItem): { correct: string; plainWrong: string } {
  const wrong = ['dog', 'cup', 'hen', 'map'].find(candidate => candidate !== item.word) ?? 'dog';
  return { correct: item.word, plainWrong: wrong };
}
