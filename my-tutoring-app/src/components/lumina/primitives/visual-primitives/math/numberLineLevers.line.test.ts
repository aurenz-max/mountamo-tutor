import { describe, expect, it } from 'vitest';
import {
  betweenMiss, countHopsLeak, countModelHop, countStart, endMarks, endMarksLeak, fewerNumbers, helpStartsShown, lastTry, lastTryLeak,
  leverFact, lineLevers, orderMiss, plotMiss, simplerItem, simplerPlot, widerGap,
} from './numberLineLevers';
import { settledView } from './numberLineView';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { NumberLineChallenge, NumberLineData } from './NumberLine';

const plot = (t: number, id = 'p'): NumberLineChallenge => ({ id, type: 'plot_point', instruction: `Place ${t}.`, hint: '', targetValues: [t] });
const order = (vals: number[], id = 'o'): NumberLineChallenge => ({ id, type: 'order_values', instruction: 'Order.', hint: '', targetValues: vals });
const between = (lo: number, hi: number, exact?: number, id = 'b'): NumberLineChallenge =>
  ({ id, type: 'find_between', instruction: 'Between.', hint: '', targetValues: [lo, hi], ...(exact !== undefined ? { exactTargetValue: exact } : {}) });
const data = (challenges: NumberLineChallenge[], max = 10, min = 0): NumberLineData =>
  ({ title: 't', range: { min, max }, numberType: 'integer', gradeBand: 'K-2', challenges });
const labelsEvery = (step: number, lo: number, hi: number) => Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

describe('what a wrong point, order or between shows (the miss)', () => {
  it.each([
    [[3], 'one_short'], [[5], 'one_past'], [[1], 'off_by_more'], [[9], 'off_by_more'], [[4], undefined],
  ] as const)('plot 4, placed %j -> %s', (placed, miss) => expect(plotMiss(plot(4), placed, 1)).toBe(miss));
  it.each([
    [[[5, 1], [7, 2], [8, 3]], undefined], [[[8, 1], [7, 2], [5, 3]], 'reversed'], [[[7, 1], [5, 2], [8, 3]], 'out_of_order'],
    [[[5, 1], [8, 2], [7, 3]], 'out_of_order'],
  ] as const)('order 8, 5, 7 placed %j -> %s', (placed, miss) =>
    expect(orderMiss(order([8, 5, 7]), new Map(placed.map(([v, at]) => [v, at] as [number, number])))).toBe(miss));
  it.each([
    [between(3, 6), [3], 'on_end'], [between(3, 6), [6], 'on_end'], [between(3, 6), [8], 'outside'], [between(3, 6), [1], 'outside'],
    [between(3, 6), [4], undefined], [between(89, 91, 90), [89], 'on_end'], [between(89, 91, 90), [95], 'outside'],
    [between(89, 91, 90), [90], undefined], [between(1, 2, 1.5), [1.25], 'wrong_inside'],
  ] as const)('%#: between %j placed %j -> %s', (ch, placed, miss) => expect(betweenMiss(ch, placed)).toBe(miss));
});

describe('count hops (plot, identify, exact between): leak rule', () => {
  it('the model hop starts on a label, is hop 1, and never reaches or passes the target, on every label grid', () => {
    for (const step of [1, 2, 5]) for (let target = 0; target <= 30; target++) {
      const labels = labelsEvery(step, 0, 30), start = countStart(target, labels);
      if (start === null) continue;
      expect(labels).toContain(start);
      expect(start).toBeLessThan(target);
      const model = countModelHop(start, target);
      if (target - start < 2) { expect(model).toBeNull(); continue; }
      expect(model).toEqual({ from: start, to: start + 1, label: '1' });
      expect(countHopsLeak(start, target, [model!])).toBe(false);
    }
  });
  it('a fully labelled line counts from its first label; a sparse one from the nearest label at least two below', () => {
    expect(countStart(7, labelsEvery(1, 0, 10))).toBe(0);
    expect(countStart(13, labelsEvery(2, 0, 20))).toBe(10);
    expect(countStart(12, labelsEvery(2, 0, 20))).toBe(10);
    expect(countStart(17, labelsEvery(5, 0, 30))).toBe(15);
    expect(countStart(16, labelsEvery(5, 0, 30))).toBe(10);
    expect(countStart(1, labelsEvery(5, 0, 30))).toBeNull();
    expect(countStart(2.5, labelsEvery(1, 0, 10))).toBeNull();
  });
  it('the leak rule catches a hop that reaches or passes the target', () => {
    expect(countHopsLeak(10, 13, [{ from: 12, to: 13, label: '3' }])).toBe(true);
    expect(countHopsLeak(10, 13, [{ from: 13, to: 14, label: '4' }])).toBe(true);
    expect(countHopsLeak(10, 13, [{ from: 10, to: 11, label: '1' }])).toBe(false);
  });
});

