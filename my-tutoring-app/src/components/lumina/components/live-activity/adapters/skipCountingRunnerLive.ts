import type { SkipCountingRunnerData } from '../../../primitives/visual-primitives/math/SkipCountingRunner';
import { gapsOf, jumpsTo, lineOf, linePositions, nextLanding, openingSpots, workspaceAssignment }
  from '../../../primitives/visual-primitives/math/skipCountingWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['count_along', 'predict', 'fill_missing', 'find_skip_value', 'connect_multiplication'];

/** Reject a lesson whose line or challenges the runner's own check cannot answer. */
export function validateSkipCountingRunnerData(value: unknown): SkipCountingRunnerData {
  const d = value as SkipCountingRunnerData;
  const line = d && { skipValue: d.skipValue, startFrom: d.startFrom ?? 0, endAt: d.endAt, direction: d.direction ?? 'forward' };
  if (!line || !Number.isInteger(line.skipValue) || line.skipValue < 1 || !Number.isFinite(line.endAt)
      || linePositions(line).length < 3) throw new Error('Generated skip counting runner has an invalid number line.');
  return validateChallengePool<SkipCountingRunnerData>(value, c => {
    if (!c || !TYPES.includes(c.type) || typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
    // An item on its own line (find_skip_value) is checked on that line, which must draw three landings.
    const own = c.line;
    if (own && (!Number.isInteger(own.skipValue) || own.skipValue < 1 || linePositions(own).length < 3)) return false;
    const ln = own ?? line;
    const spots = openingSpots(ln, c), at = spots[spots.length - 1];
    switch (c.type) {
      case 'count_along': case 'predict': return nextLanding(ln, at) !== null;
      case 'fill_missing': return gapsOf(c, ln).length > 0;
      case 'find_skip_value': return true;
      case 'connect_multiplication': return jumpsTo(ln, at) >= 1;
      default: return false;
    }
  }, { pool: 'Generated skip counting runner has invalid lesson content.', item: 'A skip-counting challenge cannot be answered as generated.' });
}

/** What the live adapter needs from the runner; the catalog's `teachingWorkspace` declares the rest. */
export const skipCountingRunnerLiveDomain: WorkspaceDomain<SkipCountingRunnerData> = {
  validate: validateSkipCountingRunnerData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0], d.challenges[0]?.line ?? lineOf(d)).task, total: d.challenges.length }),
};
