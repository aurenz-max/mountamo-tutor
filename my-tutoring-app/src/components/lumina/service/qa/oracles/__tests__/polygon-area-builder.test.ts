import { describe, expect, it } from 'vitest';
import { leakedAreaValues, polygonAreaBuilderOracle } from '../polygon-area-builder';

/**
 * Seeded-violation tests — every check class must be proven to fire. Fixtures
 * mirror the generator's real output shape (gemini-polygon-area-builder.ts
 * builds ALL figures in code — dimensions, parts, vertices, expectedArea; the
 * LLM writes only the wrapper title/description/challengeType/gradeBand).
 */

const baseCtx = {
  componentId: 'polygon-area-builder',
  evalMode: 'find_area_triangle_parallelogram',
  topic: 'Area of triangles and parallelograms',
  gradeLevel: 'Grade 6',
};

type Over = Record<string, unknown>;

function triangle(id: string, base: number, height: number, over: Over = {}) {
  return {
    id,
    type: 'find_area_triangle_parallelogram',
    figureType: 'triangle',
    base,
    height,
    apexX: Math.max(1, Math.floor(base / 3)),
    expectedArea: (base * height) / 2,
    unitLabel: 'cm',
    narration: 'A sail on a sailboat is shaped like this triangle.',
    instruction: 'Find the area of this triangle.',
    hint: 'A triangle is half of a rectangle. Use the perpendicular (dashed) height, not a slanted side.',
    ...over,
  };
}

function parallelogram(id: string, base: number, height: number, over: Over = {}) {
  return {
    id,
    type: 'find_area_triangle_parallelogram',
    figureType: 'parallelogram',
    base,
    height,
    skew: 2,
    expectedArea: base * height,
    unitLabel: 'm',
    narration: 'A parking space painted at a slant is shaped like this parallelogram.',
    instruction: 'Find the area of this parallelogram.',
    hint: 'Area of a parallelogram = base times height. Use the perpendicular (dashed) height.',
    ...over,
  };
}

function decompose(id: string, base: number, height: number, skew: number, over: Over = {}) {
  return {
    id,
    type: 'decompose',
    figureType: 'parallelogram',
    base,
    height,
    skew,
    expectedArea: base * height,
    unitLabel: 'ft',
    narration: 'A floor tile is shaped like this parallelogram.',
    instruction: 'Drag the cut triangle across to rebuild it as a rectangle, then enter base times height.',
    hint: 'A parallelogram rearranges into a rectangle with the SAME base and height.',
    ...over,
  };
}

function trapezoid(id: string, base: number, base2: number, height: number, topOffset: number, over: Over = {}) {
  return {
    id,
    type: 'find_area_trapezoid',
    figureType: 'trapezoid',
    base,
    base2,
    height,
    topOffset,
    expectedArea: ((base + base2) * height) / 2,
    unitLabel: 'in',
    narration: 'A garden plot is shaped like this trapezoid.',
    instruction: 'Find the area of this trapezoid.',
    hint: 'Average the two bases, then multiply by the height: ½ × (b₁ + b₂) × height.',
    ...over,
  };
}

function composite(id: string, parts: Array<{ x: number; y: number; w: number; h: number }>, over: Over = {}) {
  return {
    id,
    type: 'composite_area',
    figureType: 'composite',
    parts,
    expectedArea: parts.reduce((s, p) => s + p.w * p.h, 0),
    unitLabel: 'yd',
    narration: 'An L-shaped room floor is shaped like this figure.',
    instruction: 'Split the figure into rectangles, find each area, then add them up.',
    hint: 'Break the L-shape into two rectangles. Find length times width for each piece, then add the areas.',
    ...over,
  };
}

function coordinate(id: string, vertices: Array<{ x: number; y: number }>, expectedArea: number, over: Over = {}) {
  return {
    id,
    type: 'coordinate_polygon',
    figureType: 'coordinate',
    vertices,
    expectedArea,
    unitLabel: 'units',
    narration: 'A park drawn on a city map grid — find its area from the corner coordinates.',
    instruction: 'Find the area of this polygon using its vertex coordinates.',
    hint: 'Count the width and height between corners. A rectangle is width times height.',
    ...over,
  };
}

function session(challengeType: string, challenges: unknown[]) {
  return {
    title: 'Polygon Area Workshop',
    description: 'Practice finding the area of polygons by decomposing them into shapes you know.',
    challengeType,
    gradeBand: '6',
    challenges,
  } as Record<string, unknown>;
}

