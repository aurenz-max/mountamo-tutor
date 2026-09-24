/**
 * di-shapes on the shared tutor/JEV teaching workspace (rollout B3), through `DiTeachingStage` like
 * the other spoken DI packs. Every mode is one spoken answer: a shape name, or on the counting modes
 * a number word. Pure: the component and the journey read the same assignment and scene.
 *
 * What the DISTAR script taught that is task structure stays here: the ask never contains the answer,
 * a counting item never names the shape (the name gives the count away), a real-object item names the
 * object but never the shape in it, and a naming item accepts the pack's spoken alternates.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { answerWordFor, countNoun, isCountingType, type DiShapesChallenge } from './diShapesScript';

/** The ask, without the answer in it. */
export const shapesAskFor = (it: DiShapesChallenge): string =>
  it.challengeType === 'name_real_object' && it.realObjectLabel
    ? `What shape do you see in this ${it.realObjectLabel}?`
    : isCountingType(it.challengeType)
      ? `How many ${countNoun(it.challengeType)} does this shape have?`
      : 'What shape is this?';

export function shapesAssignment(it: DiShapesChallenge): TeachingAssignment {
  const answer = answerWordFor(it);
  const also = !isCountingType(it.challengeType) && it.spokenAlternates?.length
    ? ` (also accept ${it.spokenAlternates.join(' or ')})` : '';
  return { id: it.id, task: shapesAskFor(it), response: 'speech', expectedAnswer: `${answer}${also}` };
}

export function shapesScene(it: DiShapesChallenge): WorkspaceScene {
  const counting = isCountingType(it.challengeType);
  return {
    objects: [{ id: 'shape', selected: false, group: 'assignment target',
      label: it.challengeType === 'name_real_object' && it.realObjectLabel ? `the drawn ${it.realObjectLabel}`
        : counting ? `the drawn shape whose ${countNoun(it.challengeType)} the learner counts` : 'the drawn shape' }],
    facts: { kind: it.challengeType, ...(it.supportTier ? { supportTier: it.supportTier } : {}),
      constraints: counting
        ? `The learner says how many ${countNoun(it.challengeType)} aloud. The shape's name is not shown or said: it gives the count away.`
        : 'The learner says the shape name aloud. No name is printed until it is credited.' },
  };
}

/** The journey's answers: the answer word, or a plainly different one. */
export function diShapesHarnessAnswers(it: DiShapesChallenge): { correct: string; plainWrong: string } {
  const correct = answerWordFor(it);
  if (isCountingType(it.challengeType)) return { correct, plainWrong: correct === 'ten' ? 'two' : 'ten' };
  return { correct, plainWrong: correct === 'circle' ? 'square' : 'circle' };
}

/** An item the stage can ask: a drawable shape and an answer word. */
export const shapesChallengeValid = (it: DiShapesChallenge) =>
  !!it && typeof it.shape === 'string' && !!answerWordFor(it).trim()
    && (it.challengeType !== 'name_real_object' || !!it.realObjectId);
