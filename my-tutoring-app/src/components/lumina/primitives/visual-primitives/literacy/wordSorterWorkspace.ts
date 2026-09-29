/**
 * Word sorter on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C2). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer: the group a word belongs with, or its partner from the printed bank.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { askFor, wordSorterHarnessAnswers, type WordSorterItem } from './wordSorterScript';

export function wordSorterAssignment(item: WordSorterItem): TeachingAssignment {
  const expectedAnswer = item.mode === 'match_pairs'
    ? `${item.answer}, the ${item.relation === 'partner' ? 'partner' : item.relation} of ${item.word} from the bank. `
      + `${item.word} said back is not it.`
    : `${item.answer}, the group ${item.word} belongs with. ${item.word} said back is not a group.`;
  const misses = wordSorterSpokenMisses(item);
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

const sameStem = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/s$/, ''), y = b.toLowerCase().replace(/s$/, '');
  return x.startsWith(y) || y.startsWith(x);
};

/** What a wrong spoken answer shows (handoff 20 Part B). */
export type SpokenWordSorterMiss = 'other_group' | 'other_bank_word' | 'said_word_back';

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: another printed group (or
 * bank word), then the word said back. Concrete per item: the word and the choices.
 */
export function wordSorterSpokenMisses(item: WordSorterItem): KnownMiss[] {
  const sort = item.mode !== 'match_pairs';
  const others = item.choices.filter(c => c.toLowerCase() !== item.answer.toLowerCase() && c.toLowerCase() !== item.word.toLowerCase());
  const quote = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(' or ');
  return [
    ...(others.length ? [{ id: sort ? 'other_group' : 'other_bank_word',
      pattern: sort ? `"${item.word}" belongs with ${item.answer}. The learner's answer is ${quote(others)}, another group.`
        : `The ${item.relation === 'partner' ? 'partner' : item.relation} of "${item.word}" is "${item.answer}". The learner's answer is ${quote(others)}, another word from the bank.`,
      examples: others.slice(0, 2) }] : []),
    // "cat" said back sounds like the group "Cats": no echo miss where the word is a form of the answer.
    ...(sameStem(item.word, item.answer) ? [] : [{ id: 'said_word_back',
      pattern: `The learner says the word "${item.word}" back and names no ${sort ? 'group' : 'bank word'}.`, examples: [item.word] }]),
  ];
}

export function wordSorterScene(item: WordSorterItem): WorkspaceScene {
  const sort = item.mode !== 'match_pairs';
  return { objects: [], facts: {
    word: item.word,
    [sort ? 'groups' : 'bank']: item.choices.join(', '),
    namingChoices: item.namesChoices
      ? `You may name the ${sort ? 'groups' : 'bank words'} aloud.`
      : `The learner reads the ${sort ? 'groups' : 'bank'}: do not name them aloud.`,
    constraints: `The learner hears the word and says the ${sort ? 'group' : 'bank word'} out loud; nothing is tapped. `
      + 'The word and the choices are printed; the right one is marked only after credit. The hear-again button '
      + 'asks you to repeat the question only.',
  } };
}

/** What the hear-again button asks the tutor to say: the question, never the answer. */
export const hearQuestionRequest = (item: WordSorterItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}"`;

/** The journey's answers: the right group or partner, or another printed choice. */
export function wordSorterJourneyAnswers(item: WordSorterItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = wordSorterHarnessAnswers(item);
  return { correct, plainWrong };
}
