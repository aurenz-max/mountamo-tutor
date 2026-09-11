import {
  buildDiModePlan, challengeTypeDocsFromDiModes, defineDiMode, defineDiModes,
  evalModeDefinitionsFromDiModes, type DiModeItem,
} from '../../../hooks/diModeContract';

export type DiShapesChallengeType =
  | 'name_shape' | 'name_real_object' | 'shape_review' | 'count_sides' | 'count_corners';

export interface ShapesModePlanItem extends DiModeItem {
  challengeType: DiShapesChallengeType;
  realObjectLabel?: string;
}

const isCounting = (type: DiShapesChallengeType) => type === 'count_sides' || type === 'count_corners';
const instructionFor = (item: ShapesModePlanItem): string => {
  if (item.challengeType === 'name_real_object' && item.realObjectLabel) {
    return `Your turn. What shape do you see in this ${item.realObjectLabel}?`;
  }
  if (isCounting(item.challengeType)) {
    return `Your turn. How many ${item.challengeType === 'count_sides' ? 'sides' : 'corners'} does this shape have?`;
  }
  return 'Your turn. What shape is this?';
};

const mode = defineDiMode<ShapesModePlanItem>();
const step = {
  id: 'answer', actionId: (item: ShapesModePlanItem) => `${item.id}-answer`,
  label: (item: ShapesModePlanItem) => item.challengeType === 'count_sides'
    ? 'Count the sides'
    : item.challengeType === 'count_corners'
      ? 'Count the corners'
      : 'Name the shape',
  icon: '🔷', answerKind: 'voice' as const, instruction: instructionFor,
  checkingInstruction: 'Listening to your shape answer.',
};
const responseClassFor = (item: ShapesModePlanItem) =>
  isCounting(item.challengeType) ? 'number_word_to_20' as const : 'shape_name' as const;

export const DI_SHAPES_MODES = defineDiModes<ShapesModePlanItem>(
  mode({
    evalMode: 'name_shape', label: 'Name the Shape', beta: 1.5, scaffoldingMode: 1,
    challengeTypes: ['name_shape'],
    description: 'See one drawn 2D shape at any rotation, say its name aloud — modeled and practiced together first, then answered alone.',
    challengeDocs: { name_shape: {
      promptDoc: '"name_shape": the child sees ONE drawn flat shape at some rotation and SAYS ITS NAME. The base skill, drilled over the objective\'s focused set.',
      schemaDescription: "'name_shape' (say the drawn shape's name)",
    } }, responseClass: responseClassFor, answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'shape_review', label: 'Shape Review (Mixed Set)', beta: 2.5, scaffoldingMode: 2,
    challengeTypes: ['shape_review'],
    description: 'Cumulative / spaced review of shape naming — the same act, but the shapes are drawn as a WIDE mix across everything taught at this grade rather than the objective\'s one focused set.',
    challengeDocs: { shape_review: {
      promptDoc: '"shape_review": cumulative / spaced review of shape NAMING over a WIDE mix across everything taught at this grade.',
      schemaDescription: "'shape_review' (mixed cumulative naming review)",
    } }, responseClass: responseClassFor, answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'find_real_object', label: 'Find Shape in an Object', beta: 3.0, scaffoldingMode: 2,
    challengeTypes: ['name_real_object'],
    description: 'See one familiar code-drawn object, then say the 2D shape in its outline. The printed object label never contains a shape word.',
    challengeDocs: { name_real_object: {
      promptDoc: '"name_real_object": the child sees ONE familiar code-drawn object and SAYS the 2D shape of its outline. Code owns every answer.',
      schemaDescription: "'name_real_object' (say the 2D shape seen in a familiar object)",
    } }, responseClass: responseClassFor, answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'count_sides', label: 'How Many Sides', beta: 3.0, scaffoldingMode: 3,
    challengeTypes: ['count_sides'],
    description: 'See one drawn 2D shape, say how many SIDES it has as a number word. An attribute skill rather than a naming one; counting aloud and landing on the right number is a correct route. Straight-sided shapes only.',
    challengeDocs: { count_sides: {
      promptDoc: '"count_sides": the child sees ONE drawn flat shape and SAYS HOW MANY SIDES it has. Straight-sided shapes only.',
      schemaDescription: "'count_sides' (say how many sides)",
    } }, responseClass: responseClassFor, answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
  mode({
    evalMode: 'count_corners', label: 'How Many Corners', beta: 3.5, scaffoldingMode: 3,
    challengeTypes: ['count_corners'],
    description: 'See one drawn 2D shape, say how many CORNERS (vertices) it has as a number word. Harder than sides — a corner is a point, easier to skip or double-count than a whole edge. Straight-sided shapes only.',
    challengeDocs: { count_corners: {
      promptDoc: '"count_corners": the child sees ONE drawn flat shape and SAYS HOW MANY CORNERS it has. Straight-sided shapes only.',
      schemaDescription: "'count_corners' (say how many corners)",
    } }, responseClass: responseClassFor, answerStepId: 'answer', groupingKey: (i) => i.challengeType, steps: [step],
  }),
);

export const DI_SHAPES_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_SHAPES_MODES);
export const DI_SHAPES_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_SHAPES_MODES);
export const DI_SHAPES_CHALLENGE_TYPES = DI_SHAPES_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as DiShapesChallengeType[];
export const diShapesModePlan = (item: ShapesModePlanItem) => buildDiModePlan(DI_SHAPES_MODES, item);
