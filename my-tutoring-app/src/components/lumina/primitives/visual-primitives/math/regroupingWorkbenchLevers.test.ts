/**
 * regrouping-workbench levers: the leak rules per mode, the simplify builder over every problem shape the generator
 * draws, and "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { RegroupingChallenge } from './RegroupingWorkbench';
import {
  COLUMN_COLORS_LEVER, OPERATION_MODEL_LEVER, REGROUP_LEVERS, REGROUP_MARKS_LEVER, SMALLER_LEVER, TRADE_MODEL_LEVER,
  leverTextLeaks, problemShape, simplerLeaks, smallerProblem, type RegroupLeverContext,
} from './regroupingWorkbenchLevers';
import {
  REGROUP_MISSES_BY_MODE, modeOf, operandsOf, regroupColumns, regroupMiss, resultOf, type RegroupOperation,
} from './regroupingWorkbenchWorkspace';

const FALLBACK = { operand1: 10, operand2: 10 };
const MODES: Array<[string, RegroupOperation, boolean]> = [
  ['add_no_regroup', 'addition', false], ['subtract_no_regroup', 'subtraction', false],
  ['add_regroup', 'addition', true], ['subtract_regroup', 'subtraction', true],
];
const ch = (id: string, op: RegroupOperation, a: number, b: number, mode: string): RegroupingChallenge => ({
  id, type: mode, problem: `${a} ${op === 'addition' ? '+' : '-'} ${b}`, requiresRegrouping: mode.endsWith('_regroup') && !mode.includes('no_'),
  regroupCount: 0, hint: '', narration: '' });

/** Every problem of the mode, sampled across 2- and 3-digit bands (the generator's grade bands). */
function items(mode: string, op: RegroupOperation, regroup: boolean): RegroupingChallenge[] {
  const out: RegroupingChallenge[] = [];
  let k = 0;
  for (let a = 10; a <= 999; a += a < 100 ? 3 : 37) for (let b = 1; b <= a; b += b < 100 ? 7 : 41) {
    if (op === 'addition' && a + b > (a < 100 ? 99 : 999)) continue;
    const places = String(Math.max(a, b)).length + 1;
    const trades = regroupColumns(op, a, b, places).length;
    if ((trades > 0) !== regroup) continue;
    out.push(ch(`${mode}-${k++}`, op, a, b, mode));
  }
  return out;
}

describe('simplify builder', () => {
  it.each(MODES)('%s: same operation and mode, its own id, never the learner\'s numbers or result, strictly smaller, deterministic',
    (mode, op, regroup) => {
      let built = 0, none = 0;
      const list = items(mode, op, regroup);
      expect(list.length).toBeGreaterThan(50);
      for (const c of list) {
        const s = smallerProblem(c, op, FALLBACK);
        if (!s) { none++; continue; }
        built++;
        expect(s.id).toBe(`${c.id}~simpler`);
        expect(simplerLeaks(c, s, op, FALLBACK)).toBe(false);
        const [a, b] = operandsOf(c, FALLBACK), [x, y] = operandsOf(s, FALLBACK);
        expect([x, y]).not.toContain(a);
        expect([x, y]).not.toContain(b);
        expect(resultOf(op, x, y)).toBeGreaterThan(0);
        expect(resultOf(op, x, y)).not.toBe(resultOf(op, a, b));
        const p = problemShape(op, a, b), q = problemShape(op, x, y);
        expect(q.trades > 0).toBe(regroup);
        expect(q.trades <= 1).toBe(true);
        expect(q.w <= p.w && (q.w < p.w || q.wb < p.wb || q.trades < p.trades)).toBe(true);
        // The same item always opens the same practice problem (the journey row rebuilds it).
        expect(smallerProblem(c, op, FALLBACK)).toEqual(s);
        // Never a practice of a practice.
        expect(smallerProblem(s, op, FALLBACK)).toBeNull();
      }
      expect(built).toBeGreaterThan(none);
    });

  it('the smallest problem of a mode has no easier version', () => {
    expect(smallerProblem(ch('a', 'addition', 27, 5, 'add_regroup'), 'addition', FALLBACK)).toBeNull();
    expect(smallerProblem(ch('s', 'subtraction', 43, 8, 'subtract_regroup'), 'subtraction', FALLBACK)).toBeNull();
    expect(smallerProblem(ch('n', 'addition', 23, 4, 'add_no_regroup'), 'addition', FALLBACK)).toBeNull();
  });

  it('the leak rule refuses the learner\'s own numbers, a shared result, a lost trade and a bigger problem', () => {
    const parent = ch('p', 'addition', 27, 45, 'add_regroup');
    const kid = (a: number, b: number) => ({ ...parent, id: 'p~simpler', problem: `${a} + ${b}` });
    expect(simplerLeaks(parent, kid(27, 8), 'addition', FALLBACK)).toBe(true);
    expect(simplerLeaks(parent, kid(64, 8), 'addition', FALLBACK)).toBe(true);
    expect(simplerLeaks(parent, kid(21, 3), 'addition', FALLBACK)).toBe(true);
    expect(simplerLeaks(parent, kid(158, 27), 'addition', FALLBACK)).toBe(true);
    expect(simplerLeaks(parent, kid(36, 7), 'addition', FALLBACK)).toBe(false);
  });
});

