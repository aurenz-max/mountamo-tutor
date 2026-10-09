/**
 * coordinate-graph levers: the leak rules per mode, the simplify builder over many item shapes, and "this wrong answer,
 * then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { CoordinateGraphChallenge } from './CoordinateGraph';
import {
  MODEL_LINE, MODEL_POINT, SIMPLER, captionLeaks, coordinateLevers, leverFacts, leverTextLeaks, lineModel, pointModel,
  practiceLeaks, ratioText, simplerItem,
} from './coordinateGraphLevers';
import {
  COORDINATE_MISSES_BY_MODE, choiceCorrect, coordinateMiss, interceptOf, keyText, optionIsKey, optionsOf, slopeOf,
  type CoordinateGraphMode,
} from './coordinateGraphWorkspace';

const G = { gridMin: -10, gridMax: 10 };
const Q1 = { gridMin: 0, gridMax: 10 };
const TIERS = [{}, { supportTier: 'easy' as const, showDropLines: true }, { supportTier: 'medium' as const, showHoverReadout: false,
  showRiseRunLabels: false, showEquationLabel: false }, { supportTier: 'hard' as const, showHoverReadout: false, showAxisLabels: false,
  showRiseRunGuides: false, showRiseRunLabels: false, showPointLabels: false, showEquationLabel: false, showInterceptMarker: false }];

/** Choices as the generator builds them: the key and three of its signature distractors (or plain neighbours). */
function choices(key: string, extra: string[]): Pick<CoordinateGraphChallenge, 'option0' | 'option1' | 'option2' | 'option3' | 'correctOptionIndex'> {
  const opts = [key, ...extra.filter((e, i, a) => e !== key && a.indexOf(e) === i)].slice(0, 4);
  return { option0: opts[1], option1: opts[0], option2: opts[2], option3: opts[3], correctOptionIndex: 1 };
}

function items(type: CoordinateGraphMode): CoordinateGraphChallenge[] {
  const out: CoordinateGraphChallenge[] = [];
  const base = { instruction: 'Ask', hint: '', x2: 0, y2: 0 };
  if (type === 'plot_point' || type === 'read_point') {
    for (const [x, y] of [[-4, 7], [5, -8], [-6, -3], [8, 2], [-9, -5], [2, 3], [0, 6], [7, 0], [-1, 1], [10, -10]]) TIERS.forEach((t, k) => {
      const c = { ...base, ...t, id: `${type}-${x}-${y}-${k}`, type, x1: x, y1: y, instruction: type === 'plot_point' ? `Plot the point (${x}, ${y}).` : 'Read it.' };
      out.push(type === 'plot_point' ? c : { ...c, ...choices(`(${x}, ${y})`, [`(${y}, ${x})`, `(${-x}, ${y})`, `(${x}, ${-y})`, `(${x + 1}, ${y})`, `(${x}, ${y + 1})`]) });
    });
  } else {
    for (const [x1, y1, x2, y2] of [[-4, 2, 2, 5], [-3, 6, 3, -2], [-5, -1, 1, 3], [-2, 4, 4, -2], [-6, 3, 2, 3], [1, 1, 4, 7], [0, 4, 2, 8],
      [-1, -2, 1, 2], [2, 1, 4, 2], [-2, 7, 1, -2], [3, -1, 6, -3]]) TIERS.forEach((t, k) => {
      const c = { ...base, ...t, id: `${type}-${x1}${y1}${x2}${y2}-${k}`, type, x1, y1, x2, y2 } as CoordinateGraphChallenge;
      const rise = y2 - y1, run = x2 - x1, b = interceptOf(c);
      if (type === 'find_intercept' && !Number.isInteger(b)) return;
      out.push(type === 'find_slope'
        ? { ...c, ...choices(ratioText(rise, run), [ratioText(-rise, run), rise ? ratioText(run, rise) : '1', `${rise}`, `${run}`, ratioText(rise + run, run)]) }
        : { ...c, equationLabel: `y = ${ratioText(rise, run)}x + ${b}`, ...choices(`${b}`, [`${-b}`, ratioText(rise, run), `${b + 1}`, `${b - 1}`, `${y1}`]) });
    });
  }
  return out;
}
const MODES = Object.keys(COORDINATE_MISSES_BY_MODE) as CoordinateGraphMode[];

it('the hand-built items are what the adapter accepts', () => {
  for (const t of MODES) for (const c of items(t)) if (t !== 'plot_point') {
    expect(optionsOf(c).filter(o => optionIsKey(c, o)), c.id).toHaveLength(1);
    expect(choiceCorrect(c, c.correctOptionIndex!), c.id).toBe(true);
  }
});

