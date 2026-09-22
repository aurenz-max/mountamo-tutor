/**
 * diSentenceReadingDomain — what the sentence-reading pack TEACHES, with no
 * teaching engine attached: the item shape, the validity gates, what the child
 * is asked, and what counts as having read the printed sentence.
 *
 * Sunset slice for DI pack #4 (di-sentence-reading, born 2026-07-25), following
 * `countingBoardDomain`, `shapeSorterDomain`, `numberSequencerDomain`,
 * `diLetterSoundsDomain` and `diWordReadingDomain`
 * (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md). The split is by
 * ownership:
 *
 *   - HERE: the assignment. Which items can be asked at all, the question the
 *     child hears, what counts as the answer, and the success condition stated
 *     plainly enough for a tutor to judge against. Also the benched scope
 *     ceiling (`MAX_SENTENCE_WORDS`/`MIN_SENTENCE_WORDS`), which
 *     knowledgeCheckScript, decodableReaderScript, readAloudStudioScript,
 *     wordWorkoutScript and their generators/tests import from here.
 *   - The scripted drill (model/guide/test lead-in, sentinel-opened affirm and
 *     correction lines, in-band judging contract) was deleted in LA-14 S5; the
 *     workspace is the only teaching path.
 *
 * Two pieces of DISTAR content survive the sunset, because each is task
 * structure rather than control protocol:
 *
 *   1. THE ANSWER IS THE STIMULUS, AND ALREADY VISIBLE. Unlike word reading,
 *      there is nothing to withhold from the tutor or from the ask: the
 *      printed sentence is the target, it is already on the child's screen,
 *      and the tutor legitimately MODELS it aloud at `easy`/`medium` support.
 *      `askFor` still never repeats the sentence text in the task string — the
 *      workspace object draws it — matching the sibling packs' leak-avoidance
 *      shape even though the reason here is consistency, not a real leak.
 *   2. WORD-BY-WORD ACCURACY, SELF-CORRECTION ALLOWED. The bench sitting
 *      (standing gate 1, 2026-07-25, `qa/di-bench/run-2026-07-25-sentence-reading-probe.md`) proved Live can
 *      catch a single dropped/added/swapped word inside a full sentence; a
 *      learner catching and fixing their own slip mid-read still counts as
 *      accurate. A near-miss word is never accepted, however close it sounds.
 */
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { diSentenceReadingModePlan, DI_SENTENCE_READING_MODES, type DiSentenceReadingChallengeType }
  from './diSentenceReadingModes';

export type { DiSentenceReadingChallengeType } from './diSentenceReadingModes';

/**
 * The benched scope ceiling. The 2026-07-25 sitting laddered 3 → 8 words and
 * found no reliability break — the 8-word item read clean and affirmed first
 * try — so 8 is the proven ceiling, not an observed failure point. Longer
 * connected text is UNBENCHED: a generator must never exceed this without a
 * new sitting.
 */
export const MAX_SENTENCE_WORDS = 8;

/** The short end of the ladder. Below this a "sentence" is really a phrase. */
export const MIN_SENTENCE_WORDS = 3;

/**
 * The within-mode SUPPORT tier (L3). `challengeType` = WHICH reading skill,
 * `supportTier` = HOW MUCH of the DISTAR sequence precedes the child's read —
 * `easy` hands over model + guide, `medium` only the model, `hard` neither. On
 * the teaching workspace the tutor decides how much to model; the tier
 * survives as the item fact it reads (never withdrawn at any tier: the printed
 * sentence itself, and a correction's re-model).
 */
export type DiSentenceReadingSupportTier = 'easy' | 'medium' | 'hard';

/** One printed sentence the tutor drills. Mirrors the generator output shape. */
export interface DiSentenceReadingChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills — one identity at birth. */
  challengeType: DiSentenceReadingChallengeType;
  /** How much of the DISTAR sequence precedes the child's read. Absent = easy
   *  (the L0 shape), so a session generated before L3 behaves exactly as it did. */
  supportTier?: DiSentenceReadingSupportTier;
  /** The printed sentence, exactly as shown and read: "The cat sat." */
  text: string;
  /** Word count (3-8). The pack's structural-difficulty axis, computed in code
   *  from `text` — never trusted from the model. */
  wordCount: number;
  /** Short vowels the decodable content words drill — the phonics scoping key,
   *  carried for reporting and for the /add-eval-modes ladder. */
  vowels?: string[];
  /** POST-affirmation reward picture ONLY — never shown before the read
   *  (the answer IS the printed sentence). */
  emoji?: string;
  /** Whole-utterance ASR aliases — passive cross-check only, never the judge. */
  asrAliases?: string[];
}

/** The printed text as it should be READ. Trailing whitespace only — the
 *  sentence carries its own terminal punctuation. */
const sentenceText = (it: Pick<DiSentenceReadingChallenge, 'text'>) => it.text.replace(/\s+$/, '');

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

/** The eval modes this primitive binds to the shared teaching workspace. */
export const DI_SENTENCE_READING_WORKSPACE_MODES =
  DI_SENTENCE_READING_MODES.map(definition => definition.evalMode);

/** One workspace assignment. Extends the DOMAIN item base (what the answer is
 *  made of); the runtime's own `TeachingItem` (task/expectedAnswer/checker) is a
 *  different layer, and `DiSentenceReadingTeaching` maps onto it explicitly. */
