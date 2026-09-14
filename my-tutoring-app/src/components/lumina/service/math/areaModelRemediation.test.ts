import { expect, it } from 'vitest';
import {
  areaModelDeliveryEligible, areaModelTeachingFor, compiledEqualAreaContrast, compiledSameFactContrast, eligibleAreaModelTeaching,
  hasCornerFactContrast, pairKey, selectEqualAreaContrast, selectSameFactContrast, type OperandPair,
} from './areaModelRemediation';
import type { AreaModelChallenge } from '../../primitives/visual-primitives/math/AreaModel';

const seeded = (seed = 7) => () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const place = (n: number) => { const s = String(n); return s.split('').map((d, i) => Number(d) * 10 ** (s.length - 1 - i)).filter(Boolean); };
const model = (a: number, b: number, i: number, flags: Partial<AreaModelChallenge> = {}): AreaModelChallenge => ({ id: `area-model-${i + 1}`,
  factor1Parts: place(a), factor2Parts: place(b), showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null, ...flags });
const rect = (l: number, w: number, i: number): AreaModelChallenge => ({ ...model(0, 0, i), factor1Parts: [l], factor2Parts: [w] });
const set = (...pairs: [number, number][]) => pairs.map(([a, b], i) => model(a, b, i, { showCellEquations: false }));
const rects = (...pairs: [number, number][]) => pairs.map(([l, w], i) => rect(l, w, i));
const totals = (list: readonly OperandPair[]) => list.map(c => pairKey(c));
const findAreaPairs = () => { const out: OperandPair[] = []; for (let a = 11; a <= 49; a++) for (let b = 11; b <= 49; b++) {
  if (a % 10 && b % 10) out.push({ factor1Parts: place(a), factor2Parts: place(b) }); } return out; };

it('offers grid and perimeter moves at grades 3-5 only, never in factor mode', () => {
  for (const mode of ['build_model', 'find_area', 'multiply', 'perimeter']) {
    expect(eligibleAreaModelTeaching({ grade: '4', mode, tier: 'hard' })).toBe(true);
    expect(areaModelDeliveryEligible({ targetEvalMode: mode })).toBe(true);
  }
  expect(areaModelTeachingFor('perimeter')?.moves.map(m => m.id)).toEqual(['contrast_equal_area_perimeters']);
  expect(areaModelTeachingFor('multiply')?.moves.map(m => m.id)).toEqual(['contrast_same_fact_across_places']);
  expect(areaModelTeachingFor('factor')).toBeNull();
  expect(eligibleAreaModelTeaching({ grade: '4', mode: 'factor' })).toBe(false);
  expect(areaModelDeliveryEligible({ targetEvalMode: 'factor' })).toBe(false);
  for (const grade of ['2', '6', undefined]) expect(eligibleAreaModelTeaching({ grade, mode: 'find_area' })).toBe(false);
});

it('recognizes a shared fact only in the largest and smallest cells, at different places, with digits of 2 or more', () => {
  expect(hasCornerFactContrast(model(34, 43, 0))).toBe(true);   // 30 × 40 and 4 × 3
  expect(hasCornerFactContrast(model(33, 44, 0))).toBe(true);
  expect(hasCornerFactContrast(model(7, 22, 0))).toBe(true);    // build_model: 7 × 20 and 7 × 2
  expect(hasCornerFactContrast(model(243, 32, 0))).toBe(true);  // multiply: 200 × 30 and 3 × 2
  expect(hasCornerFactContrast(model(33, 27, 0))).toBe(false);  // shared facts only in same-row/column cells
  expect(hasCornerFactContrast(model(13, 31, 0))).toBe(false);  // a 1 fact is not a fact contrast
  expect(hasCornerFactContrast(model(35, 47, 0))).toBe(false);
  expect(hasCornerFactContrast(rect(12, 21, 0))).toBe(false);   // one cell
});