describe('end marks (between): leak rule', () => {
  it('marks exactly the two given numbers, never one between them, and nothing on an exact item', () => {
    for (let lo = 0; lo <= 25; lo++) for (let gap = 2; gap <= 5; gap++) {
      const marks = endMarks(between(lo, lo + gap))!;
      expect(marks).toEqual([lo, lo + gap]);
      expect(endMarksLeak(between(lo, lo + gap), marks)).toBe(false);
      expect(endMarksLeak(between(lo, lo + gap), [lo + 1])).toBe(true);
    }
    expect(endMarks(between(89, 91, 90))).toBeNull();
    expect(endMarksLeak(between(89, 91, 90), [89, 91])).toBe(true);
  });
});

describe('the line a plot or between item settles on', () => {
  it('is fitted to every item of the session, so a target is not the centre of the line', () => {
    const items = [2, 9, 8, 0, 6].map((t, i) => plot(t, `p${i}`));
    const views = items.map(c => settledView(data(items), c).window);
    expect(new Set(views.map(v => `${v.min}-${v.max}`)).size).toBe(1);
    expect(views[0]).toEqual({ min: 0, max: 10 });
  });
  it('an exact missing number is not the centre of a local Grade-1 window', () => {
    const items = [between(92, 94, 93, 'b0'), between(97, 99, 98, 'b1'), between(100, 102, 101, 'b2'), between(105, 107, 106, 'b3')];
    for (const c of items) {
      const w = settledView(data(items, 120), c).window;
      expect(w.max - w.min).toBeLessThanOrEqual(30);
      expect(c.exactTargetValue!).toBeGreaterThanOrEqual(w.min);
      expect(c.exactTargetValue!).toBeLessThanOrEqual(w.max);
    }
    const centres = items.map(c => { const w = settledView(data(items, 120), c).window; return (w.min + w.max) / 2; });
    expect(new Set(centres).size).toBe(1);
  });
});

