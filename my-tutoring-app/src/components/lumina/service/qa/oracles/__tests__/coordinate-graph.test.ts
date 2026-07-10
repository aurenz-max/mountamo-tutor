import { describe, expect, it } from 'vitest';
import { coordinateGraphOracle, parseEquationLabel } from '../coordinate-graph';

/**
 * Seeded-violation tests — every check class must be proven to fire. Fixtures
 * mirror the generator's real output shape (gemini-coordinate-graph.ts:
 * flat challenges with x1/y1/x2/y2, option0..option3 strings,
 * correctOptionIndex, top-level gridMin/gridMax).
 */

const ctx = {
  componentId: 'coordinate-graph',
  evalMode: 'plot_point',
  topic: 'Plotting points in four quadrants',
  gradeLevel: 'Grade 6',
};

function session(challenges: Array<Record<string, unknown>>, over: Record<string, unknown> = {}) {
  return {
    title: 'Coordinate Graph: Plotting Points',
    description: 'Practice coordinate plane skills with plotting points',
    gridMin: -10,
    gridMax: 10,
    gradeBand: '6-8',
    challenges,
    ...over,
  };
}

function plotCh(id: string, x: number, y: number, over: Record<string, unknown> = {}) {
  return {
    id,
    type: 'plot_point',
    instruction: `Plot the point (${x}, ${y}) on the coordinate plane`,
    hint: 'The first number tells you how far to move along the x-axis.',
    x1: x, y1: y, x2: 0, y2: 0,
    ...over,
  };
}

function readCh(id: string, x: number, y: number, over: Record<string, unknown> = {}) {
  return {
    id,
    type: 'read_point',
    instruction: 'What are the coordinates of the highlighted point?',
    hint: 'Read the x value first, then the y value.',
    x1: x, y1: y, x2: 0, y2: 0,
    option0: `(${x}, ${y})`,
    option1: `(${y}, ${x})`,
    option2: `(${-x}, ${y})`,
    option3: `(${x}, ${-y})`,
    correctOptionIndex: 0,
    ...over,
  };
}

function slopeCh(
  id: string,
  x1: number, y1: number, x2: number, y2: number,
  options: [string, string, string, string],
  over: Record<string, unknown> = {},
) {
  return {
    id,
    type: 'find_slope',
    instruction: 'Find the slope of the line through the two points shown.',
    hint: 'Divide the change in y by the change in x.',
    x1, y1, x2, y2,
    option0: options[0], option1: options[1], option2: options[2], option3: options[3],
    correctOptionIndex: 0,
    ...over,
  };
}

function interceptCh(
  id: string,
  x1: number, y1: number, x2: number, y2: number,
  options: [string, string, string, string],
  equationLabel: string,
  over: Record<string, unknown> = {},
) {
  return {
    id,
    type: 'find_intercept',
    instruction: 'Where does this line cross the y-axis?',
    hint: 'Follow the line to where it meets the vertical axis.',
    x1, y1, x2, y2,
    option0: options[0], option1: options[1], option2: options[2], option3: options[3],
    correctOptionIndex: 0,
    equationLabel,
    ...over,
  };
}

const cleanPlot = session([
  plotCh('pp-0', 3, -2),
  plotCh('pp-1', -5, 4),
  plotCh('pp-2', 7, 6),
  plotCh('pp-3', -1, -8),
]);

const cleanRead = session([
  readCh('rp-0', 3, 5),
  readCh('rp-1', -4, 6),
  readCh('rp-2', 7, -2),
  readCh('rp-3', -6, -3),
]);

const cleanSlope = session([
  slopeCh('fs-0', 1, 1, 4, 7, ['2', '1/2', '-2', '3']),
  slopeCh('fs-1', -3, 2, 3, -2, ['-2/3', '-3/2', '2/3', '1']),
  slopeCh('fs-2', 0, -2, 4, 0, ['1/2', '2', '-1/2', '0']),
  slopeCh('fs-3', -2, 5, 2, 5, ['0', '1', '-1', 'undefined']),
]);

