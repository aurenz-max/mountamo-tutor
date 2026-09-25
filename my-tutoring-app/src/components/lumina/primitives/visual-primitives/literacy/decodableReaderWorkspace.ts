/**
 * Decodable reader on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C3). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is
 * spoken: a printed story line read aloud (decode modes), a one-word answer from the story
 * (literal, read_along), or which printed choice is right, said aloud (sequence, inference,
 * main_idea). Nothing is tapped.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import {
  askFor,
  choicesSpokenFor,
  correctOptionText,
  decodableReaderHarnessAnswers,
  type DecodableReaderItem,
} from './decodableReaderScript';

const stripEnd = (value: string) => value.replace(/[.!?]+$/, '').trim();

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: DecodableReaderItem) => askFor(item).replace(/^Your turn\.\s*/, '')
  || 'Read the line out loud.';

function expectedFor(item: DecodableReaderItem): string {
  switch (item.kind) {
    case 'read_line':
      return `"${item.text}" read aloud, every word in order. A word skipped, added or read as a different word is `
        + 'not it, however small ("the" for "a" is a miss). Catching and fixing their own slip still counts; slow '
        + 'sounding-out that lands on the right words is correct.';
    case 'answer_spoken':
      return `${item.answerWord}. Said inside a phrase ("on the ${item.answerWord}") or as a word that names the same `
        + 'thing counts. A different word from the story, the question said back, or a retelling is not it.';
    case 'answer_choice': {
      const options = item.options ?? [];
      const index = options.findIndex(o => o.id === item.correctOptionId) + 1;
      return `${stripEnd(correctOptionText(item))} (choice ${index} of ${options.length}). The whole choice, the part `
        + 'that tells it apart from the others, what its picture shows, or its position in the list all count. '
        + 'Another choice is not it.';
    }
  }
}

export function decodableReaderAssignment(item: DecodableReaderItem): TeachingAssignment {
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer: expectedFor(item) };
}

export function decodableReaderScene(item: DecodableReaderItem): WorkspaceScene {
  const facts: Record<string, string | number> = {};
  if (item.kind === 'read_line') {
    facts.printedLine = item.text;
    facts.wordCount = item.wordCount;
    facts.constraints = 'The learner reads the printed line out loud; it is the only thing on screen. Nothing is tapped.';
  } else {
    facts.question = item.question ?? '';
    if (item.storyText) Object.assign(facts, textFacts('story', item.storyText));
    if (item.kind === 'answer_choice') facts.choicesInScreenOrder = choicesSpokenFor(item);
    facts.constraints = item.kind === 'answer_choice'
      ? 'The question and the picture choices are printed; the learner says which choice out loud. Nothing is tapped.'
      : 'The question is printed; the learner says the answer out loud. The answer appears only after credit.';
  }
  return { objects: [], facts };
}

/** What "Say that again" asks the tutor to say: the question side, never an answer and never the line. */
export const hearAgainRequest = (item: DecodableReaderItem) =>
  item.kind === 'read_line'
    ? 'The learner asked to hear that again. Say only: "Read the line out loud." Do not read the line or any word of it.'
    : `The learner asked to hear the question again. Say only this, once: "${ask(item)}" Never say the answer.`;

/** The journey's answers: the pack's own correct read or answer, and its plain wrong one. */
export function decodableReaderJourneyAnswers(item: DecodableReaderItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = decodableReaderHarnessAnswers(item);
  return { correct, plainWrong };
}
