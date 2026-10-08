/**
 * sentence-builder `build_sentence` — open build (qa/open-build/ROADMAP.md, OB-3L L7). The learner MAKES a sentence of a
 * given kind about a given thing ("Make a question about the dog.") by tapping word tiles and an end mark into a row,
 * then presses "I'm done!". Many sentences pass (Can the dog run? Where is the dog? Is the dog big?).
 * Code checks the shape the ask states: an end mark, only at the end, the right one, at least three words, a question
 * that opens with a question word or a helping verb, a telling sentence that does not, and not a sentence already
 * made. The shared literacy judge (`judgeWordBuild`, `unit: 'sentence'`) decides whether it makes sense and is about
 * the thing named.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';

export type SentenceKind = 'question' | 'telling';
export interface SentenceItem {
  id: string;
  kind: SentenceKind;
  /** What the sentence is about, as the ask names it ("the dog"). */
  about: string;
  /** Word tiles plus the end marks; each tile is unlimited. */
  bank: string[];
  /** Sentences the bank makes that answer the ask, as tile lists (hidden: the gate and the levers read them). */
  examples: string[][];
  ways: 1 | 2;
}

export interface SentenceBuildData {
  title: string;
  task: 'sentence_build';
  sentences: SentenceItem[];
  gradeLevel?: string;
  supportTier?: 'easy' | 'medium' | 'hard';
}

export type SentenceMiss = 'no_end_mark' | 'end_mark_inside' | 'wrong_end_mark' | 'too_short' | 'not_question_start'
  | 'question_start' | 'same_sentence' | 'not_sense' | 'off_topic';
export const SENTENCE_MISSES: readonly SentenceMiss[] = ['no_end_mark', 'end_mark_inside', 'wrong_end_mark', 'too_short',
  'not_question_start', 'question_start', 'same_sentence', 'not_sense', 'off_topic'];

export const END_MARKS = ['.', '?'];
const QUESTION_OPENERS = new Set(['who', 'what', 'where', 'when', 'why', 'how', 'which', 'is', 'are', 'can', 'do', 'does',
  'did', 'will', 'was', 'were', 'has', 'have', 'could', 'would', 'should', 'may']);
export const isEndMark = (t: string) => END_MARKS.includes(t);

/** What the learner sees: the first word capitalised, end mark joined to the last word. */
export function sentenceText(row: readonly string[]): string {
  const words = row.filter(t => !isEndMark(t));
  const mark = row.find(isEndMark) ?? '';
  const text = words.join(' ');
  return (text.charAt(0).toUpperCase() + text.slice(1) + (row[row.length - 1] && isEndMark(row[row.length - 1]) ? mark : '')).trim();
}

/** Everything the ask states about shape, checked in code before any judge. */
export function sentenceShapeMiss(item: SentenceItem, row: readonly string[], made: readonly string[] = []): SentenceMiss | undefined {
  const last = row[row.length - 1];
  if (!last || !isEndMark(last)) return 'no_end_mark';
  if (row.slice(0, -1).some(isEndMark)) return 'end_mark_inside';
  if ((item.kind === 'question') !== (last === '?')) return 'wrong_end_mark';
  const words = row.slice(0, -1);
  if (words.length < 3) return 'too_short';
  const opensAsQuestion = QUESTION_OPENERS.has(words[0].toLowerCase());
  if (item.kind === 'question' && !opensAsQuestion) return 'not_question_start';
  if (item.kind === 'telling' && opensAsQuestion) return 'question_start';
  if (made.includes(sentenceText(row).toLowerCase())) return 'same_sentence';
  return undefined;
}

export const askFor = (item: SentenceItem) =>
  item.kind === 'question' ? `Make a question about ${item.about}.` : `Make a telling sentence about ${item.about}.`;

/** A set ships when 2+ distinct bank sentences answer the ask with a good shape and the bank holds both end marks. */
export function askableSentence(item: SentenceItem): SentenceItem | null {
  if (!item?.about?.trim() || !Array.isArray(item.bank) || !Array.isArray(item.examples)) return null;
  const bank = new Set(item.bank);
  if (!END_MARKS.every(m => bank.has(m)) || item.bank.length > 16) return null;
  const seen = new Set<string>();
  const examples = item.examples.filter(ex => {
    const key = sentenceText(ex).toLowerCase();
    if (seen.has(key) || !ex.every(t => bank.has(t)) || sentenceShapeMiss(item, ex)) return false;
    seen.add(key); return true;
  });
  return examples.length >= 2 ? { ...item, examples } : null;
}

export const sentencesFrom = (items: readonly SentenceItem[], tier?: string): SentenceItem[] =>
  items.map(askableSentence).filter((i): i is SentenceItem => !!i)
    .map((i, n) => ({ ...i, id: i.id || `s${n + 1}`, ways: (tier !== 'easy' && n % 2 === 1 ? 2 : 1) as 1 | 2 }));

