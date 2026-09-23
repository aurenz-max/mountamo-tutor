import type { ShapeSorterData } from '../../../primitives/visual-primitives/math/ShapeSorter';
import { askFor, itemsFromChallenges, SHAPE_PROPERTIES, type ShapeSorterChallengeType }
  from '../../../primitives/visual-primitives/math/shapeSorterDomain';
import { realWorldShapeObjectById } from '../../../primitives/visual-primitives/shared/realWorldShapeObjects';
import { type WorkspaceDomain } from './adapterContract';

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

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const shapeSorterLiveDomain: WorkspaceDomain<ShapeSorterData> = { validate: validateShapeSorterData, initialState: shapeSorterState };

