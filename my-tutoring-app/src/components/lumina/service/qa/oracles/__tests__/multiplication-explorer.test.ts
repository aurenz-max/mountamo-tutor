import { describe, expect, it } from 'vitest';
import { multiplicationExplorerOracle } from '../multiplication-explorer';

/**
 * Seeded-violation tests for the multiplication-explorer oracle. The clean
 * fixture is trimmed from a real eval-test generation but hand-reconciled so
 * every challenge's targetFact matches the ONE shared fact (4 × 5 = 20) — the
 * shape a correct generation should produce. Real generations frequently
 * violate the cross-check (fluency/build emit many distinct facts judged
 * against one product); each mutation below reproduces one such bug class.
 */

const ctx = {
  componentId: 'multiplication-explorer',
  evalMode: 'build',
  topic: 'Multiplication facts within 25',
  gradeLevel: 'grade 3',
};

const clean = {
  title: 'Pack It Up: 4 × 5',
  fact: { factor1: 4, factor2: 5, product: 20 },
  representations: { equalGroups: true, array: true, repeatedAddition: true, numberLine: true, areaModel: true },
  activeRepresentation: 'groups',
  gradeBand: '2-3',
  showOptions: { showProduct: false, showFactFamily: true, showCommutativeFlip: true, showDistributiveBreakdown: false },
  challenges: [
    { id: 'c1', type: 'build', instruction: 'Build 4 packs of stickers with 5 in each pack.', targetFact: '4 × 5 = 20', hiddenValue: 'product', timeLimit: null, hint: 'Skip-count by 5.', narration: 'Let us build it!' },
    { id: 'c2', type: 'fluency', instruction: 'Quick! What is 4 × 5?', targetFact: '4 × 5 = 20', hiddenValue: 'product', timeLimit: 6, hint: 'Think 4 groups of 5.', narration: 'How fast can you go?' },
    { id: 'c3', type: 'missing_factor', instruction: '20 stickers in 5 packs. How many packs of size 5? Find the rows.', targetFact: '4 × 5 = 20', hiddenValue: 'factor1', timeLimit: null, hint: 'Count by 5s to 20.', narration: 'One factor is hidden.' },
    { id: 'c4', type: 'missing_factor', instruction: '20 stickers in 4 rows. How many in each row?', targetFact: '4 × 5 = 20', hiddenValue: 'factor2', timeLimit: null, hint: 'Count by 4s to 20.', narration: 'Find the other factor.' },
  ],
};

describe('multiplication-explorer oracle', () => {
  it('passes clean data', () => {
    expect(multiplicationExplorerOracle.verify(clean, ctx).violations).toEqual([]);
  });

  it('flags answer-key desync — targetFact fact differs from the shared judged fact (the live build/fluency bug)', () => {
    const data = JSON.parse(JSON.stringify(clean));
    data.challenges[1].targetFact = '2 × 5 = 10'; // asks 2×5=10 but judge accepts only 20
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c2'))).toBe(true);
  });

  it('flags answer-key desync — shipped fact.product contradicts the factors', () => {
    const data = JSON.parse(JSON.stringify(clean));
    data.fact.product = 25; // 4 × 5 = 20, not 25
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'fact')).toBe(true);
  });

  it('flags answer-key desync — targetFact internally inconsistent (a × b ≠ c)', () => {
    const data = JSON.parse(JSON.stringify(clean));
    // keep it the same fact so the cross-check stays clean; only the RHS is wrong.
    data.challenges[0].targetFact = '4 × 5 = 21';
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1') && /inconsistent/.test(x.detail))).toBe(true);
  });

  it('flags answer-key desync — missing_factor hides the product instead of a factor', () => {
    const data = JSON.parse(JSON.stringify(clean));
    data.challenges[2].hiddenValue = 'product'; // c3 is missing_factor
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c3'))).toBe(true);
  });

  it('flags scope violation — the shared fact exceeds the topic ceiling ("within 25")', () => {
    const data = JSON.parse(JSON.stringify(clean));
    data.fact = { factor1: 8, factor2: 5, product: 40 };
    for (const c of data.challenges) c.targetFact = '8 × 5 = 40';
    data.challenges[2].hiddenValue = 'factor1';
    data.challenges[3].hiddenValue = 'factor2';
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'fact.product')).toBe(true);
  });

  it('flags answer-leak — product readout on while a challenge hides the product', () => {
    const data = JSON.parse(JSON.stringify(clean));
    data.showOptions.showProduct = true; // c1/c2 hide the product
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-leak')).toBe(true);
  });

  it('flags clustering — an exact-duplicate challenge card', () => {
    const data = JSON.parse(JSON.stringify(clean));
    data.challenges.push(JSON.parse(JSON.stringify(clean.challenges[0]))); // byte-identical c1
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('does NOT flag the same fact explored via different instructions (legitimate multi-representation)', () => {
    const data = JSON.parse(JSON.stringify(clean));
    // add a connect challenge on the SAME fact — different card, must stay clean.
    data.challenges.push({ id: 'c5', type: 'connect', instruction: 'All 5 pictures show 4 × 5. What is the same?', targetFact: '4 × 5 = 20', hiddenValue: null, timeLimit: null, hint: 'Same fact, many views.', narration: 'Link them.' });
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
    expect(v.filter((x) => x.check === 'answer-key-desync')).toEqual([]);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = JSON.parse(JSON.stringify(clean));
    data.challenges = [data.challenges[0]];
    const v = multiplicationExplorerOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });
});
