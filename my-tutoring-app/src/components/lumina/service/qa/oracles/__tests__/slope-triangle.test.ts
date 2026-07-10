import { describe, expect, it } from 'vitest';
import { parseLineEquation, slopeTriangleOracle } from '../slope-triangle';

/**
 * Seeded-violation tests — every check class must be proven to fire. Fixtures
 * mirror the generator's real output shape (gemini-slope-triangle.ts builds all
 * numbers in code; the LLM only writes the wrapper).
 */

const ctx = {
  componentId: 'slope-triangle',
  evalMode: 'identify_slope',
  topic: 'Finding slope from a graph',
  gradeLevel: 'Grade 8',
};

interface ChSpec {
  id: string;
  type?: string;
  slope: number;
  b: number;
  x: number;
  run: number;
  label?: string;
  equation?: string;
  rise?: number;
  expectedSlope?: number;
  size?: number;
  showMeasurements?: boolean;
  instruction?: string;
  hint?: string;
}

function fmt(slope: number, b: number): string {
  const slopePart = slope === 1 ? 'x' : slope === -1 ? '-x' : `${slope}x`;
  if (b === 0) return `y = ${slopePart}`;
  return b > 0 ? `y = ${slopePart} + ${b}` : `y = ${slopePart} - ${Math.abs(b)}`;
}

function ch(spec: ChSpec) {
  const type = spec.type ?? 'identify_slope';
  const isDraw = type === 'draw_triangle';
  const rise = spec.rise ?? spec.slope * spec.run;
  return {
    id: spec.id,
    type,
    attachedLine: {
      equation: spec.equation ?? spec.label ?? fmt(spec.slope, spec.b),
      slope: spec.slope,
      yIntercept: spec.b,
      color: '#3b82f6',
      label: spec.label ?? fmt(spec.slope, spec.b),
    },
    triangle: {
      position: { x: spec.x, y: 0 },
      size: spec.size ?? (isDraw ? 1 : spec.run),
      showMeasurements: spec.showMeasurements ?? false,
      showSlope: !isDraw,
      showAngle: false,
      notation: 'riseRun',
      color: '#10b981',
    },
    expectedRise: rise,
    expectedRun: spec.run,
    expectedSlope: spec.expectedSlope ?? spec.slope,
    instruction: spec.instruction ?? 'Count the rise (vertical) and run (horizontal).',
    hint: spec.hint ?? 'Count grid squares vertically, then horizontally.',
  };
}

function session(challenges: ReturnType<typeof ch>[]) {
  return {
    title: 'Reading Slope Triangles',
    description: 'Read rise and run off pre-drawn slope triangles.',
    xRange: [-10, 10],
    yRange: [-10, 10],
    notation: 'riseRun',
    gradeBand: '7-8',
    challenges,
  };
}

const clean = session([
  ch({ id: 'st-1', slope: 2, b: 1, x: 0, run: 2 }),
  ch({ id: 'st-2', slope: -1, b: 3, x: -2, run: 3, label: 'y = -x + 3' }),
  ch({ id: 'st-3', slope: 0.5, b: -2, x: 0, run: 2, label: 'y = 0.5x - 2' }),
  ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2 }),
]);

