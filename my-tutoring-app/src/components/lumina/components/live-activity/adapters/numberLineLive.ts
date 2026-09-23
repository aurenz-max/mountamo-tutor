import type { NumberLineData } from '../../../primitives/visual-primitives/math/NumberLine';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';


/** Validate the renderer contract at the service boundary, including jump arithmetic. */
export function validateActivityData(value: unknown): NumberLineData {
  const d = value as NumberLineData | null;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!d || typeof d.title !== 'string' || !d.range || !finite(d.range.min) || !finite(d.range.max)
      || d.range.min >= d.range.max || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > 12) throw new Error('Generated number line has no valid challenges or range');
  const inRange = (v: unknown) => finite(v) && v >= d.range.min && v <= d.range.max;
  for (const c of d.challenges) {
    if (!c || typeof c.id !== 'string' || typeof c.instruction !== 'string' || typeof c.hint !== 'string'
        || !['plot_point', 'show_jump', 'order_values', 'find_between'].includes(c.type)
        || !Array.isArray(c.targetValues) || !c.targetValues.length || !c.targetValues.every(inRange))
      throw new Error('Generated number line has an invalid challenge');
    if (c.exactTargetValue !== undefined && !inRange(c.exactTargetValue)) throw new Error('Invalid missing value');
    if (c.type === 'show_jump') {
      if (!inRange(c.startValue) || !Array.isArray(c.operations) || !c.operations.length) throw new Error('Missing jump operations');
      let landing = c.startValue!;
      for (const [index, op] of Array.from(c.operations.entries())) {
        if (!op || !['add', 'subtract'].includes(op.type) || !finite(op.changeValue) || op.changeValue < 0
            || !finite(op.startValue) || Math.abs(op.startValue - landing) > 0.0001) throw new Error('Invalid jump operation');
        landing += op.type === 'add' ? op.changeValue : -op.changeValue;
        if (!inRange(landing)) throw new Error('Jump leaves the number line');
        if (Math.abs(landing - c.targetValues[index]) > 0.0001) throw new Error('Jump answer does not match its operations');
      }
      if (c.targetValues.length !== c.operations.length) throw new Error('Missing jump answer');
    }
  }
  return d;
}

export function initialActivityState(data: NumberLineData) {
  const first = data.challenges![0];
  return {
    ...data, rangeMin: data.range.min, rangeMax: data.range.max,
    visibleMin: data.range.min, visibleMax: data.range.max,
    numberType: data.numberType ?? 'integer', interactionMode: data.interactionMode ?? 'plot',
    gradeBand: data.gradeBand ?? 'K-2', totalChallenges: data.challenges!.length,
    currentChallengeIndex: 0, instruction: first.instruction, challengeType: first.type,
    targetValues: first.targetValues, exactTargetValue: first.exactTargetValue,
    placedPoints: [], jumpEndPoints: [], orderedPlacements: [], attemptNumber: 1, zoomLevel: 1,
    currentPhase: first.type === 'show_jump' ? 'operate' : first.type === 'order_values' ? 'compare' : 'plot',
    supportTier: data.supportTier ?? 'easy',
  };
}

/** What the live adapter needs from the number line; the catalog's `teachingWorkspace` declares the rest. */
export const numberLineLiveDomain: WorkspaceDomain<NumberLineData> = {
  validate: validateActivityData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges![0].instruction, total: d.challenges!.length }),
};
