/**
 * diShapesGeometry — the code-owned DRAWINGS for the di-shapes pack, as DATA
 * rather than JSX, so the pedagogy guards on them are assertable.
 *
 * Two exemplars per shape (L4, 2026-08-07 — the structural difficulty axis):
 *
 *   prototype  the textbook picture — an upright isoceles triangle, a regular
 *              hexagon, a landscape rectangle. What a child's shape book shows.
 *   variant    the SAME shape by its DEFINING attributes, drawn against the
 *              prototype: a scalene obtuse triangle, an irregular hexagon, a
 *              portrait rectangle. Still exactly one defensible answer.
 *
 * WHY THE VARIANT IS THE PEDAGOGY, not decoration. A child who only ever meets
 * the prototype learns the PICTURE, not the shape — they will call a scalene
 * triangle "not a triangle" and a tall rectangle "a door". Distinguishing the
 * defining attributes (3 straight sides, 3 corners) from the non-defining ones
 * (which way up, how regular, how big) is the skill itself, and it is the exact
 * wording of the G1 curriculum home /curriculum-fit measured for this pack:
 * `GEOM001-01-c` "defining versus non-defining attributes", alongside K's
 * `GEOM001-01-A` "…regardless of size, color, or orientation".
 *
 * THE INVARIANTS EVERY EXEMPLAR MUST HOLD (asserted in diShapesGeometry.test.ts,
 * because a mis-drawn variant would silently make the COUNTING answer wrong):
 *  1. A polygon's point count === the menu's `corners` for that shape. An
 *     "irregular hexagon" with five points hands the child a wrong key.
 *  2. Rule #1 — one drawing, one defensible name. Rectangles stay ≥1.6:1 in
 *     BOTH exemplars (never square-ish), ovals stay clearly non-circular.
 *  3. A rhombus keeps four EQUAL sides in both exemplars, or it is not a rhombus.
 *  4. Variants are genuinely non-prototypical where they claim to be: the
 *     triangle variant is scalene AND obtuse, the pentagon/hexagon variants are
 *     irregular (not all sides equal).
 *
 * SATURATION, stated honestly: a circle has no non-prototypical drawing, and
 * neither does a square (a square drawn any other way stops being a square).
 * Those two share one geometry across both exemplars, and the tier's remaining
 * levers — rotation and scale — carry their variation. That is the structural
 * axis saturating, not a gap.
 *
 * All geometry is a 200×200 viewBox centred on (100,100).
 */

import type { DiShapeName, ShapeExemplar } from './diShapesScript';

export type { ShapeExemplar };

export type ShapeGeometry =
  | { kind: 'circle'; r: number }
  | { kind: 'ellipse'; rx: number; ry: number }
  | { kind: 'polygon'; points: ReadonlyArray<readonly [number, number]> };

/** True when the shape has a genuinely distinct non-prototypical drawing. */
export const hasVariantDrawing = (shape: DiShapeName): boolean =>
  shape !== 'circle' && shape !== 'square';

/**
 * The largest rotation this shape may EVER be drawn at — the rule-#1 ceiling,
 * not a difficulty knob. Past it the drawing acquires a second defensible
 * answer, or stops varying at all:
 *
 *  - SQUARE is the sharp one. At 45° it reads as a DIAMOND, which is a judged
 *    alternate for `rhombus` — so a 45° square is an item with two right
 *    answers, exactly what this pack's birth discipline forbids. It stays far
 *    below that, which means the square nearly saturates on this dial. Honest,
 *    and pedagogically real: the square is the shape with the least room for a
 *    "non-defining attributes" lesson.
 *  - RHOMBUS drifts the other way (its diagonals are near-equal, so rotating it
 *    toward 45° makes it read as a square), so it is held low too.
 *  - Rotational SYMMETRY caps the rest for free: a hexagon repeats every 60° and
 *    a pentagon every 72°, so half of that is the largest DISTINCT rotation —
 *    beyond it you are drawing a picture the child has already seen.
 *  - TRIANGLE and TRAPEZOID take the full 180°. A point-down triangle is
 *    unambiguous and is the single best K.G.2 item in the menu — "regardless of
 *    their orientations" is precisely what it tests.
 *  - CIRCLE cannot show rotation at all; scale is its only honest variation.
 *
 * Asserted against SHAPE_MENU's gentle default in diShapesGeometry.test.ts: the
 * safe ceiling must never sit BELOW the untiered default, or the no-tier path
 * would already be drawing past it.
 */
export const SAFE_ROTATION_DEG: Record<DiShapeName, number> = {
  circle: 0,      // invisible — saturates to scale alone
  square: 15,     // 45° = diamond percept; stay well clear
  rhombus: 20,    // drifts toward reading as a square
  hexagon: 30,    // 60° rotational symmetry → 30 is the largest distinct turn
  pentagon: 36,   // 72° rotational symmetry → 36 likewise
  rectangle: 90,  // portrait is still unambiguously a rectangle
  oval: 90,       // portrait oval likewise
  triangle: 180,  // point-down: the K.G.2 star item
  trapezoid: 180, // upside-down is still a trapezoid
};

