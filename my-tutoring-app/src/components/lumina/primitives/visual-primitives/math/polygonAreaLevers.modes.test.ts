/**
 * Levers for polygon area builder's decompose, find_area_trapezoid, composite_area and coordinate_polygon modes
 * (`polygonAreaLevers.ts`), over the generator's own items at every tier: the leak rule, per-item coverage of every
 * miss the check can name on that item, the simpler-item builders, the drawn geometry, and "this miss, then this lever".
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../service/geminiClient', () => ({ ai: { models: { generateContent: vi.fn(() => { throw new Error('no model call'); }) } } }));

import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { selectPolygonAreaChallenges } from '../../../service/math/gemini-polygon-area-builder';
import type { PolygonAreaChallenge, PolygonAreaChallengeType } from './PolygonAreaBuilder';
import {
  CUT_LEVER, GRID_LEVER, LEFT_OUT_LEVER, OUTSIDE_LEVER, RECTANGLE_FIRST_LEVER, ROWS_LEVER, SLOT_LEVER, SMALLER_FIGURE_LEVER,
  SPLIT_LEVER, TURNED_COPY_LEVER, doubledArea, figureLeverFacts, figureLeverLeaks, figureLevers, figureOverlay, leftOutPieces,
  outsideOfBox, smallerFigure, squareRows,
} from './polygonAreaLevers';
import { areaMiss, type AreaMiss } from './polygonAreaWorkspace';

type Tier = 'easy' | 'medium' | 'hard';
const MODES = ['decompose', 'find_area_trapezoid', 'composite_area', 'coordinate_polygon'] as const;
/** The generator's tier flags (`resolveSupportStructure`), applied per challenge the way `generate` applies them. */
function withTier(c: PolygonAreaChallenge, tier: Tier | null): PolygonAreaChallenge {
  if (!tier) return c;
  const guides = c.type === 'find_area_trapezoid' ? tier === 'easy' : tier !== 'hard';
  return { ...c, supportTier: tier, showDecompositionGuides: guides, showRegionAreaLabel: c.type === 'composite_area' && tier === 'easy',
    showGridOverlay: c.type === 'find_area_trapezoid' && tier === 'easy' };
}
const ITEMS: PolygonAreaChallenge[] = MODES.flatMap(mode => ([null, 'easy', 'medium', 'hard'] as const).flatMap(tier =>
  Array.from({ length: 15 }, (_, run) => selectPolygonAreaChallenges(mode as PolygonAreaChallengeType, 4, tier)
    .map(c => withTier({ ...c, id: `${mode}-${tier}-${run}-${c.id}` }, tier))).flat()));
const ALL = [GRID_LEVER, SLOT_LEVER, CUT_LEVER, TURNED_COPY_LEVER, SPLIT_LEVER, LEFT_OUT_LEVER, ROWS_LEVER, OUTSIDE_LEVER];
const of = (mode: string) => ITEMS.filter(c => c.type === mode);