it('leaves content unchanged without a move or when a model already carries the contrast', () => {
  const baseline = set([35, 47], [34, 43], [26, 18]);
  expect(selectSameFactContrast(baseline, null, findAreaPairs())).toMatchObject({ challenges: baseline, status: 'no-focus' });
  expect(selectSameFactContrast(baseline, 'contrast_same_fact_across_places', findAreaPairs()))
    .toMatchObject({ challenges: baseline, status: 'already-targeted', targets: ['area-model-2'], count: 1 });
});

it('replaces only the second model with a legal unique same-fact pair, keeping ids, flags and the other models', () => {
  const baseline = set([35, 47], [26, 18], [29, 37], [45, 16]);
  const out = selectSameFactContrast(baseline, 'contrast_same_fact_across_places', findAreaPairs(), seeded());
  expect(out.status).toBe('targeted');
  expect(out.targets).toEqual(['area-model-2']);
  expect(out.challenges.filter((_, i) => i !== 1)).toEqual(baseline.filter((_, i) => i !== 1));
  expect({ ...out.challenges[1], factor1Parts: [], factor2Parts: [] }).toEqual({ ...baseline[1], factor1Parts: [], factor2Parts: [] });
  expect(out.challenges[1].factor1Parts).toHaveLength(2);
  expect(new Set(totals(out.challenges)).size).toBe(4);
  expect(compiledSameFactContrast(out.challenges).count).toBe(1);
});

it('reports insufficient capacity when no legal pair carries the contrast', () => {
  const baseline = set([35, 47], [25, 17]);
  expect(selectSameFactContrast(baseline, 'contrast_same_fact_across_places', [{ factor1Parts: [30, 5], factor2Parts: [40, 7] }]))
    .toMatchObject({ challenges: baseline, status: 'insufficient-capacity', count: 0 });
});

it('perimeter: keeps an existing consecutive equal-area pair, reorders a split pair, otherwise replaces one neighbour', () => {
  expect(selectEqualAreaContrast(rects([6, 20], [8, 15], [7, 13]), 'contrast_equal_area_perimeters', { min: 5, max: 30 }))
    .toMatchObject({ status: 'already-targeted', targets: ['area-model-1', 'area-model-2'] });

  const split = rects([6, 20], [7, 13], [8, 15]);
  const reordered = selectEqualAreaContrast(split, 'contrast_equal_area_perimeters', { min: 5, max: 30 });
  expect(reordered.status).toBe('targeted');
  expect(reordered.challenges.map(c => c.factor1Parts[0])).toEqual([6, 8, 7]);
  expect(reordered.challenges.map(c => c.id)).toEqual(['area-model-1', 'area-model-2', 'area-model-3']);

  const baseline = rects([12, 10], [7, 13], [11, 19], [9, 14], [5, 17]);
  const out = selectEqualAreaContrast(baseline, 'contrast_equal_area_perimeters', { min: 5, max: 30 }, seeded(3));
  expect(out.status).toBe('targeted');
  expect(out.targets).toEqual(['area-model-1', 'area-model-2']);
  const [a, b] = out.challenges;
  expect(a.factor1Parts[0] * a.factor2Parts[0]).toBe(b.factor1Parts[0] * b.factor2Parts[0]);
  expect(2 * (a.factor1Parts[0] + a.factor2Parts[0])).not.toBe(2 * (b.factor1Parts[0] + b.factor2Parts[0]));
  expect(b.factor1Parts[0]).not.toBe(b.factor2Parts[0]);
  expect(out.challenges.filter((_, i) => i !== 1)).toEqual(baseline.filter((_, i) => i !== 1));
  expect(new Set(totals(out.challenges)).size).toBe(5);
  expect(compiledEqualAreaContrast(out.challenges).count).toBe(2);
});

it('perimeter: insufficient capacity when no area has a second legal factorisation', () => {
  const baseline = rects([7, 13], [11, 19], [5, 7]); // 91, 209, 35: no other side pair within 5-30
  expect(selectEqualAreaContrast(baseline, 'contrast_equal_area_perimeters', { min: 5, max: 30 })).toMatchObject({ challenges: baseline, status: 'insufficient-capacity', count: 0 });
});