export const SHAPE_GEOMETRY: Record<DiShapeName, Record<ShapeExemplar, ShapeGeometry>> = {
  // A circle is a circle. Scale is its only honest variation.
  circle: {
    prototype: { kind: 'circle', r: 70 },
    variant: { kind: 'circle', r: 70 },
  },
  // Wide ellipse → TALL ellipse. Both clearly non-circular (rule #1 vs "circle").
  oval: {
    prototype: { kind: 'ellipse', rx: 85, ry: 50 },
    variant: { kind: 'ellipse', rx: 48, ry: 85 },
  },
  // Upright isoceles → SCALENE and OBTUSE. The apex sits outside the base span,
  // so the 112° angle is visible: the single most useful non-prototype at K–1,
  // because "triangle" is the name children most tie to one picture.
  triangle: {
    prototype: { kind: 'polygon', points: [[100, 28], [32, 140], [168, 140]] },
    variant: { kind: 'polygon', points: [[30, 145], [150, 145], [185, 60]] },
  },
  // A square has no other drawing — see the saturation note above.
  square: {
    prototype: { kind: 'polygon', points: [[40, 40], [160, 40], [160, 160], [40, 160]] },
    variant: { kind: 'polygon', points: [[40, 40], [160, 40], [160, 160], [40, 160]] },
  },
  // Landscape 1.82:1 → PORTRAIT 2.24:1. Both stay ≥1.6:1, so neither drawing is
  // ever arguably a square; what changes is the orientation prototype ("a
  // rectangle is the wide one") that children over-learn.
  rectangle: {
    prototype: { kind: 'polygon', points: [[20, 56], [180, 56], [180, 144], [20, 144]] },
    variant: { kind: 'polygon', points: [[62, 15], [138, 15], [138, 185], [62, 185]] },
  },
  // Regular → irregular, still exactly six sides and six corners.
  hexagon: {
    prototype: {
      kind: 'polygon',
      points: [[172, 100], [136, 162], [64, 162], [28, 100], [64, 38], [136, 38]],
    },
    variant: {
      kind: 'polygon',
      points: [[178, 88], [128, 172], [58, 158], [22, 108], [52, 32], [138, 24]],
    },
  },
  // Regular → irregular, still exactly five sides and five corners.
  pentagon: {
    prototype: { kind: 'polygon', points: [[100, 25], [171, 77], [144, 161], [56, 161], [29, 77]] },
    variant: { kind: 'polygon', points: [[88, 22], [180, 68], [152, 170], [45, 158], [24, 74]] },
  },
  // Tall diamond → wide diamond. Four EQUAL sides in both, or it is not a rhombus.
  rhombus: {
    prototype: { kind: 'polygon', points: [[100, 30], [165, 100], [100, 170], [35, 100]] },
    variant: { kind: 'polygon', points: [[100, 45], [180, 100], [100, 155], [20, 100]] },
  },
  // Isoceles → RIGHT trapezoid (one square corner, one slanted side).
  trapezoid: {
    prototype: { kind: 'polygon', points: [[55, 60], [145, 60], [175, 140], [25, 140]] },
    variant: { kind: 'polygon', points: [[40, 55], [150, 55], [178, 145], [40, 145]] },
  },
};

/** The geometry one item draws. Falls back to the prototype for the two shapes
 *  that have no distinct variant — honest saturation, not a silent miss. */
export const geometryFor = (
  shape: DiShapeName,
  exemplar: ShapeExemplar = 'prototype',
): ShapeGeometry => SHAPE_GEOMETRY[shape][exemplar];

/** `points` as an SVG `polygon` attribute string. */
export const pointsAttr = (points: ReadonlyArray<readonly [number, number]>): string =>
  points.map(([x, y]) => `${x},${y}`).join(' ');

/** Edge lengths of a polygon, in order. Used by the geometry guards. */
export const sideLengths = (points: ReadonlyArray<readonly [number, number]>): number[] =>
  points.map(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return Math.hypot(nx - x, ny - y);
  });

/** Interior angles in degrees, in order. */
export const interiorAngles = (points: ReadonlyArray<readonly [number, number]>): number[] =>
  points.map(([x, y], i) => {
    const [px, py] = points[(i - 1 + points.length) % points.length];
    const [nx, ny] = points[(i + 1) % points.length];
    const a = [px - x, py - y];
    const b = [nx - x, ny - y];
    const dot = a[0] * b[0] + a[1] * b[1];
    const mag = Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]);
    return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
  });
