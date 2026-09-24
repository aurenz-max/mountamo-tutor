/**
 * Picture vocabulary on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C2). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Receptive match is
 * a gesture: the tutor says the word and the learner taps its picture, checked by the activity.
 * Every other mode is one spoken word: the picture's name, the opposite, something that goes
 * with it (an open set), the missing scale rung, or the word that finishes the sentence.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, pictureVocabularyHarnessAnswers, scaleSpokenFor, type PictureVocabItem } from './pictureVocabularyScript';

function expectedFor(item: PictureVocabItem): string {
  switch (item.kind) {
    case 'naming': return `${item.word}, the name of the picture. "A thing" or another category word is not it.`;
    case 'opposite': return `${item.word}, the opposite of ${item.baseWord}. ${item.baseWord} said back is not it.`;
    case 'association':
      return `Any everyday thing that plainly goes with ${item.baseWord}, for example ${item.word}. `
        + `${item.baseWord} said back or a made-up word is not it.`;
    case 'gradable_scale': return `${item.word}, the missing word in the scale.`;
    case 'sentence_frame': return `${item.word}, the word that finishes the sentence.`;
    default: return '';
  }
}

export function pictureVocabAssignment(item: PictureVocabItem): TeachingAssignment {
  // Receptive match is checked by the activity: its key never reaches the tutor as an expected answer.
  if (item.answerKind === 'gesture') return { id: item.id, task: askFor(item), response: 'gesture' };
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: expectedFor(item) };
}

const shown = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'receptive_match': return 'Four picture cards with no words. The learner taps one; the activity checks the tap and tells you what was tapped.';
    case 'naming': return 'The picture only; its word appears after credit. Do not name the picture before the learner tries.';
    case 'opposite': return `The word ${item.baseWord} and its picture, beside an empty slot for the opposite.`;
    case 'association': return `The word ${item.baseWord} and its picture. Many answers are right; the screen names none of them.`;
    case 'gradable_scale': return `The scale with one word hidden: ${scaleSpokenFor(item)}.`;
    case 'sentence_frame': return 'The sentence with a blank; the picture of the missing word appears only after credit.';
  }
};

export function pictureVocabScene(item: PictureVocabItem): WorkspaceScene {
  return { objects: [], facts: {
    shown: shown(item),
    constraints: item.answerKind === 'gesture'
      ? 'The learner answers by tapping a picture. You cannot tap.'
      : 'The learner answers out loud. Tapping the card asks you to say the question again.',
  } };
}

/** How a card tap reads to the tutor and the observer: which picture, never the key. */
export const describeCardTap = (word: string) => `Tapped the picture of ${word}.`;

/** What hear-again asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: PictureVocabItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}"`;

/** The journey's answers: a spoken answer, or for receptive match the right and a wrong card. */
export function pictureVocabJourneyAnswers(item: PictureVocabItem): { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  const { correct, plainWrong, tapped } = pictureVocabularyHarnessAnswers(item);
  return { correct, plainWrong, tapped };
}
