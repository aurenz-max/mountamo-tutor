/**
 * The geometry oracle for di-shapes. Every drawing this pack can put on screen
 * is checked against the pack's own pedagogy guards, independently of the
 * generator — because a mis-drawn VARIANT is a silent wrong-answer bug: the
 * side/corner count comes from the menu by NAME, so an "irregular hexagon"
 * accidentally drawn with five points would ask a child how many sides it has
 * and then correct their correct answer of five.
 *
 * These are content-contract assertions in the /oracle-test spirit: solve the
 * drawing independently (count its points, measure its sides and angles) and
 * compare against the shipped key.
 */

import { describe, expect, it } from 'vitest';
import { SHAPE_MENU, isPolygon } from '../../../service/direct-instruction/gemini-di-shapes';
import {
  SAFE_ROTATION_DEG,
  SHAPE_GEOMETRY,
  geometryFor,
  hasVariantDrawing,
  interiorAngles,
  sideLengths,
  type ShapeExemplar,
} from './diShapesGeometry';
import type { DiShapeName } from './diShapesScript';

const EXEMPLARS: ShapeExemplar[] = ['prototype', 'variant'];
const SHAPES = Object.keys(SHAPE_GEOMETRY) as DiShapeName[];

/** The bounding box of a polygon. */
const bbox = (points: ReadonlyArray<readonly [number, number]>) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

describe('di-shapes geometry — the count on screen matches the shipped key', () => {
  it('every polygon has exactly the menu\'s corner count, in BOTH exemplars', () => {
    // THE bug this file exists to catch. `countNumeral` is derived from
    // SHAPE_MENU by name; the child counts what is DRAWN. If those disagree,
    // the pack marks a correct answer wrong.
    for (const shape of SHAPES) {
      if (!isPolygon(shape)) continue;
      for (const exemplar of EXEMPLARS) {
        const g = geometryFor(shape, exemplar);
        expect(g.kind, `${shape}/${exemplar} should be a polygon`).toBe('polygon');
        if (g.kind !== 'polygon') continue;
        expect(g.points.length, `${shape}/${exemplar} point count`).toBe(SHAPE_MENU[shape].corners);
        expect(sideLengths(g.points).length, `${shape}/${exemplar} side count`)
          .toBe(SHAPE_MENU[shape].sides);
      }
    }
  });

  it('curved shapes are never drawn as polygons (they carry no count at all)', () => {
    for (const shape of SHAPES) {
      if (isPolygon(shape)) continue;
      for (const exemplar of EXEMPLARS) {
        expect(['circle', 'ellipse']).toContain(geometryFor(shape, exemplar).kind);
      }
      expect(SHAPE_MENU[shape].sides).toBeNull();
    }
  });

  it('no polygon has a degenerate (zero-length) side', () => {
    for (const shape of SHAPES) {
      for (const exemplar of EXEMPLARS) {
        const g = geometryFor(shape, exemplar);
        if (g.kind !== 'polygon') continue;
        for (const len of sideLengths(g.points)) {
          expect(len, `${shape}/${exemplar} degenerate side`).toBeGreaterThan(8);
        }
      }
    }
  });
});

describe('di-shapes geometry — rule #1: one drawing, one defensible name', () => {
  it('a rectangle is never square-ish, in either exemplar (≥1.6:1)', () => {
    // The K convention: square and rectangle are DIFFERENT answers at this
    // band, so the drawing must never make both defensible. The variant flips
    // the ORIENTATION prototype (landscape → portrait) without eroding this.
    for (const exemplar of EXEMPLARS) {
      const g = geometryFor('rectangle', exemplar);
      if (g.kind !== 'polygon') throw new Error('rectangle must be a polygon');
      const { w, h } = bbox(g.points);
      const ratio = Math.max(w, h) / Math.min(w, h);
      expect(ratio, `rectangle/${exemplar} aspect`).toBeGreaterThanOrEqual(1.6);
    }
  });

  it('the rectangle variant flips orientation rather than just stretching', () => {
    const proto = geometryFor('rectangle', 'prototype');
    const variant = geometryFor('rectangle', 'variant');
    if (proto.kind !== 'polygon' || variant.kind !== 'polygon') throw new Error('polygons');
    const p = bbox(proto.points);
    const v = bbox(variant.points);
    expect(p.w, 'prototype should be landscape').toBeGreaterThan(p.h);
    expect(v.h, 'variant should be portrait').toBeGreaterThan(v.w);
  });

  it('a square really is a square in every exemplar', () => {
    for (const exemplar of EXEMPLARS) {
      const g = geometryFor('square', exemplar);
      if (g.kind !== 'polygon') throw new Error('square must be a polygon');
      const sides = sideLengths(g.points);
      for (const len of sides) expect(len).toBeCloseTo(sides[0], 4);
      for (const angle of interiorAngles(g.points)) expect(angle).toBeCloseTo(90, 4);
    }
  });

  it('an oval is never circle-ish, in either exemplar', () => {
    for (const exemplar of EXEMPLARS) {
      const g = geometryFor('oval', exemplar);
      if (g.kind !== 'ellipse') throw new Error('oval must be an ellipse');
      const ratio = Math.max(g.rx, g.ry) / Math.min(g.rx, g.ry);
      expect(ratio, `oval/${exemplar} eccentricity`).toBeGreaterThanOrEqual(1.4);
    }
  });

  it('a rhombus keeps FOUR EQUAL sides in both exemplars, or it is not a rhombus', () => {
    for (const exemplar of EXEMPLARS) {
      const g = geometryFor('rhombus', exemplar);
      if (g.kind !== 'polygon') throw new Error('rhombus must be a polygon');
      const sides = sideLengths(g.points);
      expect(sides).toHaveLength(4);
      for (const len of sides) expect(len).toBeCloseTo(sides[0], 1);
    }
  });
});

