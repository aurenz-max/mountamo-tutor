/**
 * Word builder on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C2). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken word built from the morpheme parts on the board, asked by its meaning.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { rootPartOf, wordBuilderHarnessAnswers, type WordBuilderItem } from './wordBuilderScript';

const ask = (item: WordBuilderItem) => `Here is what the word means: ${item.clue} Say the whole word.`;

export function wordBuilderAssignment(item: WordBuilderItem, board: readonly BoardPart[] = []): TeachingAssignment {
  const misses = wordBuilderSpokenMisses(item, board);
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `${item.word} (${item.parts.map(p => p.text).join(' + ')}). Built out loud part by part counts `
      + `when the whole word arrives at the end. Only "${rootPartOf(item).text}", the parts never joined, the parts in the `
      + 'wrong order, or a word from only some of the parts is not it.', ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken word shows (handoff 20 Part B; the last four from the lever table, 2026-10-03). */
export type SpokenWordBuilderMiss = 'root_only' | 'other_part_only' | 'part_missing' | 'parts_not_joined'
  | 'parts_out_of_order' | 'swapped_part' | 'meaning_word';

type BoardPart = { text: string; type: string; meaning?: string };

/**
 * A word's known wrong answers, in precedence order, for the `spoken_miss` observer: the root alone, another part
 * alone, the word with one prefix or suffix left off (three or more parts), the parts said apart and never joined,
 * the parts joined in another order, a board part swapped in for one of the word's (needs the board), and a word
 * that fits the clue but is not built from the board. Concrete per word.
 */
export function wordBuilderSpokenMisses(item: WordBuilderItem, board: readonly BoardPart[] = []): KnownMiss[] {
  const root = rootPartOf(item).text, parts = item.parts.map(p => p.text);
  const others = item.parts.filter(p => p !== rootPartOf(item) && p.text.length >= 2).map(p => p.text);
  const dropped = parts.length > 2
    ? item.parts.flatMap((p, i) => p.type === 'root' ? [] : [parts.filter((__, j) => j !== i).join('')]).filter(w => w !== root && w !== item.word) : [];
  const reversed = [...parts].reverse().join('');
  const own = new Set(parts.map(t => t.toLowerCase()));
  const swapped = item.parts.flatMap((p, i) => board.filter(b => b.type === p.type && !own.has(b.text.toLowerCase()))
    .map(b => parts.map((t, j) => (j === i ? b.text : t)).join(''))).filter(w => w !== item.word).slice(0, 2);
  return [
    { id: 'root_only', pattern: `The learner's whole answer is the single word "${root}". That is the root of "${item.word}" on its own, which is wrong because the prefix or suffix is missing.`,
      examples: [root] },
    ...(others.length ? [{ id: 'other_part_only', pattern: `The learner's whole answer is ${others.map(t => `"${t}"`).join(' or ')}: one part of "${item.word}" that is not its root, said on its own.`,
      examples: others.slice(0, 2) }] : []),
    ...(dropped.length ? [{ id: 'part_missing', pattern: `The learner's answer is ${dropped.map(w => `"${w}"`).join(' or ')}: a word made of only some of the parts of "${item.word}" (${parts.join(' + ')}).`,
      examples: dropped.slice(0, 2) }] : []),
    { id: 'parts_not_joined', pattern: `The learner says the parts of "${item.word}" (${parts.join(', ')}) one at a time, with pauses, and never says the joined word.`,
      examples: [parts.join(' ... ')] },
    ...(reversed !== item.word ? [{ id: 'parts_out_of_order', pattern: `The learner's answer is made of the parts of "${item.word}" (${parts.join(' + ')}) put together in a wrong order, such as "${reversed}".`,
      examples: [reversed] }] : []),
    ...(swapped.length ? [{ id: 'swapped_part', pattern: `The learner's answer uses a part from the board that is not in "${item.word}", in place of one of its parts, such as ${swapped.map(x => `"${x}"`).join(' or ')}.`,
      examples: swapped }] : []),
    { id: 'meaning_word', pattern: `The learner says a word that fits the clue but is not "${item.word}" and is not built from the parts on the board: a word recalled for the meaning instead of built.` },
  ];
}

export function wordBuilderScene(item: WordBuilderItem, board: ReadonlyArray<{ text: string; meaning: string }>): WorkspaceScene {
  return { objects: [], facts: {
    clue: item.clue,
    board: board.map(p => `${p.text} (${p.meaning})`).join(', '),
    ...(item.spokenSentence ? { sentence: item.spokenSentence } : {}),
    constraints: 'The learner says the whole word out loud, built from parts on the board. The clue and the board of '
      + 'parts with their meanings are printed; the word, its assembly and its definition appear only after credit. '
      + 'Nothing on the board is tapped.',
  } };
}

/** What "Say the clue again" asks the tutor to say: the clue (and sentence), never the word. */
export const hearClueRequest = (item: WordBuilderItem) =>
  `The learner asked to hear the clue again. Say only this, once: "${ask(item)}"`
  + (item.spokenSentence ? ` You may add the sentence: "${item.spokenSentence}"` : '');

/** The journey's answers: the word, or its parts in reverse order. */
export function wordBuilderJourneyAnswers(item: WordBuilderItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = wordBuilderHarnessAnswers(item);
  return { correct, plainWrong };
}
