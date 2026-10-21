/**
 * fraction-circles' boss (`components/live-activity/boss.ts`), bespoke because its modes are answered five ways (a typed
 * fraction, shaded slices, a chosen side, an open build, a touched picture), every one checked by the circle: the card
 * is `fractionCircles.card.ts`; this file validates a lesson, lists its challenges, asks one, carries the lever set and
 * plays the harness.
 */
import type { FractionCirclesChallenge, FractionCirclesData } from './FractionCircles';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { buildFractionTouchItems, twoPictureItem } from './fractionCirclesWorkspace';
import { cutsFor, equalWays } from './fractionEqualBuild';
import { fractionTouchPlan } from './fractionTouchModes';
import { FRACTION_CIRCLES_LEVERS, isTouchItem, modeOfItem, simplerItem, type FractionCirclesItem } from './fractionCirclesLevers';
import { fractionCirclesCard, type FractionCirclesMiss } from './fractionCircles.card';

const whole = (n: unknown, min: number, max: number): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** A challenge the component can actually run to a correct Check (or, for touch_fraction, build three pictures for). */
function runnable(c: FractionCirclesChallenge): boolean {
  if (!c || typeof c.id !== 'string' || typeof c.instruction !== 'string' || !whole(c.denominator, 2, 12)) return false;
  switch (c.type) {
    case 'identify': return whole(c.numerator, 0, c.denominator);
    // The Check needs at least one shaded slice.
    case 'build': return whole(c.numerator, 1, c.denominator);
    case 'compare': return whole(c.numerator, 0, c.denominator) && !!c.compareFraction
      && whole(c.compareFraction.denominator, 2, 12) && whole(c.compareFraction.numerator, 0, c.compareFraction.denominator);
    case 'equivalent': {
      const d = c.equivalentDenominator;
      if (!whole(c.numerator, 1, c.denominator) || !whole(d, 2, 12)) return false;
      const built = c.numerator * d / c.denominator;
      return Number.isInteger(built) && built >= 1 && built <= d;
    }
    case 'touch_fraction':
      try { buildFractionTouchItems([c]); return true; } catch { return false; }
    // The open build needs another equal cut the circle can make (never the target's own).
    case 'build_equal': return whole(c.numerator, 1, c.denominator - 1) && equalWays(c.numerator, c.denominator).length > 0;
    default: return false;
  }
}

/** Reject a fraction-circles lesson with a challenge the component cannot run. */
export function validateFractionCirclesData(value: unknown): FractionCirclesData {
  return validateChallengePool<FractionCirclesData>(value, runnable, {
    pool: 'Generated fraction circles have no valid challenges.',
    item: 'A fraction circles challenge cannot run in the lesson.',
  });
}

/** What the learner is asked. A touch item's fraction is spoken, never printed: its ask is the instruction to say. */
export function fractionCirclesAsk(item: FractionCirclesItem): string {
  if (isTouchItem(item)) return item.actionContract.instruction;
  return item.type === 'touch_fraction'
    ? fractionTouchPlan({ id: item.id, challengeType: 'touch_fraction', numerator: item.numerator, denominator: item.denominator })
      .answerStep.actionContract.instruction
    : item.instruction;
}

/** The current item: the session challenge, or the easier practice item a simplify lever opened, rebuilt from its parent. */
function currentItem(data: FractionCirclesData, itemId: string): FractionCirclesItem | undefined {
  const [parentId, easier] = itemId.split('~');
  const parent = (data.challenges ?? []).find(c => c.id === parentId);
  if (!parent || !easier) return parent;
  if (parent.type === 'touch_fraction') return twoPictureItem(buildFractionTouchItems([parent])[0]) ?? undefined;
  return simplerItem(parent, data.gradeBand) ?? undefined;
}

/**
 * The harness's moves: typed text, shaded slices or a choice, then Check; the open build's cut and shading, then
 * I'm done!; a touch on the picture. A wrong answer is one slice or one numerator off, or another choice.
 */
