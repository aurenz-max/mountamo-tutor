import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import { normalizeObjectiveGrade } from '../generation/resolveGenerationContext';
import type { FractionCirclesChallenge } from '../../primitives/visual-primitives/math/FractionCircles';

export type FractionCirclesRemediationMove = 'contrast_same_numerator_denominators';

// Describes the compare-mode affordance, not diagnosis wording. Every circle is
// cut into equal parts by construction, so unequal partitions cannot be shown.
export const fractionCompareTeaching: TeachingCapability<FractionCirclesRemediationMove> = {
  activity: 'fraction-circles',
  task: 'For each of several pairs of proper fractions, look at two circles of the same size, each cut into equal slices with some slices shaded, and tap which fraction is larger or whether they are equal. The instruction names both fractions; numeric labels under the circles are hidden, so the size of the shaded area is the visible evidence. Every circle is always cut into equal parts.',
  moves: [{ id: 'contrast_same_numerator_denominators', description: 'Make two of the comparisons pairs with the same numerator and different denominators (for example 1/4 against 1/8, then 2/3 against 2/6). Both circles are the same size, so the circle cut into more slices has smaller slices, and the same number of those smaller slices covers less of the circle: the fraction with the larger denominator is the smaller amount. Holds the numerator within each pair, the size of the whole, the item count and the support level constant while changing the number of equal parts. Does not show unequal parts, compare fractions that share a denominator, or practice naming, shading or building a fraction.' }],
};

/** Published objectives whose comparison structure admits same-numerator pairs.
 * Like-denominator, benchmark and common-denominator objectives are excluded. */
const REVIEWED_SUBSKILLS: Readonly<Record<string, readonly string[]>> = {
  '3': ['NF001-02-e', 'NF001-06-b', 'NF001-06-c'],
  '4': ['NF002-02-b', 'NF002-02-e'],
};
/** Grade 3 standards limit denominators to 2, 3, 4, 6 and 8. */
const GRADE_DENOMINATORS: Readonly<Record<string, readonly number[]>> = {
  '3': [2, 3, 4, 6, 8],
  '4': [2, 3, 4, 5, 6, 8, 10, 12],
};
const FAMILY_DENOMINATORS: readonly [RegExp, number][] = [
  [/\bhalf|\bhalves\b/i, 2], [/\bthirds?\b/i, 3], [/\bfourths?\b|\bquarters?\b/i, 4], [/\bfifths?\b/i, 5],
  [/\bsixths?\b/i, 6], [/\beighths?\b/i, 8], [/\btenths?\b/i, 10], [/\btwelfths?\b/i, 12],
];

/** Delivery gate on the manifest config: reviewed objective, compare, medium. */
export function fractionCompareDeliveryEligible(config: Record<string, unknown>): boolean {
  const grade = normalizeObjectiveGrade(config.objectiveGrade);
  return config.targetEvalMode === 'compare' && String(config.difficulty ?? '').trim().toLowerCase() === 'medium'
    && !!grade && (REVIEWED_SUBSKILLS[grade] ?? []).includes(String(config.subskillId));
}

/** Content constraints only; never interprets an observation. Explicit fractions
 * in the topic, intent or objective statement are lesson anchors and outrank
 * adaptation. Published objectives list illustrative "Examples:", which are not. */
export function eligibleFractionCompareTeaching(task: AdaptationTask): boolean {
  const objective = (task.objectiveText ?? '').split(/\bExamples?:/i)[0];
  const text = [task.topic, task.intent, objective].filter(Boolean).join(' ');
  return !!GRADE_DENOMINATORS[task.grade ?? ''] && task.mode === 'compare' && task.tier === 'medium'
    && !/\b\d+\s*\/\s*\d+\b/.test(text) && legalDenominators(task).length >= 2;
}

/** Grade-legal denominators, narrowed to any fraction family the topic or intent names. */
export function legalDenominators(task: Pick<AdaptationTask, 'grade' | 'topic' | 'intent'>): number[] {
  const grade = GRADE_DENOMINATORS[task.grade ?? ''] ?? [];
  const text = [task.topic, task.intent].filter(Boolean).join(' ');
  const named = FAMILY_DENOMINATORS.filter(([pattern]) => pattern.test(text)).map(([, d]) => d);
  return named.length ? grade.filter(d => named.includes(d)) : [...grade];
}

type Fraction = { numerator: number; denominator: number };
const shownValue = (f: Fraction) => f.numerator / f.denominator;
const proper = (f: Fraction) => Number.isInteger(f.numerator) && Number.isInteger(f.denominator)
  && f.numerator >= 1 && f.numerator < f.denominator;
