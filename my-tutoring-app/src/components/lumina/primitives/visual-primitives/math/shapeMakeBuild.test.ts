/**
 * shape-builder `make_shape`: the board's judge, the tap rules, the code-owned asks, the watcher word filter and the
 * oracle, without a component.
 */
import { describe, expect, it } from 'vitest';
import { keepWatchLine } from '../../../service/build-layer/gemini-build-watch';
import { shapeBuilderOracle, searchForms } from '../../../service/qa/oracles/shape-builder';
import {
  EMPTY_BUILD, SHAPE_ASK_MENU, SHAPE_WATCH_NEVER_SAY, askIsOpen, asksFor, fewerProperties, formKey, readShape,
  shapeAskText, shapeMakeMiss, shapeMarks, tapDot, type Pt, type ShapeBuild,
} from './shapeMakeBuild';

const P = (...xy: number[]): Pt[] => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));

describe('the judge', () => {
  it('reads sides, right angles, parallel pairs, equal sides and fold lines exactly', () => {
    expect(readShape(P(0, 0, 2, 0, 2, 2, 0, 2))).toMatchObject({ sides: 4, rightAngles: 4, parallelPairs: 2, sidesOfOneLength: 4, symmetryLines: 4 });
    expect(readShape(P(0, 0, 3, 0, 3, 1, 0, 1))).toMatchObject({ rightAngles: 4, sidesOfOneLength: 2, symmetryLines: 2 });
    expect(readShape(P(0, 0, 4, 0, 3, 2, 1, 2))).toMatchObject({ sides: 4, rightAngles: 0, parallelPairs: 1, symmetryLines: 1 });
    expect(readShape(P(0, 0, 4, 0, 2, 2, 0, 1))).toMatchObject({ rightAngles: 1, parallelPairs: 0, symmetryLines: 0 });
    // A dot on a straight run is not a corner: four dots, three sides.
    expect(readShape(P(0, 0, 1, 0, 2, 0, 0, 2))).toMatchObject({ sides: 3, rightAngles: 1 });
    expect(readShape(P(0, 0, 1, 0, 2, 0))).toBeNull();
  });

  it('names the first asked property the shape misses, one miss per property', () => {
    const trap = P(0, 0, 4, 0, 3, 2, 1, 2), square = P(0, 0, 2, 0, 2, 2, 0, 2);
    expect(shapeMakeMiss({ sides: 3 }, readShape(trap))).toBe('sides_off');
    expect(shapeMakeMiss({ sides: 4, rightAngles: 1 }, readShape(trap))).toBe('right_angles_off');
    expect(shapeMakeMiss({ sides: 4, parallelPairs: 2 }, readShape(trap))).toBe('parallel_off');
    expect(shapeMakeMiss({ sides: 4, equalSides: 'all' }, readShape(trap))).toBe('equal_sides_off');
    expect(shapeMakeMiss({ sides: 4, linesOfSymmetry: 2 }, readShape(trap))).toBe('symmetry_off');
    expect(shapeMakeMiss({ sides: 4, parallelPairs: 1, linesOfSymmetry: 1 }, readShape(trap))).toBeUndefined();
    expect(shapeMakeMiss({ sides: 4, rightAngles: 4 }, readShape(square))).toBeUndefined();
    expect(shapeMakeMiss({ sides: 4 }, null)).toBe('sides_off');
  });

  it('marks the learner shape for the help levers', () => {
    const m = shapeMarks(P(0, 0, 3, 0, 2, 2, 0, 2))!;
    expect(m.rightCorners).toEqual([0, 3]);
    expect(m.parallelGroups).toEqual([[0, 2]]);
    expect(m.foldLines).toHaveLength(0);
    expect(shapeMarks(P(0, 0, 3, 0, 3, 1, 0, 1))!.foldLines).toHaveLength(2);
  });
});

describe('the board', () => {
  const tap = (b: ShapeBuild, ...xy: number[]) => P(...xy).reduce<ShapeBuild | null>((s, p) => s && tapDot(s, p), b);

  it('builds, closes on the first corner, takes a corner out and adds one on the nearest side', () => {
    const tri = tap(EMPTY_BUILD, 0, 0, 2, 0, 0, 2, 0, 0)!;
    expect(tri).toMatchObject({ closed: true, points: P(0, 0, 2, 0, 0, 2) });
    const quad = tapDot(tri, { x: 2, y: 2 })!;
    expect(quad.closed).toBe(true);
    expect(readShape(quad.points)).toMatchObject({ sides: 4, rightAngles: 4 });
    expect(tapDot(quad, { x: 2, y: 2 })).toMatchObject({ closed: true, points: P(0, 0, 2, 0, 0, 2) });
    expect(tapDot(tri, { x: 2, y: 0 })).toMatchObject({ closed: false, points: P(0, 0, 0, 2) });
  });

  it('refuses a crossing side, a fold back, and closing a flat shape', () => {
    expect(tap(EMPTY_BUILD, 0, 0, 2, 2, 2, 0, 0, 2)).toBeNull();
    expect(tap(EMPTY_BUILD, 0, 0, 2, 0, 1, 0)).toBeNull();
    expect(tap(EMPTY_BUILD, 0, 0, 1, 0, 2, 0, 0, 0)).toBeNull();
  });
});

