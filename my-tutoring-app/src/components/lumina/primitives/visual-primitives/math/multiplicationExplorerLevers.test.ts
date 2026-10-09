/**
 * multiplication-explorer levers: each leak rule per mode over every fact the generator can draw, the easier-fact
 * builder, "this wrong answer, then this lever" as code, and per-item coverage (J12) over the saved payloads.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MultiplicationExplorerChallenge } from './MultiplicationExplorer';
import {
  BREAK_APART_LEVER, SHOW_MODEL_LEVER, SKIP_LINE_LEVER, SKIP_STRIP_LEVER, SMALLER_FACT_LEVER, isPracticeFact, leverFacts,
  leverNumbers, multiplicationLevers, practiceLeaks, practiceParent, smallerFact,
} from './multiplicationExplorerLevers';
import { askedSlot, expectedAnswer, multiplicationAnswerCorrect, numbersIn, resolveChallengeFact, type ExplorerFactValue } from './multiplicationExplorerWorkspace';
import buildP from '../../../components/live-activity/runtime/testing/w1-payloads/multiplication-explorer.build.json';
import connectP from '../../../components/live-activity/runtime/testing/w1-payloads/multiplication-explorer.connect.json';
import commutativeP from '../../../components/live-activity/runtime/testing/w1-payloads/multiplication-explorer.commutative.json';
import distributiveP from '../../../components/live-activity/runtime/testing/w1-payloads/multiplication-explorer.distributive.json';
import missingP from '../../../components/live-activity/runtime/testing/w1-payloads/multiplication-explorer.missing_factor.json';
import fluencyP from '../../../components/live-activity/runtime/testing/w1-payloads/multiplication-explorer.fluency.json';

type Mode = MultiplicationExplorerChallenge['type'];
const MODES: Mode[] = ['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'];
const NONE: ExplorerFactValue = { factor1: 0, factor2: 0, product: 0 };
const item = (id: string, type: Mode, a: number, b: number, hiddenValue: MultiplicationExplorerChallenge['hiddenValue']): MultiplicationExplorerChallenge =>
  ({ id, type, instruction: '', targetFact: `${a} × ${b} = ${a * b}`, fact: { factor1: a, factor2: b }, hiddenValue, timeLimit: null,
    hint: '', narration: '' });

// Every fact the generator's widest band admits (FACT_BAND '3-4': 2..12, product ≤ 144); missing factors both ways, no squares.
const GENERATED: Record<Mode, MultiplicationExplorerChallenge[]> = Object.fromEntries(MODES.map(m => [m, [] as MultiplicationExplorerChallenge[]])) as never;
for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) for (const mode of MODES) {
  if (mode !== 'missing_factor') GENERATED[mode].push(item(`${mode}${a}x${b}`, mode, a, b, 'product'));
  else if (a !== b) for (const slot of ['factor1', 'factor2'] as const) GENERATED[mode].push(item(`${slot}${a}x${b}`, mode, a, b, slot));
}
const payload = (p: { data?: unknown }) => ((p.data ?? p) as { challenges: MultiplicationExplorerChallenge[] }).challenges;
const SAVED: Record<Mode, MultiplicationExplorerChallenge[]> = {
  build: payload(buildP), connect: payload(connectP), commutative: payload(commutativeP), distributive: payload(distributiveP),
  missing_factor: payload(missingP), fluency: payload(fluencyP),
};
const all = (mode: Mode) => [...GENERATED[mode], ...SAVED[mode]];
const factOf = (c: MultiplicationExplorerChallenge) => resolveChallengeFact(c, NONE);
const givens = (c: MultiplicationExplorerChallenge) => {
  const f = factOf(c), slot = askedSlot(c);
  return (['factor1', 'factor2', 'product'] as const).filter(s => s !== slot).map(s => f[s]);
};

describe('leak rules', () => {
  it.each(MODES)('%s: no lever prints or states the answer, and its words carry no number', mode => {
    for (const c of all(mode)) {
      const f = factOf(c), key = expectedAnswer(c, f);
      const levers = multiplicationLevers(c, NONE, []);
      const help = levers.filter(l => l.kind === 'help').map(l => l.id);
      if (!givens(c).includes(key)) {
        for (const id of help) expect(leverNumbers(c, f, id), `${c.id} ${id}`).not.toContain(key);
        expect(numbersIn(leverFacts(c, f, help)), c.id).not.toContain(key);
      }
      for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/\d/);
    }
  });

  it('each mode gets its own help levers', () => {
    const ids = (c: MultiplicationExplorerChallenge) => multiplicationLevers(c, NONE, []).map(l => l.id);
    expect(ids(item('b', 'build', 3, 4, 'product'))).toEqual([SKIP_STRIP_LEVER, SMALLER_FACT_LEVER]);
    expect(ids(item('q', 'fluency', 3, 4, 'product'))).toEqual([SKIP_STRIP_LEVER, SHOW_MODEL_LEVER, SMALLER_FACT_LEVER]);
    expect(ids(item('d', 'distributive', 7, 6, 'product'))).toEqual([SKIP_STRIP_LEVER, BREAK_APART_LEVER, SMALLER_FACT_LEVER]);
    expect(multiplicationLevers(item('d', 'distributive', 7, 6, 'product'), NONE, [], { breakdownShown: true }).map(l => l.id))
      .toEqual([SKIP_STRIP_LEVER, SMALLER_FACT_LEVER]);
    expect(ids(item('f', 'missing_factor', 5, 4, 'factor1'))).toEqual([SKIP_LINE_LEVER, SMALLER_FACT_LEVER]);
    // The plainest facts have no smaller one; an easier item has no levers.
    expect(ids(item('t', 'build', 2, 2, 'product'))).toEqual([SKIP_STRIP_LEVER]);
    expect(ids(item('t', 'missing_factor', 3, 2, 'factor1'))).toEqual([SKIP_LINE_LEVER]);
    expect(multiplicationLevers(smallerFact(item('b', 'build', 3, 4, 'product'), NONE), NONE, [])).toEqual([]);
  });

  it('the skip strip stops one group short, and the skip line labels only 0 and the product', () => {
    const b = item('b', 'build', 3, 4, 'product');
    expect(leverNumbers(b, factOf(b), SKIP_STRIP_LEVER)).toEqual([4, 4, 8]);
    const m = item('f', 'missing_factor', 5, 4, 'factor1');
    expect(leverNumbers(m, factOf(m), SKIP_LINE_LEVER)).toEqual([0, 4, 20]);
    expect(leverFacts(m, factOf(m), [SKIP_LINE_LEVER])).toBe('Under the equation: a number line with jumps of 4 from 0 running past 20; only 0 and 20 are labelled.');
  });
});

describe('easier facts', () => {
  it.each(MODES)('%s: the same mode and slot, smaller, solvable, never the item, its turnaround, product or answer', mode => {
    let built = 0;
    for (const c of all(mode)) {
      const p = smallerFact(c, NONE);
      if (!p) continue;
      built++;
      const pf = factOf(p), cf = factOf(c);
      expect(p.id).toBe(`${c.id}~smaller`);
      expect(isPracticeFact(p)).toBe(true);
      expect([p.type, askedSlot(p)]).toEqual([c.type, askedSlot(c)]);
      expect(practiceLeaks(c, p, NONE), c.id).toBe(false);
      expect(pf.product).toBeLessThan(cf.product);
      expect(multiplicationAnswerCorrect(p, pf, String(expectedAnswer(p, pf)))).toBe(true);
      expect(smallerFact(p, NONE)).toBeNull();
      expect(practiceParent(p.id, [c])).toBe(c);
    }
    expect(built).toBeGreaterThan(all(mode).length * 0.8);
  });

  it('practiceLeaks refuses the item, its turnaround, a shared product and a shared answer', () => {
    const c = item('a', 'build', 6, 4, 'product');
    expect(practiceLeaks(c, { ...c }, NONE)).toBe(true);
    expect(practiceLeaks(c, { ...item('a~smaller', 'build', 4, 6, 'product') }, NONE)).toBe(true);
    expect(practiceLeaks(c, { ...item('a~smaller', 'build', 3, 8, 'product') }, NONE)).toBe(true);
    expect(practiceLeaks(c, { ...item('a~smaller', 'build', 3, 4, 'product') }, NONE)).toBe(false);
    const m = item('m', 'missing_factor', 5, 4, 'factor1');
    expect(practiceLeaks(m, item('m~smaller', 'missing_factor', 5, 2, 'factor1'), NONE)).toBe(true);
    expect(practiceLeaks(m, item('m~smaller', 'missing_factor', 2, 2, 'factor1'), NONE)).toBe(true);
  });
});

describe('this wrong answer, then this lever', () => {
  const b = item('b', 'build', 3, 4, 'product'), d = item('d', 'distributive', 7, 6, 'product'), q = item('q', 'fluency', 3, 4, 'product');
  const m = item('f', 'missing_factor', 5, 4, 'factor1');
  it.each([
    [b, 'added_factors', SKIP_STRIP_LEVER], [b, 'one_group_short', SKIP_STRIP_LEVER], [d, 'one_part_only', SKIP_STRIP_LEVER],
    [q, 'other_product', SKIP_STRIP_LEVER], [m, 'gave_product', SKIP_LINE_LEVER], [m, 'one_jump_off', SKIP_LINE_LEVER],
  ] as const)('%#: %s → %s', (c, miss, lever) => {
    expect(nextLever(multiplicationLevers(c, NONE, []), miss)).toBe(lever);
  });
  it('after the first help lever, the next one, then the smaller fact', () => {
    expect(nextLever(multiplicationLevers(d, NONE, [SKIP_STRIP_LEVER]), 'one_part_only')).toBe(BREAK_APART_LEVER);
    expect(nextLever(multiplicationLevers(q, NONE, [SKIP_STRIP_LEVER]), 'other_product')).toBe(SHOW_MODEL_LEVER);
    expect(nextLever(multiplicationLevers(b, NONE, [SKIP_STRIP_LEVER]), 'added_factors')).toBe(SMALLER_FACT_LEVER);
    expect(nextLever(multiplicationLevers(m, NONE, [SKIP_LINE_LEVER]), 'gave_product')).toBe(SMALLER_FACT_LEVER);
  });
});

it('every catalog miss is answered by a lever on every item, generated and saved (J9, J12)', () => {
  const tw = getComponentById('multiplication-explorer')!.teachingWorkspace!;
  expect(tw.levers).toBe(true);
  for (const mode of MODES) for (const c of all(mode)) {
    const levers = multiplicationLevers(c, NONE, []);
    for (const miss of tw.misses![mode]) expect(levers.some(l => l.answers?.includes(miss)), `${mode} ${c.id} ${miss}`).toBe(true);
  }
});
