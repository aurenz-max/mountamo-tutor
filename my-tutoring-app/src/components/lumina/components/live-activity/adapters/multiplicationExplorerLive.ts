import type { MultiplicationExplorerData } from '../../../primitives/visual-primitives/math/MultiplicationExplorer';
import { askFor, resolveChallengeFact } from '../../../primitives/visual-primitives/math/multiplicationExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'];
const factor = (n: unknown) => Number.isInteger(n) && (n as number) >= 1;

/** Reject a multiplication lesson whose challenges cannot be attempted. */
export function validateMultiplicationExplorerData(value: unknown): MultiplicationExplorerData {
  const d = value as MultiplicationExplorerData;
  if (!d || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)))
    throw new Error('Generated multiplication explorer has invalid lesson content.');
  // Each challenge needs a fact its check can read, and a missing factor must hide a factor.
  for (const c of d.challenges) {
    const f = resolveChallengeFact(c, d.fact ?? { factor1: NaN, factor2: NaN, product: NaN });
    if (!factor(f.factor1) || !factor(f.factor2)
        || (c.type === 'missing_factor' && c.hiddenValue !== 'factor1' && c.hiddenValue !== 'factor2'))
      throw new Error(`A multiplication-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the multiplication explorer; the catalog's `teachingWorkspace` declares the rest. */
export const multiplicationExplorerLiveDomain: WorkspaceDomain<MultiplicationExplorerData> = {
  validate: validateMultiplicationExplorerData,
  initialState: d => workspaceOpening({ title: d.title || 'Multiplication Explorer',
    task: askFor(d.challenges[0], resolveChallengeFact(d.challenges[0], d.fact)), total: d.challenges.length }),
};