describe('simplify builders', () => {
  it('easier plot: same mode, a target strictly nearer the count start, in view, never the item\'s own target', () => {
    let built = 0;
    for (const max of [10, 20, 30]) for (let t = 0; t <= max; t++) {
      const items = [plot(t), plot(Math.max(0, t - 3), 'q'), plot(Math.min(max, t + 3), 'r')];
      const view = settledView(data(items, max), items[0]), s = simplerPlot(items[0], view);
      const start = countStart(t, view.labels);
      if (start === null || t - start < 2) { expect(s).toBeNull(); continue; }
      built++;
      expect(s!.type).toBe('plot_point');
      expect(s!.id).toBe('p~simpler');
      const v = s!.targetValues[0];
      expect(v).not.toBe(t);
      expect(v).toBeGreaterThan(start);
      expect(v - start).toBeLessThan(t - start);
      expect(v).toBeGreaterThanOrEqual(view.window.min);
      expect(v).toBeLessThanOrEqual(view.window.max);
      expect(s!.instruction).toBe(`Place a point at ${v} on the number line.`);
    }
    expect(built).toBeGreaterThan(40);
  });

  it('easier order: one number fewer, distinct, none from the item, listed out of order, in view', () => {
    let built = 0;
    for (let a = 0; a <= 8; a++) for (let b = a + 1; b <= 9; b++) for (let c = b + 1; c <= 10; c++) for (const set of [[c, a, b], [a, c, b]]) {
      const item = order(set), view = settledView(data([item]), item), s = fewerNumbers(item, view, { min: 0, max: 10 });
      if (!s) continue;
      built++;
      expect(s.type).toBe('order_values');
      expect(s.targetValues).toHaveLength(2);
      expect(new Set(s.targetValues).size).toBe(2);
      for (const v of s.targetValues) {
        expect(set).not.toContain(v);
        expect(v).toBeGreaterThanOrEqual(Math.max(0, Math.ceil(view.window.min)));
        expect(v).toBeLessThanOrEqual(Math.min(10, Math.floor(view.window.max)));
      }
      expect(s.targetValues[0]).toBeGreaterThan(s.targetValues[1]);
    }
    expect(built).toBeGreaterThan(200);
    expect(fewerNumbers(order([3, 7]), { window: { min: 0, max: 10 }, labels: [] }, { min: 0, max: 10 })).toBeNull();
    const four = fewerNumbers(order([12, 3, 18, 7]), { window: { min: 0, max: 20 }, labels: [] }, { min: 0, max: 20 })!;
    expect(four.targetValues).toHaveLength(3);
    expect([...four.targetValues].sort((x, y) => x - y)).not.toEqual(four.targetValues);
  });

  it('easier between: two numbers two farther apart, in view, the item\'s own pair never repeated; none on an exact or a wide item', () => {
    for (let lo = 0; lo <= 8; lo++) for (let gap = 2; gap <= 4 && lo + gap <= 10; gap++) {
      const item = between(lo, lo + gap), s = widerGap(item, { window: { min: 0, max: 10 }, labels: [] }, { min: 0, max: 10 })!;
      expect(s.type).toBe('find_between');
      expect(s.exactTargetValue).toBeUndefined();
      const [a, b] = s.targetValues;
      expect(b - a).toBe(gap + 2);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(10);
      expect([a, b]).not.toEqual([lo, lo + gap]);
    }
    expect(widerGap(between(1, 7), { window: { min: 0, max: 10 }, labels: [] }, { min: 0, max: 10 })).toBeNull();
    expect(widerGap(between(89, 91, 90), { window: { min: 85, max: 110 }, labels: [] }, { min: 0, max: 120 })).toBeNull();
  });

  it('simplerItem dispatches by mode and is what the journey row rebuilds from the payload alone', () => {
    const items = [plot(7, 'p0'), plot(2, 'p1')];
    const d = data(items);
    expect(simplerItem(items[0], d, settledView(d, items[0]))).toEqual(simplerPlot(items[0], settledView(d, items[0])));
  });
});