const cleanIntercept = session([
  interceptCh('fi-0', 1, 5, 3, 9, ['3', '2', '-3', '5'], 'y = 2x + 3'),
  interceptCh('fi-1', -2, 4, 2, 0, ['2', '-2', '4', '1'], 'y = -x + 2'),
  interceptCh('fi-2', 2, 1, 4, 2, ['0', '1', '2', '-1'], 'y = 1/2x'),
  interceptCh('fi-3', -1, 6, 1, 2, ['4', '-4', '-2', '2'], 'y = -2x + 4'),
]);

describe('coordinate-graph oracle', () => {
  it('passes clean plot_point data', () => {
    expect(coordinateGraphOracle.verify(cleanPlot, ctx).violations).toEqual([]);
  });

  it('passes clean read_point data', () => {
    expect(coordinateGraphOracle.verify(cleanRead, { ...ctx, evalMode: 'read_point' }).violations).toEqual([]);
  });

  it('passes clean find_slope data', () => {
    expect(coordinateGraphOracle.verify(cleanSlope, { ...ctx, evalMode: 'find_slope' }).violations).toEqual([]);
  });

  it('passes clean find_intercept data', () => {
    expect(coordinateGraphOracle.verify(cleanIntercept, { ...ctx, evalMode: 'find_intercept' }).violations).toEqual([]);
  });

  it('flags answer-key desync — plot_point instruction states a different point than the key judges', () => {
    const data = session([
      ...cleanPlot.challenges.slice(0, 3),
      plotCh('pp-3', -1, -8, { instruction: 'Plot the point (2, 6) on the coordinate plane' }),
    ]);
    const v = coordinateGraphOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pp-3')).toBe(true);
  });

  it('flags answer-key desync — plot_point instruction never states a target pair', () => {
    const data = session([
      ...cleanPlot.challenges.slice(0, 3),
      plotCh('pp-3', -1, -8, { instruction: 'Plot the mystery point on the coordinate plane' }),
    ]);
    const v = coordinateGraphOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pp-3' && x.detail.includes('unguessable'))).toBe(true);
  });

  it('flags answer-key desync — non-integer plot target is unreachable on the snap grid', () => {
    const data = session([...cleanPlot.challenges.slice(0, 3), plotCh('pp-3', 3.5, 2)]);
    const v = coordinateGraphOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pp-3' && x.detail.includes('unreachable'))).toBe(true);
  });

  it('flags answer-key desync — plot target outside the plotted grid range', () => {
    const data = session([...cleanPlot.challenges.slice(0, 3), plotCh('pp-3', 12, 3)]);
    const v = coordinateGraphOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pp-3' && x.detail.includes('unclickable'))).toBe(true);
  });

  it('flags answer-key desync — read_point key option names a different point than the one drawn', () => {
    const data = session([
      ...cleanRead.challenges.slice(0, 3),
      readCh('rp-3', -6, -3, { correctOptionIndex: 1 }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'rp-3')).toBe(true);
  });

  it('flags answer-key desync — two read_point options parse to the drawn point (ambiguity)', () => {
    const data = session([
      ...cleanRead.challenges.slice(0, 3),
      readCh('rp-3', -6, -3, { option2: '(-6,-3)' }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'rp-3' && x.detail.includes('twin'))).toBe(true);
  });

  it('flags answer-key desync — find_slope key option disagrees with the geometric slope', () => {
    const data = session([
      ...cleanSlope.challenges.slice(0, 3),
      slopeCh('fs-3', -2, 5, 2, 5, ['1', '0', '-1', 'undefined']), // true slope 0, key says 1
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'find_slope' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fs-3')).toBe(true);
  });

  it('flags answer-key desync — find_slope vertical line has no correct option', () => {
    const data = session([
      ...cleanSlope.challenges.slice(0, 3),
      slopeCh('fs-3', 2, 5, 2, -1, ['3', '-3', '1/3', '0']),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'find_slope' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fs-3' && x.detail.includes('vertical'))).toBe(true);
  });

  it('flags answer-key desync — find_intercept crossing lies outside the plotted grid', () => {
    const data = session([
      ...cleanIntercept.challenges.slice(0, 3),
      // slope -10 through (3, 9) and (4, -1): crossing at y = 39, off-canvas.
      interceptCh('fi-3', 3, 9, 4, -1, ['39', '-39', '9', '3'], 'y = -10x + 39'),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'find_intercept' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fi-3' && x.detail.includes('off-canvas'))).toBe(true);
  });

  it('flags answer-key desync — the equation banner contradicts the drawn line', () => {
    const data = session([
      ...cleanIntercept.challenges.slice(0, 3),
      interceptCh('fi-3', -1, 6, 1, 2, ['4', '-4', '-2', '2'], 'y = -2x + 7'),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'find_intercept' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fi-3' && x.detail.includes('banner'))).toBe(true);
  });

  it('flags answer leak — read_point hint states the asked coordinate pair', () => {
    const data = session([
      ...cleanRead.challenges.slice(0, 3),
      readCh('rp-3', -6, -3, { hint: 'The point sits at (-6, -3) on the grid.' }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'rp-3')).toBe(true);
  });

  it('flags answer leak — find_slope hint states the slope value', () => {
    const data = session([
      ...cleanSlope.challenges.slice(0, 3),
      slopeCh('fs-3', -2, 5, 2, 5, ['0', '1', '-1', 'undefined'], {
        hint: 'Remember the slope is 0 for a horizontal line like this one.',
      }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'find_slope' }).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'fs-3')).toBe(true);
  });

  it('flags answer leak — find_intercept hint states the intercept value', () => {
    const data = session([
      ...cleanIntercept.challenges.slice(0, 3),
      interceptCh('fi-3', -1, 6, 1, 2, ['4', '-4', '-2', '2'], 'y = -2x + 4', {
        hint: 'The y-intercept is 4 — look where the line crosses.',
      }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'find_intercept' }).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'fi-3')).toBe(true);
  });

  it('flags answer leak — medium/hard tier withholds the equation label but the flag leaves it visible', () => {
    const leaky = session([
      ...cleanIntercept.challenges.slice(0, 3),
      interceptCh('fi-3', -1, 6, 1, 2, ['4', '-4', '-2', '2'], 'y = -2x + 4', {
        supportTier: 'hard',
        showEquationLabel: true,
        showInterceptMarker: false,
      }),
    ]);
    const v = coordinateGraphOracle.verify(leaky, { ...ctx, evalMode: 'find_intercept' }).violations;
    expect(v.some((x) => x.check === 'answer-leak' && x.where === 'fi-3' && x.detail.includes('tier'))).toBe(true);

    // Properly withheld label must NOT read as a leak.
    const withheld = session([
      ...cleanIntercept.challenges.slice(0, 3),
      interceptCh('fi-3', -1, 6, 1, 2, ['4', '-4', '-2', '2'], 'y = -2x + 4', {
        supportTier: 'hard',
        showEquationLabel: false,
        showInterceptMarker: false,
      }),
    ]);
    const v2 = coordinateGraphOracle.verify(withheld, { ...ctx, evalMode: 'find_intercept' }).violations;
    expect(v2.some((x) => x.check === 'answer-leak')).toBe(false);
  });

  it('flags scope — the session delivers a different eval mode than requested', () => {
    const v = coordinateGraphOracle.verify(cleanPlot, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags scope — coordinates exceed the topic ceiling', () => {
    const v = coordinateGraphOracle.verify(cleanPlot, { ...ctx, topic: 'Plotting points within 5' }).violations;
    expect(v.some((x) => x.check === 'scope' && x.detail.includes('ceiling 5'))).toBe(true);
  });

  it('flags scope — ctx.scopeMax overrides the topic ceiling', () => {
    const v = coordinateGraphOracle.verify(cleanPlot, { ...ctx, scopeMax: 6 }).violations;
    expect(v.some((x) => x.check === 'scope' && x.detail.includes('ceiling 6'))).toBe(true);
  });

  it('flags clustering — every line has the same slope', () => {
    const data = session([
      slopeCh('fs-0', 1, 1, 4, 7, ['2', '1/2', '-2', '3']),
      slopeCh('fs-1', 0, -3, 2, 1, ['2', '-2', '1/2', '4']),
      slopeCh('fs-2', -4, -5, -1, 1, ['2', '3', '-1/2', '0']),
      slopeCh('fs-3', 2, 0, 5, 6, ['2', '6', '1/3', '-2']),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'find_slope' }).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — a byte-identical card appears twice', () => {
    const data = session([
      readCh('rp-0', 3, 5),
      readCh('rp-1', 3, 5),
      readCh('rp-2', -4, 6),
      readCh('rp-3', 7, -2),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'clustering' && x.detail.includes('identical card'))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = session([plotCh('pp-0', 3, -2)]);
    const v = coordinateGraphOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags a missing MC option as schema', () => {
    const data = session([
      ...cleanRead.challenges.slice(0, 3),
      readCh('rp-3', -6, -3, { option2: '' }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'rp-3')).toBe(true);
  });

  it('flags duplicate MC options as schema', () => {
    const data = session([
      ...cleanRead.challenges.slice(0, 3),
      readCh('rp-3', -6, -3, { option1: '(-6, -3)' }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'rp-3' && x.detail.includes('duplicate'))).toBe(true);
  });

  it('flags a missing correctOptionIndex as schema (unwinnable card)', () => {
    const data = session([
      ...cleanRead.challenges.slice(0, 3),
      readCh('rp-3', -6, -3, { correctOptionIndex: undefined }),
    ]);
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'rp-3' && x.detail.includes('unwinnable'))).toBe(true);
  });

  it('flags a malformed grid range as schema', () => {
    const data = session(cleanRead.challenges, { gridMin: 10, gridMax: 10 });
    const v = coordinateGraphOracle.verify(data, { ...ctx, evalMode: 'read_point' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'gridMin/gridMax')).toBe(true);
  });

  it('reports unknown challenge types as unchecked, not passed', () => {
    const data = session([
      ...cleanPlot.challenges.slice(0, 3),
      { ...plotCh('pp-3', -1, -8), type: 'mystery_mode' },
    ]);
    const r = coordinateGraphOracle.verify(data, ctx);
    expect(r.uncheckedTypes).toContain('mystery_mode');
  });
});

describe('parseEquationLabel', () => {
  it('parses the generator label forms', () => {
    expect(parseEquationLabel('y = 2x + 3')).toEqual({ slope: 2, yIntercept: 3 });
    expect(parseEquationLabel('y = -x + 2')).toEqual({ slope: -1, yIntercept: 2 });
    expect(parseEquationLabel('y = x')).toEqual({ slope: 1, yIntercept: 0 });
    expect(parseEquationLabel('y = 1/2x')).toEqual({ slope: 0.5, yIntercept: 0 });
    expect(parseEquationLabel('y = -2/3x - 1')).toEqual({ slope: -2 / 3, yIntercept: -1 });
    expect(parseEquationLabel('y = 2*x + 5')).toEqual({ slope: 2, yIntercept: 5 });
    // The generator fallback's ugly "+ -3" form must still parse.
    expect(parseEquationLabel('y = 2x + -3')).toEqual({ slope: 2, yIntercept: -3 });
    expect(parseEquationLabel('a mystery line')).toBeNull();
  });
});
