import type { ShapeSorterData } from '../../../primitives/visual-primitives/math/ShapeSorter';
import { askFor, itemsFromChallenges, SHAPE_PROPERTIES, SHAPE_SORTER_WORKSPACE_MODES, type ShapeSorterChallengeType }
  from '../../../primitives/visual-primitives/math/shapeSorterDomain';
import { realWorldShapeObjectById } from '../../../primitives/visual-primitives/shared/realWorldShapeObjects';
import { workspaceGuidance, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

const shapeItems = (d: ShapeSorterData) =>
  itemsFromChallenges(d.challenges, { isPreReader: (d.gradeBand ?? 'K') === 'K' });

const VALID_TYPES: readonly ShapeSorterChallengeType[] = ['identify', 'identify-real-object', 'count', 'sort'];

/** Reject a pool whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateShapeSorterData(value: unknown): ShapeSorterData {
  const d = value as ShapeSorterData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? 'K')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || !VALID_TYPES.includes(c.type) || !Array.isArray(c.shapes) || !c.shapes.length
        || c.shapes.some(s => !s || !Object.hasOwn(SHAPE_PROPERTIES, s.shape) || !['small', 'medium', 'large'].includes(s.size)
          || typeof s.color !== 'string' || !Number.isFinite(s.rotation) || s.emoji
          || (c.type === 'identify-real-object'
            ? (!s.realObjectId || !realWorldShapeObjectById(s.realObjectId))
            : (!!s.realObjectId || !!s.realObject)))))
    throw new Error('Generated shape sorter has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so
  // an empty build means this lesson would mount with nothing to ask.
  if (!shapeItems(d).length) throw new Error('A shape-sorter challenge cannot run in the naming workspace.');
  return d;
}

function shapeSorterState(data: ShapeSorterData) {
  const items = shapeItems(data);
  return { title: data.title, instruction: askFor(items[0]),
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
    lessons: [['identify', 'Name the shape'], ['find_real_object', 'Find the shape in an object'],
      ['count', 'Count the sides or corners'], ['sort', 'Sort into a group']],
  },
  lessonStart: workspaceLessonStart('shape', 'shape-sorter'),
  // Teaching ownership, spoken verdicts, crediting, help and progression come from
  // WORKSPACE_DOCTRINE (adapterContract.ts); this names only the sorter's own facts.
  guidance: workspaceGuidance('The gold ring (or the single object shown) fixes the assignment across every mode. Under identify, '
    + 'accept its listed alternate names and equivalents in other languages; a color or side count is useful progress but not the '
    + 'naming answer. Under find_real_object, the object\'s own name is never the answer — accept only the 2D shape its outline is '
    + 'drawn as. Under count, accept counting aloud that lands on the right total; a shape name, or a count one more or one less, '
    + 'is wrong, and sides and corners are asked separately, never both at once. Under sort, the printed mats are the groups the '
    + 'learner names; the shape\'s own name is not a group. '
    + 'Use demonstrate with visible shape or mat IDs to draw purple dashed tutor rings for comparison; [] clears them. Those marks '
    + 'never change the gold-ringed assignment or move a shape onto a mat. You cannot move, rotate, count, or sort a shape for the learner.'),
  validate: validateShapeSorterData,
  initialState: shapeSorterState,
};
