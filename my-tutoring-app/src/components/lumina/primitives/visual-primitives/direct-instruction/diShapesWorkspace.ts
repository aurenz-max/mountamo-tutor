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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { NEAR_SHAPE, flatShapeNameMisses, shapeCountMisses } from '../math/shapeSorterDomain';
import { answerWordFor, countNoun, isCountingType, type DiShapeName, type DiShapesChallenge } from './diShapesScript';

/** The ask, without the answer in it. */
export const shapesAskFor = (it: DiShapesChallenge): string =>
  it.challengeType === 'name_real_object' && it.realObjectLabel
    ? `What shape do you see in this ${it.realObjectLabel}?`
    : isCountingType(it.challengeType)
      ? `How many ${countNoun(it.challengeType)} does this shape have?`
      : 'What shape is this?';

const DRAWABLE: readonly DiShapeName[] = ['circle', 'triangle', 'square', 'rectangle', 'hexagon', 'oval', 'pentagon', 'rhombus', 'trapezoid'];

/**
 * A drawn shape's known wrong answers, in precedence order, for the `spoken_miss` observer, with shape-sorter's
 * ids (`SpokenShapeMiss`): the object's name, the look-alike name, another name; on a count its name, then off-by.
 */
export function shapesSpokenMisses(it: DiShapesChallenge): KnownMiss[] {
  if (isCountingType(it.challengeType)) {
    return it.countNumeral ? shapeCountMisses(it.shapeWord, it.countNumeral, countNoun(it.challengeType)) : [];
  }
  const object = it.challengeType === 'name_real_object' ? it.realObjectLabel : undefined;
  const fact = object ? `The ${object} is drawn as ${it.article} ${it.shapeWord}.` : `The shape drawn is ${it.article} ${it.shapeWord}.`;
  return [
    ...(object ? [{ id: 'said_object', pattern: `${fact} The learner's answer is ${object}, the object's own name, not a shape name.`, examples: [object] }] : []),
    ...flatShapeNameMisses(it.shapeWord, it.spokenAlternates ?? [], NEAR_SHAPE[it.shapeWord], DRAWABLE, fact),
  ];
}

export function shapesAssignment(it: DiShapesChallenge): TeachingAssignment {
  const answer = answerWordFor(it);
  const also = !isCountingType(it.challengeType) && it.spokenAlternates?.length
    ? ` (also accept ${it.spokenAlternates.join(' or ')})` : '';
  const misses = shapesSpokenMisses(it);
  return { id: it.id, task: shapesAskFor(it), response: 'speech', expectedAnswer: `${answer}${also}`, ...(misses.length ? { misses } : {}) };
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
