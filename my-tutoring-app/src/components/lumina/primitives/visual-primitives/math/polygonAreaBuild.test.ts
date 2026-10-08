import { describe, expect, it } from 'vitest';
import { buildAreaAsk, buildAreaMiss, connectedParts, sameShape, smallerArea, type Cell } from './polygonAreaBuild';
import { areaMiss } from './polygonAreaWorkspace';
import { polygonAreaBuilderOracle } from '../../../service/qa/oracles/polygon-area-builder';
import type { PolygonAreaChallenge } from './PolygonAreaBuilder';

const cells = (...xs: Array<[number, number]>): Cell[] => xs.map(([c, r]) => ({ c, r }));
const L = cells([0, 0], [0, 1], [0, 2], [1, 2]);

describe('build_area check', () => {
  it('counts, joins along sides only, and names the miss in precedence order', () => {
    expect(connectedParts(cells([0, 0], [1, 1])).length).toBe(2); // corner touch is not joined
    expect(buildAreaMiss(4, L, null)).toBeUndefined();
    expect(buildAreaMiss(5, L, null)).toBe('one_short');
    expect(buildAreaMiss(3, L, null)).toBe('one_over');
    expect(buildAreaMiss(8, L, null)).toBe('short_by_more');
    expect(buildAreaMiss(2, L, null)).toBe('over_by_more');
    expect(buildAreaMiss(4, cells([0, 0], [1, 0], [3, 0], [4, 0]), null)).toBe('not_connected');
    // The first shape moved, turned or flipped is the same shape; a different tetromino is not.
    const mirrored = cells([5, 3], [5, 4], [5, 5], [4, 5]);
    const turned = cells([2, 2], [3, 2], [4, 2], [2, 3]);
    expect(sameShape(L, mirrored) && sameShape(L, turned)).toBe(true);
    expect(buildAreaMiss(4, mirrored, L)).toBe('same_as_first');
    expect(buildAreaMiss(4, cells([0, 0], [1, 0], [0, 1], [1, 1]), L)).toBeUndefined();
  });

  it('the simplify lever halves the area to one shape, never below 3, and not twice', () => {
    const ch = { id: 'a', type: 'build_area', figureType: 'grid', targetArea: 13, expectedArea: 13, shapesAsked: 2,
      unitLabel: 'square units', narration: '', instruction: buildAreaAsk(13, 2), hint: '' } as PolygonAreaChallenge;
    expect(smallerArea(ch)).toMatchObject({ id: 'a~smaller', targetArea: 6, shapesAsked: 1,
      instruction: 'Make a shape with an area of 6 squares.' });
    expect(smallerArea(smallerArea(ch)!)).toBeNull();
    expect(smallerArea({ ...ch, targetArea: 5, expectedArea: 5 })).toBeNull();
  });

  it('a typed area names its signature miss', () => {
    const tri = { id: 't', type: 'find_area_triangle_parallelogram', figureType: 'triangle', base: 8, height: 5,
      expectedArea: 20, unitLabel: 'cm', narration: '', instruction: '', hint: '' } as PolygonAreaChallenge;
    expect(areaMiss(tri, 40)).toBe('forgot_half');
    expect(areaMiss(tri, 13)).toBe('added_sides');
    expect(areaMiss(tri, 21)).toBe('wrong_area');
    expect(areaMiss(tri, 20)).toBeUndefined();
    const comp = { ...tri, type: 'composite_area', figureType: 'composite', expectedArea: 12,
      parts: [{ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 2, w: 2, h: 2 }] } as PolygonAreaChallenge;
    expect(areaMiss(comp, 8)).toBe('one_piece');
    expect(areaMiss(comp, 6)).toBe('halved');
    const coord = { ...tri, type: 'coordinate_polygon', figureType: 'coordinate', expectedArea: 6,
      vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }] } as PolygonAreaChallenge;
    expect(areaMiss(coord, 12)).toBe('bounding_box');
  });
});

describe('oracle on build_area', () => {
  const item = (id: string, area: number, over: Record<string, unknown> = {}) => ({ id, type: 'build_area', figureType: 'grid',
    targetArea: area, expectedArea: area, shapesAsked: 1, unitLabel: 'square units', narration: 'Each square is one square unit.',
    instruction: buildAreaAsk(area, 1), hint: 'Count each square.', ...over });
  const ctx = { componentId: 'polygon-area-builder', evalMode: 'build_area', topic: 'Area by counting squares', gradeLevel: 'Grade 3' };
  const run = (challenges: unknown[], c: Record<string, unknown> = ctx) =>
    polygonAreaBuilderOracle.verify({ challenges }, c as never).violations.map(v => v.check);

  it('passes a clean session and fires on each seeded violation', () => {
    expect(run([item('a', 6), item('b', 9), item('c', 12, { shapesAsked: 2, instruction: buildAreaAsk(12, 2) })])).toEqual([]);
    expect(run([item('a', 6), item('b', 9), item('c', 12, { expectedArea: 11 })])).toContain('answer-key-desync');
    expect(run([item('a', 6), item('b', 9), item('c', 2)])).toContain('answer-key-desync');
    expect(run([item('a', 6), item('b', 9), item('c', 12, { instruction: 'Make a shape.' })])).toContain('schema');
    expect(run([item('a', 6), item('b', 9), item('c', 12, { shapesAsked: 3 })])).toContain('schema');
    expect(run([item('a', 6), item('b', 9), item('c', 12)], { ...ctx, topic: 'Area up to 10 square units' })).toContain('scope');
    expect(run([item('a', 6), item('b', 6), item('c', 12)])).toContain('clustering');
  });
});