describe('slope-triangle oracle', () => {
  it('passes clean identify_slope data', () => {
    expect(slopeTriangleOracle.verify(clean, ctx).violations).toEqual([]);
  });

  it('passes clean draw_triangle data — the placeholder seed size must NOT read as a desync', () => {
    const data = session([
      ch({ id: 'st-1', type: 'draw_triangle', slope: 2, b: 0, x: 1, run: 3, size: 1 }),
      ch({ id: 'st-2', type: 'draw_triangle', slope: -1, b: 2, x: 0, run: 2, size: 1, label: 'y = -x + 2' }),
      ch({ id: 'st-3', type: 'draw_triangle', slope: 1, b: -3, x: 2, run: 4, size: 1, label: 'y = x - 3', equation: 'y = x - 3' }),
    ]);
    expect(slopeTriangleOracle.verify(data, { ...ctx, evalMode: 'draw_triangle' }).violations).toEqual([]);
  });

  it('flags answer-key desync — expectedSlope disagrees with the drawn line', () => {
    const data = session([...clean.challenges.slice(0, 3), ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2, expectedSlope: 2, rise: 6 })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'st-4')).toBe(true);
  });

  it('flags answer-key desync — expectedRise disagrees with the geometric rise (slope × run)', () => {
    const data = session([...clean.challenges.slice(0, 3), ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2, rise: 5 })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'st-4')).toBe(true);
  });

  it('flags answer-key desync — the drawn triangle run differs from the judged expectedRun', () => {
    const data = session([...clean.challenges.slice(0, 3), ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2, size: 3 })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'st-4')).toBe(true);
  });

  it('flags answer-key desync — draw_triangle target run outside the drag clamp [1, 8]', () => {
    const data = session([
      ch({ id: 'st-1', type: 'draw_triangle', slope: 1, b: 0, x: 0, run: 9, size: 1, label: 'y = x', equation: 'y = x' }),
      ch({ id: 'st-2', type: 'draw_triangle', slope: -1, b: 2, x: 0, run: 2, size: 1, label: 'y = -x + 2' }),
      ch({ id: 'st-3', type: 'draw_triangle', slope: 2, b: -3, x: 1, run: 3, size: 1 }),
    ]);
    const v = slopeTriangleOracle.verify(data, { ...ctx, evalMode: 'draw_triangle' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'st-1')).toBe(true);
  });

  it('flags answer-key desync — the triangle exits the viewport (uncountable leg)', () => {
    const data = session([...clean.challenges.slice(0, 3), ch({ id: 'st-4', slope: 3, b: 8, x: 0, run: 2 })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'st-4' && x.detail.includes('viewport'))).toBe(true);
  });

  it('flags answer-key desync — the equation banner contradicts the drawn line', () => {
    const data = session([...clean.challenges.slice(0, 3), ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2, label: 'y = 5x - 2' })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'st-4' && x.detail.includes('banner'))).toBe(true);
  });

  it('flags answer leak — identify_slope with numeric rise/run leg labels on', () => {
    const data = session([...clean.challenges.slice(0, 3), ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2, showMeasurements: true })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'st-4')).toBe(true);
  });

  it('flags answer leak — the hint states the asked rise value', () => {
    const data = session([
      ...clean.challenges.slice(0, 3),
      ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2, hint: 'Remember the rise is 6 here, so count carefully.' }),
    ]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'st-4')).toBe(true);
  });

  it('flags answer leak — a calculate hint states the slope value', () => {
    const data = session([
      ch({ id: 'st-1', type: 'calculate', slope: 2, b: 1, x: 0, run: 2, showMeasurements: true }),
      ch({ id: 'st-2', type: 'calculate', slope: -1, b: 3, x: -2, run: 3, label: 'y = -x + 3', showMeasurements: true }),
      ch({
        id: 'st-3', type: 'calculate', slope: 0.5, b: -2, x: 0, run: 2, label: 'y = 0.5x - 2',
        showMeasurements: true, hint: 'Divide the legs — the slope = 0.5 for this line.',
      }),
    ]);
    const v = slopeTriangleOracle.verify(data, { ...ctx, evalMode: 'calculate' }).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'st-3')).toBe(true);
    // The leg labels themselves are legitimate scaffolding for calculate.
    expect(v.some((x) => x.check === 'answer-leak' && x.detail.includes('leg labels'))).toBe(false);
  });

  it('flags scope — the session delivers a different eval mode than requested', () => {
    const v = slopeTriangleOracle.verify(clean, { ...ctx, evalMode: 'calculate' }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags clustering — every line has the same slope', () => {
    const data = session([
      ch({ id: 'st-1', slope: 2, b: 1, x: 0, run: 2 }),
      ch({ id: 'st-2', slope: 2, b: 3, x: -2, run: 3 }),
      ch({ id: 'st-3', slope: 2, b: -2, x: 1, run: 2 }),
      ch({ id: 'st-4', slope: 2, b: 0, x: 2, run: 4 }),
    ]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — a byte-identical card appears twice', () => {
    const data = session([
      ch({ id: 'st-1', slope: 2, b: 1, x: 0, run: 2 }),
      ch({ id: 'st-2', slope: 2, b: 1, x: 0, run: 2 }),
      ch({ id: 'st-3', slope: -1, b: 3, x: -2, run: 3, label: 'y = -x + 3' }),
      ch({ id: 'st-4', slope: 0.5, b: -2, x: 0, run: 2, label: 'y = 0.5x - 2' }),
    ]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('identical card'))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = session([ch({ id: 'st-1', slope: 2, b: 1, x: 0, run: 2 })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags an unparseable equation banner as schema', () => {
    const data = session([...clean.challenges.slice(0, 3), ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2, label: 'the line goes up by 3' })]);
    const v = slopeTriangleOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'st-4')).toBe(true);
  });

  it('reports unknown challenge types as unchecked, not passed', () => {
    const data = session([...clean.challenges.slice(0, 3), { ...ch({ id: 'st-4', slope: 3, b: -2, x: 0, run: 2 }), type: 'mystery_mode' }]);
    const r = slopeTriangleOracle.verify(data, ctx);
    expect(r.uncheckedTypes).toContain('mystery_mode');
  });
});

describe('parseLineEquation', () => {
  it('parses the generator label forms', () => {
    expect(parseLineEquation('y = x')).toEqual({ slope: 1, yIntercept: 0 });
    expect(parseLineEquation('y = -x')).toEqual({ slope: -1, yIntercept: 0 });
    expect(parseLineEquation('y = 2x + 1')).toEqual({ slope: 2, yIntercept: 1 });
    expect(parseLineEquation('y = -3x - 4')).toEqual({ slope: -3, yIntercept: -4 });
    expect(parseLineEquation('y = 0.67x - 1')).toEqual({ slope: 0.67, yIntercept: -1 });
    expect(parseLineEquation('y = 2*x + 5')).toEqual({ slope: 2, yIntercept: 5 });
    expect(parseLineEquation('a mystery line')).toBeNull();
  });
});
