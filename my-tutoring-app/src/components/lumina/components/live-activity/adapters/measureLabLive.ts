import type { MeasureContainer, MeasureLabChallenge, MeasureLabData } from '../../../primitives/visual-primitives/math/MeasureLab';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['balance_predict', 'capacity_predict', 'pour_count', 'order_capacity'];
const SHAPES = ['tall', 'wide', 'round'];
const containerOk = (c: MeasureContainer | undefined) => !!c && typeof c.id === 'string' && !!c.id && typeof c.name === 'string'
  && SHAPES.includes(c.shape) && Number.isInteger(c.capacity) && c.capacity > 0;

/** Each type needs the material its own check reads, or it mounts unanswerable. */
function answerable(c: MeasureLabChallenge): boolean {
  switch (c.type) {
    case 'balance_predict':
      return !!c.left && !!c.right && c.left.id !== c.right.id && c.left.weight !== c.right.weight
        && (c.expectedChoice === c.left.id || c.expectedChoice === c.right.id);
    case 'capacity_predict':
      return containerOk(c.containerA) && containerOk(c.containerB) && c.containerA!.id !== c.containerB!.id
        && c.containerA!.capacity !== c.containerB!.capacity
        && (c.expectedChoice === c.containerA!.id || c.expectedChoice === c.containerB!.id);
    case 'pour_count':
      return containerOk(c.container) && c.expectedCount === c.container!.capacity
        && Array.isArray(c.options) && c.options.includes(c.expectedCount!);
    default: {
      const ids = (c.containers ?? []).map(j => j?.id);
      return ids.length >= 2 && (c.containers ?? []).every(containerOk) && new Set(ids).size === ids.length
        && (c.expectedOrder ?? []).length === ids.length && (c.expectedOrder ?? []).every(id => ids.includes(id));
    }
  }
}

/** Reject a measuring lesson whose challenges cannot be attempted. */
export function validateMeasureLabData(value: unknown): MeasureLabData {
  const d = value as MeasureLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.prompt !== 'string' || !c.prompt.trim()))
    throw new Error('Generated measure lab has invalid lesson content.');
  for (const c of d.challenges)
    if (!answerable(c)) throw new Error(`A measure-lab ${c.type} challenge cannot be answered as generated.`);
  return d;
}

/** What the live adapter needs from the measure lab; the catalog's `teachingWorkspace` declares the rest. */
export const measureLabLiveDomain: WorkspaceDomain<MeasureLabData> = {
  validate: validateMeasureLabData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].prompt, total: d.challenges.length }),
};
