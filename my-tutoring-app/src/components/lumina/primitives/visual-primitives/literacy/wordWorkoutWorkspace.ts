/**
 * Word workout on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C1). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer (a word or sentence read aloud, or a spoken answer about it) except picture
 * match, where the learner reads the word and taps its picture and the activity checks the tap.
 * Everything printed is read cold, so the scene tells the tutor not to say it first.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, chainWordOf, wordWorkoutHarnessAnswers, type WordWorkoutItem } from './wordWorkoutScript';

function expectedFor(item: WordWorkoutItem): string {
  switch (item.kind) {
    case 'real_word':
      return `${item.realWord}, the real word. ${item.nonsenseWord} is the made-up one.`;
    case 'chain_word':
      return `${chainWordOf(item)}, read aloud.`;
    case 'read_sentence':
      return `"${item.sentence}" read aloud, every word in order. A small slip the learner fixes still counts; a skipped or changed word does not.`;
    case 'answer_question':
      return `${item.answerWord}. A short phrase that says it counts.`;
    case 'read_extended_word':
    case 'read_context_word':
      return `${item.targetWord}, read aloud as the whole word.`;
    case 'answer_word_meaning':
      return `A meaning equivalent to "${item.answerWord}"`
        + (item.acceptedAnswers?.length ? ` (for example ${item.acceptedAnswers.join(', ')}).` : '.');
    case 'choose_context_word':
      return `${item.answerWord}, the word that fits the sentence.`;
    case 'picture_tap':
      return '';
  }
}

export function wordWorkoutAssignment(item: WordWorkoutItem): TeachingAssignment {
  // Picture match is checked by the activity: its key never reaches the tutor.
  if (item.kind === 'picture_tap') return { id: item.id, task: askFor(item), response: 'gesture' };
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: expectedFor(item) };
}

/** What is printed, and that reading it is the task. */
const coldRead = (item: WordWorkoutItem): string => {
  switch (item.kind) {
    case 'real_word': return 'Two printed words, one real and one made up. Reading them is the task: do not say either word, or any part of one, before the learner does.';
    case 'picture_tap': return 'A printed word and pictures beside it. Reading the word is half the task: do not say it or sound it out before the learner taps.';
    case 'chain_word': return 'A chain of printed words that change by one letter; the current one is lit. Do not say it, or any part of it, before the learner does.';
    case 'read_sentence': return 'A printed sentence. Do not read it, or any part of it, before the learner does.';
    case 'answer_question': return 'The sentence the learner just read, and a question about it.';
    case 'read_extended_word': return 'One printed word with an ending or two word parts. Do not say it, its parts or any sound in it before the learner does.';
    case 'answer_word_meaning': return 'The word the learner just read, a short sentence and a question about its meaning.';
    case 'read_context_word': return 'Two similar printed words; the lit one is to be read. Do not say it, its parts or any sound in it before the learner does.';
    case 'choose_context_word': return 'The two words the learner read and a sentence with a blank.';
  }
};

export function wordWorkoutScene(item: WordWorkoutItem): WorkspaceScene {
  const facts: Record<string, string> = { printed: coldRead(item) };
  if (item.kind === 'answer_question') facts.question = item.question ?? '';
  if (item.kind === 'choose_context_word') facts.words = (item.contextWords ?? []).join(' or ');
  facts.constraints = item.kind === 'picture_tap'
    ? 'The learner taps a picture; the activity checks the tap and tells you what it was. You cannot tap.'
    : 'The learner answers out loud. The answer is marked on screen only after credit. The hear-again button asks you to repeat the question only.';
  return { objects: [], facts };
}

/** How a picture tap reads to the tutor and the observer: which picture, never the key. */
export const describePictureTap = (word: string) => `Tapped the picture of ${word}.`;

/** What the hear-again button asks the tutor to say: the instruction or question, never the print. */
export const hearQuestionRequest = (item: WordWorkoutItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}" ${coldRead(item)}`;

/** The journey's answers. Picture match answers by tapping, so the journey presses the picture instead. */
export function wordWorkoutJourneyAnswers(item: WordWorkoutItem): { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  const { correct, plainWrong, tapped } = wordWorkoutHarnessAnswers(item);
  return { correct, plainWrong, tapped };
}