function play(right: boolean, item: FractionCirclesItem, band?: string): DriverInput[] {
  const off = (n: number, max: number) => (n + 1 <= max ? n + 1 : n - 1);
  const check: DriverInput = { type: 'check' };
  const shade = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'touch' as const, target: `slice-${i}` }));
  if (isTouchItem(item)) {
    // A two-picture practice item is built deterministically, so its other picture is known.
    const pick = item.choices.find(c => (c.id === item.correctChoiceId) === right);
    if (!pick) throw new Error('fraction-circles touch_fraction: no picture to touch');
    return [{ type: 'touch', target: `picture-${pick.numerator}-of-${pick.denominator}` }];
  }
  const c = item;
  switch (c.type) {
    case 'identify':
      return [{ type: 'write', label: 'Fraction answer', text: `${right ? c.numerator : off(c.numerator, c.denominator)}/${c.denominator}` }, check];
    case 'build': return [...shade(right ? c.numerator : off(c.numerator, c.denominator)), check];
    case 'equivalent': {
      const e = c.equivalentDenominator!, built = c.numerator * e / c.denominator;
      return [...shade(right ? built : off(built, e)), check];
    }
    case 'compare': {
      const cmp = c.compareFraction!;
      const left = c.numerator / c.denominator, rightValue = cmp.numerator / cmp.denominator;
      const key = Math.abs(left - rightValue) < 0.001 ? 'equal' : left > rightValue ? 'left' : 'right';
      const choice = right ? key : (key === 'left' ? 'right' : 'left');
      const labels = c.showFractionLabels !== false;
      const label = choice === 'equal' ? 'They are equal'
        : choice === 'left' ? (labels ? `Left (${c.numerator}/${c.denominator}) is larger` : 'Left is larger')
          : (labels ? `Right (${cmp.numerator}/${cmp.denominator}) is larger` : 'Right is larger');
      return [{ type: 'choose', label }, check];
    }
    case 'build_equal': {
      // The first other way the circle can make; halving every piece of the target's cut when no button makes it.
      // Wrong: one piece too many shaded on that cut (`one_off`).
      const way = equalWays(c.numerator, c.denominator, band)[0];
      if (!way) throw new Error(`fraction-circles build_equal ${c.numerator}/${c.denominator}: no other way to make it`);
      const cut: DriverInput[] = cutsFor(band).includes(way.pieces) ? [{ type: 'choose', label: `Cut into ${way.pieces} equal pieces` }]
        : [{ type: 'choose', label: `Cut into ${c.denominator} equal pieces` }, { type: 'choose', label: '✂️ Cut a piece in half' },
          ...Array.from({ length: c.denominator }, (_, k) => ({ type: 'touch' as const, target: `slice-${2 * k}` })),
          { type: 'choose', label: '✂️ Cut a piece in half' }];
      return [...cut, ...shade(right ? way.shaded : off(way.shaded, way.pieces)), { type: 'choose', label: "I'm done!" }];
    }
    case 'touch_fraction':
      // The two wrong pictures are drawn at random on mount, so the harness cannot name one.
      if (!right) throw new Error('fraction-circles touch_fraction: the wrong pictures are random per mount; no driver input for a wrong touch');
      return [{ type: 'touch', target: `picture-${c.numerator}-of-${c.denominator}` }];
    default: throw new Error(`fraction-circles ${modeOfItem(c)}: no driver input`);
  }
}

export const fractionCirclesBoss = defineBoss<FractionCirclesData, FractionCirclesItem, FractionCirclesMiss>({
  card: fractionCirclesCard,
  validate: validateFractionCirclesData,
  items: d => d.challenges,
  ask: item => fractionCirclesAsk(item),
  // Every item is a gesture the circle checks: no key reaches the tutor (not the typed fraction, not the larger
  // circle, not the matching picture).
  assignment: item => bossAssignment(item.id, fractionCirclesAsk(item), null),
  levers: FRACTION_CIRCLES_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/FractionCircles.tsx',
    instanceId: 'circles',
    defaults: { grade: 'Grade 2', mode: 'build', topic: 'Building halves, thirds and fourths by shading equal slices' },
    mounted: '[data-pip-object="workspace"]',
    current: ctx => currentItem(ctx.data as FractionCirclesData, String(ctx.itemId ?? '')),
    play: (right, item, ctx) => play(right, item, (ctx.data as FractionCirclesData).gradeBand),
  },
});
