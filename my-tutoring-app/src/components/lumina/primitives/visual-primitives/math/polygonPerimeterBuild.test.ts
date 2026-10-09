import { describe, expect, it } from 'vitest';
import {
  buildPerimeterAsk, buildPerimeterLevers, buildPerimeterMiss, buildPerimeterVerdict, holesIn, perimeterOf, smallerPerimeter,
  type Cell,
} from './polygonAreaBuild';
import { polygonAreaBuilderOracle } from '../../../service/qa/oracles/polygon-area-builder';
import type { PolygonAreaChallenge } from './PolygonAreaBuilder';

const rect = (cols: number, rows: number, at: [number, number] = [0, 0]): Cell[] =>
  Array.from({ length: cols * rows }, (_, i) => ({ c: at[0] + (i % cols), r: at[1] + Math.floor(i / cols) }));
const cells = (...xs: Array<[number, number]>): Cell[] => xs.map(([c, r]) => ({ c, r }));
/** An L of five: four down, one across the foot. */
const L5 = cells([0, 0], [0, 1], [0, 2], [0, 3], [1, 3]);
const RING = rect(3, 3).filter(x => !(x.c === 1 && x.r === 1));

describe('build_perimeter check', () => {
  it('counts the sides around the shape, and finds holes', () => {
    expect(perimeterOf(rect(3, 3))).toBe(12);
    expect(perimeterOf(rect(4, 2))).toBe(12);
    expect(perimeterOf(L5)).toBe(12);
    expect(perimeterOf(rect(1, 1))).toBe(4);
    expect(holesIn(rect(3, 3))).toBe(0);
    expect(holesIn(RING)).toBe(1);
    expect(perimeterOf(RING)).toBe(16); // 12 around the outside, 4 around the hole
  });

  it('many different shapes pass the same ask', () => {
    for (const shape of [rect(3, 3), rect(4, 2), rect(2, 4, [5, 2]), rect(5, 1), L5]) expect(buildPerimeterMiss(12, shape, null)).toBeUndefined();
  });

  it('one step over, one step under, further off, and the area made instead of the perimeter', () => {
    expect(buildPerimeterMiss(12, rect(5, 2), null)).toBe('two_over'); // 14
    expect(buildPerimeterMiss(12, rect(3, 2), null)).toBe('two_short'); // 10
    expect(buildPerimeterMiss(12, rect(8, 1), null)).toBe('over_by_more'); // 18
    expect(buildPerimeterMiss(12, rect(2, 2), null)).toBe('short_by_more'); // 8
    expect(buildPerimeterMiss(12, rect(4, 3), null)).toBe('counted_squares'); // 12 squares, perimeter 14
  });

  it('pieces and holes come first, whatever the count', () => {
    expect(buildPerimeterMiss(8, [...rect(1, 1), ...rect(1, 1, [3, 3])], null)).toBe('not_connected');
    expect(buildPerimeterMiss(12, RING, null)).toBe('has_hole');
    expect(buildPerimeterMiss(16, RING, null)).toBe('has_hole');
  });

  it('a second shape must differ: the first moved, turned or flipped is refused; a different area with the same perimeter passes', () => {
    expect(buildPerimeterMiss(12, rect(2, 4, [4, 1]), rect(4, 2))).toBe('same_as_first');
    expect(buildPerimeterMiss(12, rect(3, 3), rect(4, 2))).toBeUndefined();
    expect(buildPerimeterMiss(12, L5, rect(3, 3))).toBeUndefined();
  });

  it('the verdict names no number and no direction on a miss', () => {
    for (const miss of ['two_short', 'two_over', 'short_by_more', 'over_by_more', 'counted_squares', 'has_hole', 'same_as_first'] as const) {
      expect(buildPerimeterVerdict(12, miss, rect(3, 2), false)).not.toMatch(/\d|more|less|too|fewer|add|take/i);
    }
    expect(buildPerimeterVerdict(12, undefined, rect(3, 3), true)).toMatch(/Two different shapes, each with a perimeter of 12/);
  });

  it('the simplify lever halves the perimeter to an even one-shape ask, never below 6, and not twice', () => {
    const ch = { id: 'p', type: 'build_perimeter', figureType: 'grid', targetPerimeter: 18, expectedArea: 18, shapesAsked: 2,
      unitLabel: 'units', narration: '', instruction: buildPerimeterAsk(18, 2), hint: '' } as PolygonAreaChallenge;
    expect(smallerPerimeter(ch)).toMatchObject({ id: 'p~smaller', targetPerimeter: 8, expectedArea: 8, shapesAsked: 1,
      instruction: 'Make a shape with a perimeter of 8 units.' });
    expect(smallerPerimeter({ ...ch, targetPerimeter: 12, expectedArea: 12 })?.targetPerimeter).toBe(6);
    expect(smallerPerimeter(smallerPerimeter(ch)!)).toBeNull();
    expect(smallerPerimeter({ ...ch, targetPerimeter: 10, expectedArea: 10 })).toBeNull();
    // Every lever names the build, never the perimeter asked for.
    const levers = buildPerimeterLevers(ch, []);
    expect(levers.map(l => l.id)).toEqual(['edge_marks', 'piece_colors', 'turned_first', 'smaller_perimeter']);
    for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/\b18\b|type|hand|drag/i);
  });
});

describe('oracle on build_perimeter', () => {
  const item = (id: string, p: number, over: Record<string, unknown> = {}) => ({ id, type: 'build_perimeter', figureType: 'grid',
    targetPerimeter: p, expectedArea: p, shapesAsked: 1, unitLabel: 'units', narration: 'Each side of a square is one unit long.',
    instruction: buildPerimeterAsk(p, 1), hint: 'Walk around the outside.', ...over });
  const ctx = { componentId: 'polygon-area-builder', evalMode: 'build_perimeter', topic: 'Perimeter of shapes on a grid', gradeLevel: 'Grade 3' };
  const run = (challenges: unknown[], c: Record<string, unknown> = ctx) =>
    polygonAreaBuilderOracle.verify({ challenges }, c as never).violations.map(v => v.check);

  it('passes a clean session and fires on each seeded violation', () => {
    expect(run([item('a', 8), item('b', 12), item('c', 16, { shapesAsked: 2, instruction: buildPerimeterAsk(16, 2) })])).toEqual([]);
    expect(run([item('a', 8), item('b', 12), item('c', 16, { expectedArea: 15 })])).toContain('answer-key-desync');
    expect(run([item('a', 8), item('b', 12), item('c', 13, { instruction: buildPerimeterAsk(13, 1) })])).toContain('answer-key-desync');
    expect(run([item('a', 6), item('b', 12), item('c', 16)])).toContain('answer-key-desync');
    expect(run([item('a', 8), item('b', 12), item('c', 16, { instruction: 'Make a shape with an area of 16 squares.' })])).toContain('schema');
    expect(run([item('a', 8), item('b', 12), item('c', 16)], { ...ctx, topic: 'Perimeter up to 12 units' })).toContain('scope');
    expect(run([item('a', 8), item('b', 8), item('c', 16)])).toContain('clustering');
  });
});