describe('levers per item, and the lever each miss gets next (code, not a Live run)', () => {
  const range = { min: 0, max: 10 };
  it('plot: count hops then the easier point; a target one from the count start offers hops only after a placement', () => {
    const items = [plot(7), plot(1, 'p1')];
    const view = settledView(data(items), items[0]);
    const levers = lineLevers(items[0], [], view, range);
    expect(levers.map(l => [l.id, l.kind])).toEqual([['count_hops', 'help'], ['nearer_number', 'simplify']]);
    for (const miss of ['one_short', 'one_past', 'off_by_more']) expect(nextLever(levers, miss)).toBe('count_hops');
    expect(nextLever(lineLevers(items[0], ['count_hops'], view, range), 'off_by_more')).toBe('nearer_number');
    const near = settledView(data(items), items[1]);
    expect(lineLevers(items[1], [], near, range)).toEqual([]);
    expect(lineLevers(items[1], [], near, range, [3]).map(l => l.id)).toEqual(['count_hops']);
  });
  it('order: the arrow, then the smaller set; a two-number set has the arrow only', () => {
    const item = order([8, 5, 7]), view = settledView(data([item]), item);
    const levers = lineLevers(item, [], view, range);
    expect(levers.map(l => l.id)).toEqual(['bigger_arrow', 'fewer_numbers']);
    expect(nextLever(levers, 'reversed')).toBe('bigger_arrow');
    expect(nextLever(lineLevers(item, ['bigger_arrow'], view, range), 'out_of_order')).toBe('fewer_numbers');
    expect(lineLevers(order([3, 9]), [], view, range).map(l => l.id)).toEqual(['bigger_arrow']);
  });
  it('between: rings then the wider pair; an exact missing number gets count hops and nothing else', () => {
    const item = between(3, 6), view = settledView(data([item, between(1, 4, undefined, 'b1'), between(2, 5, undefined, 'b2')]), item);
    const levers = lineLevers(item, [], view, range);
    expect(levers.map(l => l.id)).toEqual(['end_marks', 'wider_gap']);
    for (const miss of ['on_end', 'outside']) expect(nextLever(levers, miss)).toBe('end_marks');
    const exact = [between(102, 104, 103, 'e0'), between(96, 98, 97, 'e1')], d = data(exact, 120);
    expect(lineLevers(exact[0], [], settledView(d, exact[0]), { min: 0, max: 120 }).map(l => [l.id, l.answers]))
      .toEqual([['count_hops', ['on_end', 'outside']]]);
  });
  it('no lever on a fraction or decimal line, a jump (its own levers), or a build', () => {
    const half = { ...plot(0.5), targetValues: [0.5] };
    expect(lineLevers(half, [], { window: { min: 0, max: 1 }, labels: [0, 1] }, { min: 0, max: 1 })).toEqual([]);
    expect(lineLevers({ ...plot(4), type: 'show_jump' }, [], { window: range, labels: [] }, range)).toEqual([]);
  });
  it('scene facts say what is drawn, never the answer', () => {
    const p = plot(7), view = settledView(data([p, plot(2, 'q')]), p);
    const fact = leverFact(p, ['count_hops'], view)!;
    expect(fact).toMatch(/counted from 1:/);
    expect(fact).not.toMatch(/\b7\b/);
    const o = order([8, 5, 7]);
    expect(leverFact(o, ['bigger_arrow'], settledView(data([o]), o))).not.toMatch(/\d/);
    expect(leverFact(between(3, 6), ['end_marks'], view)).toBe('Rings mark 3 and 6 on the line, each with its number above it.');
    for (const l of lineLevers(o, [], settledView(data([o]), o), range)) expect(l.does).not.toMatch(/\b[578]\b/);
  });
  it('easy starts with the item\'s help shown; other tiers start with nothing', () => {
    expect(helpStartsShown('easy', plot(4))).toEqual(['count_hops']);
    expect(helpStartsShown('easy', order([1, 2, 3]))).toEqual(['bigger_arrow']);
    expect(helpStartsShown('easy', between(3, 6))).toEqual(['end_marks']);
    expect(helpStartsShown('easy', between(89, 91, 90))).toEqual(['count_hops']);
    expect(helpStartsShown('medium', plot(4))).toEqual([]);
  });
});

describe('last try (a target with no label to count from below it)', () => {
  const full = { window: { min: 0, max: 10 }, labels: labelsEvery(1, 0, 10) };
  it('rings only the wrong point of the learner, only where count hops cannot exist, never the target', () => {
    // identify payload plot_point-3: place 0, placed 1 (one_past). Count hops would start on 0, the answer.
    expect(countStart(0, full.labels)).toBeNull();
    expect(lastTry(plot(0), full, 1)).toBe(1);
    expect(lastTry(plot(0), full, null)).toBeNull();
    expect(lastTry(plot(0), full, 0)).toBeNull();
    expect(lastTryLeak(plot(0), 0)).toBe(true);
    expect(lastTryLeak(plot(0), 1)).toBe(false);
    // Any target with a count start keeps count hops, and no ring.
    for (let t = 1; t <= 10; t++) expect(lastTry(plot(t), full, t === 10 ? 9 : t + 1)).toBeNull();
    // A sparse line: 1 has no label at least two below it, so its wrong point is ringed.
    expect(lastTry(plot(1), { window: { min: 0, max: 20 }, labels: labelsEvery(5, 0, 20) }, 3)).toBe(3);
    expect(lastTry(between(3, 6), full, 1)).toBeNull();
  });
  it('the payload item plot_point-3: last_try is declared after the miss and answers one_past; its fact names the ring, not the target', () => {
    const levers = lineLevers(plot(0, 'plot_point-3'), [], full, { min: 0, max: 10 }, [1], 1);
    expect(levers.map(l => l.id)).toEqual(['last_try']);
    expect(nextLever(levers, plotMiss(plot(0), [1], 1))).toBe('last_try');
    expect(lineLevers(plot(0), [], full, { min: 0, max: 10 })).toEqual([]);
    const fact = leverFact(plot(0), ['last_try'], full, 1)!;
    expect(fact).toBe("A dashed ring marks 1, where the learner's last checked point was.");
    expect(fact.split(/[^0-9]+/)).not.toContain('0');
    expect(levers[0].does.split(/[^0-9]+/)).not.toContain('0');
  });
});
