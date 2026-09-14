import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';

export type NumberLineRemediationMove = 'contrast_start_positions';

export interface JumpTuple {
  startValue: number;
  opType: 'add' | 'subtract';
  change: number;
  targetValue: number;
}

// Describes the executable jump task, not diagnosis wording or a source primitive.
export const numberLineTeaching: TeachingCapability<NumberLineRemediationMove> = {
  activity: 'number-line',
  task: 'Show one addition or subtraction as movement on a whole-number line: the start number is marked, the learner hops the stated number of spaces right to add or left to subtract, with no drawn arc, and places the landing point. A hop is the space between neighbouring ticks. Only the landing point is placed and recorded. Does not ask the learner to order, compare, or place fractions.',
  moves: [{
    id: 'contrast_start_positions',
    description: 'Pair two jump challenges with the same hop count and direction: one anchored at zero (adding from zero, or subtracting down to zero), where the landing or the start equals the hop count, and one from a nonzero start. Treating the start tick as the first hop puts both landings one space short, and at zero that landing visibly disagrees with the hop count. Holds hop count and direction within the pair and changes where one challenge starts. Does not teach number facts, place value, skip counting, or estimating a position.',
  }],
};

/** Content constraints only; never interprets an observation. Named numeric
 *  anchors (an equation or a named start) outrank adaptation. A range bound
 *  such as "within 20" is scope, which the generator's range resolver owns. */
export function eligibleNumberLineTeaching(task: AdaptationTask): boolean {
  const text = [task.topic, task.intent].filter(Boolean).join(' ');
  return ['1', '2'].includes(task.grade ?? '') && task.mode === 'jump' && task.tier === 'medium'
    // "8 + 3", "15 - 3", "8 plus 3", "from 8" name a problem; "0-20" is a range.
    && !/\d+\s*[+−]\s*\d+|\d+\s+[-–]\s*\d+|\d+\s+(?:plus|minus)\s+\d+|\b(?:from|at)\s+\d+\b/i.test(text);
}

// Reviewed 2026-09-13 against the published Grade 1 curriculum
// (dcf2787a…@2026-04-02): count on within 20 and count back within 20, both
// authored for number-line. Their examples illustrate the range; the generator
// has never pinned them as targets.
const REVIEWED_SUBSKILLS = new Set(['OPS001-03-a', 'OPS001-04-a']);

/** Delivery gate on the manifest config: a reviewed Grade 1 jump objective
 *  at the tier where the move is executable. */
export function numberLineDeliveryEligible(config: Record<string, unknown>): boolean {
  return config.objectiveGrade === '1' && typeof config.skillId === 'string' && REVIEWED_SUBSKILLS.has(String(config.subskillId))
    && config.targetEvalMode === 'jump' && config.difficulty === 'medium';
}

const landingOf = (t: Pick<JumpTuple, 'startValue' | 'opType' | 'change'>) =>
  t.opType === 'add' ? t.startValue + t.change : t.startValue - t.change;
const touchesZero = (t: JumpTuple) => (t.opType === 'add' ? t.startValue : t.targetValue) === 0;
const tupleKey = (t: JumpTuple) => `${t.startValue}|${t.opType}|${t.change}`;

/** The contrast as the component will present it: two single jumps with equal
 *  hop count and direction, exactly one anchored at zero, both recomputable. */
export function compiledStartContrast(tuples: readonly JumpTuple[]) {
  for (let i = 0; i < tuples.length; i++) for (let j = i + 1; j < tuples.length; j++) {
    const [a, b] = [tuples[i], tuples[j]];
    if (a.opType !== b.opType || a.change !== b.change || touchesZero(a) === touchesZero(b)) continue;
    if (landingOf(a) !== a.targetValue || landingOf(b) !== b.targetValue) continue;
    return { targets: [i, j], count: 2 };
  }
  return { targets: [] as number[], count: 0 };
}

export type StartContrastStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';

/** Replace at most one tuple with the zero-anchored twin of another. Count,
 *  the other challenges, the band's jump sizes, range, and uniqueness hold.
 *  Adjacent pairs with the zero-anchored challenge first are preferred. */
export function selectStartContrast(
  baseline: readonly JumpTuple[], move: NumberLineRemediationMove | null,
  range: { min: number; max: number }, jumpChoices: readonly number[],
) {
  const result = (tuples: readonly JumpTuple[], status: StartContrastStatus) =>
    ({ tuples, status, ...compiledStartContrast(tuples) });
  if (!move) return result(baseline, 'no-focus');
  if (compiledStartContrast(baseline).count === 2) return result(baseline, 'already-targeted');
  const n = baseline.length;
  const pairs: Array<[number, number]> = [];
  for (let b = 1; b < n; b++) pairs.push([b - 1, b]);
  for (let b = 0; b < n - 1; b++) pairs.push([b + 1, b]);
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) if (Math.abs(a - b) > 1) pairs.push([a, b]);
  for (const [a, b] of pairs) {
    const partner = baseline[b];
    if (touchesZero(partner) || !jumpChoices.includes(partner.change)) continue;
    const zero: JumpTuple = partner.opType === 'add'
      ? { startValue: 0, opType: 'add', change: partner.change, targetValue: partner.change }
      : { startValue: partner.change, opType: 'subtract', change: partner.change, targetValue: 0 };
    if ([zero.startValue, zero.targetValue].some(v => v < range.min || v > range.max)) continue;
    const next = baseline.map((t, i) => (i === a ? zero : t));
    if (new Set(next.map(tupleKey)).size !== next.length) continue;
    if (compiledStartContrast(next).count === 2) return result(next, 'targeted');
  }
  return result(baseline, 'insufficient-capacity');
}