const cleanTriPara = session('find_area_triangle_parallelogram', [
  triangle('pab-1', 8, 4),          // 16
  parallelogram('pab-2', 6, 5),     // 30
  triangle('pab-3', 6, 6),          // 18
  parallelogram('pab-4', 9, 4),     // 36
]);

describe('polygon-area-builder oracle', () => {
  // ── clean fixtures: one per mode, zero violations ──

  it('passes clean find_area_triangle_parallelogram data', () => {
    expect(polygonAreaBuilderOracle.verify(cleanTriPara, baseCtx).violations).toEqual([]);
  });

  it('passes clean decompose data', () => {
    const data = session('decompose', [
      decompose('pab-1', 5, 3, 2),   // 15
      decompose('pab-2', 8, 4, 3),   // 32
      decompose('pab-3', 10, 6, 4),  // 60
      decompose('pab-4', 7, 9, 1),   // 63
    ]);
    expect(polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'decompose' }).violations).toEqual([]);
  });

  it('passes clean find_area_trapezoid data (isosceles, right, and scalene offsets)', () => {
    const data = session('find_area_trapezoid', [
      trapezoid('pab-1', 8, 4, 3, 2),   // 18, isosceles
      trapezoid('pab-2', 10, 6, 4, 0),  // 32, right
      trapezoid('pab-3', 7, 3, 4, 1),   // 20, scalene
      trapezoid('pab-4', 12, 4, 5, 4),  // 40
    ]);
    expect(polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'find_area_trapezoid' }).violations).toEqual([]);
  });

  it('passes clean composite_area data (incl. a hard-tier union-outline card)', () => {
    const data = session('composite_area', [
      composite('pab-1', [{ x: 0, y: 0, w: 6, h: 2 }, { x: 0, y: 2, w: 3, h: 3 }]),                                     // 21
      composite('pab-2', [{ x: 0, y: 0, w: 8, h: 3 }, { x: 5, y: 3, w: 3, h: 2 }]),                                     // 30
      composite('pab-3', [{ x: 0, y: 0, w: 5, h: 4 }, { x: 0, y: 4, w: 2, h: 2 }], { showDecompositionGuides: false }), // 24
      composite('pab-4', [{ x: 0, y: 0, w: 7, h: 2 }, { x: 0, y: 2, w: 2, h: 3 }, { x: 2, y: 2, w: 3, h: 2 }]),         // 26, 3-piece T
    ]);
    expect(polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'composite_area' }).violations).toEqual([]);
  });

  it('passes clean coordinate_polygon data (rectangle, right triangle, L-hexagon)', () => {
    const data = session('coordinate_polygon', [
      coordinate('pab-1', [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 1, y: 4 }], 15),
      coordinate('pab-2', [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }], 12),
      coordinate('pab-3', [
        { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 5 }, { x: 0, y: 5 },
      ], 16),
      coordinate('pab-4', [{ x: 2, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 5 }, { x: 2, y: 5 }], 28),
    ]);
    expect(polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'coordinate_polygon' }).violations).toEqual([]);
  });

  // ── answer-key-desync ──

  it('flags answer-key desync — expectedArea disagrees with the drawn triangle', () => {
    const data = session('find_area_triangle_parallelogram', [
      triangle('pab-1', 8, 4),
      parallelogram('pab-2', 6, 5),
      triangle('pab-3', 6, 6),
      triangle('pab-4', 9, 4, { expectedArea: 36 }), // drawn: ½·9·4 = 18
    ]);
    const v = polygonAreaBuilderOracle.verify(data, baseCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-4' && x.detail.includes('marked wrong'))).toBe(true);
  });

  it('flags answer-key desync — degenerate trapezoid (zero height)', () => {
    const data = session('find_area_trapezoid', [
      trapezoid('pab-1', 8, 4, 3, 2),
      trapezoid('pab-2', 10, 6, 4, 0),
      trapezoid('pab-3', 7, 3, 0, 1), // height 0 → nothing drawable
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'find_area_trapezoid' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-3' && x.detail.includes('degenerate'))).toBe(true);
  });

  it('flags answer-key desync — decompose cut triangle unreachable (skew outside [1, base−1])', () => {
    const data = session('decompose', [
      decompose('pab-1', 5, 3, 2),
      decompose('pab-2', 8, 4, 3),
      decompose('pab-3', 6, 5, 0),  // zero-area grab target — input never unlocks
      decompose('pab-4', 6, 4, 6),  // skew = base — reversed remaining quad
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'decompose' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-3' && x.detail.includes('unreachable'))).toBe(true);
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-4')).toBe(true);
  });

  it('flags answer-key desync — overlapping composite parts (key counts a region twice)', () => {
    const data = session('composite_area', [
      composite('pab-1', [{ x: 0, y: 0, w: 6, h: 2 }, { x: 0, y: 2, w: 3, h: 3 }]),
      composite('pab-2', [{ x: 0, y: 0, w: 8, h: 3 }, { x: 5, y: 3, w: 3, h: 2 }]),
      composite('pab-3', [{ x: 0, y: 0, w: 6, h: 3 }, { x: 2, y: 1, w: 3, h: 4 }]), // overlap 3×2
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'composite_area' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-3' && x.detail.includes('overlap'))).toBe(true);
  });

  it('flags answer-key desync — hard-tier union outline with 3 parts (2-rect walk contract)', () => {
    const data = session('composite_area', [
      composite('pab-1', [{ x: 0, y: 0, w: 6, h: 2 }, { x: 0, y: 2, w: 3, h: 3 }]),
      composite('pab-2', [{ x: 0, y: 0, w: 8, h: 3 }, { x: 5, y: 3, w: 3, h: 2 }]),
      composite('pab-3', [
        { x: 0, y: 0, w: 7, h: 2 }, { x: 0, y: 2, w: 2, h: 3 }, { x: 2, y: 2, w: 3, h: 2 },
      ], { showDecompositionGuides: false }),
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'composite_area' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-3' && x.detail.includes('union outline'))).toBe(true);
  });

  it('flags answer-key desync — self-intersecting coordinate polygon', () => {
    const bowtie = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }];
    const data = session('coordinate_polygon', [
      coordinate('pab-1', [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 1, y: 4 }], 15),
      coordinate('pab-2', [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }], 12),
      coordinate('pab-3', bowtie, 8),
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'coordinate_polygon' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-3' && x.detail.includes('self-intersects'))).toBe(true);
  });

  it('flags answer-key desync — coordinate key disagrees with the shoelace of the plotted vertices', () => {
    const data = session('coordinate_polygon', [
      coordinate('pab-1', [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 1, y: 4 }], 15),
      coordinate('pab-2', [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }], 12),
      coordinate('pab-3', [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 3 }], 20), // drawn: 15
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'coordinate_polygon' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-3' && x.detail.includes('marked wrong'))).toBe(true);
  });

  it('flags answer-key desync — negative vertex plots off the origin-anchored grid', () => {
    const data = session('coordinate_polygon', [
      coordinate('pab-1', [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 1, y: 4 }], 15),
      coordinate('pab-2', [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }], 12),
      coordinate('pab-3', [{ x: -2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: -2, y: 3 }], 18),
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'coordinate_polygon' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pab-3' && x.detail.includes('first quadrant'))).toBe(true);
  });

  // ── scope ──

  it('flags scope — the produced area exceeds the harness scopeMax', () => {
    const v = polygonAreaBuilderOracle.verify(cleanTriPara, { ...baseCtx, scopeMax: 25 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.detail.includes('exceeds objective ceiling 25'))).toBe(true);
  });

  it('flags scope — the produced area exceeds the topic ceiling', () => {
    const v = polygonAreaBuilderOracle.verify(cleanTriPara, { ...baseCtx, topic: 'Areas within 20' }).violations;
    expect(v.filter((x) => x.check === 'scope').length).toBeGreaterThanOrEqual(2); // 30 and 36 both exceed 20
  });

  it('flags scope — the session delivers a different eval mode than requested', () => {
    const v = polygonAreaBuilderOracle.verify(cleanTriPara, { ...baseCtx, evalMode: 'find_area_trapezoid' }).violations;
    expect(v.some((x) => x.check === 'scope' && x.detail.includes('task identity'))).toBe(true);
  });

  // ── answer-leak ──

  it('flags answer leak — the hint states the asked area value', () => {
    const data = session('find_area_triangle_parallelogram', [
      triangle('pab-1', 8, 4),
      parallelogram('pab-2', 6, 5),
      triangle('pab-3', 6, 6),
      parallelogram('pab-4', 9, 4, { hint: 'Multiply carefully — the area is 36 here.' }),
    ]);
    const v = polygonAreaBuilderOracle.verify(data, baseCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'pab-4')).toBe(true);
  });

  it('flags answer leak — the narration states the area with squared units', () => {
    const data = session('composite_area', [
      composite('pab-1', [{ x: 0, y: 0, w: 6, h: 2 }, { x: 0, y: 2, w: 3, h: 3 }]),
      composite('pab-2', [{ x: 0, y: 0, w: 8, h: 3 }, { x: 5, y: 3, w: 3, h: 2 }]),
      composite('pab-3', [{ x: 0, y: 0, w: 5, h: 4 }, { x: 0, y: 4, w: 2, h: 2 }], {
        narration: 'An L-shaped room floor covering 24 yd² is shaped like this figure.',
      }),
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'composite_area' }).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'pab-3')).toBe(true);
  });

  it('does NOT flag dimension mentions as leaks (intended scaffolding)', () => {
    const data = session('find_area_triangle_parallelogram', [
      triangle('pab-1', 8, 4, { hint: 'The base is 8 cm and the height is 4 cm — a triangle is half of base times height.' }),
      parallelogram('pab-2', 6, 5),
      triangle('pab-3', 6, 6),
      parallelogram('pab-4', 9, 4),
    ]);
    const v = polygonAreaBuilderOracle.verify(data, baseCtx).violations;
    expect(v.filter((x) => x.check === 'answer-leak')).toEqual([]);
  });

  // ── clustering ──

  it('flags clustering — every figure has the same area', () => {
    const data = session('find_area_triangle_parallelogram', [
      triangle('pab-1', 8, 6),        // 24
      triangle('pab-2', 12, 4),       // 24
      parallelogram('pab-3', 6, 4),   // 24
      parallelogram('pab-4', 8, 3),   // 24
    ]);
    const v = polygonAreaBuilderOracle.verify(data, baseCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('cluster'))).toBe(true);
  });

  it('flags clustering — a byte-identical figure card appears twice', () => {
    const data = session('find_area_trapezoid', [
      trapezoid('pab-1', 8, 4, 3, 2),
      trapezoid('pab-2', 8, 4, 3, 2), // identical drawn figure
      trapezoid('pab-3', 10, 6, 4, 0),
      trapezoid('pab-4', 7, 3, 4, 1),
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'find_area_trapezoid' }).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('identical figure'))).toBe(true);
  });

  // ── schema ──

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = session('find_area_triangle_parallelogram', [triangle('pab-1', 8, 4)]);
    const v = polygonAreaBuilderOracle.verify(data, baseCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });

  it('flags schema — missing dimensions on a drawn figure', () => {
    const broken = triangle('pab-4', 9, 4) as Record<string, unknown>;
    delete broken.base;
    const data = session('find_area_triangle_parallelogram', [
      triangle('pab-1', 8, 4),
      parallelogram('pab-2', 6, 5),
      triangle('pab-3', 6, 6),
      broken,
    ]);
    const v = polygonAreaBuilderOracle.verify(data, baseCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'pab-4' && x.detail.includes('missing dimensions'))).toBe(true);
  });

  it('flags schema — figureType outside the challenge type family', () => {
    const data = session('find_area_trapezoid', [
      trapezoid('pab-1', 8, 4, 3, 2),
      trapezoid('pab-2', 10, 6, 4, 0),
      { ...trapezoid('pab-3', 7, 3, 4, 1), figureType: 'triangle' },
    ]);
    const v = polygonAreaBuilderOracle.verify(data, { ...baseCtx, evalMode: 'find_area_trapezoid' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'pab-3' && x.detail.includes('figureType'))).toBe(true);
  });

  it('reports unknown challenge types as unchecked, not passed', () => {
    const data = session('find_area_triangle_parallelogram', [
      triangle('pab-1', 8, 4),
      parallelogram('pab-2', 6, 5),
      triangle('pab-3', 6, 6),
      { ...triangle('pab-4', 9, 4), type: 'mystery_mode' },
    ]);
    const r = polygonAreaBuilderOracle.verify(data, baseCtx);
    expect(r.uncheckedTypes).toContain('mystery_mode');
  });
});

describe('leakedAreaValues', () => {
  it('matches labeled and squared-unit area statements, not dimension mentions', () => {
    expect(leakedAreaValues('The area is 24 here.')).toContain(24);
    expect(leakedAreaValues('Answer: 18')).toContain(18);
    expect(leakedAreaValues('It covers 30 cm² of floor.')).toContain(30);
    expect(leakedAreaValues('about 12 square feet')).toContain(12);
    expect(leakedAreaValues('The base is 8 cm and the height is 4 cm.')).toEqual([]);
    expect(leakedAreaValues('½ × (b₁ + b₂) × height')).toEqual([]);
  });
});