const waysLine = (item: SentenceItem) => item.ways === 2 ? ' Then make a different one.' : '';
export const sentenceAssignment = (item: SentenceItem): TeachingAssignment =>
  ({ id: item.id, task: `${askFor(item)}${waysLine(item)}`, response: 'gesture' });

export const describeSentence = (row: readonly string[]) => row.length ? `Built: "${sentenceText(row)}"` : 'Built nothing';

export const sentenceJudgeRequest = (item: SentenceItem, row: readonly string[], grade?: string): WordBuildJudgeRequest =>
  ({ ask: askFor(item), made: sentenceText(row), unit: 'sentence', ...(grade ? { grade } : {}) });

export function sentenceScene(item: SentenceItem, row: readonly string[], made: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: askFor(item),
    tiles: item.bank.join(' '),
    sentence: row.length ? sentenceText(row) : 'empty',
    tilesPlaced: row.length,
    ...(item.ways === 2 ? { waysAsked: 2, waysMade: made.length, madeBefore: made.join(' | ') || 'none' } : {}),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner taps word tiles and an end mark into a row (tap one in the row to take it back) and presses '
      + '"I\'m done!". The builder checks the end mark and how the sentence starts, then whether it makes sense and is '
      + 'about what was asked. Many sentences pass. You cannot move a tile.',
  } };
}

// ── Levers ───────────────────────────────────────────────────────────────────
export const FRAME_LEVER = 'sentence_frame';
export const MODEL_LEVER = 'model_sentence';
export const FEWER_LEVER = 'fewer_tiles';

export const frameFor = (item: SentenceItem) => item.kind === 'question'
  ? ['asking word (who, what, is, can...)', '...', '?'] : ['who or what', 'does what', '.'];

const MODELS: Record<SentenceKind, string> = { question: 'Can the bird sing?', telling: 'The bird sings a song.' };
export const modelFor = (item: SentenceItem) => (item.about.toLowerCase().includes('bird') ? MODELS[item.kind].replace(/bird/g, 'fish') : MODELS[item.kind]);

export function fewerTilesFor(item: SentenceItem): SentenceItem | null {
  const tiles = Array.from(new Set([...item.examples[0], ...END_MARKS]));
  return tiles.length < item.bank.length ? { ...item, id: `${item.id}~fewer`, ways: 1, bank: tiles, examples: [item.examples[0]] } : null;
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly SentenceMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function sentenceLevers(item: SentenceItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  return [
    lever(FRAME_LEVER, 'help', ['no_end_mark', 'end_mark_inside', 'wrong_end_mark', 'too_short', 'not_question_start', 'question_start'],
      'The learner leaves out the end mark, uses the wrong one, or starts the sentence the wrong way for its kind.',
      'Shows the shape of the sentence kind above the row (an asking word ... ? for a question; who or what, does what, . for a telling sentence). No tile is placed.',
      pulled),
    lever(MODEL_LEVER, 'help', ['not_sense', 'off_topic'],
      'The learner\'s sentence does not make sense or is about something else.',
      'Shows one finished sentence of the same kind about a different animal, so the learner hears how one sounds.', pulled),
    ...(fewerTilesFor(item) ? [lever(FEWER_LEVER, 'simplify', ['not_sense', 'off_topic', 'too_short'],
      'The learner cannot put a sentence together from so many tiles.',
      'Opens the same ask with only the tiles one sentence needs plus the end marks, ungraded. The full set comes back after it.',
      pulled)] : []),
  ];
}

export function sentenceLeverFacts(pulled: readonly string[], item: SentenceItem): string | undefined {
  const notes = [
    pulled.includes(FRAME_LEVER) && `The sentence shape is shown above the row: ${frameFor(item).join(' ')}.`,
    pulled.includes(MODEL_LEVER) && `A model sentence about another animal is shown: ${modelFor(item)}`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

export function sentenceMissWords(miss: SentenceMiss | undefined, item: SentenceItem): string {
  switch (miss) {
    case 'no_end_mark': return 'Every sentence needs an end mark. Which one goes at the end?';
    case 'end_mark_inside': return 'The end mark goes only at the very end.';
    case 'wrong_end_mark': return item.kind === 'question' ? 'A question ends with a question mark.' : 'A telling sentence ends with a period.';
    case 'too_short': return 'Add more words so the sentence tells a whole idea.';
    case 'not_question_start': return 'A question starts with an asking word, like who, what, where, is, or can.';
    case 'question_start': return 'That starts like a question. A telling sentence tells something.';
    case 'same_sentence': return 'You already made that sentence. Make a different one.';
    case 'not_sense': return 'Read it out loud. Does it make sense?';
    case 'off_topic': return `Is your sentence about ${item.about}?`;
    default: return 'Not quite. Try again.';
  }
}
