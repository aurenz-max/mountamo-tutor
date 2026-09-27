import { describe, expect, it } from 'vitest';
import { hopsLeak, jumpLevers, learnerHops, modelHop, simplerJump } from './numberLineLevers';
import type { NumberLineChallenge, NumberLineOperation } from './NumberLine';

const op = (type: 'add' | 'subtract', startValue: number, changeValue: number): NumberLineOperation =>
  ({ type, startValue, changeValue, showJumpArc: false });
const land = (o: NumberLineOperation) => o.type === 'add' ? o.startValue + o.changeValue : o.startValue - o.changeValue;
const item = (ops: NumberLineOperation[], id = 'j'): NumberLineChallenge => ({ id, type: 'show_jump', instruction: 'Hop.', hint: 'Count.',
  startValue: ops[0].startValue, targetValues: ops.map(land), operations: ops });

describe('numbered hops: leak rule', () => {
  it('the model hop is hop 1 from the start and never reaches the landing, for every K-2 jump', () => {
    for (let start = 0; start <= 30; start++) for (const change of [1, 2, 3, 4, 5]) for (const type of ['add', 'subtract'] as const) {
      const o = op(type, start, change), model = modelHop(o);
      if (change < 2) { expect(model).toBeNull(); continue; }
      expect(model).toEqual({ from: start, to: start + (type === 'add' ? 1 : -1), label: '1' });
      expect(hopsLeak(o, [model!])).toBe(false);
    }
  });
  it('the leak rule catches a hop that reaches or passes the landing', () => {
    expect(hopsLeak(op('add', 4, 3), [{ from: 6, to: 7, label: '3' }])).toBe(true);
    expect(hopsLeak(op('subtract', 8, 3), [{ from: 5, to: 4, label: '4' }])).toBe(true);
    expect(hopsLeak(op('subtract', 8, 3), [{ from: 8, to: 7, label: '1' }, { from: 7, to: 6, label: '2' }])).toBe(false);
  });
  it('the learner\'s own jump is numbered from where it started, in either direction', () => {
    expect(learnerHops(8, 6).map(h => [h.from, h.to, h.label])).toEqual([[8, 7, '1'], [7, 6, '2']]);
    expect(learnerHops(3, 5).map(h => h.label)).toEqual(['1', '2']);
    expect(learnerHops(3, 3)).toEqual([]);
    expect(learnerHops(0.5, 2)).toEqual([]);
  });
});

describe('simpler jump builder', () => {
  const range = { min: 0, max: 30 };
  it('over every K-2 item: same mode and direction, one step simpler, in range, solvable, never the learner\'s start or an answer', () => {
    let built = 0;
    for (let start = 0; start <= 30; start++) for (const change of [1, 2, 3, 4, 5]) for (const type of ['add', 'subtract'] as const) {
      const first = op(type, start, change);
      if (land(first) < 0 || land(first) > 30) continue;
      for (const ops of [[first], ...[1, 2, 3].map(c => [first, op(type === 'add' ? 'subtract' : 'add', land(first), c)])]) {
        if (ops.some(o => land(o) < 0 || land(o) > 30)) continue;
        const source = item(ops), simpler = simplerJump(source, range);
        if (ops.length === 1 && change === 1) { expect(simpler).toBeNull(); continue; }
        expect(simpler).not.toBeNull();
        built++;
        const s = simpler!, o = s.operations![0];
        expect(s.type).toBe('show_jump');
        expect(s.operations).toHaveLength(1);
        expect(o.type).toBe(type);
        expect(o.changeValue).toBe(ops.length > 1 ? change : Math.ceil(change / 2));
        expect(o.changeValue).toBeLessThanOrEqual(change);
        expect(s.targetValues).toEqual([land(o)]);
        expect(s.startValue).toBe(o.startValue);
        for (const v of [o.startValue, land(o)]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(30); }
        expect(o.startValue).not.toBe(start);
        for (const answer of ops.map(land)) { expect(o.startValue).not.toBe(answer); expect(land(o)).not.toBe(answer); }
        expect(s.id).not.toBe(source.id);
        // The text names the start and the change only, never where the hops land.
        expect(s.instruction).toBe(`Start at ${o.startValue}. Jump ${type === 'add' ? 'forward' : 'back'} ${o.changeValue}.`);
      }
    }
    expect(built).toBeGreaterThan(400);
  });
  it('declares the simplify lever only when a simpler jump exists', () => {
    expect(jumpLevers(item([op('add', 4, 1)]), [], range).map(l => l.id)).toEqual(['numbered_hops']);
    expect(jumpLevers(item([op('add', 4, 3)]), ['numbered_hops'], range).map(l => [l.id, l.pulled]))
      .toEqual([['numbered_hops', true], ['simpler_jump', false]]);
    expect(jumpLevers({ ...item([op('add', 4, 3)]), type: 'plot_point' }, [], range)).toEqual([]);
  });
});
