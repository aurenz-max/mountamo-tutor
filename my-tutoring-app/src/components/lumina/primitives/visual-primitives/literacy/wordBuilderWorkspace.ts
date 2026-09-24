/**
 * Word builder on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C2). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken word built from the morpheme parts on the board, asked by its meaning.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { rootPartOf, wordBuilderHarnessAnswers, type WordBuilderItem } from './wordBuilderScript';

const ask = (item: WordBuilderItem) => `Here is what the word means: ${item.clue} Say the whole word.`;

export function wordBuilderAssignment(item: WordBuilderItem): TeachingAssignment {
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `${item.word} (${item.parts.map(p => p.text).join(' + ')}). Built out loud part by part counts `
      + `when the whole word arrives at the end. Only "${rootPartOf(item).text}", the parts never joined, the parts in the `
      + 'wrong order, or a word from only some of the parts is not it.' };
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