describe('simplify builder', () => {
  it.each(MODES)('%s: same mode, its own id and ask, other points and answer, solvable, deterministic', (type) => {
    let built = 0;
    for (const grid of type === 'plot_point' || type === 'read_point' ? [G, Q1] : [G]) for (const c of items(type)) {
      if (grid === Q1 && (c.x1 < 0 || c.y1 < 0)) continue;
      const s = simplerItem(c, grid);
      if (!s) continue;
      built++;
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(s.type).toBe(type);
      expect(practiceLeaks(c, s), c.id).toBe(false);
      expect(simplerItem(c, grid)).toEqual(s);
      expect([s.x1, s.y1, s.x2, s.y2].every(v => v >= grid.gridMin && v <= grid.gridMax), c.id).toBe(true);
      if (type !== 'plot_point') {
        expect(optionsOf(s), c.id).toHaveLength(4);
        expect(new Set(optionsOf(s)).size).toBe(4);
        expect(optionsOf(s).filter(o => optionIsKey(s, o))).toEqual([optionsOf(s)[s.correctOptionIndex!]]);
        expect(optionsOf(s)).not.toContain(keyText(c));
      }
      if (type === 'plot_point' || type === 'read_point') expect(Math.max(Math.abs(s.x1), Math.abs(s.y1))).toBeLessThanOrEqual(3);
      if (type === 'find_slope') expect(Math.sign(slopeOf(s))).toBe(Math.sign(slopeOf(c)));
      // Never a simpler item of an item that is already that simple.
      expect(simplerItem(s, grid)).toBeNull();
    }
    expect(built).toBeGreaterThan(10);
  });

  it('an item already that simple has none: a small point, a small reduced slope or a flat line, a marked point on the y-axis', () => {
    const [small] = items('plot_point').filter(c => c.x1 === 2 && c.y1 === 3);
    expect(simplerItem(small, G)).toBeNull();
    expect(simplerItem(items('find_slope').find(c => c.y1 === c.y2)!, G)).toBeNull();
    expect(simplerItem(items('find_intercept').find(c => c.x1 === 0)!, G)).toBeNull();
  });
});

describe('leak rules', () => {
  it.each(MODES)('%s: no lever text has a digit; the facts and models never hold the key', (type) => {
    for (const grid of [G]) for (const c of items(type)) {
      const levers = coordinateLevers(c, grid, []);
      expect(levers.length, c.id).toBeGreaterThan(0);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), `${c.id} ${l.id}`).toBe(false);
      const facts = leverFacts(c, grid, levers.map(l => l.id));
      if (type === 'plot_point' || type === 'read_point') expect(facts.replace(/\s/g, '')).not.toContain(`(${c.x1},${c.y1})`);
      else expect(captionLeaks(c, facts), c.id).toBe(false);
      const pm = pointModel(c, grid), lm = lineModel(c);
      if (pm) {
        expect(pm.point).not.toEqual({ x: c.x1, y: c.y1 });
        expect([Math.abs(pm.point.x), Math.abs(pm.point.y)]).not.toContain(Math.abs(c.x1));
        expect(captionLeaks(c, pm.caption)).toBe(false);
      }
      if (lm) {
        expect(captionLeaks(c, lm.caption)).toBe(false);
        if (type === 'find_slope') expect((lm.b.y - lm.a.y) / (lm.b.x - lm.a.x)).not.toBeCloseTo(slopeOf(c));
        else expect(lm.crossing).not.toBe(interceptOf(c));
      }
    }
  });

  it('captionLeaks reads values, not spellings', () => {
    const [slope] = items('find_slope').filter(c => c.x1 === -4);   // slope 1/2
    expect(captionLeaks(slope, 'slope = 2 ÷ 4 = 1/2')).toBe(true);
    expect(captionLeaks(slope, 'rise 3, run 1, so slope = 3')).toBe(false);
    const [read] = items('read_point');
    expect(captionLeaks(read, 'Example (-4, 7)')).toBe(true);
  });
});

describe('every miss the check names has a lever on every item; this wrong answer, then this lever', () => {
  it.each(MODES)('%s', (type) => {
    for (const c of items(type)) {
      const levers = coordinateLevers(c, G, []);
      const answered = new Set(levers.flatMap(l => l.answers ?? []));
      for (const miss of COORDINATE_MISSES_BY_MODE[type]) expect(answered.has(miss), `${c.id} ${miss}`).toBe(true);
    }
  });

  it.each([
    ['plot_point', 'swapped', 'axis_guide'], ['plot_point', 'off_by_one', 'every_line'], ['plot_point', 'wrong_point', 'every_line'],
    ['read_point', 'x_sign', 'axis_guide'], ['read_point', 'off_by_one', 'every_line'],
    ['find_slope', 'reciprocal', 'slope_frame'], ['find_slope', 'rise_only', 'slope_frame'],
    ['find_intercept', 'slope_instead', 'intercept_frame'], ['find_intercept', 'off_by_one', MODEL_LINE],
  ] as const)('%s: %s -> %s (no tier)', (type, miss, lever) => {
    const c = items(type)[0];
    expect(nextLever(coordinateLevers(c, G, []), miss)).toBe(lever);
  });

  it('a hard-tier slope item offers the triangle first after an upside-down answer', () => {
    const hard = items('find_slope').find(c => c.supportTier === 'hard')!;
    expect(nextLever(coordinateLevers(hard, G, []), 'reciprocal')).toBe('rise_run_triangle');
    expect(coordinateMiss(hard, { placed: null, chosen: 0 })).toBe('opposite_sign');
  });

  it('a practice item offers no levers; simplify is the last resort', () => {
    const c = items('plot_point')[0];
    expect(coordinateLevers(simplerItem(c, G), G, [])).toEqual([]);
    expect(coordinateLevers(c, G, []).at(-1)?.id).toBe(SIMPLER);
    expect(coordinateLevers(c, G, []).map(l => l.id)).toContain(MODEL_POINT);
  });
});