/** The typed value that shows each miss on this item, when the check can name it here. */
function missesOn(c: PolygonAreaChallenge): AreaMiss[] {
  const b = c.base ?? 0, h = c.height ?? 0;
  const tries = [c.expectedArea * 2, c.expectedArea / 2, b + h + (c.base2 ?? 0), c.expectedArea + 1, c.expectedArea + 7,
    ...(c.parts ?? []).map(p => p.w * p.h)];
  if (c.vertices?.length) {
    const xs = c.vertices.map(v => v.x), ys = c.vertices.map(v => v.y);
    tries.push((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
  }
  return Array.from(new Set(tries.map(t => areaMiss(c, t)).filter((m): m is AreaMiss => !!m)));
}

describe('leak rule', () => {
  it('names each mode\'s area and one-step products, never the drawn givens', () => {
    const trap = of('find_area_trapezoid')[0];
    expect(figureLeverLeaks(trap, `the area is ${trap.expectedArea}`)).toBe(true);
    expect(figureLeverLeaks(trap, `${(trap.base! + trap.base2!) * trap.height!} squares`)).toBe(true);
    const comp = of('composite_area')[0];
    const p = comp.parts![0];
    if (p.w * p.h !== p.w && p.w * p.h !== p.h) expect(figureLeverLeaks(comp, `one piece is ${p.w * p.h}`)).toBe(true);
    expect(figureLeverLeaks(comp, `${p.w} by ${p.h}`)).toBe(false);
  });
  it('no lever text, fact or caption on any generated item leaks or prints a number', () => {
    for (const c of ITEMS) {
      for (const l of figureLevers(c, [])) {
        expect(figureLeverLeaks(c, `${l.when} ${l.does}`), `${c.id} ${l.id}`).toBe(false);
        expect(`${l.when} ${l.does}`).not.toMatch(/\d/);
      }
      expect(figureLeverFacts(c, ALL)).not.toMatch(/\d/);
    }
  });
});

describe('every miss the check can name on an item has an open lever on that item', () => {
  it.each(MODES)('%s', mode => {
    const catalog = getComponentById('polygon-area-builder')!.teachingWorkspace!.misses![mode];
    for (const c of of(mode)) {
      const levers = figureLevers(c, []);
      for (const m of missesOn(c)) {
        expect(catalog, `${mode} catalog lists ${m}`).toContain(m);
        expect(levers.some(l => !l.pulled && l.answers?.includes(m)), `${c.id} ${JSON.stringify(c.vertices ?? c.parts ?? [c.base, c.base2, c.height])} ${m}`).toBe(true);
      }
    }
  });
});

describe('the simpler item', () => {
  it.each(MODES)('%s: same mode and figure, simpler, never the item or its answer, answer recomputed', mode => {
    let built = 0;
    for (const c of of(mode)) {
      const s = smallerFigure(c);
      if (!s) { expect(mode === 'coordinate_polygon' && c.vertices!.length === 4, c.id).toBe(true); continue; }
      built++;
      expect(s).toMatchObject({ id: `${c.id}~smaller`, type: c.type, figureType: c.figureType, instruction: c.instruction });
      expect(s.expectedArea).not.toBe(c.expectedArea);
      expect(Number.isInteger(s.expectedArea)).toBe(true);
      expect(areaMiss(s, s.expectedArea)).toBeUndefined();
      expect(smallerFigure(s)).toBeNull();
      expect(figureLevers(s, [])).toEqual([]);
      if (mode === 'decompose') {
        expect(s.skew).toBe(1);
        expect(s.showDecompositionGuides).toBe(true);
        expect(s.expectedArea).toBe(s.base! * s.height!);
        expect(s.base! * s.height!).toBeLessThan(c.base! * c.height!);
      }
      if (mode === 'find_area_trapezoid') {
        expect(s.topOffset).toBe(0);
        expect(s.base2!).toBeLessThan(s.base!);
        expect(s.expectedArea).toBe(((s.base! + s.base2!) * s.height!) / 2);
        expect(s.expectedArea).toBeLessThan(c.expectedArea);
      }
      if (mode === 'composite_area') {
        expect(s.parts).toHaveLength(2);
        expect(s.expectedArea).toBe(s.parts!.reduce((t, p) => t + p.w * p.h, 0));
        expect(s.expectedArea).toBeLessThan(c.expectedArea);
        expect(s.showDecompositionGuides).toBe(true);
      }
      if (mode === 'coordinate_polygon') {
        expect(c.vertices!.length).not.toBe(4);
        expect(s.vertices).toHaveLength(4);
        expect(doubledArea(s.vertices!)).toBe(2 * s.expectedArea);
      }
    }
    expect(built).toBeGreaterThan(mode === 'coordinate_polygon' ? 0 : of(mode).length * 0.95);
  });
  it('coordinate: a rectangle is already the plainest polygon, so it has no simplify lever', () => {
    const r = of('coordinate_polygon').find(c => c.vertices!.length === 4)!;
    expect(smallerFigure(r)).toBeNull();
    expect(figureLevers(r, []).map(l => l.id)).toEqual([ROWS_LEVER]);
  });
});

describe('drawn geometry', () => {
  it('trapezoid: the turned copy has the trapezoid\'s area, and the outline is the two together', () => {
    for (const c of of('find_area_trapezoid')) {
      const o = figureOverlay(c, [TURNED_COPY_LEVER])!;
      expect(doubledArea(o.moved!)).toBe(2 * c.expectedArea);
      expect(doubledArea(o.rectangle)).toBe(4 * c.expectedArea);
    }
  });
  it('coordinate: the box minus the tinted outside is the polygon', () => {
    for (const c of of('coordinate_polygon').filter(x => x.vertices!.length !== 4)) {
      const out = outsideOfBox(c)!;
      const o = figureOverlay(c, [OUTSIDE_LEVER])!;
      expect(doubledArea(o.rectangle) - doubledArea(out)).toBe(2 * c.expectedArea);
    }
  });
  it('rows of squares cover the figure exactly (composite and rectilinear coordinate)', () => {
    for (const c of [...of('composite_area'), ...of('coordinate_polygon').filter(x => x.vertices!.length !== 3)]) {
      const rows = squareRows(c)!;
      expect(rows.reduce((t, r) => t + doubledArea(r.cells), 0), c.id).toBe(2 * c.expectedArea);
    }
    expect(squareRows(of('coordinate_polygon').find(x => x.vertices!.length === 3)!)).toBeNull();
  });
  it('composite: the left-out pieces are the ones the typed area did not match', () => {
    const c = of('composite_area').find(x => new Set(x.parts!.map(p => p.w * p.h)).size === x.parts!.length)!;
    const typed = c.parts![0].w * c.parts![0].h;
    expect(areaMiss(c, typed)).toBe('one_piece');
    expect(leftOutPieces(c, typed)).toEqual(c.parts!.map((_, i) => i).slice(1));
    expect(leftOutPieces(c, c.expectedArea + 1000)).toBeNull();
    expect(figureOverlay(c, [LEFT_OUT_LEVER], [1])!.outlined).toHaveLength(1);
    expect(figureOverlay(c, [LEFT_OUT_LEVER], [])).toBeNull();
  });
});

describe('which lever comes next', () => {
  const first = (mode: string, pred: (c: PolygonAreaChallenge) => boolean = () => true) =>
    of(mode).find(c => !c.supportTier && pred(c))!;
  it.each([
    ['decompose', 'halved', [], GRID_LEVER], ['decompose', 'added_sides', [GRID_LEVER], SMALLER_FIGURE_LEVER],
    ['find_area_trapezoid', 'forgot_half', [], TURNED_COPY_LEVER], ['find_area_trapezoid', 'added_sides', [], GRID_LEVER],
    ['find_area_trapezoid', 'added_sides', [GRID_LEVER], CUT_LEVER],
    ['find_area_trapezoid', 'forgot_half', [TURNED_COPY_LEVER], SMALLER_FIGURE_LEVER],
    ['composite_area', 'one_piece', [], LEFT_OUT_LEVER], ['composite_area', 'halved', [], ROWS_LEVER],
    ['composite_area', 'one_piece', [LEFT_OUT_LEVER], SMALLER_FIGURE_LEVER],
  ])('%s: after %s with %j pulled, %s', (mode, miss, pulled, want) => {
    expect(nextLever(figureLevers(first(mode), pulled as string[]), miss)).toBe(want);
  });
  it('coordinate: the outside of the box after the rectangle around it, rows on an L, the rectangle first last', () => {
    const tri = first('coordinate_polygon', c => c.vertices!.length === 3);
    expect(areaMiss(tri, outsideBoxArea(tri))).toBe('bounding_box');
    expect(nextLever(figureLevers(tri, []), 'bounding_box')).toBe(OUTSIDE_LEVER);
    expect(nextLever(figureLevers(tri, [OUTSIDE_LEVER]), 'halved')).toBe(RECTANGLE_FIRST_LEVER);
    const rectangle = first('coordinate_polygon', c => c.vertices!.length === 4);
    expect(nextLever(figureLevers(rectangle, []), 'halved')).toBe(ROWS_LEVER);
  });
  it('a tier\'s guides are starting positions: shown as pulled, so the next lever is another', () => {
    const hard = of('composite_area').find(c => c.supportTier === 'hard')!;
    const easy = of('composite_area').find(c => c.supportTier === 'easy')!;
    expect(figureLevers(hard, []).find(l => l.id === SPLIT_LEVER)!.pulled).toBe(false);
    expect(figureLevers(easy, []).find(l => l.id === SPLIT_LEVER)!.pulled).toBe(true);
    const slotHard = of('decompose').find(c => c.supportTier === 'hard')!;
    expect(figureLevers(slotHard, []).find(l => l.id === SLOT_LEVER)!.pulled).toBe(false);
    const trapEasy = of('find_area_trapezoid').find(c => c.supportTier === 'easy')!;
    expect(figureLevers(trapEasy, []).filter(l => l.pulled).map(l => l.id)).toEqual([GRID_LEVER, CUT_LEVER]);
  });
});

function outsideBoxArea(c: PolygonAreaChallenge): number {
  const xs = c.vertices!.map(v => v.x), ys = c.vertices!.map(v => v.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}
