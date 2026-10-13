/**
 * build_shape's judge and asks (diShapesBuild.ts): every buildable name has two passing shapes of different form on
 * the grid, the K convention holds (a square is not a rectangle or a rhombus), and each miss is named first-wrong-first.
 */
import { describe, expect, it } from 'vitest';
import { formKey, readShape, type Pt } from '../math/shapeMakeBuild';
import { BUILDABLE_SHAPES, BUILD_WITNESSES, GRID_MAX, WRONG_BUILD, buildAskFor, buildFacts, shapeBuildMiss } from './diShapesBuild';
import { shapeItem, shapeLevers, simplerShape, MAKE_TRIANGLE, modelFor, shapeLeaks } from './diShapesLevers';
import { shapesAssignment, shapesScene } from './diShapesWorkspace';

const P = (...xy: number[]): Pt[] => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));
const SQUARE = P(1, 1, 3, 1, 3, 3, 1, 3);

describe('the judge', () => {
  it.each(BUILDABLE_SHAPES)('%s: two different passing shapes, both on the grid', shape => {
    const w = BUILD_WITNESSES[shape];
    expect(w).toHaveLength(2);
    for (const pts of w) {
      expect(pts.every(p => p.x >= 0 && p.y >= 0 && p.x <= GRID_MAX && p.y <= GRID_MAX)).toBe(true);
      expect(shapeBuildMiss(shape, readShape(pts))).toBeUndefined();
    }
    // Every square has one form; its two differ by size and turn instead.
    if (shape === 'square') expect(readShape(w[0])!.sidesOfOneLength).toBe(4);
    else expect(formKey(w[0])).not.toBe(formKey(w[1]));
  });

  it('a square is not a rectangle or a rhombus at this band, and is a square', () => {
    expect(shapeBuildMiss('rectangle', readShape(SQUARE))).toBe('made_square');
    expect(shapeBuildMiss('rhombus', readShape(SQUARE))).toBe('made_square');
    expect(shapeBuildMiss('square', readShape(SQUARE))).toBeUndefined();
  });

  it('names the first thing wrong: sides, then square corners, then equal sides, then parallel sides', () => {
    expect(shapeBuildMiss('hexagon', readShape(BUILD_WITNESSES.pentagon[0]))).toBe('too_few_sides');
    expect(shapeBuildMiss('triangle', readShape(SQUARE))).toBe('too_many_sides');
    expect(shapeBuildMiss('square', readShape(BUILD_WITNESSES.rhombus[0]))).toBe('corners_not_square');
    expect(shapeBuildMiss('square', readShape(BUILD_WITNESSES.rectangle[0]))).toBe('sides_not_equal');
    expect(shapeBuildMiss('rhombus', readShape(BUILD_WITNESSES.rectangle[0]))).toBe('sides_not_equal');
    expect(shapeBuildMiss('trapezoid', readShape(SQUARE))).toBe('parallel_off');
    expect(shapeBuildMiss('triangle', null)).toBe('too_few_sides');
  });

  it("the journey's wrong builds miss", () => {
    expect(shapeBuildMiss('triangle', readShape(WRONG_BUILD.triangle))).toBe('too_many_sides');
    for (const shape of BUILDABLE_SHAPES.filter(s => s !== 'triangle')) {
      expect(shapeBuildMiss(shape, readShape(WRONG_BUILD.other))).toBe('too_few_sides');
    }
  });
});

describe('the ask, scene and levers', () => {
  const hex = shapeItem('hexagon', 'build_shape', 'b1', 'medium');

  it('the ask states the name; the assignment is a gesture with no key; the scene gives the made shape as numbers', () => {
    expect(buildAskFor('hexagon')).toBe('Make a hexagon.');
    expect(shapesAssignment(hex)).toEqual({ id: 'b1', task: 'Make a hexagon.', response: 'gesture' });
    const facts = shapesScene(hex, { points: BUILD_WITNESSES.pentagon[0], closed: true }).facts;
    expect(facts).toMatchObject({ kind: 'build_shape', sides: 5, cornersPlaced: 5, shapeClosed: 'yes' });
    expect(JSON.stringify(facts)).not.toMatch(/\bsix\b|\b6 sides/);
    expect(buildFacts({ points: [], closed: false })).toMatchObject({ sides: 0, cornersPlaced: 0 });
  });

  it('the model is a different straight-sided shape; marks match the shape; simplify is a triangle', () => {
    const model = modelFor(hex, [hex])!;
    expect(model.sides).not.toBeNull();
    expect(shapeLeaks(model.shape, 'hexagon')).toBe(false);
    const ids = (shape: Parameters<typeof shapeItem>[0]) => shapeLevers(shapeItem(shape, 'build_shape', 'x'), [], []).map(l => l.id);
    expect(ids('square')).toEqual(['model_shape', 'side_ticks', 'corner_marks', 'same_length_marks', 'make_triangle']);
    expect(ids('rectangle')).toEqual(['model_shape', 'side_ticks', 'corner_marks', 'make_triangle']);
    expect(ids('triangle')).toEqual(['model_shape', 'side_ticks']);
    expect(simplerShape(hex, MAKE_TRIANGLE, [hex])).toMatchObject({ id: 'b1~simpler', shape: 'triangle', challengeType: 'build_shape' });
    for (const l of shapeLevers(hex, [], [hex])) expect(`${l.when} ${l.does}`).not.toMatch(/\bsix\b|\b6\b/);
  });
});
