import { describe, expect, it } from 'vitest';
import { hopsLeak, jumpLevers, jumpMiss, learnerHops, modelHop, simplerJump, wayArrow, wayArrowLeak } from './numberLineLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
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
    // A jump of 1: no model hop, so numbered hops only once the learner has placed a jump away from the start;
    // the which-way arrow is there from the start.
    expect(jumpLevers(item([op('add', 4, 1)]), [], range).map(l => l.id)).toEqual(['which_way']);
    expect(jumpLevers(item([op('add', 4, 1)]), [], range, [4]).map(l => l.id)).toEqual(['which_way']);
    expect(jumpLevers(item([op('add', 4, 1)]), [], range, [6]).map(l => l.id)).toEqual(['which_way', 'numbered_hops']);
    expect(jumpLevers(item([op('add', 4, 3)]), ['numbered_hops'], range).map(l => [l.id, l.pulled]))
      .toEqual([['numbered_hops', true], ['simpler_jump', false]]);
    expect(jumpLevers({ ...item([op('add', 4, 3)]), type: 'plot_point' }, [], range)).toEqual([]);
  });
});

describe('what a wrong jump shows, and the lever that answers it (code, not a Live run)', () => {
  const one = item([op('subtract', 8, 3)]);                        // lands on 5
  const two = item([op('add', 2, 3), op('add', 5, 4)]);            // lands on 5, then 9
  it.each([
    [one, [4], 'one_past'], [one, [6], 'one_short'], [one, [2], 'off_by_more'], [one, [9], 'wrong_direction'],
    [one, [8], 'wrong_direction'], [one, [], 'no_landing'], [one, [5], undefined],
    [two, [5, 10], 'second_jump_off'], [two, [4, 9], 'one_short'], [two, [5], 'no_landing'], [two, [5, 9], undefined],
  ] as const)('%#: landings %j -> %s', (ch, placed, miss) => {
    expect(jumpMiss(ch, placed)).toBe(miss);
  });

  it('one hop off, either way, or lost count on one jump: numbered hops come next', () => {
    const levers = jumpLevers(one, [], { min: 0, max: 20 });
    for (const miss of ['one_short', 'one_past', 'off_by_more', 'wrong_direction', 'no_landing']) expect(nextLever(levers, miss)).toBe('numbered_hops');
  });

  it('lost track across two jumps: the easier single jump comes next, before the hops', () => {
    const levers = jumpLevers(two, [], { min: 0, max: 20 });
    expect(levers.map(l => l.id)).toEqual(['numbered_hops', 'simpler_jump']);
    expect(nextLever(levers, 'second_jump_off')).toBe('simpler_jump');
    expect(nextLever(levers, 'one_short')).toBe('numbered_hops');
  });

  it('once the lever for a miss is pulled, the next open lever that answers it; with no named miss, help first', () => {
    const pulled = jumpLevers(two, ['numbered_hops'], { min: 0, max: 20 });
    expect(nextLever(pulled, 'off_by_more')).toBe('simpler_jump');
    expect(nextLever(jumpLevers(two, [], { min: 0, max: 20 }))).toBe('numbered_hops');
  });
});

describe('which way (a jump of 1)', () => {
  it('only on a jump of 1, at the first start, pointing the way the jump goes, and never reaching another number', () => {
    for (let start = 0; start <= 30; start++) for (const change of [1, 2, 3, 4, 5]) for (const type of ['add', 'subtract'] as const) {
      const o = op(type, start, change), way = wayArrow(o);
      if (change !== 1) { expect(way).toBeNull(); continue; }
      expect(way).toMatchObject({ from: start, dir: type === 'add' ? 'right' : 'left' });
      expect(Math.sign(way!.to - way!.from)).toBe(type === 'add' ? 1 : -1);
      expect(wayArrowLeak(o, way!)).toBe(false);
      // The tip stays nearer the start than any other tick, so it never points at the landing.
      expect(Math.abs(way!.to - start)).toBeLessThan(0.5);
    }
    expect(wayArrowLeak(op('subtract', 3, 1), { from: 3, to: 2, dir: 'left' })).toBe(true);
    expect(wayArrowLeak(op('subtract', 3, 1), { from: 2.4, to: 2, dir: 'left' })).toBe(true);
  });
  it('the payload item show_jump-2 (3 back 1, placed on the start): the arrow answers wrong_direction', () => {
    const ch = item([op('subtract', 3, 1)], 'show_jump-2');
    expect(jumpMiss(ch, [3])).toBe('wrong_direction');
    expect(nextLever(jumpLevers(ch, [], { min: 0, max: 10 }, [3]), 'wrong_direction')).toBe('which_way');
    expect(nextLever(jumpLevers(ch, [], { min: 0, max: 10 }), 'no_landing')).toBe('which_way');
    // Placed the wrong way: the arrow first, then the learner's own hop numbered.
    const wrongWay = jumpLevers(ch, ['which_way'], { min: 0, max: 10 }, [4]);
    expect(nextLever(wrongWay, jumpMiss(ch, [4]))).toBe('numbered_hops');
  });
  it('a chained jump whose first jump is 1 gets the arrow too; its second start is never marked', () => {
    const ch = item([op('subtract', 20, 1), op('subtract', 19, 5)]);
    const levers = jumpLevers(ch, [], { min: 0, max: 30 });
    expect(levers.map(l => l.id)).toEqual(['which_way', 'simpler_jump']);
    expect(levers[0].does).not.toMatch(/19/);
  });
});
