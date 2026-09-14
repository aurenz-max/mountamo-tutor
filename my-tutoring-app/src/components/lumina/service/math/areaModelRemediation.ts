import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import type { AreaModelChallenge } from '../../primitives/visual-primitives/math/AreaModel';

export type AreaModelGridMove = 'contrast_same_fact_across_places';
export type AreaModelPerimeterMove = 'contrast_equal_area_perimeters';
export type AreaModelRemediationMove = AreaModelGridMove | AreaModelPerimeterMove;

const GRID_MODES = ['build_model', 'find_area', 'multiply'];
const ADAPTIVE_MODES = [...GRID_MODES, 'perimeter'];

// Describes the forward grid task (build_model / find_area / multiply), not diagnosis wording.
// factor mode is excluded: its learner enters the parts, and a symmetric grid would admit two answers.
export const areaModelGridTeaching: TeachingCapability<AreaModelGridMove> = {
  activity: 'area-model',
  task: 'An area model for one whole-number multiplication: one-digit × two-digit, two-digit × two-digit, or three-digit × two-digit, depending on the mode. '
    + 'Each factor with two or more digits is already split by place value (for example 34 into 30 and 4); a one-digit factor stays whole. The parts label the columns and rows of a grid. '
    + 'For each cell the learner types the product of its column part and its row part, then types the sum of all the cell products. A wrong entry is marked and can be retried. '
    + 'At some support levels each cell shows the two parts to multiply; otherwise the learner reads them from the headers. '
    + 'The learner does not choose how to split a factor, estimate, divide, or find a perimeter.',
  moves: [{
    id: 'contrast_same_fact_across_places',
    description: 'Include one model whose largest cell (the first part of each factor) and smallest cell (the last part of each factor) use the same single-digit multiplication fact at different place values, '
      + 'for example 34 × 43, where 30 × 40 = 1200 and 4 × 3 = 12 both use 3 × 4. A one-digit factor is both its first and last part, so 7 × 22 puts 7 × 20 = 140 beside 7 × 2 = 14. '
      + 'The learner computes both cells in the same grid, so the products of one fact at two place values sit side by side. '
      + 'Replaces the factors of one model; holds the mode, grid shape, factor size range, item count and support level. '
      + 'Does not teach the single-digit facts themselves, adding the cell products, splitting a factor into parts, or area versus perimeter.',
  }],
};

// Describes the perimeter task: two labeled side lengths, one typed answer.
export const areaModelPerimeterTeaching: TeachingCapability<AreaModelPerimeterMove> = {
  activity: 'area-model',
  task: 'Find the perimeter of a rectangle whose length and width are labeled (whole numbers from 5 to 30, never a square). The learner types one number; a wrong answer is marked and can be retried. '
    + 'At some support levels the sum length + width + length + width is written out. The learner is never asked for the area.',
  moves: [{
    id: 'contrast_equal_area_perimeters',
    description: 'Place two consecutive rectangles that cover the same area but have different side lengths, for example 6 by 20 and 8 by 15 (both 120 square units) with perimeters 52 and 46. '
      + 'Multiplying the sides gives the same number for both rectangles, while the distances around them differ. '
      + 'Replaces or reorders at most one rectangle; holds the item count, side-length range, the no-square rule and the support level. '
      + 'Does not teach how to find an area, and does not address adding only two of the four sides.',
  }],
};

export function areaModelTeachingFor(mode: string | undefined) {
  if (mode === 'perimeter') return areaModelPerimeterTeaching;
  return GRID_MODES.includes(mode ?? '') ? areaModelGridTeaching : null;
}

/** Code-owned task gate. The generator honours no numbers from the topic, so there is no named anchor to outrank. */
export function eligibleAreaModelTeaching(task: AdaptationTask): boolean {
  return ['3', '4', '5'].includes(task.grade ?? '') && ADAPTIVE_MODES.includes(task.mode ?? '');
}

/** Delivery gate on the manifest config; the generator still runs the full task gate. */
export function areaModelDeliveryEligible(config: Record<string, unknown>): boolean {
  return ADAPTIVE_MODES.includes(String(config.targetEvalMode));
}

export type AreaModelAdaptationStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';
export type OperandPair = Pick<AreaModelChallenge, 'factor1Parts' | 'factor2Parts'>;

const total = (parts: readonly number[]) => parts.reduce((s, v) => s + v, 0);
/** Same unordered totals = the same card for session uniqueness (the generator's canonKey). */
export const pairKey = (c: OperandPair) => [total(c.factor1Parts), total(c.factor2Parts)].sort((a, b) => a - b).join('x');
const placeOf = (part: number) => (/^[1-9]0*$/.test(String(part)) ? String(part).length - 1 : -1);
const digitOf = (part: number) => Number(String(part)[0]);

/** Recomputed from the parts the component renders: the two corner cells share a fact (both digits ≥ 2) at different places. */
export function hasCornerFactContrast(c: OperandPair): boolean {
  const { factor1Parts: f1, factor2Parts: f2 } = c;
  if (f1.length * f2.length < 2) return false;
  const largest = [f1[0], f2[0]];
  const smallest = [f1[f1.length - 1], f2[f2.length - 1]];
  const parts = [...largest, ...smallest];
  if (parts.some(p => placeOf(p) < 0 || digitOf(p) < 2)) return false;
  const fact = (ps: number[]) => ps.map(digitOf).sort().join('x');
  const place = (ps: number[]) => ps.reduce((s, p) => s + placeOf(p), 0);
  return fact(largest) === fact(smallest) && place(largest) !== place(smallest);
}