export interface SentenceReadingItem extends TeachingItem {
  challengeType: DiSentenceReadingChallengeType;
  supportTier: DiSentenceReadingSupportTier;
  /** The printed sentence, trimmed. */
  text: string;
  wordCount: number;
  /** The reward picture, revealed only after a committed correct read. */
  emoji: string;
  /** The question the child hears. It never contains the sentence. */
  ask: string;
  /** The accepted answer, the exact sentence, for comparing a tutor's affirmation against. */
  accepted: string;
  /** The success condition in full, for the tutor's scene facts. */
  assignment: string;
}

/**
 * Independent key check, run on both sides of the wire. An item that cannot be
 * ASKED is dropped rather than repaired: a repaired word count would silently
 * change what the pack's own structural-difficulty axis reports.
 */
export function sentenceReadingChallengeValid(c: DiSentenceReadingChallenge): boolean {
  if (!c || !nonEmpty(c.id) || !nonEmpty(c.text)) return false;
  if (!DI_SENTENCE_READING_WORKSPACE_MODES.includes(c.challengeType)) return false;
  if (c.supportTier && c.supportTier !== 'easy' && c.supportTier !== 'medium' && c.supportTier !== 'hard') return false;
  const words = sentenceText(c).split(/\s+/).filter(Boolean);
  if (words.length < MIN_SENTENCE_WORDS || words.length > MAX_SENTENCE_WORDS) return false;
  // The generator's own wordCount is never trusted; an item whose reported
  // count does not match its actual printed sentence is a content defect.
  if (typeof c.wordCount === 'number' && c.wordCount !== words.length) return false;
  return true;
}

/**
 * The ask, in the child's own terms — and deliberately WITHOUT the sentence.
 * Every mode is the same act, so every item asks the same question; the
 * sentence is drawn on the card and published as a scene fact, where the
 * tutor can judge against it without a task string that reads aloud as
 * the answer.
 */
export function askFor(): string {
  return 'Read the sentence out loud, every word in order.';
}

/**
 * The success condition, and what is NOT it — short, because this sentence is
 * what a tutor's feedback gets judged against. Every challenge type shares this
 * SAME judging criteria (the class the standing-gate sitting benched); what
 * differs between them is which sentences are drawn, not how a read is judged.
 */
function assignmentFor(c: DiSentenceReadingChallenge): string {
  return `The learner must read the printed sentence "${sentenceText(c)}" aloud, every word in order. `
    + 'A word skipped, added, or read as a different word is a miss, however small — a near-sounding word '
    + 'is not close enough. Catching and fixing their own slip mid-read still counts as an accurate read. '
    + 'Slow, effortful sounding-out that lands on the right words is correct; speed is never judged.';
}

/** Expand a generated pool into the assignments the workspace actually asks.
 *  Unaskable items are DROPPED, never repaired. */
export function buildSentenceReadingItems(challenges: DiSentenceReadingChallenge[] = []): SentenceReadingItem[] {
  const seen = new Set<string>();
  return challenges.filter(c => {
    if (!sentenceReadingChallengeValid(c) || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).map(c => ({
    id: c.id,
    challengeType: c.challengeType,
    supportTier: c.supportTier ?? 'easy',
    text: sentenceText(c),
    wordCount: c.wordCount,
    emoji: c.emoji ?? '',
    ask: askFor(),
    accepted: sentenceText(c),
    assignment: assignmentFor(c),
    answerKind: diSentenceReadingModePlan(c).answerStep.actionContract.answerKind === 'voice' ? 'voice' : 'gesture',
    responseClass: 'sentence_read_aloud',
  }));
}

/** The item as the tutor and the outcome observer are told it. Every mode is spoken: the
 *  child reads print aloud, the tutor hears the audio and JEV reads its completed feedback. */
export const workspaceAssignment = (item: SentenceReadingItem): TeachingAssignment =>
  ({ id: item.id, task: item.ask, expectedAnswer: item.accepted, response: 'speech' });

/** The drawn stage: the printed sentence, one markable object. Connected text has no
 *  discrete sound-out sub-units the way a single decodable word does, so unlike
 *  word reading there is no per-letter demonstration target — only the whole sentence. */
export const workspaceScene = (item: SentenceReadingItem): WorkspaceScene => ({
  objects: [
    { id: 'sentence', selected: false, group: 'assignment target (gold ring)',
      label: `the sentence "${item.text}" printed on the card, which the learner must read aloud` },
  ],
  facts: { kind: item.challengeType, assignment: item.assignment, printedSentence: item.text,
    wordCount: item.wordCount, supportTier: item.supportTier,
    markMeaning: 'Purple dashed marks are yours. They point at the printed sentence while you teach; '
      + 'they are not the learner reading, and they never move the gold ring off the sentence.' },
});

/** A fixed set of plainly different sentences for the mounted journey driver.
 *  A near-neighbour misreading is this pack's real misconception and belongs in
 *  the JEV probe, where the tutor's reply is fixed and only the observer is
 *  under test; a transport harness must not score the tutor's handling of it. */
const PLAIN_WRONG_SENTENCES = ['I see a dog.', 'The sun is hot.', 'We ran to the park.', 'A cat sat down.'];

/** What the mounted journey driver SAYS for this item. */
export function sentenceReadingHarnessAnswers(item: SentenceReadingItem): { correct: string; plainWrong: string } {
  const wrong = PLAIN_WRONG_SENTENCES.find(candidate => candidate !== item.text) ?? PLAIN_WRONG_SENTENCES[0];
  return { correct: item.text, plainWrong: wrong };
}
