/**
 * circle-explorer levers: the leak rules per mode, the simplify builder over many item shapes, and "this wrong answer,
 * then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { CircleCompositeShape, CircleExplorerChallenge, CircleExplorerChallengeType } from './CircleExplorer';
import {
  FIGURE_LEVERS, FORMULA_LEVER, LEVER_CAPTIONS, SIMPLER_LEVER,
  circleLevers, discoverTrack, leverFacts, leverTextLeaks, pictureLeaks, practiceLeaks, ratioFrame, simplerCircle, undoChain, otherLengthLabel,
} from './circleExplorerLevers';
import { CIRCLE_MISSES_BY_MODE, PI_APPROX, circleCorrect, circleMiss, fmt, signatureValues } from './circleExplorerWorkspace';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const tol = (k: number) => Math.max(0.5, Math.abs(k) * 0.02);

/** Every item shape the generator builds (`gemini-circle-explorer.ts`), over its radius bands, both tiers of the reveal. */
function items(type: CircleExplorerChallengeType): CircleExplorerChallenge[] {
  const out: CircleExplorerChallenge[] = [];
  const base = { narration: 'A pond is shaped like this circle.', hint: '', unitLabel: 'cm', usePiApprox: true };
  for (const reveal of [undefined, false]) for (let r = 2; r <= 15; r++) {
    const common = { ...base, radius: r, showFormulaReveal: reveal };
    const id = (s: string) => `${type}-${s}-${r}-${reveal ?? 'on'}`;
    if (type === 'discover_pi' && r >= 3 && r <= 10) {
      out.push({ ...common, id: id('pi'), type, given: 'diameter', answerKind: 'ratio', instruction: 'Unroll, then C ÷ d.',
        expectedAnswer: 3.14, tolerance: 0.15 });
    }
    if (type === 'circumference') for (const given of ['radius', 'diameter'] as const) {
      const k = r2(2 * PI_APPROX * r);
      out.push({ ...common, id: id(given), type, given, answerKind: 'length', instruction: 'Find the circumference.', expectedAnswer: k, tolerance: tol(k) });
    }
    if (type === 'area' && r <= 12) for (const given of ['radius', 'diameter'] as const) {
      const k = r2(PI_APPROX * r * r);
      out.push({ ...common, id: id(given), type, given, answerKind: 'area', instruction: 'Find the area.', expectedAnswer: k, tolerance: tol(k) });
    }
    if (type === 'reverse' && r >= 3) for (const from of ['circumference', 'area'] as const) {
      out.push({ ...common, id: id(from), type, given: 'radius', answerKind: 'length', reverseGiven: from, instruction: 'Find the radius.',
        givenValue: from === 'area' ? r1(PI_APPROX * r * r) : r1(2 * PI_APPROX * r), expectedAnswer: r, tolerance: 0.2 });
    }
    if (type === 'composite') for (const shape of ['semicircle_area', 'semicircle_perimeter', 'circle_in_square'] as CircleCompositeShape[]) {
      if (shape === 'circle_in_square' && r > 8) continue;
      const k = shape === 'circle_in_square' ? r2(4 * r * r - PI_APPROX * r * r) : shape === 'semicircle_perimeter'
        ? r2(PI_APPROX * r + 2 * r) : r2(0.5 * PI_APPROX * r * r);
      out.push({ ...common, id: id(shape), type, given: 'radius', answerKind: shape === 'semicircle_perimeter' ? 'length' : 'area',
        compositeShape: shape, ...(shape === 'circle_in_square' ? { squareSide: 2 * r } : {}), instruction: 'Find it.',
        expectedAnswer: k, tolerance: tol(k) });
    }
  }
  return out;
}
const MODES = Object.keys(CIRCLE_MISSES_BY_MODE) as CircleExplorerChallengeType[];

describe('leak rules', () => {
  it.each(MODES)('%s: no lever text or fact carries a digit; no picture carries the answer', (mode) => {
    for (const c of items(mode)) {
      const levers = circleLevers(c, []);
      expect(levers.length, c.id).toBeGreaterThan(0);
      for (const l of levers) {
        expect(leverTextLeaks(l.when), `${c.id} ${l.id} when`).toBe(false);
        expect(leverTextLeaks(l.does), `${c.id} ${l.id} does`).toBe(false);
      }
      expect(leverTextLeaks(leverFacts(c, levers.map(l => l.id))), c.id).toBe(false);
      const pictures = [...[FORMULA_LEVER, ...FIGURE_LEVERS].map(id => LEVER_CAPTIONS[id](c)), otherLengthLabel(c),
        mode === 'discover_pi' ? ratioFrame(c) : '', mode === 'reverse' ? `${undoChain(c).forward} ${undoChain(c).back}` : ''];
      for (const text of pictures) expect(pictureLeaks(c, text), `${c.id}: ${text}`).toBe(false);
      for (const id of [FORMULA_LEVER, ...FIGURE_LEVERS]) expect(leverTextLeaks(LEVER_CAPTIONS[id](c)), id).toBe(false);
    }
  });

  it('the formula lever is offered only where the tier withheld the labels', () => {
    const [on, off] = [items('area').find(c => c.showFormulaReveal === undefined)!, items('area').find(c => c.showFormulaReveal === false)!];
    expect(circleLevers(on, []).map(l => l.id)).not.toContain(FORMULA_LEVER);
    expect(circleLevers(off, []).map(l => l.id)).toContain(FORMULA_LEVER);
  });

  it('the picture leak rule finds the answer as a number, not inside another one', () => {
    const c = items('reverse').find(x => x.radius === 7)!;
    expect(pictureLeaks(c, 'r = 7 cm')).toBe(true);
    expect(pictureLeaks(c, 'C = 44 cm, 17.5')).toBe(false);
    expect(ratioFrame(items('discover_pi').find(x => x.radius === 5 && x.showFormulaReveal === undefined)!)).toBe('C ÷ d = 31.4 ÷ 10 = ?');
    expect(ratioFrame(items('discover_pi').find(x => x.radius === 5 && x.showFormulaReveal === false)!)).toBe('C ÷ d = unrolled length ÷ 10 cm = ?');
  });
});

