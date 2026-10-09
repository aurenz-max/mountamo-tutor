/**
 * find_area_triangle_parallelogram levers (`polygonAreaLevers.ts`): the leak rule, the simpler-figure builder over
 * many random items, the overlay geometry, and "this miss, then this lever".
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { PolygonAreaChallenge } from './PolygonAreaBuilder';
import {
  GRID_LEVER, HALF_LEVER, SLIDE_LEVER, SMALLER_FIGURE_LEVER, doubledArea, figureLeverFacts, figureLeverLeaks, figureLevers,
  figureOverlay, smallerFigure,
} from './polygonAreaLevers';
import { areaMiss } from './polygonAreaWorkspace';

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const triangle = (id = 't', base = 8, height = 5, apexX = 3): PolygonAreaChallenge => ({ id, type: 'find_area_triangle_parallelogram',
  figureType: 'triangle', base, height, apexX, expectedArea: (base * height) / 2, unitLabel: 'cm', narration: 'A sail.',
  instruction: 'Find the area of this triangle.', hint: '' });
const parallelogram = (id = 'p', base = 7, height = 4, skew = 2): PolygonAreaChallenge => ({ id, type: 'find_area_triangle_parallelogram',
  figureType: 'parallelogram', base, height, skew, expectedArea: base * height, unitLabel: 'm', narration: 'A tile.',
  instruction: 'Find the area of this parallelogram.', hint: '' });
/** Items the way the generator's builders make them. */
function randomItem(i: number): PolygonAreaChallenge {
  if (i % 2) return parallelogram(`p${i}`, rand(4, 14), rand(3, 10), rand(1, 4));
  let b = rand(4, 16), h = rand(3, 12);
  if ((b * h) % 2) { if (h < 12) h += 1; else b += 1; }
  return triangle(`t${i}`, b, h, rand(1, b - 1));
}
const ITEMS = Array.from({ length: 400 }, (_, i) => randomItem(i));
const ALL = [GRID_LEVER, HALF_LEVER, SLIDE_LEVER, SMALLER_FIGURE_LEVER];

describe('leak rule', () => {
  it('names the area and base × height, never the drawn base or height', () => {
    const t = triangle();
    expect(figureLeverLeaks(t, 'the area is 20')).toBe(true);
    expect(figureLeverLeaks(t, 'a 40 square rectangle')).toBe(true);
    expect(figureLeverLeaks(t, 'base 8 and height 5')).toBe(false);
  });
  it('no lever text, fact or drawn caption on any item leaks', () => {
    for (const c of ITEMS) {
      for (const l of figureLevers(c, [])) expect(figureLeverLeaks(c, `${l.when} ${l.does}`), `${c.id} ${l.id}`).toBe(false);
      expect(figureLeverLeaks(c, figureLeverFacts(c, ALL))).toBe(false);
      expect(figureLeverFacts(c, ALL)).not.toMatch(/\d/);
    }
  });
});

describe('the simpler figure', () => {
  it('same mode and figure, smaller, never the item or its answer, its answer recomputed', () => {
    let built = 0;
    for (const c of ITEMS) {
      const s = smallerFigure(c);
      if (!s) { expect(c.base! * c.height!).toBeLessThanOrEqual(8); continue; }
      built++;
      expect(s).toMatchObject({ id: `${c.id}~smaller`, type: c.type, figureType: c.figureType, unitLabel: c.unitLabel,
        instruction: c.instruction, showGridOverlay: true });
      expect(s.base! * s.height!).toBeLessThan(c.base! * c.height!);
      expect(s.base === c.base && s.height === c.height).toBe(false);
      expect(s.expectedArea).not.toBe(c.expectedArea);
      expect(s.expectedArea).toBe(c.figureType === 'triangle' ? (s.base! * s.height!) / 2 : s.base! * s.height!);
      expect(Number.isInteger(s.expectedArea)).toBe(true);
      if (c.figureType === 'triangle') expect(s.apexX).toBe(0); else expect(s.skew).toBe(1);
      // The mode's own check still runs on it.
      expect(areaMiss(s, s.expectedArea)).toBeUndefined();
      expect(smallerFigure(s)).toBeNull();
    }
    expect(built).toBeGreaterThan(ITEMS.length * 0.9);
  });
  it('a figure with nothing smaller offers no simplify lever', () => {
    expect(smallerFigure(triangle('t', 4, 2, 1))).toBeNull();
    expect(figureLevers(triangle('t', 4, 2, 1), []).map(l => l.id)).toEqual([GRID_LEVER, HALF_LEVER]);
  });
});

