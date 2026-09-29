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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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
  const misses = pictureVocabSpokenMisses(item);
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: expectedFor(item), ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken answer shows (handoff 20 Part B; opposite, association, scale and frame handoff 24). */
export type SpokenPictureVocabMiss = 'category_word' | 'other_thing' | 'said_base_word' | 'not_opposite' | 'no_link'
  | 'given_rung' | 'off_scale' | 'does_not_fit';

/** Per spoken mode, the misses its answers can show, in precedence order. */
export const PICTURE_VOCAB_SPOKEN_MISSES = {
  naming: ['category_word', 'other_thing'],
  opposite: ['said_base_word', 'not_opposite'],
  association: ['said_base_word', 'no_link'],
  gradable_scale: ['given_rung', 'off_scale'],
  sentence_frame: ['does_not_fit'],
} as const satisfies Record<string, readonly SpokenPictureVocabMiss[]>;

/** A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer. */
export function pictureVocabSpokenMisses(item: PictureVocabItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const w = item.word, base = item.baseWord ?? '';
  switch (item.kind) {
    case 'opposite': return [
      { id: 'said_base_word', pattern: `The word shown is "${base}". The learner says "${base}" back, or a word that means the same, instead of its opposite.`, examples: [base] },
      { id: 'not_opposite', pattern: `The opposite of "${base}" is "${w}". The learner says a word that is neither "${w}" nor another word for it, and not "${base}".`, examples: [] },
    ];
    case 'association': return [
      { id: 'said_base_word', pattern: `The word shown is "${base}". The learner says "${base}" back instead of something that goes with it.`, examples: [base] },
      { id: 'no_link', pattern: `The learner names a real thing that does not plainly go with "${base}" (used with it, found with it, or part of it).`, examples: [] },
    ];
    case 'gradable_scale': {
      const given = (item.scaleWords ?? []).filter((_, i) => i !== item.scaleTargetIndex);
      return [
        { id: 'given_rung', pattern: `The scale already shows ${given.map(g => `"${g}"`).join(' and ')}. The learner says one of those words instead of the missing one.`, examples: given },
        { id: 'off_scale', pattern: `The missing word is "${w}". The learner says a word that does not fit between the words around the gap, such as one that is not about the same quality or is too far along the scale.`, examples: [] },
      ];
    }
    case 'sentence_frame': return [
      { id: 'does_not_fit', pattern: `The sentence is "${item.frameDisplay ?? ''}". The learner says a word that does not make sense in the blank.`, examples: [] },
    ];
    case 'naming': break;
    default: return [];
  }
  const other = w.toLowerCase() === 'button' ? 'ladder' : 'button';
  return [
    { id: 'category_word', pattern: `The picture shows a ${w}. The learner's answer is a word for a whole group of things, such as "a thing", "stuff" or "toys", not the name ${w} or another name for it.`,
      examples: ['a thing', 'stuff'] },
    { id: 'other_thing', pattern: `The picture shows a ${w}. The learner's answer names a different object, such as "${other}", that is not a ${w} and not another name for a ${w}.`,
      examples: [other] },
  ];
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
