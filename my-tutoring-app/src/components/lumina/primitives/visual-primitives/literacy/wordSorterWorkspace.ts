/**
 * Word sorter on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C2). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer: the group a word belongs with, or its partner from the printed bank.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, wordSorterHarnessAnswers, type WordSorterItem } from './wordSorterScript';

export function wordSorterAssignment(item: WordSorterItem): TeachingAssignment {
  const expectedAnswer = item.mode === 'match_pairs'
    ? `${item.answer}, the ${item.relation === 'partner' ? 'partner' : item.relation} of ${item.word} from the bank. `
      + `${item.word} said back is not it.`
    : `${item.answer}, the group ${item.word} belongs with. ${item.word} said back is not a group.`;
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer };
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
