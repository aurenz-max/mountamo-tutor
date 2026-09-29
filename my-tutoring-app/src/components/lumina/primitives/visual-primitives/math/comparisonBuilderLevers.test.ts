/**
 * The comparison-builder levers (handoff 21 M2): which lever answers which miss, and each lever's leak rule.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';
import { comparisonMiss } from './comparisonBuilderWorkspace';
import { FAR_GROUPS_LEVER, FAR_NUMBERS_LEVER, HOPS_LEVER, MARKS_LEVER, MATCH_LEVER, SMALL_LEVER, STEPS_LEVER, TAP_LEVER,
  THREE_FAR_LEVER, comparisonLevers, farGroups, farNumbers, hopLabels, leverFacts, modelPair, quantityParts, singleSmall,
  slotSteps, startLevers, threeFar } from './comparisonBuilderLevers';

const groups = (l: number, r: number): ComparisonBuilderChallenge => ({ id: `g${l}v${r}`, type: 'compare-groups', instruction: 'Compare.',
  leftGroup: { count: l, objectType: 'bears' }, rightGroup: { count: r, objectType: 'bears' },
  correctAnswer: l > r ? 'more' : l < r ? 'less' : 'equal' });
const numbers = (l: number, r: number): ComparisonBuilderChallenge => ({ id: `n${l}v${r}`, type: 'compare-numbers', instruction: 'Compare.',
  leftNumber: l, rightNumber: r, correctSymbol: l > r ? '>' : l < r ? '<' : '=' });
const order = (ns: number[], direction: 'ascending' | 'descending' = 'ascending'): ComparisonBuilderChallenge =>
  ({ id: `o${ns.join('-')}`, type: 'order', instruction: 'Order.', numbers: ns, direction });
const step = (t: number, askFor: 'one-more' | 'one-less' | 'both' = 'both'): ComparisonBuilderChallenge =>
  ({ id: `s${t}${askFor}`, type: 'one-more-one-less', instruction: 'Find it.', targetNumber: t, askFor });

describe('every miss the check names has a lever', () => {
  const cases: [ComparisonBuilderChallenge, string[]][] = [
    [groups(4, 5), ['reversed', 'said_equal', 'missed_equal']],
    [numbers(12, 14), ['reversed', 'said_equal', 'missed_equal']],
    [order([3, 5, 4, 7]), ['reversed', 'two_swapped', 'other_order']],
    [step(8), ['no_step', 'wrong_way', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ];
  it.each(cases)('%o', (c, misses) => {
    const answered = comparisonLevers(c, [], '1').flatMap(l => l.answers ?? []);
    for (const m of misses) expect(answered, m).toContain(m);
  });
});

describe('which lever comes next', () => {
  it.each([
    [groups(4, 5), [], 'reversed', MATCH_LEVER],
    [groups(4, 5), [MATCH_LEVER], 'reversed', TAP_LEVER],
    [groups(4, 5), [MATCH_LEVER, TAP_LEVER], 'reversed', FAR_GROUPS_LEVER],
    [groups(5, 5), [MATCH_LEVER, TAP_LEVER], 'missed_equal', FAR_GROUPS_LEVER],
    [numbers(12, 14), [], 'said_equal', MARKS_LEVER],
    [numbers(12, 14), [MARKS_LEVER], 'reversed', FAR_NUMBERS_LEVER],
    [order([3, 5, 4]), [], 'reversed', STEPS_LEVER],
    [order([3, 5, 4]), [], 'two_swapped', MARKS_LEVER],
    [order([3, 5, 4]), [MARKS_LEVER], 'other_order', THREE_FAR_LEVER],
    [step(8), [], 'wrong_way', HOPS_LEVER],
    [step(8), [HOPS_LEVER], 'over_by_more', SMALL_LEVER],
  ] as const)('%o pulled %o after %s: %s', (c, pulled, miss, lever) => {
    expect(nextLever(comparisonLevers(c, pulled, '1'), miss)).toBe(lever);
  });

  it('the miss function and the table agree on a real wrong answer', () => {
    const c = groups(4, 7);
    const miss = comparisonMiss(c, { selected: 'more', ordered: [], oneMore: null, oneLess: null });
    expect(miss).toBe('reversed');
    expect(nextLever(comparisonLevers(c, [], 'K'), miss)).toBe(MATCH_LEVER);
  });

  it('easy starts with the model pulled on groups only, and a simplify is declared only when there is an easier item', () => {
    expect(startLevers(groups(4, 5), 'easy')).toEqual([MATCH_LEVER]);
    expect(startLevers(groups(4, 5), 'medium')).toEqual([]);
    expect(startLevers(numbers(4, 5), 'easy')).toEqual([]);
    expect(comparisonLevers(groups(1, 5), [], 'K').map(l => l.id)).not.toContain(FAR_GROUPS_LEVER);
    expect(comparisonLevers(step(4, 'one-more'), [], 'K').map(l => l.id)).not.toContain(SMALL_LEVER);
    expect(comparisonLevers(order([1, 5, 9]), [], 'K').map(l => l.id)).not.toContain(THREE_FAR_LEVER);
  });
});

describe('leak rules', () => {
  const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  it('model_match never uses a count the item uses, and always has a winner', () => {
    for (const l of range(1, 10)) for (const r of range(1, 10)) {
      const pair = modelPair(groups(l, r));
      if (!pair) continue;
      expect([l, r]).not.toContain(pair[0]);
      expect([l, r]).not.toContain(pair[1]);
      expect(pair[0]).toBeGreaterThan(pair[1]);
    }
    // Two counts leave the model somewhere to go.
    for (const l of range(1, 10)) for (const r of range(1, 10)) expect(modelPair(groups(l, r)), `${l}v${r}`).not.toBeNull();
  });

  it('far_groups: small, far apart, a winner, recomputed key, no count shared with the item', () => {
    for (const l of range(1, 20)) for (const r of range(1, 20)) {
      const easier = farGroups(groups(l, r));
      if (!easier) { expect(l !== r && Math.abs(l - r) >= 3 && Math.max(l, r) <= 6, `${l}v${r}`).toBe(true); continue; }
      const a = easier.leftGroup!.count, b = easier.rightGroup!.count;
      expect(Math.max(a, b)).toBeLessThanOrEqual(6);
      expect(Math.abs(a - b)).toBeGreaterThanOrEqual(3);
      expect([a, b].some(n => [l, r].includes(n))).toBe(false);
      expect(easier.correctAnswer).toBe(a > b ? 'more' : 'less');
      expect(easier.id).toBe(`g${l}v${r}~simpler`);
    }
  });

  it.each(['K', '1'] as const)('far_numbers at band %s: in band, 5 or more apart, recomputed symbol, no shared number', band => {
    const max = band === 'K' ? 10 : 20;
    for (const l of range(0, max)) for (const r of range(0, max)) {
      const easier = farNumbers(numbers(l, r), band);
      if (!easier) { expect(l !== r && Math.abs(l - r) >= 5).toBe(true); continue; }
      const a = easier.leftNumber!, b = easier.rightNumber!;
      expect(Math.max(a, b)).toBeLessThanOrEqual(max);
      expect(Math.abs(a - b)).toBeGreaterThanOrEqual(5);
      expect([a, b].some(n => [l, r].includes(n))).toBe(false);
      expect(easier.correctSymbol).toBe(a > b ? '>' : '<');
    }
  });

  it.each(['K', '1'] as const)('three_far at band %s: three numbers 3 apart, in band, none of the item\'s, same direction', band => {
    const max = band === 'K' ? 10 : 20;
    let built = 0;
    for (let seed = 0; seed < 400; seed++) {
      const size = 3 + (seed % 3);
      const pool = range(1, max).sort((a, b) => ((a * 7919 + seed * 31) % 101) - ((b * 7919 + seed * 31) % 101));
      const ns = pool.slice(0, size);
      const c = order(ns, seed % 2 ? 'descending' : 'ascending');
      const easier = threeFar(c, band);
      if (!easier) continue;
      built++;
      const got = [...easier.numbers!].sort((a, b) => a - b);
      expect(got).toHaveLength(3);
      expect(got[1] - got[0]).toBeGreaterThanOrEqual(3);
      expect(got[2] - got[1]).toBeGreaterThanOrEqual(3);
      expect(got[2]).toBeLessThanOrEqual(max);
      expect(got.some(n => ns.includes(n)), `${ns}`).toBe(false);
      expect(easier.direction).toBe(c.direction);
      // Never handed over sorted.
      expect(easier.numbers).not.toEqual(got);
    }
    expect(built).toBeGreaterThan(100);
  });

  it('single_small: one "one more" ask on a small target whose answer is not the item\'s, never the item\'s target', () => {
    for (const t of range(1, 20)) for (const ask of ['one-more', 'one-less', 'both'] as const) {
      const easier = singleSmall(step(t, ask));
      if (!easier) { expect(ask === 'one-more' && t <= 5, `${t} ${ask}`).toBe(true); continue; }
      const n = easier.targetNumber!;
      expect(easier.askFor).toBe('one-more');
      expect(n).toBeLessThanOrEqual(5);
      expect([t - 1, t, t + 1]).not.toContain(n);
      expect([t - 1, t, t + 1]).not.toContain(n + 1);
    }
  });

  it('learner_hops labels only from the target to the learner\'s pick, never past it', () => {
    expect(Array.from(hopLabels(7, null))).toEqual([[7, 0]]);
    expect(Array.from(hopLabels(7, 7))).toEqual([[7, 0]]);
    expect(Array.from(hopLabels(7, 9))).toEqual([[7, 0], [8, 1], [9, 2]]);
    expect(Array.from(hopLabels(7, 6))).toEqual([[7, 0], [6, 1]]);
    for (const t of range(1, 19)) for (const pick of range(0, 20)) {
      const cells = Array.from(hopLabels(t, pick).keys());
      const lo = Math.min(t, pick), hi = Math.max(t, pick);
      expect(cells.every(c => c >= lo && c <= hi)).toBe(true);
    }
  });

  it('slot_steps and quantity marks draw heights and amounts only', () => {
    expect(slotSteps(3, 'ascending')).toEqual([6, 10, 14]);
    expect(slotSteps(3, 'descending')).toEqual([14, 10, 6]);
    expect(quantityParts(17)).toEqual({ tens: 1, ones: 7 });
  });

  it('the scene facts never name the item\'s answer or its untapped counts', () => {
    const c = groups(4, 7);
    const facts = leverFacts(c, [MATCH_LEVER, TAP_LEVER], { left: 2, right: 0 });
    expect(facts).toMatch(/Tapped so far: 2 on the left, 0 on the right/);
    expect(facts).not.toMatch(/\b(4|7)\b/);
    expect(facts).not.toMatch(/more|fewer/i);
    expect(leverFacts(order([3, 8, 5]), [STEPS_LEVER, MARKS_LEVER], { left: 0, right: 0 })).not.toMatch(/\d/);
    expect(leverFacts(step(8), [HOPS_LEVER], { left: 0, right: 0 })).not.toMatch(/\b9\b|\b7\b/);
  });
});
