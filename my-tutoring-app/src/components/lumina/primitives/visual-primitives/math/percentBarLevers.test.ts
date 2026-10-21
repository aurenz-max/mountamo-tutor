/**
 * percent-bar levers: the leak rules per mode, the simplify builder over every item shape the generator draws, and
 * "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { PercentBarChallenge, PercentBarChallengeType } from './PercentBar';
import { percentOfChallenge } from '../../../service/math/gemini-percent-bar';
import { percentItems } from '../../../service/itemSpace/percentOf';
import {
  ADDED_MODEL_LEVER, COMPARE_MODEL_LEVER, DISCOUNT_MODEL_LEVER, FILL_NAMES_LEVER, PART_COPIES_LEVER, PERCENT_LEVERS, SIMPLER_LEVER,
  TENTHS_LEVER, VALUE_BAR_LEVER,
  leverTextLeaks, practiceLeaks, simplerPercent, type PercentLeverContext,
} from './percentBarLevers';
import { PERCENT_MISSES_BY_MODE, amountTarget, challengeSteps, percentMiss, stepCorrect } from './percentBarWorkspace';

const ctx = { problemType: 'direct' as const, initialValue: 0, changeRate: 0, discountFactor: 0, finalValue: 0 };
const place = (prompt: string, whole: number, target: number, max = 100, recap?: string) =>
  ({ kind: 'place' as const, prompt, wholeValue: whole, wholeValueLabel: 'Price ($)', targetPercent: target, maxPercent: max, hint: '',
    ...(recap ? { recapLabel: recap } : {}) });

/** The generator's pools (`gemini-percent-bar.ts`), every combination. */
function items(type: PercentBarChallengeType): PercentBarChallenge[] {
  const out: PercentBarChallenge[] = [];
  const one = (id: string, scenario: string, whole: number, target: number): PercentBarChallenge => ({
    id, type, scenario, wholeValue: whole, wholeValueLabel: 'Total', question: 'Show it on the bar.', targetPercent: target, hint: '', context: ctx });
  if (type === 'direct') for (const r of [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) for (const b of [20, 25, 40, 50, 60, 80, 100])
    out.push(one(`d-${r}-${b}`, `A jar holds ${b} marbles; ${r}% are blue.`, b, r));
  if (type === 'subtraction') for (const d of [10, 15, 20, 25, 30, 40, 50, 60]) for (const b of [20, 30, 40, 50, 60, 80, 100, 120])
    out.push(one(`s-${d}-${b}`, `A $${b} shirt is ${d}% off.`, b, 100 - d));
  if (type === 'addition') for (const r of [5, 6, 7, 8, 10, 12, 15, 18, 20, 25]) for (const b of [20, 30, 40, 50, 60, 80, 100])
    out.push({ ...one(`a-${r}-${b}`, `A $${b} bill with a ${r}% tip.`, b, 100 + r), maxPercent: 150,
      steps: [place('Step 1 — the tip.', b, r, 100, 'Tip'), place('Step 2 — the total.', b, 100 + r, 150)] });
  if (type === 'comparison') for (const [ba, da, bb, db] of [[40, 30, 60, 50], [80, 50, 30, 10], [20, 10, 50, 40], [60, 25, 50, 10]]) {
    const pa = ba * (100 - da) / 100, pb = bb * (100 - db) / 100;
    out.push({ ...one(`c-${ba}-${bb}`, `A: $${ba} at ${da}% off; B: $${bb} at ${db}% off.`, ba, 100 - da),
      steps: [place('Step 1 — A.', ba, 100 - da, 100, 'A'), place('Step 2 — B.', bb, 100 - db, 100, 'B'),
        { kind: 'choice', prompt: 'Step 3 — which is cheaper?', options: [{ id: 'A', label: 'A', sublabel: `$${pa.toFixed(2)}` },
          { id: 'B', label: 'B', sublabel: `$${pb.toFixed(2)}` }], correctOptionId: pa < pb ? 'A' : 'B', hint: '' }] });
  }
  if (type === 'part_of' || type === 'whole_of') {
    const unknown = type === 'part_of' ? 'part' : 'whole';
    percentItems().filter(it => it.unknown === unknown).filter((_, i) => i % 5 === 0)
      .forEach(it => out.push(percentOfChallenge(it, `${type}-${it.percent}-${it.whole}`)));
  }
  return out;
}
const MODES: Array<[string, PercentBarChallengeType]> = [
  ['identify_percent', 'direct'], ['find_part', 'part_of'], ['percent_remaining', 'subtraction'], ['percent_total', 'addition'], ['find_whole', 'whole_of'], ['convert', 'comparison']];

describe('simplify builder', () => {
  it.each(MODES)('%s: same mode and step count, its own id and scenario, no step percent near the item\'s, solvable, deterministic',
    (_mode, type) => {
      let built = 0;
      for (const c of items(type)) {
        const s = simplerPercent(c);
        if (!s) continue;
        built++;
        expect(s.id).toBe(`${c.id}~simpler`);
        expect(s.type).toBe(c.type);
        expect(practiceLeaks(c, s)).toBe(false);
        expect(challengeSteps(s)).toHaveLength(challengeSteps(c).length);
        // Each practice step is answerable on its own bar.
        challengeSteps(s).forEach((step, i) => {
          if (step.kind === 'amount') {
            expect(stepCorrect(s, { stepIndex: i, percent: 0, selected: null, amount: String(amountTarget(step)) })).toBe(true);
            return;
          }
          if (step.kind !== 'place') return;
          expect(step.targetPercent).toBeLessThanOrEqual(step.maxPercent ?? 100);
          expect(stepCorrect(s, { stepIndex: i, percent: step.targetPercent, selected: null })).toBe(true);
        });
        expect(simplerPercent(c)).toEqual(s);
        expect(simplerPercent(s)).toBeNull();
      }
      if (type === 'comparison') expect(built).toBe(0);
      else expect(built).toBeGreaterThan(10);
    });

  it('an item already on a guide line or a whole ten has no easier version', () => {
    expect(simplerPercent(items('direct').find(c => c.targetPercent === 25)!)).toBeNull();
    expect(simplerPercent(items('subtraction').find(c => c.targetPercent === 50)!)).toBeNull();
    expect(simplerPercent(items('addition').find(c => c.targetPercent === 110)!)).toBeNull();
    expect(simplerPercent(items('part_of').find(c => c.targetPercent === 10)!)).toBeNull();
    expect(simplerPercent(items('whole_of').find(c => c.targetPercent === 50)!)).toBeNull();
  });

  it("a find-whole practice problem never uses the item's whole, and its answer is not the item's", () => {
    for (const c of items('whole_of')) {
      const s = simplerPercent(c);
      if (!s) continue;
      const [mine] = challengeSteps(c).filter(x => x.kind === 'amount');
      const [theirs] = challengeSteps(s).filter(x => x.kind === 'amount');
      if (mine?.kind !== 'amount' || theirs?.kind !== 'amount') throw new Error('no amount step');
      expect(theirs.whole).not.toBe(mine.whole);
      expect(amountTarget(theirs)).not.toBe(amountTarget(mine));
    }
  });

  it('the leak rule refuses the learner\'s own percent, its scenario and a lost step', () => {
    const parent = items('addition').find(c => c.id === 'a-12-80')!;
    const kid = simplerPercent(parent)!;
    expect(challengeSteps(kid).map(s => s.kind === 'place' && s.targetPercent)).toEqual([20, 120]);
    expect(practiceLeaks(parent, { ...kid, scenario: parent.scenario })).toBe(true);
    expect(practiceLeaks(parent, { ...kid, steps: kid.steps!.slice(1) })).toBe(true);
    expect(practiceLeaks(parent, { ...kid, steps: [{ ...kid.steps![0], targetPercent: 13 } as never, kid.steps![1]] })).toBe(true);
  });
});

const declare = (c: PercentBarChallenge, ctx: PercentLeverContext, pulled: string[] = []) => PERCENT_LEVERS.declare(c, ctx, pulled);
const FIRST: PercentLeverContext = { valueBarShown: false, step: 'place' };

describe('declarations', () => {
  it.each(MODES)('%s: every catalog miss is answered by a help lever on every item; no lever text or fact carries a digit', (mode, type) => {
    const misses = getComponentById('percent-bar')!.teachingWorkspace!.misses![mode];
    expect(misses).toEqual(PERCENT_MISSES_BY_MODE[mode]);
    for (const c of items(type)) for (const valueBarShown of [false, true]) {
      const ctx = { valueBarShown, step: 'place' as const };
      const levers = declare(c, ctx);
      const help = levers.filter(l => l.kind === 'help');
      for (const miss of misses) expect(help.some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
      expect(leverTextLeaks(PERCENT_LEVERS.onScreen(c, ctx, levers.map(l => l.id)))).toBe(false);
    }
  });

  it('the value bar is offered only where the session does not draw it; a practice problem has no levers', () => {
    const c = items('subtraction')[0];
    expect(declare(c, FIRST).map(l => l.id))
      .toEqual([VALUE_BAR_LEVER, TENTHS_LEVER, FILL_NAMES_LEVER, DISCOUNT_MODEL_LEVER, SIMPLER_LEVER]);
    expect(declare(c, { ...FIRST, valueBarShown: true }).map(l => l.id)).not.toContain(VALUE_BAR_LEVER);
    expect(declare(simplerPercent(c)!, FIRST)).toEqual([]);
  });

  it('a choice step shows no bar, so no bar lever is offered there; part_copies is offered from the first step', () => {
    const c = items('comparison')[0];
    expect(declare(c, { valueBarShown: false, step: 'choice' }).map(l => l.id)).toEqual([DISCOUNT_MODEL_LEVER, COMPARE_MODEL_LEVER]);
    const w = items('whole_of')[0];
    expect(declare(w, FIRST).map(l => l.id)).toContain(PART_COPIES_LEVER);
    expect(PERCENT_LEVERS.support(c, FIRST)).toBe('');
  });

  // "This wrong answer, then this lever": where the bar was set (or the option tapped), the miss, the first open lever.
  const byId = (type: PercentBarChallengeType, id: string) => items(type).find(c => c.id === id)!;
  it.each([
    ['direct', 'd-30-40', 0, 70, null, 'complement', FILL_NAMES_LEVER],
    ['direct', 'd-30-40', 0, 12, null, 'placed_value', VALUE_BAR_LEVER],
    ['direct', 'd-30-40', 0, 45, null, 'too_high', TENTHS_LEVER],
    ['subtraction', 's-20-40', 0, 20, null, 'placed_discount', FILL_NAMES_LEVER],
    ['addition', 'a-15-80', 1, 15, null, 'rate_not_total', FILL_NAMES_LEVER],
    ['addition', 'a-15-80', 1, 100, null, 'whole_only', ADDED_MODEL_LEVER],
    ['addition', 'a-15-80', 1, 85, null, 'took_off_rate', ADDED_MODEL_LEVER],
    ['comparison', 'c-40-60', 0, 30, null, 'placed_discount', FILL_NAMES_LEVER],
    ['comparison', 'c-40-60', 2, 0, 'B', 'bigger_discount', COMPARE_MODEL_LEVER],
    ['part_of', 'part_of-15-60', 0, 85, null, 'complement', FILL_NAMES_LEVER],
    ['part_of', 'part_of-15-60', 1, 0, '51', 'rest_not_part', FILL_NAMES_LEVER],
    ['part_of', 'part_of-15-60', 1, 0, '15', 'percent_as_amount', TENTHS_LEVER],
    ['part_of', 'part_of-15-60', 1, 0, '6', 'tenth_only', TENTHS_LEVER],
    ['part_of', 'part_of-15-60', 1, 0, '30', 'too_high', TENTHS_LEVER],
    ['whole_of', 'whole_of-20-60', 1, 0, '2.4', 'percent_of_part', PART_COPIES_LEVER],
    ['whole_of', 'whole_of-20-60', 1, 0, '120', 'part_times_ten', TENTHS_LEVER],
    ['whole_of', 'whole_of-20-60', 1, 0, '48', 'rest_not_whole', FILL_NAMES_LEVER],
    ['whole_of', 'whole_of-20-60', 1, 0, '12', 'part_as_whole', PART_COPIES_LEVER],
    ['whole_of', 'whole_of-20-60', 1, 0, '58', 'near_miss', TENTHS_LEVER],
  ] as const)('%s %s step %d at %d / %s: %s, then %s', (type, id, stepIndex, percent, selected, miss, lever) => {
    const c = byId(type, id) ?? percentOfChallenge(percentItems().find(it => `${type}-${it.percent}-${it.whole}` === id
      && it.unknown === (type === 'part_of' ? 'part' : 'whole'))!, id);
    const amountStep = challengeSteps(c)[stepIndex]?.kind === 'amount';
    expect(percentMiss(c, amountStep ? { stepIndex, percent, selected: null, amount: selected ?? '' } : { stepIndex, percent, selected })).toBe(miss);
    const step = challengeSteps(c)[stepIndex]?.kind;
    expect(nextLever(declare(c, { valueBarShown: false, step }), miss)).toBe(lever);
  });

  it('with the first lever pulled, the next one for the same miss comes up', () => {
    const c = byId('subtraction', 's-20-40');
    expect(nextLever(declare(c, FIRST, [FILL_NAMES_LEVER]), 'placed_discount')).toBe(DISCOUNT_MODEL_LEVER);
  });
});