describe('the asks', () => {
  it('every menu ask is proved open by two passing shapes of different form', () => {
    for (const e of SHAPE_ASK_MENU) {
      expect(askIsOpen(e.ask), JSON.stringify(e.ask)).toBe(true);
      expect(new Set(e.witnesses.map(formKey)).size).toBe(2);
    }
    // A set no shape meets, and one only a single form meets, are not open.
    expect(askIsOpen({ sides: 4, rightAngles: 1, parallelPairs: 1 })).toBe(false);
  });

  it('the oracle finds two forms for every menu ask on its own, and none for an impossible ask', () => {
    for (const e of SHAPE_ASK_MENU) expect(searchForms(e.ask), JSON.stringify(e.ask)).toBe(2);
    expect(searchForms({ sides: 4, rightAngles: 1, parallelPairs: 1 }, 10, 20000)).toBe(0);
    expect(searchForms({ sides: 4, rightAngles: 3 }, 10, 20000)).toBe(0);
  });

  it('states every property in the band words, never a shape name; narrows to a named family', () => {
    expect(shapeAskText({ sides: 4, rightAngles: 1 }, '3-5')).toBe('Make a shape with 4 sides and exactly 1 right angle.');
    expect(shapeAskText({ sides: 4, rightAngles: 4 }, 'K-2')).toBe('Make a shape with 4 sides and exactly 4 square corners.');
    expect(shapeAskText({ sides: 4, parallelPairs: 1, linesOfSymmetry: 1 }, '3-5'))
      .toBe('Make a shape with 4 sides, exactly 1 pair of parallel sides and exactly 1 line of symmetry.');
    expect(shapeAskText({ sides: 4, rightAngles: 0 }, 'K-2')).toBe('Make a shape with 4 sides and no square corners.');
    expect(asksFor('3-5', 'Quadrilaterals').every(a => a.sides === 4)).toBe(true);
    expect(asksFor('K-2').some(a => a.parallelPairs !== undefined || a.linesOfSymmetry !== undefined)).toBe(false);
    expect(fewerProperties({ sides: 4, parallelPairs: 1, rightAngles: 2 })).toEqual({ sides: 4, rightAngles: 2 });
    expect(fewerProperties({ sides: 5 })).toBeNull();
  });

  it('the oracle passes a code-written session and catches a named shape, a closed ask and a K-2 parallel ask', () => {
    const ok = { gradeBand: '3-5', grid: { size: { rows: 10, columns: 10 } }, challenges: [
      { id: 'a', type: 'make_shape', instruction: shapeAskText({ sides: 4, rightAngles: 1 }, '3-5'), targetProperties: { sides: 4, rightAngles: 1 } },
      { id: 'b', type: 'make_shape', instruction: shapeAskText({ sides: 6, parallelPairs: 3 }, '3-5'), targetProperties: { sides: 6, parallelPairs: 3 } },
    ] };
    const ctx = { componentId: 'shape-builder', evalMode: 'make_shape', topic: 'Quadrilaterals', gradeLevel: 'Grade 4' };
    expect(shapeBuilderOracle.verify(ok, ctx).violations).toEqual([]);
    const bad = { gradeBand: 'K-2', challenges: [
      { id: 'a', type: 'make_shape', instruction: 'Make a square with 4 sides and exactly 1 square corner.', targetProperties: { sides: 4, rightAngles: 1, parallelPairs: 1 } },
    ] };
    expect(shapeBuilderOracle.verify(bad, ctx).violations.map(v => v.check).sort()).toEqual(['answer-key-desync', 'answer-leak', 'schema', 'scope']);
  });
});

it('the watcher drops a line that names a shape or a property, and keeps a plain one', () => {
  expect(keepWatchLine('Ooh, a tall pointy shape is growing near the top!', 'never', SHAPE_WATCH_NEVER_SAY)).not.toBe('');
  expect(keepWatchLine('Wow, that looks like a big trapezoid!', 'never', SHAPE_WATCH_NEVER_SAY)).toBe('');
  expect(keepWatchLine('The squares are lining up neatly!', 'never', SHAPE_WATCH_NEVER_SAY)).toBe('');
  expect(keepWatchLine('Those sides look parallel already!', 'never', SHAPE_WATCH_NEVER_SAY)).toBe('');
  expect(keepWatchLine('A slanted line stretches beside the dots!', 'never', SHAPE_WATCH_NEVER_SAY)).not.toBe('');
});