describe('tenth_marks fits the canvas', () => {
  it('the ruler ten parts, the unrolled line and the diameter marks stay inside the drawable area for every payload circle', () => {
    const W = 560; // CircleExplorer's CANVAS_W; the figure is drawn at a fixed size whatever the radius
    const payload = JSON.parse(readFileSync(join(process.cwd(),
      'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/circle-explorer.discover_pi.json'), 'utf-8'));
    const largest = Math.max(...payload.data.challenges.map((c: { radius: number }) => c.radius), ...items('discover_pi').map(c => c.radius));
    expect(largest).toBeGreaterThanOrEqual(9);
    const t = discoverTrack(W);
    expect(t.tenths).toHaveLength(11);
    expect(t.tenths[10]).toBeLessThanOrEqual(W - 4);
    expect(t.tenths[10] - t.tenths[0]).toBeCloseTo(t.diaPx);
    expect(t.lineEnd).toBeLessThan(t.tenths[10]);
    expect(t.lineEnd).toBeGreaterThan(t.tenths[1]);
  });
});

describe('simplify builder', () => {
  it.each(MODES.filter(m => m !== 'discover_pi'))('%s: same mode and figure, its own id, a different radius and answer, solvable, deterministic', (mode) => {
    let built = 0;
    for (const c of items(mode)) {
      const s = simplerCircle(c);
      if (!s) continue;
      built++;
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(s.type).toBe(c.type);
      expect(s.compositeShape).toBe(c.compositeShape);
      expect(practiceLeaks(c, s)).toBe(false);
      expect(circleCorrect(s, { typed: fmt(s.expectedAnswer), unrolled: true, sliced: false })).toBe(true);
      expect(`${s.narration} ${s.instruction}`).not.toContain(fmt(c.expectedAnswer));
      // One step fewer where the mode has one.
      if (mode === 'circumference') expect(s.given).toBe('diameter');
      if (mode === 'area') expect(s.given).toBe('radius');
      if (mode === 'reverse') expect(s.reverseGiven).toBe('circumference');
      expect(simplerCircle(c)).toEqual(s);
      expect(simplerCircle(s)).toBeNull();
    }
    expect(built).toBeGreaterThan(10);
  });

  it('discover π has no easier version (π is every circle\'s answer); a round radius already one step is none either', () => {
    for (const c of items('discover_pi')) expect(simplerCircle(c)).toBeNull();
    expect(simplerCircle(items('circumference').find(c => c.given === 'diameter' && c.radius === 5)!)).toBeNull();
    expect(simplerCircle(items('circumference').find(c => c.given === 'radius' && c.radius === 5)!)).not.toBeNull();
  });
});

describe('a wrong answer, then the lever that answers it', () => {
  it('the catalog declares levers and the same miss lists', () => {
    const entry = getComponentById('circle-explorer')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    expect(entry.teachingWorkspace!.misses).toEqual(CIRCLE_MISSES_BY_MODE);
  });

  it.each(MODES)('%s: every miss of the mode is answered by a help lever on every item', (mode) => {
    for (const c of items(mode)) {
      const help = circleLevers(c, []).filter(l => l.kind === 'help');
      for (const miss of CIRCLE_MISSES_BY_MODE[mode]) {
        // A composite item's misses belong to its own figure; the other figures' misses never fire on it.
        const fires = mode !== 'composite' || signatureValues(c).some(([m]) => m === miss) || ['near_miss', 'too_high', 'too_low'].includes(miss);
        if (fires) expect(help.some(l => l.answers?.includes(miss)), `${c.id}: ${miss}`).toBe(true);
      }
    }
  });

  it.each([
    ['discover_pi', 0.32, 'inverse_ratio', 'ratio_frame'],
    ['discover_pi', 2.95, 'near_miss', 'tenth_marks'],
    ['circumference', 21.98, 'pi_times_radius', 'other_length'],
    ['circumference', 14, 'no_pi', 'other_length'],
    ['area', 21.98, 'pi_times_radius', 'radius_square'],
    ['reverse', 14, 'diameter_not_radius', 'undo_chain'],
    ['composite', 113.04, 'whole_circle', 'whole_circle'],
  ] as const)('%s: typed %s is %s, so %s comes next', (mode, typed, miss, lever) => {
    const c = items(mode).find(x => x.radius === (mode === 'composite' ? 6 : 7) && x.showFormulaReveal === undefined
      && (mode !== 'composite' || x.compositeShape === 'semicircle_area') && (mode !== 'reverse' || x.reverseGiven === 'circumference')
      && (mode !== 'circumference' || x.given === 'radius') && (mode !== 'discover_pi' || true))!;
    expect(circleMiss(c, { typed: String(typed), unrolled: true, sliced: false })).toBe(miss);
    expect(nextLever(circleLevers(c, []), miss)).toBe(lever);
    // The lever is not offered twice; the simplify lever is the last one left.
    const pulled = circleLevers(c, []).filter(l => l.kind === 'help').map(l => l.id);
    const left = circleLevers(c, pulled);
    expect(nextLever(left, miss)).toBe(left.some(l => l.id === SIMPLER_LEVER) ? SIMPLER_LEVER : null);
  });
});
