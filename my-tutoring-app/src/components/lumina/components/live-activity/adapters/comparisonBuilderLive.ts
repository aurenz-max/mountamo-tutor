import type { ComparisonBuilderData } from '../../../primitives/visual-primitives/math/ComparisonBuilder';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['compare-groups', 'compare-numbers', 'order', 'one-more-one-less'];

/** Reject a comparison whose challenges cannot be attempted. */
export function validateComparisonBuilderData(value: unknown): ComparisonBuilderData {
  const d = value as ComparisonBuilderData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated comparison builder has invalid lesson content.');
  // Each type needs the material its own ask is built from, or it mounts unanswerable.
  for (const c of d.challenges) {
    const ok = c.type === 'compare-groups'
        ? Number.isInteger(c.leftGroup?.count) && Number.isInteger(c.rightGroup?.count)
          && ['more', 'less', 'equal'].includes(c.correctAnswer ?? '')
      : c.type === 'compare-numbers'
        ? Number.isInteger(c.leftNumber) && Number.isInteger(c.rightNumber)
          && ['<', '>', '='].includes(c.correctSymbol ?? '')
      : c.type === 'order'
        ? Array.isArray(c.numbers) && c.numbers.length >= 3 && c.numbers.every(Number.isInteger)
          && new Set(c.numbers).size === c.numbers.length
      : Number.isInteger(c.targetNumber) && ['one-more', 'one-less', 'both'].includes(c.askFor ?? '');
    if (!ok) throw new Error('A comparison-builder challenge cannot be answered as generated.');
  }
  return d;
}

/** What the live adapter needs from the comparison builder; the catalog's `teachingWorkspace` declares the rest. */
export const comparisonBuilderLiveDomain: WorkspaceDomain<ComparisonBuilderData> = {
  validate: validateComparisonBuilderData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