describe('di-shapes geometry — the safe rotation ceiling', () => {
  it('never sits BELOW the untiered menu default, or the no-tier path already breaks it', () => {
    // The menu's maxRotationDeg is the gentle default an untiered session
    // draws at; SAFE_ROTATION_DEG is the rule-#1 ceiling the tier may climb
    // toward. If the ceiling were lower, `easy` would be drawing shapes the
    // guard says are ambiguous.
    for (const shape of SHAPES) {
      expect(SAFE_ROTATION_DEG[shape], `${shape} ceiling vs menu default`)
        .toBeGreaterThanOrEqual(SHAPE_MENU[shape].maxRotationDeg);
    }
  });

  it('keeps the square well clear of the 45° diamond percept', () => {
    // The sharp one: a square at 45° reads as a diamond, which is a JUDGED
    // ALTERNATE for rhombus — so that drawing would have two right answers,
    // exactly what the pack's birth discipline forbids.
    expect(SAFE_ROTATION_DEG.square).toBeLessThan(30);
    expect(SAFE_ROTATION_DEG.rhombus).toBeLessThan(30);
  });

  it('caps the regular polygons at their rotational symmetry, not beyond', () => {
    // A hexagon repeats every 60°, a pentagon every 72°: past half of that you
    // are drawing a picture the child has already been shown this session.
    expect(SAFE_ROTATION_DEG.hexagon).toBeLessThanOrEqual(30);
    expect(SAFE_ROTATION_DEG.pentagon).toBeLessThanOrEqual(36);
  });

  it('lets the triangle reach point-down — the menu\'s best K.G.2 item', () => {
    // "Name shapes regardless of their orientations" is the standard; a
    // triangle that never leaves 25° has never tested it.
    expect(SAFE_ROTATION_DEG.triangle).toBeGreaterThanOrEqual(180);
    expect(SAFE_ROTATION_DEG.circle, 'a circle cannot show rotation at all').toBe(0);
  });
});

describe('di-shapes geometry — the variant is genuinely non-prototypical', () => {
  it('the triangle variant is SCALENE and OBTUSE (the prototype is neither)', () => {
    // The headline structural lever: a child who learned the picture rather
    // than the shape refuses this one. Prototype = upright isoceles.
    const proto = geometryFor('triangle', 'prototype');
    const variant = geometryFor('triangle', 'variant');
    if (proto.kind !== 'polygon' || variant.kind !== 'polygon') throw new Error('polygons');

    const protoSides = sideLengths(proto.points).map((n) => Math.round(n));
    expect(new Set(protoSides).size, 'prototype should be isoceles').toBeLessThan(3);
    expect(Math.max(...interiorAngles(proto.points)), 'prototype should be acute')
      .toBeLessThan(90);

    const varSides = sideLengths(variant.points).map((n) => Math.round(n));
    expect(new Set(varSides).size, 'variant should be scalene — three distinct sides').toBe(3);
    expect(Math.max(...interiorAngles(variant.points)), 'variant should be obtuse')
      .toBeGreaterThan(95);
  });

  it('the pentagon and hexagon variants are IRREGULAR (the prototypes are regular)', () => {
    for (const shape of ['pentagon', 'hexagon'] as const) {
      const proto = geometryFor(shape, 'prototype');
      const variant = geometryFor(shape, 'variant');
      if (proto.kind !== 'polygon' || variant.kind !== 'polygon') throw new Error('polygons');
      const spread = (pts: ReadonlyArray<readonly [number, number]>) => {
        const s = sideLengths(pts);
        return (Math.max(...s) - Math.min(...s)) / Math.min(...s);
      };
      expect(spread(proto.points), `${shape} prototype should be regular`).toBeLessThan(0.08);
      expect(spread(variant.points), `${shape} variant should be irregular`)
        .toBeGreaterThan(0.25);
    }
  });

  it('the trapezoid variant has a RIGHT angle the prototype does not', () => {
    const proto = interiorAngles((geometryFor('trapezoid', 'prototype') as { points: ReadonlyArray<readonly [number, number]> }).points);
    const variant = interiorAngles((geometryFor('trapezoid', 'variant') as { points: ReadonlyArray<readonly [number, number]> }).points);
    const hasRight = (angles: number[]) => angles.some((a) => Math.abs(a - 90) < 1);
    expect(hasRight(proto), 'isoceles prototype has no right angle').toBe(false);
    expect(hasRight(variant), 'right trapezoid variant has one').toBe(true);
  });

  it('every shape claiming a variant actually has a DIFFERENT drawing', () => {
    // And the two that do not (circle, square) say so, rather than silently
    // sharing geometry — honest saturation of the structural axis.
    for (const shape of SHAPES) {
      const same = JSON.stringify(geometryFor(shape, 'prototype'))
        === JSON.stringify(geometryFor(shape, 'variant'));
      expect(same, `${shape}: hasVariantDrawing says ${hasVariantDrawing(shape)}`)
        .toBe(!hasVariantDrawing(shape));
    }
  });

  it('every drawing stays inside the 200×200 stage', () => {
    for (const shape of SHAPES) {
      for (const exemplar of EXEMPLARS) {
        const g = geometryFor(shape, exemplar);
        if (g.kind === 'polygon') {
          for (const [x, y] of g.points) {
            expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(200);
            expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(200);
          }
        } else if (g.kind === 'circle') {
          expect(g.r).toBeLessThanOrEqual(100);
        } else {
          expect(g.rx).toBeLessThanOrEqual(100);
          expect(g.ry).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
