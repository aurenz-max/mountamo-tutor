/**
 * factor-tree levers: the leak rules per mode, the simplify builder over every number the generator draws, and
 * "this wrong split, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import {
  DIVISIBILITY_RULES, PARTNER_LEVER, PRODUCT_LEVER, RULES_LEVER, SMALLER_LEVER, factorTreeLevers, frameLeaks, leverFacts,
  leverTextLeaks, partnerFrame, practiceLeaks, productReadout, readoutLeaks, smallerTree,
} from './factorTreeLevers';
import { FACTOR_TREE_MISSES_BY_MODE, factorMiss, factorPairs, isPrime, primeFactors } from './factorTreeWorkspace';

/** The generator's pools (`gemini-factor-tree.ts` CANDIDATE_POOLS). */
const POOLS: Record<string, number[]> = {
  guided_small: [6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 24],
  guided_medium: [24, 27, 28, 30, 32, 33, 35, 36, 40, 42, 44, 45, 48, 50, 54, 56, 60],
  unguided: [20, 21, 24, 27, 28, 30, 32, 33, 35, 36, 40, 42, 44, 45, 48, 50, 54, 56, 60],
  unguided_large: [40, 42, 44, 45, 48, 50, 54, 56, 60, 63, 64, 70, 72, 75, 80],
  assessment_intro: [40, 42, 44, 45, 48, 50, 54, 56, 60, 63, 64, 70, 72, 75, 80],
  assessment: [40, 42, 48, 54, 56, 60, 63, 64, 70, 72, 75, 80, 84, 90, 96, 100],
};
const MODES = Object.keys(POOLS);
const item = (rootValue: number) => ({ id: `ft-${rootValue}`, rootValue });

describe('simplify builder', () => {
  it.each(MODES)('%s: a nearby composite with one prime factor fewer, its own id, never a factor or multiple, deterministic', mode => {
    let built = 0;
    for (const n of POOLS[mode]) {
      const c = item(n), s = smallerTree(c);
      if (primeFactors(n).length <= 2) { expect(s, `${n}`).toBeNull(); continue; }
      expect(s, `${n}`).not.toBeNull();
      built++;
      expect(s!.id).toBe(`${c.id}~simpler`);
      expect(isPrime(s!.rootValue)).toBe(false);
      expect(primeFactors(s!.rootValue)).toHaveLength(primeFactors(n).length - 1);
      expect(s!.rootValue).toBeLessThan(n);
      expect(s!.rootValue).toBeGreaterThanOrEqual(Math.ceil(n * 0.6));
      expect(n % s!.rootValue).not.toBe(0);
      expect(practiceLeaks(c, s!)).toBe(false);
      expect(smallerTree(c)).toEqual(s);
      expect(smallerTree(s!)).toBeNull();
    }
    expect(built).toBeGreaterThan(3);
  });

  it('the leak rule refuses the item, a factor of it, a multiple of it and a tree as deep', () => {
    const c = item(36);
    expect(practiceLeaks(c, { id: 'ft-36~simpler', rootValue: 36 })).toBe(true);
    expect(practiceLeaks(c, { id: 'ft-36~simpler', rootValue: 18 })).toBe(true);
    expect(practiceLeaks(c, { id: 'ft-36~simpler', rootValue: 24 })).toBe(true);
    expect(practiceLeaks(c, { id: 'ft-36~simpler', rootValue: 30 })).toBe(false);
  });
});

describe('leak rules', () => {
  it.each(MODES)('%s: the frame never works the division; the readout shows only the learner\'s own product', mode => {
    for (const n of POOLS[mode]) for (const [a, b] of factorPairs(n)) {
      for (const f1 of [null, a, b, a + 1]) {
        const frame = partnerFrame(n, f1);
        expect(frameLeaks(frame, n, f1), frame).toBe(false);
        if (f1 === a) expect(frame).not.toMatch(new RegExp(`=\\s*${b}\\b`));
      }
      for (const [x, y] of [[a, b + 1], [a, b], [1, n]]) {
        const readout = productReadout(n, x, y)!;
        expect(readoutLeaks(readout, n, x, y), readout).toBe(false);
      }
      expect(productReadout(n, a, null)).toBeNull();
    }
    expect(partnerFrame(null, null)).not.toMatch(/\d/);
  });

  it('the rules panel and every lever\'s words carry no digit', () => {
    for (const rule of DIVISIBILITY_RULES) expect(leverTextLeaks(rule), rule).toBe(false);
  });
});

describe('declarations', () => {
  it.each(MODES)('%s: every catalog miss is answered by a help lever on every item; no lever text or fact carries a digit', mode => {
    const misses = getComponentById('factor-tree')!.teachingWorkspace!.misses![mode];
    expect(misses).toEqual(FACTOR_TREE_MISSES_BY_MODE[mode]);
    for (const n of POOLS[mode]) for (const rulesShown of [false, true]) {
      const levers = factorTreeLevers(item(n), [], { rulesShown });
      const help = levers.filter(l => l.kind === 'help');
      for (const miss of misses) expect(help.some(l => l.answers?.includes(miss)), `${n} ${miss}`).toBe(true);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
      expect(leverTextLeaks(leverFacts(item(n), levers.map(l => l.id), { rulesShown }))).toBe(false);
      expect(levers.find(l => l.id === RULES_LEVER)!.pulled).toBe(rulesShown);
    }
  });

  it('a one-split number has no practice tree; a practice tree has no levers', () => {
    expect(factorTreeLevers(item(35), [], { rulesShown: false }).map(l => l.id)).toEqual([RULES_LEVER, PARTNER_LEVER, PRODUCT_LEVER]);
    expect(factorTreeLevers(item(36), [], { rulesShown: false }).map(l => l.id)).toEqual([RULES_LEVER, PARTNER_LEVER, PRODUCT_LEVER, SMALLER_LEVER]);
    expect(factorTreeLevers(smallerTree(item(36)), [], { rulesShown: false })).toEqual([]);
  });

  // "This wrong split, then this lever": the split, the miss, the first open lever.
  it.each([
    [12, 1, 12, 'used_one', RULES_LEVER],
    [9, 4, 5, 'added', PRODUCT_LEVER],
    [63, 3, 22, 'wrong_partner', PARTNER_LEVER],
    [35, 3, 11, 'not_a_factor', RULES_LEVER],
  ] as const)('%d split as %d × %d: %s, then %s', (value, factor1, factor2, miss, lever) => {
    expect(factorMiss({ value, factor1, factor2 })).toBe(miss);
    expect(nextLever(factorTreeLevers(item(value), [], { rulesShown: false }), miss)).toBe(lever);
  });

  it('with the first lever pulled, the next one for the same miss comes up', () => {
    expect(nextLever(factorTreeLevers(item(63), [PARTNER_LEVER], { rulesShown: false }), 'wrong_partner')).toBe(PRODUCT_LEVER);
    expect(nextLever(factorTreeLevers(item(35), [RULES_LEVER], { rulesShown: false }), 'not_a_factor')).toBe(PRODUCT_LEVER);
  });
});
