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
import { BUILD_WITNESSES, buildAskFor, buildFacts, type ShapeBuildState } from './diShapesBuild';

/** The ask, without the answer in it. */
export const shapesAskFor = (it: DiShapesChallenge): string =>
  it.challengeType === 'build_shape' ? buildAskFor(it.shape)
  : it.challengeType === 'name_real_object' && it.realObjectLabel
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
    // The documented struggle no name miss covered: a description in place of a name (`model_shape` answers it).
    { id: 'described_shape', pattern: `${fact} The learner's answer describes the drawing (round, pointy, a colour or a size word) and names no shape.`,
      examples: ['it is round', 'the pointy one'] },
  ];
}

export function shapesAssignment(it: DiShapesChallenge): TeachingAssignment {
  // The open build: the board checks the made shape; its misses come from that check, not from words.
  if (it.challengeType === 'build_shape') return { id: it.id, task: shapesAskFor(it), response: 'gesture' };
  const answer = answerWordFor(it);
  const also = !isCountingType(it.challengeType) && it.spokenAlternates?.length
    ? ` (also accept ${it.spokenAlternates.join(' or ')})` : '';
  const misses = shapesSpokenMisses(it);
  return { id: it.id, task: shapesAskFor(it), response: 'speech', expectedAnswer: `${answer}${also}`, ...(misses.length ? { misses } : {}) };
}

/**
 * build_shape: the made shape's own numbers, measured by the board, for the tutor and the work history. The ask
 * names the shape (it is the task); the facts never say whether the made shape is one.
 */
function buildScene(it: DiShapesChallenge, build: ShapeBuildState): WorkspaceScene {
  return {
    objects: [{ id: 'shape', selected: false, group: 'assignment target', label: "the learner's own shape on the dot grid" }],
    facts: { kind: it.challengeType,
      howToBuild: 'tap dots to place corners; tap the first corner to close the shape; tap a corner to take it out',
      ...buildFacts(build),
      shapeFacts: "the numbers above are the learner's own shape as it is now, measured by the board",
      support: it.supportTier === 'hard' ? 'the learner builds cold: model nothing before they try'
        : 'the learner builds first; after a miss, pull a lever. A model is a DIFFERENT shape, never this one',
      constraints: 'The learner makes the named shape on the dots and presses "I\'m done!"; the board checks it. You '
        + 'cannot place, move or take out a corner. Never say how many sides or corners the asked shape has, or what '
        + 'the learner\'s shape is short of: knowing that IS the task.' },
  };
}

export function shapesScene(it: DiShapesChallenge, build?: ShapeBuildState): WorkspaceScene {
  if (it.challengeType === 'build_shape') return buildScene(it, build ?? { points: [], closed: false });
  const counting = isCountingType(it.challengeType);
  return {
    objects: [{ id: 'shape', selected: false, group: 'assignment target',
      label: it.challengeType === 'name_real_object' && it.realObjectLabel ? `the drawn ${it.realObjectLabel}`
        : counting ? `the drawn shape whose ${countNoun(it.challengeType)} the learner counts` : 'the drawn shape' }],
    facts: { kind: it.challengeType,
      // DI's model is a PARALLEL shape, never this one (user ruling 2026-10-02): easy (or no tier) pulls the model
      // card before the learner tries, medium only after a miss, hard never first.
      support: it.supportTier === 'hard' ? 'answer it cold: model nothing before the learner answers, and never say this answer'
        : it.supportTier === 'medium' ? 'the learner tries first; after a miss, model a different shape with the model lever, never this one'
          : 'before the learner tries, pull the model lever (a card of a different shape): say it as your turn, then ask about this one. Never model this one',
      constraints: counting
        ? `The learner says how many ${countNoun(it.challengeType)} aloud. The shape's name is not shown or said: it gives the count away.`
        : 'The learner says the shape name aloud. No name is printed until it is credited.' },
  };
}

/** The journey's answers: the answer word, or a plainly different one. */
export function diShapesHarnessAnswers(it: DiShapesChallenge): { correct: string; plainWrong: string } {
  if (it.challengeType === 'build_shape') return { correct: '', plainWrong: '' };
  const correct = answerWordFor(it);
  if (isCountingType(it.challengeType)) return { correct, plainWrong: correct === 'ten' ? 'two' : 'ten' };
  return { correct, plainWrong: correct === 'circle' ? 'square' : 'circle' };
}

/** An item the stage can ask: a drawable shape and an answer word. */
export const shapesChallengeValid = (it: DiShapesChallenge) =>
  !!it && typeof it.shape === 'string' && !!answerWordFor(it).trim()
    && (it.challengeType !== 'name_real_object' || !!it.realObjectId)
    && (it.challengeType !== 'build_shape' || !!BUILD_WITNESSES[it.shape]);
