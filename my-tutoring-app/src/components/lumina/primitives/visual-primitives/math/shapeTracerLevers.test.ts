/**
 * shape-tracer levers (`shapeTracerLevers.ts`): each leak rule per mode, each easier-item builder, the miss → lever
 * table, and that every miss the catalog lists for a mode is answered on every saved payload item (J12 per item).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ShapeTracerChallenge } from './ShapeTracer';
import { checkShapeProperties, drawCorners, gridDots, shapeTracerMiss } from './shapeTracerWorkspace';
import {
  BARS_LEVER, FADE_LEVER, GLOW_LEVER, NUMBERS_LEVER, OUTLINE_LEVER, RINGS_LEVER, SIMPLER_LEVER, STRIP_LEVER, cornerRings,
  glowOffered, guidesWith, leverFacts, practiceItem, practiceLeaks, practiceParent, shapeTracerLevers, sideBars,
} from './shapeTracerLevers';

const ids = (levers: { id: string }[]) => levers.map(l => l.id);
const ring = (n: number, r = 120, cx = 250, cy = 200) =>
  Array.from({ length: n }, (_, k) => ({ x: Math.round(cx + r * Math.cos(-Math.PI / 2 + (2 * Math.PI * k) / n)),
    y: Math.round(cy + r * Math.sin(-Math.PI / 2 + (2 * Math.PI * k) / n)) }));
const trace = (n: number, tier: Partial<ShapeTracerChallenge> = {}): ShapeTracerChallenge =>
  ({ id: `t${n}`, type: 'trace', instruction: 'Trace it!', targetShape: n === 3 ? 'triangle' : 'square', tracePath: ring(n), ...tier });
const dots = (n: number): ShapeTracerChallenge => ({ id: `d${n}`, type: 'connect-dots', instruction: 'Connect!', targetShape: 'shape',
  dots: ring(n).map((p, i) => ({ ...p, label: String(i + 1) })), correctOrder: ring(n).map((_, i) => i), revealShape: 'shape' });
const complete = (n: number, open: number): ShapeTracerChallenge => {
  const v = ring(n), drawn = n - open;
  return { id: `c${n}-${open}`, type: 'complete', instruction: 'Finish it!', targetShape: n === 3 ? 'triangle' : 'square',
    drawnSides: v.slice(0, drawn).map((p, i) => ({ from: p, to: v[i + 1] })).slice(0, Math.max(1, drawn - 1)),
    remainingVertices: v.slice(Math.max(2, drawn)) };
};
const draw = (sides: number, equal: boolean): ShapeTracerChallenge => ({ id: `f${sides}${equal}`, type: 'draw-from-description',
  instruction: 'Read the clue and draw the shape!', targetShape: 'shape',
  description: `A shape with ${sides} ${equal ? 'equal ' : ''}sides`, requiredProperties: { sides, corners: sides, allSidesEqual: equal } });

describe('leak rules', () => {
  it('no next-dot glow on connect-dots, where the next dot is the answer', () => {
    expect(glowOffered('connect-dots')).toBe(false);
    expect(glowOffered('draw-from-description')).toBe(false);
    for (const n of [3, 4, 5, 6]) expect(ids(shapeTracerLevers(dots(n), []))).not.toContain(GLOW_LEVER);
    expect(guidesWith({ ...dots(4), showNextCue: false }, [GLOW_LEVER]).nextCue).toBe(false);
  });
  it('the side bars are the learner\'s own sides only; the rings are the clue\'s count against the learner\'s', () => {
    const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    expect(sideBars(square)).toEqual([100, 100, 100, 100]);
    expect(sideBars(square.slice(0, 2))).toEqual([100]);
    expect(sideBars([])).toEqual([]);
    expect(cornerRings(draw(4, true), 2)).toEqual({ rings: 4, filled: 2, extra: 0 });
    expect(cornerRings(draw(3, false), 5)).toEqual({ rings: 3, filled: 3, extra: 2 });
  });
  it('lever texts and facts carry no digit and name no shape, on every mode with every lever pulled', () => {
    for (const c of [trace(4), complete(4, 2), dots(5), draw(4, true), draw(3, false)]) {
      const all = ids(shapeTracerLevers(c, []));
      expect(leverFacts(c, all), c.type).not.toMatch(/\d|triangle|square|rectangle|pentagon|hexagon/i);
      for (const l of shapeTracerLevers(c, [])) expect(`${l.when} ${l.does}`, `${c.type} ${l.id}`).not.toMatch(/\d|triangle|square/i);
    }
  });
  it('a guide the tier shows is declared pulled; a pulled guide lever turns the guide on', () => {
    const easy = trace(4), hard = trace(4, { showGuidePath: false, showDirectionArrows: false, showNextCue: false, showOrderNumbers: false });
    expect(shapeTracerLevers(easy, []).filter(l => l.kind === 'help').every(l => l.pulled)).toBe(true);
    expect(shapeTracerLevers(hard, []).filter(l => l.kind === 'help').some(l => l.pulled)).toBe(false);
    expect(guidesWith(hard, [OUTLINE_LEVER, NUMBERS_LEVER])).toEqual({ guidePath: true, arrows: true, nextCue: false, orderNumbers: true });
  });
});

describe('simpler items', () => {
  it('trace and connect_dots: a triangle, never on a three-corner item', () => {
    for (const n of [3, 4, 5, 6]) for (const c of [trace(n), dots(n)]) {
      const p = practiceItem(c);
      if (n === 3) { expect(p).toBeNull(); expect(ids(shapeTracerLevers(c, []))).not.toContain(SIMPLER_LEVER); continue; }
      expect(p).toMatchObject({ id: `${c.id}~simpler`, type: c.type, targetShape: 'triangle' });
      expect(practiceLeaks(c, p!), `${c.type} ${n}`).toBe(false);
    }
  });
  it('complete: another shape with one open corner; none when one corner is open', () => {
    for (const [n, open] of [[3, 2], [4, 2], [4, 3], [5, 3], [6, 4], [4, 1], [3, 1]] as const) {
      const c = complete(n, open), p = practiceItem(c);
      if ((c.remainingVertices?.length ?? 0) <= 1) { expect(p).toBeNull(); continue; }
      expect(p!.remainingVertices).toHaveLength(1);
      expect(p!.targetShape).not.toBe(c.targetShape);
      expect(practiceLeaks(c, p!), `${n}/${open}`).toBe(false);
    }
  });
  it('draw_from_description: a three-sided clue with no equal sides, solvable; none when that is the clue', () => {
    expect(practiceItem(draw(3, false))).toBeNull();
    for (const c of [draw(3, true), draw(4, true), draw(4, false), draw(5, true), draw(6, true)]) {
      const p = practiceItem(c)!;
      expect(p.requiredProperties).toMatchObject({ sides: 3, allSidesEqual: false });
      expect(practiceLeaks(c, p)).toBe(false);
      const corners = drawCorners(p, 50).map(i => gridDots(50)[i]);
      expect(checkShapeProperties(corners, p.requiredProperties!).correct).toBe(true);
    }
  });
  it('a practice item offers no levers and no further practice; the parent is found from its id', () => {
    const c = dots(4), p = practiceItem(c)!;
    expect(practiceItem(p)).toBeNull();
    expect(shapeTracerLevers(p, [])).toEqual([]);
    expect(practiceParent(p.id, [dots(5), c])).toBe(c);
    expect(practiceParent(c.id, [c])).toBeNull();
  });
});

describe('the miss → lever table', () => {
  it.each([
    ['connect_dots', dots(4), 'started_elsewhere', STRIP_LEVER],
    ['connect_dots', dots(4), 'skipped_number', STRIP_LEVER],
    ['connect_dots', dots(3), 'went_back', FADE_LEVER],
    ['draw_from_description', draw(4, true), 'too_few_sides', RINGS_LEVER],
    ['draw_from_description', draw(3, false), 'too_many_sides', RINGS_LEVER],
    ['draw_from_description', draw(4, true), 'sides_unequal', BARS_LEVER],
  ] as const)('%s: %s → %s', (_mode, c, miss, lever) => {
    expect(nextLever(shapeTracerLevers(c, []), miss)).toBe(lever);
  });
  it('the observed miss names match the table', () => {
    expect(shapeTracerMiss(dots(4), { tapped: [], points: [], wrongDot: 2 })).toBe('started_elsewhere');
    expect(shapeTracerMiss(draw(3, false), { tapped: [], points: ring(4) })).toBe('too_many_sides');
  });
  it('after the strip, a skipped number on a four-dot item gets the triangle', () => {
    expect(nextLever(shapeTracerLevers(dots(4), [STRIP_LEVER]), 'skipped_number')).toBe(SIMPLER_LEVER);
  });
});

it('every miss the catalog lists for a mode is answered by an open lever on every saved payload item (J12)', async () => {
  const entry = getComponentById('shape-tracer')!;
  expect(entry.teachingWorkspace!.levers).toBe(true);
  const misses = entry.teachingWorkspace!.misses!;
  for (const mode of ['trace', 'connect_dots', 'complete', 'draw_from_description']) {
    const payload = await import(`../../../components/live-activity/runtime/testing/w1-payloads/shape-tracer.${mode}.json`);
    const data = (payload.default ?? payload).data;
    for (const c of data.challenges as ShapeTracerChallenge[]) {
      const levers = shapeTracerLevers(c, []);
      expect(levers.length, `${mode} ${c.id}`).toBeGreaterThan(0);
      for (const m of misses[mode] ?? []) {
        // sides_unequal is only possible when the clue asks for equal sides.
        if (m === 'sides_unequal' && !c.requiredProperties?.allSidesEqual) continue;
        expect(levers.some(l => !l.pulled && l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
      }
      const p = practiceItem(c);
      if (p) expect(practiceLeaks(c, p), `${mode} ${c.id}`).toBe(false);
    }
  }
});
