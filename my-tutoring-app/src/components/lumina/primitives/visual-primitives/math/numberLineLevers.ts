/**
 * The in-item levers on a number-line jump (`/add-support-tiers`, pilot: handoff 18).
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each
 * leak rule. Two levers, from the jump failure inventory
 * (qa/eval-reports/number-line-levers-2026-09-27.md):
 * - `numbered_hops` (help): the learner's own jump is drawn as numbered unit hops, and hop 1 from
 *   the start is drawn as a model. Answers "counts the start as hop 1" and "loses count".
 *   Leak rule: a hop the learner did not place never reaches or passes the landing.
 * - `simpler_jump` (simplify): an easier practice jump first — one jump instead of two, or a
 *   shorter jump — built here from the current item. Leak rule: never the learner's own start,
 *   and neither its start nor its landing is a landing of the full item.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { NumberLineChallenge, NumberLineOperation } from './NumberLine';

export const HOPS_LEVER = 'numbered_hops';
export const SIMPLER_LEVER = 'simpler_jump';
/** Beyond this many unit hops the labels no longer read as a count. */
const MAX_HOPS = 30;

export interface Hop { from: number; to: number; label: string }

const landingOf = (op: Pick<NumberLineOperation, 'type' | 'startValue' | 'changeValue'>) =>
  op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue;
const integral = (...values: number[]) => values.every(v => Number.isInteger(v));

/** The one hop drawn as a model: hop 1 from the start, only when it cannot be the landing. */
export function modelHop(op: NumberLineOperation): Hop | null {
  if (!integral(op.startValue, op.changeValue) || op.changeValue < 2) return null;
  const to = op.startValue + (op.type === 'add' ? 1 : -1);
  return { from: op.startValue, to, label: '1' };
}

/** The learner's own jump from `from` to where they placed it, as numbered unit hops. */
export function learnerHops(from: number, to: number): Hop[] {
  if (!integral(from, to) || from === to || Math.abs(to - from) > MAX_HOPS) return [];
  const step = to > from ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) }, (_, i) =>
    ({ from: from + i * step, to: from + (i + 1) * step, label: String(i + 1) }));
}

/** Leak rule for hops the learner did not place: true when any reaches or passes the landing. */
export function hopsLeak(op: NumberLineOperation, drawn: readonly Hop[]): boolean {
  const landing = landingOf(op), dir = Math.sign(landing - op.startValue);
  return drawn.some(h => dir === 0 || (h.to - landing) * dir >= 0 || (h.from - landing) * dir >= 0);
}

/**
 * The easier practice jump for `ch`, or null when there is none: two jumps become the first jump's
 * shape alone; one jump becomes a shorter one. Same mode and direction, in the displayed range, and
 * its answer computed here. The start moves to the nearest value that keeps every rule.
 */
export function simplerJump(ch: NumberLineChallenge, range: { min: number; max: number }): NumberLineChallenge | null {
  const ops = ch.operations ?? [];
  if (ch.type !== 'show_jump' || !ops.length) return null;
  const first = ops[0];
  if (!integral(first.startValue, first.changeValue, ...ops.map(o => o.changeValue))) return null;
  const change = ops.length > 1 ? first.changeValue : first.changeValue >= 2 ? Math.ceil(first.changeValue / 2) : 0;
  if (change < 1) return null;
  const answers = new Set(ops.map(landingOf));
  const sign = first.type === 'add' ? 1 : -1;
  for (let d = 1; d <= range.max - range.min; d++) {
    for (const start of [first.startValue + d, first.startValue - d]) {
      const landing = start + sign * change;
      if (start < range.min || start > range.max || landing < range.min || landing > range.max) continue;
      if (answers.has(start) || answers.has(landing)) continue;
      const dir = sign > 0 ? 'forward' : 'back';
      return {
        id: `${ch.id}~simpler`, type: 'show_jump',
        instruction: `Start at ${start}. Jump ${dir} ${change}.`,
        hint: `Count each hop as you make it: ${change} hop${change === 1 ? '' : 's'} ${dir}.`,
        startValue: start, targetValues: [landing],
        operations: [{ type: first.type, startValue: start, changeValue: change, showJumpArc: false }],
      };
    }
  }
  return null;
}

/** The levers this jump item declares, with their state. Empty for any other item. */
export function jumpLevers(ch: NumberLineChallenge | null, pulled: readonly string[], range: { min: number; max: number }): WorkspaceLever[] {
  const ops = ch?.operations ?? [];
  if (!ch || ch.type !== 'show_jump' || !ops.length || !integral(...ops.flatMap(o => [o.startValue, o.changeValue]))) return [];
  const levers: WorkspaceLever[] = [{
    id: HOPS_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(HOPS_LEVER),
    when: 'The learner lands one hop off, counts the start as a hop, or loses count.',
    does: 'Numbers every hop of the learner\'s own jump on the line (1, 2, 3...) and draws hop 1 from the start as a model.',
  }];
  if (simplerJump(ch, range)) levers.push({
    id: SIMPLER_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(SIMPLER_LEVER),
    when: ops.length > 1 ? 'The learner cannot keep track across two jumps.' : 'The learner cannot manage a jump this long yet.',
    does: `Opens an easier practice jump first, ${ops.length > 1 ? 'one jump instead of two' : 'a shorter jump'} from a different start. `
      + 'It is not graded; the full item comes back after it.',
  });
  return levers;
}
