/**
 * Syllable clapper on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C1). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer: the whole word (blend), how many parts (count) or the word left (delete).
 * The tutor voices the stimulus, so the ask carries it; how it is voiced is the pedagogy and
 * inverts between the acts, so the scene states it per item.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, chantOf, syllableClapperHarnessAnswers, type SyllableClapperItem } from './syllableClapperScript';

export function syllableAssignment(item: SyllableClapperItem): TeachingAssignment {
  const expectedAnswer = item.task === 'count_parts'
    ? `${item.answer} (${item.partCount}). Counting the parts out loud is fine when the count lands on ${item.answer}; `
      + 'a count that runs past it does not.'
    : item.task === 'delete_compound'
      ? `${item.answer}, the word left when ${item.removePart} is taken away. The whole word said back is not it.`
      : `${item.word}, said as one joined word. The parts said back one at a time are not yet the word.`;
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer };
}

/** How the stimulus is said: joined on count and delete (a split hands the count over), in parts on blend. */
const voicing = (item: SyllableClapperItem) => item.task === 'blend_syllables'
  ? `Say the parts one at a time with a clear pause between them (${chantOf(item.parts)}); saying them joined `
    + 'is the answer.'
  : `Say ${item.word} as one joined word at a natural pace; breaking it into parts before the learner has tried `
    + (item.task === 'count_parts' ? 'hands over the count.' : 'does the task for them.');

export function syllableScene(item: SyllableClapperItem): WorkspaceScene {
  return { objects: [], facts: {
    act: item.task,
    voicing: voicing(item),
    constraints: 'The learner hears the word from you and answers out loud; nothing on screen shows the word, its '
      + 'parts or the answer until it is credited. Tapping the speaker asks you to say the question again.',
  } };
}

/** What the hear-again button asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: SyllableClapperItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}" ${voicing(item)}`;

/** After credit, a tapped part of the reveal asks for that part only. */
export const hearPartRequest = (part: string) => `The learner tapped a word part. Say only this part, once: "${part}".`;

/** The journey's answers: the pack's own right and plainly wrong answers. */
export function syllableHarnessAnswers(item: SyllableClapperItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = syllableClapperHarnessAnswers(item);
  return { correct, plainWrong };
}