describe('overlay geometry', () => {
  it('triangle: the tinted pieces add up to the triangle, inside the rectangle of its base and height', () => {
    for (const c of ITEMS.filter(x => x.figureType === 'triangle')) {
      const o = figureOverlay(c, [HALF_LEVER])!;
      expect(doubledArea(o.rectangle)).toBe(2 * c.base! * c.height!);
      expect(o.tinted.reduce((s, p) => s + doubledArea(p), 0)).toBe(c.base! * c.height!);
    }
  });
  it('parallelogram: the moved copy is the tinted corner, and the rectangle is base by height', () => {
    for (const c of ITEMS.filter(x => x.figureType === 'parallelogram')) {
      const o = figureOverlay(c, [SLIDE_LEVER])!;
      expect(doubledArea(o.moved!)).toBe(doubledArea(o.tinted[0]));
      expect(doubledArea(o.rectangle)).toBe(2 * c.base! * c.height!);
    }
  });
  it('draws nothing unless its lever is pulled, and never the other figure\'s lever', () => {
    expect(figureOverlay(triangle(), [])).toBeNull();
    expect(figureOverlay(triangle(), [SLIDE_LEVER])).toBeNull();
    expect(figureOverlay(parallelogram(), [HALF_LEVER])).toBeNull();
  });
});

describe('which lever comes next', () => {
  it.each([
    ['triangle', 'forgot_half', [], HALF_LEVER], ['triangle', 'added_sides', [], GRID_LEVER],
    ['triangle', 'wrong_area', [], GRID_LEVER], ['triangle', 'wrong_area', [GRID_LEVER], HALF_LEVER],
    ['triangle', 'forgot_half', [HALF_LEVER], SMALLER_FIGURE_LEVER],
    ['parallelogram', 'halved', [], SLIDE_LEVER], ['parallelogram', 'added_sides', [GRID_LEVER], SMALLER_FIGURE_LEVER],
    ['parallelogram', undefined, [GRID_LEVER, SLIDE_LEVER], SMALLER_FIGURE_LEVER],
  ])('%s: after %s with %j pulled, %s', (figure, miss, pulled, want) => {
    const c = figure === 'triangle' ? triangle() : parallelogram();
    expect(nextLever(figureLevers(c, pulled as string[]), miss as string | undefined)).toBe(want);
  });
  it('the observed misses are named as the levers expect', () => {
    expect(areaMiss(triangle(), 40)).toBe('forgot_half');
    expect(areaMiss(parallelogram(), 14)).toBe('halved');
    expect(areaMiss(triangle(), 13)).toBe('added_sides');
  });
  it('every catalog miss of the mode is answered by a lever on both figures', () => {
    const misses = getComponentById('polygon-area-builder')!.teachingWorkspace!.misses!.find_area_triangle_parallelogram;
    for (const c of [triangle(), parallelogram()]) {
      const levers = figureLevers(c, []);
      const shown = c.figureType === 'triangle' ? misses.filter(m => m !== 'halved') : misses.filter(m => m !== 'forgot_half');
      for (const m of shown) expect(levers.some(l => l.kind === 'help' && l.answers?.includes(m)), `${c.figureType} ${m}`).toBe(true);
    }
  });
  it('a tier grid is a starting position: shown as pulled, not recorded', () => {
    expect(figureLevers({ ...triangle(), showGridOverlay: true }, []).find(l => l.id === GRID_LEVER)!.pulled).toBe(true);
  });
  it('no figure levers on the open builds or on a practice item', () => {
    expect(figureLevers({ ...triangle(), type: 'build_area', figureType: 'grid' }, [])).toEqual([]);
    expect(figureLevers(smallerFigure(triangle())!, [])).toEqual([]);
  });
});
