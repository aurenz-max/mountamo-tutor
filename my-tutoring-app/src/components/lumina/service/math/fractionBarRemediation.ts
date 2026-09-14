import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import type { FractionBarChallenge } from '../../primitives/visual-primitives/math/FractionBar';

export type FractionBarRemediationMove = 'contrast_shared_digit_roles';

// Describes the build-mode affordance, not diagnosis wording. identify is
// unit fractions only (numerator always 1), so no number can change roles there.
export const fractionBarTeaching: TeachingCapability<FractionBarRemediationMove> = {
  activity: 'fraction-bar',
  task: 'For each of several proper fractions with a numerator of at least 2 and a denominator from 3 to 6: choose the numerator from four numbers, choose the denominator from four numbers, then shade parts of a bar that is divided into the denominator\'s number of equal parts until the shaded count equals the numerator. Each question offers the fraction\'s other number among its choices. Does not compare, order, or combine fractions.',
  moves: [{ id: 'contrast_shared_digit_roles', description: 'Place two consecutive fractions in which the same number is the denominator of one and the numerator of the other (for example 3/4, then 4/5). The student selects that number once as the count of equal parts in the whole and once as the count of shaded parts, and shades each bar accordingly, while the other number of each fraction stays among the choices. Holds the item count, fraction range and choice structure constant. Does not teach comparing fraction sizes, equivalence, or operations with fractions.' }],
};

/** Code-owned eligibility: only build draws non-unit fractions from a fixed window. */
export function eligibleFractionBarTeaching(task: AdaptationTask): boolean {
  return task.mode === 'build';
}

type Pair = { numerator: number; denominator: number };
const inBuildWindow = (p: Pair) => Number.isInteger(p.numerator) && Number.isInteger(p.denominator)
  && p.numerator >= 2 && p.numerator < p.denominator && p.denominator >= 3 && p.denominator <= 6;
const sharesRole = (a: Pair, b: Pair) => a.denominator === b.numerator || a.numerator === b.denominator;
const offersPartner = (c: FractionBarChallenge) =>
  c.numeratorChoices.includes(c.numerator) && c.numeratorChoices.includes(c.denominator)
  && c.denominatorChoices.includes(c.denominator) && c.denominatorChoices.includes(c.numerator);

/** Compiled check on final challenges: consecutive fractions whose shared number
 * changes role, with both numbers offered in every question of the pair. */
export function compiledSharedDigitRoleContrast(challenges: readonly FractionBarChallenge[]) {
  for (let i = 0; i + 1 < challenges.length; i++) {
    const [a, b] = [challenges[i], challenges[i + 1]];
    if (sharesRole(a, b) && offersPartner(a) && offersPartner(b)) return { targets: [a.id, b.id], count: 2 };
  }
  return { targets: [] as string[], count: 0 };
}

export type FractionBarAdaptationStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';

/** Reorders first; replaces one fraction only when no pair exists. Count, window,
 * uniqueness and the tier's choice builder are preserved; ids follow position. */
export function selectSharedDigitRoleContrast(
  baseline: readonly FractionBarChallenge[], move: FractionBarRemediationMove | null,
  choicesFor: (p: Pair) => Pick<FractionBarChallenge, 'numeratorChoices' | 'denominatorChoices'>,
  random: () => number = Math.random,
) {
  const result = (challenges: readonly FractionBarChallenge[], status: FractionBarAdaptationStatus) =>
    ({ challenges, status, ...compiledSharedDigitRoleContrast(challenges) });
  if (!move) return result(baseline, 'no-focus');
  if (baseline.length < 2 || !baseline.every(inBuildWindow)
    || new Set(baseline.map(c => `${c.numerator}/${c.denominator}`)).size !== baseline.length) return result(baseline, 'insufficient-capacity');
  if (compiledSharedDigitRoleContrast(baseline).count === 2) return result(baseline, 'already-targeted');
  const reid = (list: FractionBarChallenge[]) => list.map((c, i) => ({ ...c, id: `fraction-bar-${i + 1}` }));
  const accept = (list: FractionBarChallenge[]) => compiledSharedDigitRoleContrast(list).count === 2 ? list : null;

  for (let a = 0; a < baseline.length; a++) for (let b = a + 1; b < baseline.length; b++) {
    if (!sharesRole(baseline[a], baseline[b])) continue;
    const rest = baseline.filter((_, i) => i !== a && i !== b);
    const at = Math.min(a, rest.length);
    const next = accept(reid([...rest.slice(0, at), baseline[a], baseline[b], ...rest.slice(at)]));
    if (next) return result(next, 'targeted');
  }

  const used = new Set(baseline.map(c => `${c.numerator}/${c.denominator}`));
  const candidates: Pair[] = [];
  for (let d = 3; d <= 6; d++) for (let n = 2; n < d; n++) if (!used.has(`${n}/${d}`)) candidates.push({ numerator: n, denominator: d });
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (let keep = 0; keep < baseline.length; keep++) {
    const replace = keep + 1 < baseline.length ? keep + 1 : keep - 1;
    const pair = candidates.find(p => sharesRole(baseline[keep], p));
    if (!pair) continue;
    const next = accept(reid(baseline.map((c, i) => i === replace ? { ...c, ...pair, ...choicesFor(pair) } : c)));
    if (next) return result(next, 'targeted');
  }
  return result(baseline, 'insufficient-capacity');
}

/** Delivery gate on the manifest config: the shared-digit-role contrast lives in build. */
export function fractionBarDeliveryEligible(config: Record<string, unknown>): boolean {
  return config.targetEvalMode === 'build';
}
