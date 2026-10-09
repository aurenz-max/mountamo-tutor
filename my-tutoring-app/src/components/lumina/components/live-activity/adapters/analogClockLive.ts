import type { AnalogClockData } from '../../../primitives/visual-primitives/math/AnalogClock';
import { clockOptions } from '../../../primitives/visual-primitives/math/analogClockWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['read', 'set_time', 'match', 'elapsed', 'hand_name', 'count_face', 'hear_time'];
const CHOICE_TYPES = ['read', 'match', 'elapsed', 'hear_time'];
const hourOk = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 12;
const minuteOk = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 59;

/** Reject a clock lesson whose challenges cannot be attempted. */
export function validateAnalogClockData(value: unknown): AnalogClockData {
  const d = value as AnalogClockData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !hourOk(c.targetHour) || !minuteOk(c.targetMinute)))
    throw new Error('Generated analog clock has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const n = clockOptions(c).length;
    const ok = CHOICE_TYPES.includes(c.type)
      ? n >= 2 && Number.isInteger(c.correctOptionIndex) && c.correctOptionIndex! >= 0 && c.correctOptionIndex! < n
      : c.type === 'hand_name' ? c.targetHand === 'hour' || c.targetHand === 'minute'
      : true;
    if (!ok) throw new Error(`An analog-clock ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the analog clock; the catalog's `teachingWorkspace` declares the rest. */
export const analogClockLiveDomain: WorkspaceDomain<AnalogClockData> = {
  validate: validateAnalogClockData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
