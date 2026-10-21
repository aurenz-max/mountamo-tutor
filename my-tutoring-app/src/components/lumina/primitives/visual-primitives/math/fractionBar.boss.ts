/**
 * fraction-bar's boss (`components/live-activity/boss.ts`), bespoke because its modes are answered three ways (the
 * three-step item's picks and shading, a sign between two bars, an open build), every one checked by the bar: the card
 * is `fractionBar.card.ts`; this file validates a lesson, lists its items, asks one, carries the lever set and plays the
 * harness.
 */
import type { FractionBarChallenge, FractionBarData } from './FractionBar';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { barItems, barTask, type FractionBarItem } from './fractionBarWorkspace';
import { cutsFor, equalWays } from './fractionEqualBuild';
import { FRACTION_BAR_LEVERS, barPractice } from './fractionBarLevers';
import { fractionBarCard, type FractionBarAnyMiss } from './fractionBar.card';

const whole = (n: unknown, min: number, max: number): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** A challenge the bar can run to a correct check: both choices reachable and a shadeable target, or an open build with another way. */
function runnable(type: FractionBarData['challengeType']) {
  return (c: FractionBarChallenge): boolean => {
    if (!c || typeof c.id !== 'string' || !whole(c.denominator, 2, 12)) return false;
    // The open build needs another equal split the bar can make (never the target's own).
    if (type === 'build_equal') return whole(c.numerator, 1, c.denominator - 1) && equalWays(c.numerator, c.denominator).length > 0;
    // compare: two proper fractions and the relation the check expects.
    if (type === 'compare') return whole(c.numerator, 1, c.denominator - 1) && !!c.compareWith
      && whole(c.compareWith.denominator, 2, 12) && whole(c.compareWith.numerator, 1, c.compareWith.denominator - 1)
      && ['<', '=', '>'].includes(c.relation as string);
    return whole(c.numerator, 0, c.denominator) && Array.isArray(c.numeratorChoices) && c.numeratorChoices.includes(c.numerator)
      && Array.isArray(c.denominatorChoices) && c.denominatorChoices.includes(c.denominator);
  };
}

/** Reject a fraction-bar lesson with no known mode or a challenge the bar cannot run. */
export function validateFractionBarData(value: unknown): FractionBarData {
  const type = (value as FractionBarData | null)?.challengeType;
  if (!['identify', 'build', 'larger_denominators', 'compare', 'add_subtract', 'build_equal'].includes(type as string))
    throw new Error('Generated fraction bar has no known challenge type.');
  return validateChallengePool<FractionBarData>(value, runnable(type as FractionBarData['challengeType']), {
    pool: 'Generated fraction bar has no valid challenges.',
    item: 'A fraction bar challenge cannot run in the lesson.',
  });
}

/** The current item: the session challenge, or the easier practice item a simplify lever opened, rebuilt from its parent. */
function currentItem(ctx: JourneyContext): FractionBarItem | undefined {
  const data = ctx.data as FractionBarData;
  const [parentId, easier] = String(ctx.itemId ?? '').split('~');
  const parent = barItems(data).find(c => c.id === parentId);
  if (!parent || !easier) return parent;
  return barPractice(parent, data.gradeBand) ?? undefined;
}

/**
 * The harness's moves, through the bar's own controls. The three-step item goes from the step the scene names: the
 * numerator button and Check Answer, the denominator button and Check Answer, then the bar part that shades up to the
 * numerator and Submit Fraction. A wrong answer is the wrong number at the current step (the denominator for the
 * numerator, and back), or one part over on the bar. build_equal: the first other way the bar can make, split directly
 * or by halving every part of the target's split, shaded and "I'm done!" (wrong: one part too many, `one_off`).
 * compare: the item's relation sign and Check Answer (wrong: another sign).
 */
function play(right: boolean, c: FractionBarItem, ctx: JourneyContext): DriverInput[] {
  const band = (ctx.data as FractionBarData).gradeBand;
  const wrong = !right;
  const off = (n: number, max: number) => (n + 1 <= max ? n + 1 : n - 1);
  const part = (i: number): DriverInput => ({ type: 'touch', target: `part-${i}` });
  if (c.type === 'build_equal') {
    const way = equalWays(c.numerator, c.denominator, band)[0];
    if (!way) throw new Error(`fraction-bar build_equal ${c.numerator}/${c.denominator}: no other way to make it`);
    const knife: DriverInput = { type: 'choose', label: '✂️ Cut a part in half' };
    const split: DriverInput[] = cutsFor(band).includes(way.pieces) ? [{ type: 'choose', label: `Split into ${way.pieces} equal parts` }]
      : [{ type: 'choose', label: `Split into ${c.denominator} equal parts` }, knife,
        ...Array.from({ length: c.denominator }, (_, k) => part(2 * k)), knife];
    const shaded = wrong ? off(way.shaded, way.pieces) : way.shaded;
    return [...split, ...Array.from({ length: shaded }, (_, i) => part(i)), { type: 'choose', label: "I'm done!" }];
  }
  const check: DriverInput = { type: 'choose', label: 'Check Answer' };
  if (c.type === 'compare') {
    if (!c.relation) throw new Error(`fraction-bar compare ${c.id}: no relation`);
    const sign = wrong ? (['<', '=', '>'] as const).find(r => r !== c.relation)! : c.relation;
    return [{ type: 'choose', label: sign }, check];
  }
  const pick = (value: number, choices: number[], other: number) => {
    if (!wrong) return String(value);
    return String(choices.includes(other) && other !== value ? other : choices.find(x => x !== value));
  };
  const shade = (n: number): DriverInput[] => [...(n > 0 ? [part(n - 1)] : []), { type: 'choose', label: 'Submit Fraction' }];
  const step = ctx.demand?.step;
  if (step === 'shade') return shade(wrong ? off(c.numerator, c.denominator) : c.numerator);
  const denominator: DriverInput[] = [{ type: 'choose', label: pick(c.denominator, c.denominatorChoices, c.numerator) }, check];
  if (step === 'denominator') return wrong ? denominator : [...denominator, ...shade(c.numerator)];
  const numerator: DriverInput[] = [{ type: 'choose', label: pick(c.numerator, c.numeratorChoices, c.denominator) }, check];
  return wrong ? numerator : [...numerator, ...denominator, ...shade(c.numerator)];
}

export const fractionBarBoss = defineBoss<FractionBarData, FractionBarItem, FractionBarAnyMiss>({
  card: fractionBarCard,
  validate: validateFractionBarData,
  items: barItems,
  ask: item => barTask(item),
  // Every item is a gesture the bar checks: no key reaches the tutor (not the pick, the count or the sign).
  assignment: item => bossAssignment(item.id, barTask(item), null),
  levers: FRACTION_BAR_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/FractionBar.tsx',
    instanceId: 'bar',
    defaults: { grade: 'Grade 3', mode: 'build', topic: 'Naming and building fractions on a bar' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
  },
});
