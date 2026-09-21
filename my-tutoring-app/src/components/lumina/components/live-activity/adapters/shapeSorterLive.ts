import type { ShapeSorterData } from '../../../primitives/visual-primitives/math/ShapeSorter';
import { itemsFromChallenges, SHAPE_PROPERTIES, SHAPE_SORTER_WORKSPACE_MODES }
  from '../../../primitives/visual-primitives/math/shapeSorterDomain';
import { type LiveActivityAdapter } from './adapterContract';

const shapeItems = (d: ShapeSorterData) =>
  itemsFromChallenges(d.challenges, { isPreReader: (d.gradeBand ?? 'K') === 'K' });

/** Reject a pool whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateShapeSorterData(value: unknown): ShapeSorterData {
  const d = value as ShapeSorterData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? 'K')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || c.type !== 'identify' || !Array.isArray(c.shapes) || !c.shapes.length
        || c.shapes.some(s => !s || !Object.hasOwn(SHAPE_PROPERTIES, s.shape) || !['small', 'medium', 'large'].includes(s.size)
          || typeof s.color !== 'string' || !Number.isFinite(s.rotation) || s.realObjectId || s.realObject || s.emoji)))
    throw new Error('Generated shape sorter has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so
  // an empty build means this lesson would mount with nothing to ask.
  if (!shapeItems(d).length) throw new Error('A shape-sorter challenge cannot run in the naming workspace.');
  return d;
}

function shapeSorterState(data: ShapeSorterData) {
  const items = shapeItems(data);
  return { title: data.title, instruction: 'Name the shape inside the gold ring. What shape is it?',
    teachingOwner: 'tutor', totalChallenges: items.length,
    interaction: 'Teach from the current assignment and workspace. Judge spoken answers naturally; the host observes feedback and handles progression.' };
}

export const shapeSorterLive: LiveActivityAdapter<ShapeSorterData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  modes: SHAPE_SORTER_WORKSPACE_MODES,
  bindsTeachingWorkspace: true,
  canAdvance: false,
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Shape Sorter', checkbox: 'Shape sorter', title: 'Learn with Shapes',
    lessons: [['identify', 'Name the shape']],
  },
  lessonStart: (grade, mode) => `[LESSON_START] Begin a shape naming lesson for ${grade}. Call request_activity with primitiveId shape-sorter and mode ${mode}. After mounting, teach from the current workspace.`,
  guidance: 'You own the teaching conversation. The gold ring fixes which shape the learner must name. '
    + 'Judge the spoken name against the assignment, accepting its listed alternative names and equivalent names in other languages. '
    + 'A color, side count, or corner count can be useful intermediate progress but does not complete the naming assignment. '
    + 'Use begin_help before guiding questions or explanations. Use demonstrate with visible shape IDs to draw purple dashed tutor rings for comparison; [] clears them. '
    + 'When asked to show what you mean, execute demonstrate on the shape you are discussing and wait for its visible result before claiming it is marked. '
    + 'Those marks never change the gold-ringed assignment and are not learner responses. You cannot move, rotate, or sort shapes. '
    + 'Teach one step at a time and let the learner try. Speak feedback naturally; the host records the verdict and handles retry/advance after speech settles. '
    + 'When the name is right, say so and name the shape back in the same breath, in your own words; praise that '
    + 'names no shape is generic and credits nothing. '
    + 'Do not call recording/progression tools or replace an unfinished activity. No correction cap or exact correction wording.',
  validate: validateShapeSorterData,
  initialState: shapeSorterState,
};
