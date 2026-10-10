/**
 * slope-triangle levers: the leak rules per mode, the simplify builder over many item shapes, and "this wrong answer,
 * then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { SlopeTriangleChallenge } from './SlopeTriangle';
import {
  MODEL_TRIANGLE, SIMPLER, captionLeaks, isPracticeItem, leverFacts, leverTextLeaks, practiceLeaks, simplerItem,
  slopeTriangleLevers, triangleModel,
} from './slopeTriangleLevers';
import {
  SLOPE_TRIANGLE_MISSES_BY_MODE, emptyWork, ratioText, slopeTriangleMiss, workCorrect, type SlopeTriangleMode, type SlopeWork,
} from './slopeTriangleWorkspace';
import { validateSlopeTriangleData } from '../../../components/live-activity/adapters/slopeTriangleLive';

const MODES = Object.keys(SLOPE_TRIANGLE_MISSES_BY_MODE) as SlopeTriangleMode[];
/** The generator's slope pools and run bands (gemini-slope-triangle.ts), with the tier overlays as starting positions. */
const POOLS: Record<SlopeTriangleMode, { pairs: Array<[number, number]>; runs: number[] }> = {
  identify_slope: { pairs: [[1, 1], [2, 1], [3, 1], [4, 1], [-1, 1], [-2, 1], [-3, 1], [1, 2], [-1, 2]], runs: [2, 3, 4] },
  calculate: { pairs: [[1, 2], [2, 3], [3, 4], [1, 3], [3, 2], [4, 3], [-1, 2], [-2, 3], [-1, 3], [-3, 4], [2, 1], [3, 1], [-2, 1], [-3, 1]],
    runs: [2, 3, 4, 5, 6] },
  draw_triangle: { pairs: [[1, 1], [2, 1], [3, 1], [-1, 1], [-2, 1], [1, 2], [-1, 2]], runs: [2, 3, 4] },
};
const TIERS = [{}, { showGridCountOverlay: true, showFormulaReminder: true }, { showGridCountOverlay: true }];

function items(type: SlopeTriangleMode): SlopeTriangleChallenge[] {
  const out: SlopeTriangleChallenge[] = [];
  for (const [r, n] of POOLS[type].pairs) for (const run of POOLS[type].runs) TIERS.forEach((tier, k) => {
    const m = r / n, rise = m * run;
    if (!Number.isInteger(rise)) return;
    const b = m > 0 ? -3 : 3;
    const labels = type === 'calculate' && k !== 2;
    out.push({ id: `${type}-${r}-${n}-${run}-${k}`, type, instruction: `Ask ${type}`, hint: '',
      attachedLine: { equation: 'y', slope: m, yIntercept: b, label: 'y' },
      triangle: { position: { x: type === 'draw_triangle' ? -3 : -1, y: 0 }, size: type === 'draw_triangle' ? 1 : run,
        showMeasurements: labels, showSlope: true, showAngle: false, notation: type === 'identify_slope' ? 'riseRun' : 'deltaNotation', ...tier },
      expectedRise: rise, expectedRun: run, expectedSlope: m });
  });
  return out;
}
const lesson = (challenges: SlopeTriangleChallenge[]) => ({ title: 't', description: '', xRange: [-10, 10] as [number, number],
  yRange: [-10, 10] as [number, number], challenges });

it('the hand-built items are what the adapter accepts', () => {
  for (const t of MODES) for (const c of items(t)) expect(() => validateSlopeTriangleData(lesson([c])), c.id).not.toThrow();
});