const pairKey = (c: FractionCirclesChallenge) =>
  [`${c.numerator}/${c.denominator}`, `${c.compareFraction?.numerator}/${c.compareFraction?.denominator}`].sort().join('|');

export function isSameNumeratorContrast(c: FractionCirclesChallenge): boolean {
  const other = c.compareFraction;
  return c.type === 'compare' && !!other && proper(c) && proper(other)
    && c.numerator === other.numerator && c.denominator !== other.denominator;
}

/** Compiled check on final challenges; the component compares values only. */
export function compiledSameNumeratorContrast(challenges: readonly FractionCirclesChallenge[]) {
  const targets = challenges.filter(isSameNumeratorContrast).map(c => c.id);
  return { targets, count: targets.length };
}

export type FractionCirclesAdaptationStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';

type Option = { index: number; challenge: FractionCirclesChallenge; cost: number; largerOnLeft: boolean };

/** Rewrites one fraction of a pair so both share a numerator. Pairs that already
 * share a numerator or denominator, or are equal, keep their structure. */
function optionsFor(c: FractionCirclesChallenge, index: number, legal: readonly number[]): Option[] {
  const other = c.compareFraction;
  if (c.type !== 'compare' || !other || c.numerator === other.numerator || c.denominator === other.denominator
    || Math.abs(shownValue(c) - shownValue(other)) < 1e-9) return [];
  const options: Option[] = [];
  for (const keepLeft of [true, false]) {
    const kept = keepLeft ? { numerator: c.numerator, denominator: c.denominator } : other;
    const replaced = keepLeft ? other : c;
    if (!proper(kept) || !legal.includes(kept.denominator)) continue;
    for (const denominator of legal) {
      if (denominator === kept.denominator || denominator <= kept.numerator) continue;
      const rewritten = { numerator: kept.numerator, denominator };
      const challenge = keepLeft ? { ...c, compareFraction: rewritten } : { ...c, ...rewritten, compareFraction: { ...other } };
      options.push({ index, challenge, cost: Math.abs(denominator - replaced.denominator),
        largerOnLeft: challenge.denominator > challenge.compareFraction!.denominator });
    }
  }
  return options;
}

/** Deterministic: the same baseline always yields the same session. Count, ids,
 * types, tier flags and every untouched pair are preserved; all or nothing. */
export function selectSameNumeratorContrast(
  baseline: readonly FractionCirclesChallenge[], move: FractionCirclesRemediationMove | null, legal: readonly number[],
) {
  const result = (challenges: readonly FractionCirclesChallenge[], status: FractionCirclesAdaptationStatus) =>
    ({ challenges, status, ...compiledSameNumeratorContrast(challenges) });
  if (!move || baseline.some(c => c.type !== 'compare')) return result(baseline, 'no-focus');
  const existing = baseline.filter(isSameNumeratorContrast);
  if (existing.length >= 2) return result(baseline, 'already-targeted');
  const options = baseline.flatMap((c, i) => optionsFor(c, i, legal));
  const unique = (next: readonly FractionCirclesChallenge[]) => new Set(next.map(pairKey)).size === next.length;
  const apply = (chosen: readonly Option[]) => baseline.map((c, i) => chosen.find(o => o.index === i)?.challenge ?? c);
  // Soft preferences: the two contrasts put the larger denominator on different
  // sides and use different numerators, so neither position nor numeral repeats.
  const penalty = (a: FractionCirclesChallenge, b: FractionCirclesChallenge, largerOnLeftA: boolean, largerOnLeftB: boolean) =>
    (largerOnLeftA === largerOnLeftB ? 4 : 0) + (a.numerator === b.numerator ? 2 : 0);
  let best: { chosen: Option[]; score: number } | null = null;
  if (existing.length === 1) {
    const anchor = existing[0];
    const anchorLeft = anchor.denominator > anchor.compareFraction!.denominator;
    for (const o of options) {
      const score = o.cost + penalty(o.challenge, anchor, o.largerOnLeft, anchorLeft);
      if ((!best || score < best.score) && unique(apply([o]))) best = { chosen: [o], score };
    }
  } else {
    for (const a of options) for (const b of options) {
      if (b.index <= a.index) continue;
      const score = a.cost + b.cost + penalty(a.challenge, b.challenge, a.largerOnLeft, b.largerOnLeft);
      if ((!best || score < best.score) && unique(apply([a, b]))) best = { chosen: [a, b], score };
    }
  }
  return best ? result(apply(best.chosen), 'targeted') : result(baseline, 'insufficient-capacity');
}