describe('the lever set', () => {
  const ctx = (operation: RegroupOperation, marksShown = false, tradeNeeded?: boolean): RegroupLeverContext =>
    ({ operation, fallback: FALLBACK, marksShown, ...(tradeNeeded === undefined ? {} : { tradeNeeded }) });
  const declare = (c: RegroupingChallenge, pulled: string[], context: RegroupLeverContext) => REGROUP_LEVERS.declare(c, context, pulled);

  it.each(MODES)('%s: every catalog miss is answered by a help lever on every item; no lever text carries a digit', (mode, op, regroup) => {
    const misses = getComponentById('regrouping-workbench')!.teachingWorkspace!.misses![mode];
    expect(misses).toEqual(REGROUP_MISSES_BY_MODE[mode as keyof typeof REGROUP_MISSES_BY_MODE]);
    for (const c of items(mode, op, regroup).slice(0, 40)) for (const marksShown of [false, true]) {
      expect(modeOf(c)).toBe(mode);
      const levers = declare(c, [], ctx(op, marksShown));
      const help = levers.filter(l => l.kind === 'help');
      for (const miss of misses) expect(help.some(l => l.answers?.includes(miss)), `${c.problem} ${miss}`).toBe(true);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
      const pulled = levers.map(l => l.id);
      expect(leverTextLeaks(REGROUP_LEVERS.onScreen(c, ctx(op, marksShown), pulled))).toBe(false);
      expect(leverTextLeaks(REGROUP_LEVERS.support(c, ctx(op, marksShown)))).toBe(false);
    }
  });

  it('regroup marks are offered only where the session hides them, a column still needs a trade, and on a regroup item', () => {
    const add = ch('a', 'addition', 27, 45, 'add_regroup');
    expect(declare(add, [], ctx('addition')).map(l => l.id))
      .toEqual([COLUMN_COLORS_LEVER, OPERATION_MODEL_LEVER, REGROUP_MARKS_LEVER, TRADE_MODEL_LEVER, SMALLER_LEVER]);
    expect(declare(add, [], ctx('addition', true)).map(l => l.id)).not.toContain(REGROUP_MARKS_LEVER);
    expect(declare(add, [], ctx('addition', false, false)).map(l => l.id)).not.toContain(REGROUP_MARKS_LEVER);
    expect(declare(ch('n', 'addition', 23, 14, 'add_no_regroup'), [], ctx('addition')).map(l => l.id))
      .toEqual([COLUMN_COLORS_LEVER, OPERATION_MODEL_LEVER, SMALLER_LEVER]);
    expect(declare({ ...add, id: 'a~simpler' }, [], ctx('addition'))).toEqual([]);
  });

  it('the mode is the item\'s structure, so an untyped or mistyped challenge gets its own levers', () => {
    expect(modeOf({ problem: '27 + 45' })).toBe('add_regroup');
    expect(modeOf({ problem: '23 + 14' })).toBe('add_no_regroup');
    expect(modeOf({ problem: '52 - 17' })).toBe('subtract_regroup');
    expect(modeOf({ problem: '58 − 23' })).toBe('subtract_no_regroup');
  });

  it('the trade model is the model lever: its support fact follows the item\'s tier, and a no-regroup item has none', () => {
    const add = ch('a', 'addition', 27, 45, 'add_regroup');
    expect(REGROUP_LEVERS.support({ ...add, supportTier: 'easy' }, ctx('addition'))).toMatch(/pull the model lever \(trade_model\)/);
    expect(REGROUP_LEVERS.support(add, ctx('addition'))).toMatch(/after a miss, model one trade on blocks/);
    expect(REGROUP_LEVERS.support({ ...add, supportTier: 'hard' }, ctx('addition'))).toMatch(/model nothing before/);
    expect(REGROUP_LEVERS.support(ch('n', 'addition', 23, 14, 'add_no_regroup'), ctx('addition'))).toBe('');
  });

  // "This wrong answer, then this lever": the typed digits, the miss they show, the first open lever for it.
  it.each([
    ['addition', 27, 45, [2, 6], 'no_carry', REGROUP_MARKS_LEVER],
    ['subtraction', 52, 17, [5, 4], 'smaller_from_larger', REGROUP_MARKS_LEVER],
    ['subtraction', 403, 248, [5, 6, 2], 'forgot_to_reduce', REGROUP_MARKS_LEVER],
    ['subtraction', 52, 17, [9, 6], 'wrong_operation', OPERATION_MODEL_LEVER],
    ['addition', 27, 45, [7, 2], 'misplaced_digits', COLUMN_COLORS_LEVER],
    ['addition', 23, 14, [8, 3], 'column_slip', COLUMN_COLORS_LEVER],
    ['addition', 27, 45, [2, null], 'left_blank', COLUMN_COLORS_LEVER],
  ] as const)('%s %d, %d typed %j: %s, then %s', (op, a, b, digits, miss, lever) => {
    const places = 3;
    const typed = [...digits, ...Array(places - digits.length).fill(null)];
    expect(regroupMiss({ operation: op, a, b, places, digits: typed, blocks: [], pending: [], trades: 0, regroupMarks: false,
      placeLabels: true, carryRow: true, columnBadges: false, algorithmShown: true })).toBe(miss);
    const item = ch('x', op, a, b, 'mode');
    expect(nextLever(declare(item, [], ctx(op)), miss)).toBe(lever);
    // With the marks pulled, the trade picture comes next.
    if (lever === REGROUP_MARKS_LEVER) expect(nextLever(declare(item, [lever], ctx(op)), miss)).toBe(TRADE_MODEL_LEVER);
  });
});
