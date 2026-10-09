/**
 * area-model levers: each leak rule per mode, the easier-item builder over many items shaped like the generator's,
 * "this wrong answer, then this lever" as code, and per-item coverage (J12) over the saved payloads.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { AreaModelChallenge, AreaModelChallengeType } from './AreaModel';
import {
  ALL_SIDES_LEVER, CELL_DOTS_LEVER, CELL_LABELS_LEVER, EASIER_GRID_LEVER, EASIER_MODEL_LEVER, SHARED_PARTS_LEVER, SIDE_SUM_LEVER,
  SMALLER_RECT_LEVER, STACK_LEVER, START_CELL_LEVER, TENS_SPLIT_LEVER, areaModelLevers, isPractice, leverFacts, practiceItem,
  practiceLeaks, practiceParent, tensSplit, tensSplits, textLeaks,
} from './areaModelLevers';
import { areaCheckCorrect, cellProducts } from './areaModelWorkspace';
import buildP from '../../../components/live-activity/runtime/testing/w1-payloads/area-model.build_model.json';
import findP from '../../../components/live-activity/runtime/testing/w1-payloads/area-model.find_area.json';
import multiplyP from '../../../components/live-activity/runtime/testing/w1-payloads/area-model.multiply.json';
import perimeterP from '../../../components/live-activity/runtime/testing/w1-payloads/area-model.perimeter.json';
import factorP from '../../../components/live-activity/runtime/testing/w1-payloads/area-model.factor.json';

const split = (n: number) => { const s = String(n); return s.length === 1 ? [n] : [n - (n % 10), n % 10].filter(Boolean); };
const splitHundreds = (n: number) => [Math.floor(n / 100) * 100, Math.floor((n % 100) / 10) * 10, n % 10].filter(Boolean);
const item = (id: string, f1: number[], f2: number[]): AreaModelChallenge =>
  ({ id, factor1Parts: f1, factor2Parts: f2, showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null });

// Shaped like the generator's operand builders (`gemini-area-model.ts`).
const GENERATED: Record<AreaModelChallengeType, AreaModelChallenge[]> = { build_model: [], find_area: [], multiply: [], perimeter: [], factor: [] };
for (let a = 3; a <= 9; a++) for (let b = 11; b <= 25; b++) GENERATED.build_model.push(item(`b${a}-${b}`, [a], split(b)));
for (let a = 11; a <= 49; a += 3) for (let b = 11; b <= 49; b += 4) if (a % 10 && b % 10) {
  GENERATED.find_area.push(item(`f${a}-${b}`, split(a), split(b)));
  GENERATED.factor.push(item(`x${a}-${b}`, split(a), split(b)));
}
for (let a = 111; a <= 499; a += 37) for (let b = 12; b <= 49; b += 7) if (a % 10 && b % 10 && Math.floor(a / 10) % 10)
  GENERATED.multiply.push(item(`m${a}-${b}`, splitHundreds(a), split(b)));
for (let w = 5; w <= 30; w += 2) for (let h = 6; h <= 30; h += 3) if (w !== h) GENERATED.perimeter.push(item(`p${w}-${h}`, [w], [h]));

const SAVED: Record<AreaModelChallengeType, AreaModelChallenge[]> = {
  build_model: buildP.data.challenges as AreaModelChallenge[], find_area: findP.data.challenges as AreaModelChallenge[],
  multiply: multiplyP.data.challenges as AreaModelChallenge[], perimeter: perimeterP.data.challenges as AreaModelChallenge[],
  factor: factorP.data.challenges as AreaModelChallenge[],
};
const MODES = Object.keys(GENERATED) as AreaModelChallengeType[];
const ctx = (mode: AreaModelChallengeType, tierOn = false) => ({ mode, cellsLabelled: tierOn, sideSumShown: tierOn, startCellShown: tierOn });
const keysOf = (c: AreaModelChallenge) => {
  const w = c.factor1Parts.reduce((s, v) => s + v, 0), h = c.factor2Parts.reduce((s, v) => s + v, 0);
  return [...cellProducts(c).flat(), w * h, 2 * (w + h)];
};

describe('leak rules', () => {
  it.each(MODES)('%s: no pulled lever\'s fact names a number', mode => {
    for (const c of [...GENERATED[mode], ...SAVED[mode]]) {
      const all = areaModelLevers(c, [], ctx(mode)).map(l => l.id);
      expect(leverFacts(c, all, mode)).not.toMatch(/\d/);
      for (const l of areaModelLevers(c, [], ctx(mode))) expect(`${l.when} ${l.does}`.replace(/3 × 4 × 10 × 10|1 to 3|5 or less|10 or less/g, '')).not.toMatch(/\d/);
    }
  });

  it('tens_split splits a part into its fact and its tens, never writes a product, and skips a cell with no tens', () => {
    expect(tensSplit(30, 40)).toBe('3 × 4 × 10 × 10');
    expect(tensSplit(200, 30)).toBe('2 × 3 × 10 × 10 × 10');
    expect(tensSplit(7, 20)).toBe('7 × 2 × 10');
    expect(tensSplit(4, 3)).toBeNull();
    for (const mode of ['build_model', 'find_area', 'multiply'] as const) for (const c of [...GENERATED[mode], ...SAVED[mode]]) {
      const shown = new Set([...c.factor1Parts, ...c.factor2Parts]);
      for (const text of Object.values(tensSplits(c))) {
        expect(textLeaks(c, text), `${c.id} ${text}`).toBe(false);
        for (const n of (text.match(/\d+/g) ?? []).map(Number)) expect(keysOf(c).includes(n) && !shown.has(n), `${c.id} ${text}`).toBe(false);
      }
    }
  });

  it('textLeaks catches a product, the total or the perimeter that is not a printed part', () => {
    const c = item('t', [30, 4], [40, 3]);
    expect(textLeaks(c, '3 × 4 × 10 × 10')).toBe(false);
    expect(textLeaks(c, 'that makes 1200')).toBe(true);
    expect(textLeaks(c, '1462')).toBe(true);
  });
});

describe('easier items', () => {
  it.each(MODES)('%s: the same shape, easier digits, solvable, never the item and sharing no number with it', mode => {
    let built = 0;
    for (const c of [...GENERATED[mode], ...SAVED[mode]]) {
      const p = practiceItem(c, mode);
      if (!p) continue;
      built++;
      expect(p.id).toBe(`${c.id}~easier`);
      expect(isPractice(p)).toBe(true);
      expect(practiceLeaks(c, p, mode), c.id).toBe(false);
      expect(p.factor1Parts).toHaveLength(c.factor1Parts.length);
      expect(p.factor2Parts).toHaveLength(c.factor2Parts.length);
      expect(practiceItem(p, mode)).toBeNull();
      expect(practiceParent(p.id, [c])).toBe(c);
      if (mode === 'perimeter') expect(Math.max(p.factor1Parts[0], p.factor2Parts[0])).toBeLessThanOrEqual(5);
      else for (const part of [...p.factor1Parts, ...p.factor2Parts]) expect(Number(String(part)[0])).toBeLessThanOrEqual(3);
      // Solvable by the activity's own check.
      const w = p.factor1Parts.reduce((s, v) => s + v, 0), h = p.factor2Parts.reduce((s, v) => s + v, 0);
      if (mode === 'perimeter') expect(areaCheckCorrect(p, { step: 'perimeter', entered: String(2 * (w + h)) })).toBe(true);
      else if (mode === 'factor') expect(areaCheckCorrect(p, { step: 'dimensions', top: p.factor1Parts.map(String), left: p.factor2Parts.map(String) })).toBe(true);
      else expect(areaCheckCorrect(p, { step: 'sum', entered: String(w * h) })).toBe(true);
    }
    // Every saved item has one, and nearly every generated one.
    expect(SAVED[mode].every(c => practiceItem(c, mode))).toBe(true);
    expect(built).toBeGreaterThan(GENERATED[mode].length * 0.8);
  });

  it('practiceLeaks refuses the item itself and an item sharing an answer', () => {
    const c = item('a', [30, 4], [40, 3]);
    expect(practiceLeaks(c, { ...c }, 'find_area')).toBe(true);
    expect(practiceLeaks(c, { ...c, id: 'b', factor1Parts: [10, 4], factor2Parts: [20, 3] }, 'find_area')).toBe(true);
    expect(practiceLeaks(c, { ...c, id: 'b', factor1Parts: [10, 2], factor2Parts: [20, 1] }, 'find_area')).toBe(false);
    // On factor the parts are the answer: an easier grid may not reuse one.
    expect(practiceLeaks(c, { ...c, id: 'b', factor1Parts: [30, 2], factor2Parts: [20, 1] }, 'factor')).toBe(true);
  });
});

describe('this wrong answer, then this lever', () => {
  const find = item('f', [30, 4], [40, 3]);
  it.each([
    ['dropped_zeros', TENS_SPLIT_LEVER], ['extra_zeros', TENS_SPLIT_LEVER], ['added_not_multiplied', CELL_LABELS_LEVER],
    ['one_group_off', CELL_LABELS_LEVER], ['wrong_product', CELL_LABELS_LEVER], ['left_out_part', STACK_LEVER],
    ['carry_slip', STACK_LEVER], ['sum_off', STACK_LEVER],
  ])('find_area at the hard tier: %s → %s', (miss, lever) => {
    expect(nextLever(areaModelLevers(find, [], ctx('find_area')), miss)).toBe(lever);
  });
  it('with the cells labelled by the tier, one group off goes to the dots, then the easier model', () => {
    expect(nextLever(areaModelLevers(find, [], ctx('find_area', true)), 'one_group_off')).toBe(CELL_DOTS_LEVER);
    expect(nextLever(areaModelLevers(find, [CELL_DOTS_LEVER], ctx('find_area', true)), 'one_group_off')).toBe(EASIER_MODEL_LEVER);
  });
  it('perimeter and factor', () => {
    const per = item('p', [12], [7]), fac = item('x', [20, 5], [30, 6]);
    expect(nextLever(areaModelLevers(per, [], ctx('perimeter')), 'two_sides_only')).toBe(ALL_SIDES_LEVER);
    expect(nextLever(areaModelLevers(per, [ALL_SIDES_LEVER], ctx('perimeter')), 'two_sides_only')).toBe(SIDE_SUM_LEVER);
    expect(nextLever(areaModelLevers(per, [], ctx('perimeter', true)), 'perimeter_off')).toBe(SMALLER_RECT_LEVER);
    expect(nextLever(areaModelLevers(fac, [], ctx('factor')), 'swapped')).toBe(SHARED_PARTS_LEVER);
    expect(nextLever(areaModelLevers(fac, [], ctx('factor')), 'parts_wrong')).toBe(START_CELL_LEVER);
    expect(nextLever(areaModelLevers(fac, [START_CELL_LEVER, SHARED_PARTS_LEVER], ctx('factor')), 'parts_wrong')).toBe(EASIER_GRID_LEVER);
  });
  it('a tier aid on screen is a lever already pulled; a practice item has none', () => {
    expect(areaModelLevers(find, [], ctx('find_area', true)).find(l => l.id === CELL_LABELS_LEVER)?.pulled).toBe(true);
    expect(areaModelLevers(practiceItem(find, 'find_area'), [], ctx('find_area'))).toEqual([]);
  });
});

it('every catalog miss is answered by a lever on every item, generated and saved (J9, J12)', () => {
  const tw = getComponentById('area-model')!.teachingWorkspace!;
  expect(tw.levers).toBe(true);
  for (const mode of MODES) for (const c of [...GENERATED[mode], ...SAVED[mode]]) for (const tierOn of [false, true]) {
    const levers = areaModelLevers(c, [], ctx(mode, tierOn));
    for (const m of tw.misses![mode]) expect(levers.some(l => l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
  }
});
