import { describe, expect, it } from 'vitest';
import {
  buildRecipes, freeSpot, groupCount, judgeShapeBuild, magnetTo, pieceGap, recipeInstruction,
  type BoardPiece, type RecipePart,
} from './shapeComposerBuild';

const piece = (id: string, shape: string, x: number, y: number, rotation = 0, w = 50, h = 50): BoardPiece =>
  ({ id, shape, x, y, width: w, height: h, rotation });
const house: RecipePart[] = [{ shape: 'square', count: 1 }, { shape: 'triangle', count: 1 }];

describe('shape-composer open build judge', () => {
  it('passes a triangle sitting on a square, and a different make of the same recipe', () => {
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100), piece('t', 'triangle', 100, 50)]))
      .toEqual({ pass: true, miss: null });
    // Triangle against the square's right side, turned 90 degrees.
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100), piece('t', 'triangle', 150, 100, 90)]).pass).toBe(true);
  });

  it('names one under and one over', () => {
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100)]).miss).toBe('missing_piece');
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100), piece('t', 'triangle', 100, 50), piece('t2', 'triangle', 150, 100)]).miss)
      .toBe('extra_piece');
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100), piece('c', 'circle', 100, 50)]).miss).toBe('missing_piece');
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100), piece('t', 'triangle', 100, 50), piece('c', 'circle', 150, 100)]).miss)
      .toBe('extra_piece');
  });

  it('names pieces apart and pieces stacked', () => {
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100), piece('t', 'triangle', 250, 100)]).miss).toBe('not_touching');
    expect(judgeShapeBuild(house, [piece('s', 'square', 100, 100), piece('t', 'triangle', 105, 105)]).miss).toBe('overlapping');
  });

  it('counts groups across a chain of touching pieces', () => {
    const row = [piece('a', 'square', 0, 0), piece('b', 'square', 50, 0), piece('c', 'square', 100, 0), piece('d', 'square', 300, 0)];
    expect(groupCount(row)).toBe(2);
    expect(groupCount(row.slice(0, 3))).toBe(1);
  });
});

describe('placing pieces', () => {
  it('a drop near another piece slides it until they touch; a far drop stays', () => {
    const fixed = piece('s', 'square', 100, 100);
    const to = magnetTo(piece('t', 'square', 160, 100), [fixed])!;
    expect(to.x).toBeCloseTo(150.5, 1);
    expect(pieceGap({ ...piece('t', 'square', 0, 0), ...to }, fixed)).toBeLessThanOrEqual(4);
    expect(magnetTo(piece('t', 'square', 200, 100), [fixed])).toBeNull();
  });

  it('a new piece lands in open space, clear of the board', () => {
    const board = [piece('s', 'square', 175, 150)];
    const spot = freeSpot({ id: 'n', shape: 'triangle', width: 50, height: 50, rotation: 0 }, board, 400, 350);
    expect(pieceGap(piece('n', 'triangle', spot.x, spot.y), board[0])).toBeGreaterThan(16);
  });
});

describe('recipes', () => {
  it('four distinct recipes per session, totals rising, K shapes only at K', () => {
    for (let run = 0; run < 20; run++) {
      const k = buildRecipes('K', 4);
      expect(new Set(k.map(r => JSON.stringify(r))).size).toBe(4);
      expect(k.map(r => r.reduce((n, p) => n + p.count, 0))).toEqual([2, 3, 3, 4]);
      expect(k.flat().every(p => ['triangle', 'square', 'rectangle', 'circle'].includes(p.shape))).toBe(true);
      const g1 = buildRecipes('1', 4);
      expect(g1.slice(2).every(r => ['hexagon', 'trapezoid', 'rhombus'].includes(r[0].shape))).toBe(true);
    }
  });

  it('the ask states the recipe and the touching rule', () => {
    expect(recipeInstruction(house)).toBe('Make your own picture with one square and one triangle. Every shape must touch another shape.');
  });
});