describe('declarations', () => {
  it.each(MODES)('%s: no digit in any when/does; every miss is answered by a help lever on every item', (type) => {
    for (const c of items(type)) {
      const levers = slopeTriangleLevers(c, []);
      for (const l of levers) {
        expect(leverTextLeaks(l.when), `${c.id} ${l.id} when`).toBe(false);
        expect(leverTextLeaks(l.does), `${c.id} ${l.id} does`).toBe(false);
      }
      for (const miss of SLOPE_TRIANGLE_MISSES_BY_MODE[type])
        expect(levers.some(l => l.kind === 'help' && l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
    }
  });

  it('a lever the tier already shows is not offered', () => {
    const [plain, easy] = items('calculate').filter(c => c.id.startsWith('calculate-2-3-3'));
    expect(slopeTriangleLevers(plain, []).map(l => l.id)).not.toContain('leg_labels');
    expect(slopeTriangleLevers(plain, []).map(l => l.id)).toContain('count_ticks');
    expect(slopeTriangleLevers(easy, []).map(l => l.id)).not.toContain('count_ticks');
    const bare = items('calculate').find(c => c.id === 'calculate-2-3-3-2')!;
    expect(slopeTriangleLevers(bare, []).map(l => l.id)).toContain('leg_labels');
  });
});

describe('the worked model', () => {
  it.each(MODES)('%s: always built, outside the item, no number of the key', (type) => {
    for (const c of items(type)) {
      const model = triangleModel(c);
      expect(model, c.id).not.toBeNull();
      expect(captionLeaks(c, model!.caption), `${c.id}: ${model!.caption}`).toBe(false);
      expect(Math.abs(model!.rise / model!.run)).not.toBeCloseTo(Math.abs(c.expectedSlope), 6);
      // The facts the tutor reads say no more than the caption.
      const facts = leverFacts(c, [MODEL_TRIANGLE]);
      expect(captionLeaks(c, facts), facts).toBe(false);
    }
  });
});

describe('simplify builder', () => {
  it.each(MODES)('%s: same mode, its own id, ask, line and answer; in view; solvable; deterministic', (type) => {
    let built = 0;
    for (const c of items(type)) {
      const s = simplerItem(c);
      const offered = slopeTriangleLevers(c, []).some(l => l.id === SIMPLER);
      expect(offered, c.id).toBe(!!s);
      if (!s) continue;
      built++;
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(isPracticeItem(s)).toBe(true);
      expect(s.type).toBe(type);
      expect(practiceLeaks(c, s), c.id).toBe(false);
      expect(simplerItem(c)).toEqual(s);
      expect(Math.sign(s.expectedSlope)).toBe(Math.sign(c.expectedSlope));
      expect(s.expectedRise).toBeCloseTo(s.attachedLine.slope * s.expectedRun, 9);
      expect(Number.isInteger(s.expectedRise)).toBe(true);
      expect(() => validateSlopeTriangleData(lesson([s]))).not.toThrow();
      expect(simplerItem(s)).toBeNull();
      if (type === 'identify_slope') expect(s.expectedRun).toBeLessThan(c.expectedRun);
      if (type === 'calculate') expect(ratioText(s.expectedRise, s.expectedRun)).toMatch(/^-?\d(\/\d)?$/);
      if (type === 'draw_triangle') expect(Number.isInteger(s.expectedSlope)).toBe(true);
    }
    expect(built).toBeGreaterThan(5);
  });
});

/** The work each named miss stands for on an item, where the item can show it. */
function missWork(c: SlopeTriangleChallenge, miss: string): SlopeWork | null {
  const w = emptyWork(c), R = c.expectedRise, N = c.expectedRun;
  const legs = (rise: number, run: number) => ({ ...w, rise: String(rise), run: String(run) });
  const slope = (v: number) => ({ ...w, slope: String(v) });
  const table: Record<string, SlopeWork> = c.type === 'identify_slope'
    ? { swapped: legs(N, R), rise_sign: legs(-R, N), run_sign: legs(R, -N), same_ratio: legs(R / N * 1, 1), rise_off: legs(R + 1, N),
      run_off: legs(R, N + 1), wrong_legs: legs(R + 7, N + 7) }
    : c.type === 'calculate'
      ? { opposite_sign: slope(-R / N), reciprocal: slope(N / R), negative_reciprocal: slope(-N / R), rise_only: slope(R), run_only: slope(N),
        wrong_slope: slope(R / N + 11) }
      : { flat: { ...w, size: N, top: 0 }, wrong_sign: { ...w, size: N, top: -R }, swapped: { ...w, size: Math.abs(R), top: Math.sign(R) * N },
        rise_off: { ...w, size: N, top: R + 1 }, wrong_ratio: { ...w, size: N, top: R + 5 } };
  return table[miss] ?? null;
}

describe('this wrong answer, then this lever', () => {
  it.each(MODES)('%s: each miss the work shows is named, and the next lever answers it', (type) => {
    for (const c of items(type)) for (const miss of SLOPE_TRIANGLE_MISSES_BY_MODE[type]) {
      const w = missWork(c, miss);
      if (!w || workCorrect(c, w) || slopeTriangleMiss(c, w) !== miss) continue;
      const levers = slopeTriangleLevers(c, []);
      const next = nextLever(levers, miss);
      expect(next, `${c.id} ${miss}`).toBeTruthy();
      expect(levers.find(l => l.id === next)!.answers).toContain(miss);
      expect(levers.find(l => l.id === next)!.kind).toBe('help');
    }
  });

  it('named examples', () => {
    const c = items('identify_slope').find(x => x.id === 'identify_slope--2-1-3-0')!;
    const levers = slopeTriangleLevers(c, []);
    expect(levers.map(l => l.id)).toEqual(['count_ticks', 'leg_names', 'sign_frame', 'model_triangle', 'simpler_item']);
    expect(nextLever(levers, 'rise_sign')).toBe('sign_frame');
    expect(nextLever(levers, 'swapped')).toBe('leg_names');
    expect(nextLever(levers, 'rise_off')).toBe('count_ticks');
    const k = items('calculate').find(x => x.id === 'calculate-2-3-6-2')!;
    expect(nextLever(slopeTriangleLevers(k, []), 'reciprocal')).toBe('formula_frame');
    expect(nextLever(slopeTriangleLevers(k, []), 'rise_only')).toBe('leg_labels');
    const d = items('draw_triangle').find(x => x.id === 'draw_triangle-1-1-3-0')!;
    expect(nextLever(slopeTriangleLevers(d, []), 'flat')).toBe('build_frame');
    expect(nextLever(slopeTriangleLevers(d, []), 'wrong_sign')).toBe('build_frame');
    expect(nextLever(slopeTriangleLevers(d, []), 'rise_off')).toBe('count_ticks');
  });
});