export function compiledSameFactContrast(challenges: readonly AreaModelChallenge[]) {
  const targets = challenges.filter(hasCornerFactContrast).map(c => c.id);
  return { targets, count: targets.length };
}

const pick = <T>(list: readonly T[], random: () => number) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** Replace the factors of one model (the second, so the session still opens on an ordinary model)
 *  with a legal pair whose corner cells share a fact. Count, ids, flags and uniqueness hold. */
export function selectSameFactContrast(
  baseline: readonly AreaModelChallenge[], move: AreaModelGridMove | null,
  legalPairs: readonly OperandPair[], random: () => number = Math.random,
) {
  const result = (challenges: readonly AreaModelChallenge[], status: AreaModelAdaptationStatus) =>
    ({ challenges, status, ...compiledSameFactContrast(challenges) });
  if (!move) return result(baseline, 'no-focus');
  if (!baseline.length) return result(baseline, 'insufficient-capacity');
  if (compiledSameFactContrast(baseline).count) return result(baseline, 'already-targeted');
  const slot = Math.min(1, baseline.length - 1);
  const used = new Set(baseline.filter((_, i) => i !== slot).map(pairKey));
  const pool = legalPairs.filter(p => hasCornerFactContrast(p) && !used.has(pairKey(p)));
  if (!pool.length) return result(baseline, 'insufficient-capacity');
  const chosen = pick(pool, random);
  const next = baseline.map((c, i) => (i === slot
    ? { ...c, factor1Parts: [...chosen.factor1Parts], factor2Parts: [...chosen.factor2Parts] } : c));
  return result(next, 'targeted');
}

const sidesOf = (c: OperandPair) => [total(c.factor1Parts), total(c.factor2Parts)];
const areaOf = (c: OperandPair) => sidesOf(c)[0] * sidesOf(c)[1];
const sameAreaOtherSides = (a: OperandPair, b: OperandPair) => areaOf(a) === areaOf(b) && pairKey(a) !== pairKey(b);

/** Consecutive rectangles with equal area and different sides (so different perimeters). */
export function compiledEqualAreaContrast(challenges: readonly AreaModelChallenge[]) {
  for (let i = 0; i + 1 < challenges.length; i++) {
    if (sameAreaOtherSides(challenges[i], challenges[i + 1])) return { targets: [challenges[i].id, challenges[i + 1].id], count: 2 };
  }
  return { targets: [] as string[], count: 0 };
}

/** Reorders an existing equal-area pair first; otherwise replaces the neighbour of one rectangle with
 *  another legal factorisation of its area. Count, side range, no-square rule and uniqueness hold. */
export function selectEqualAreaContrast(
  baseline: readonly AreaModelChallenge[], move: AreaModelPerimeterMove | null,
  sideRange: { min: number; max: number }, random: () => number = Math.random,
) {
  const result = (challenges: readonly AreaModelChallenge[], status: AreaModelAdaptationStatus) =>
    ({ challenges, status, ...compiledEqualAreaContrast(challenges) });
  if (!move) return result(baseline, 'no-focus');
  const legal = (c: OperandPair) => c.factor1Parts.length === 1 && c.factor2Parts.length === 1
    && sidesOf(c).every(s => Number.isInteger(s) && s >= sideRange.min && s <= sideRange.max) && sidesOf(c)[0] !== sidesOf(c)[1];
  if (baseline.length < 2 || !baseline.every(legal) || new Set(baseline.map(pairKey)).size !== baseline.length) {
    return result(baseline, 'insufficient-capacity');
  }
  if (compiledEqualAreaContrast(baseline).count) return result(baseline, 'already-targeted');
  const reid = (list: AreaModelChallenge[]) => list.map((c, i) => ({ ...c, id: `area-model-${i + 1}` }));

  for (let a = 0; a < baseline.length; a++) for (let b = a + 1; b < baseline.length; b++) {
    if (!sameAreaOtherSides(baseline[a], baseline[b])) continue;
    const rest = baseline.filter((_, i) => i !== a && i !== b);
    const at = Math.min(a, rest.length);
    return result(reid([...rest.slice(0, at), baseline[a], baseline[b], ...rest.slice(at)]), 'targeted');
  }

  for (let keep = 0; keep < baseline.length; keep++) {
    const replace = keep + 1 < baseline.length ? keep + 1 : keep - 1;
    const used = new Set(baseline.filter((_, i) => i !== replace).map(pairKey));
    const area = areaOf(baseline[keep]);
    const options: OperandPair[] = [];
    for (let length = sideRange.min; length <= sideRange.max; length++) {
      const width = area / length;
      const option = { factor1Parts: [length], factor2Parts: [width] };
      if (Number.isInteger(width) && legal(option) && !used.has(pairKey(option))) options.push(option);
    }
    if (!options.length) continue;
    const chosen = pick(options, random);
    return result(baseline.map((c, i) => (i === replace ? { ...c, ...chosen } : c)), 'targeted');
  }
  return result(baseline, 'insufficient-capacity');
}
