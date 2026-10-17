import { describe, expect, it } from 'vitest';
import { percentBarOracle } from '../percent-bar';

/**
 * Seeded-violation tests for the percent-bar oracle. Clean fixtures trimmed from
 * real /api/lumina/eval-test generations (convert = comparison, percent_total =
 * addition) plus one mutated fixture per implemented check class that MUST fire —
 * including a choice step whose correctOptionId isn't among the options AND a
 * choice whose key disagrees with the re-derived cheaper/pricier answer.
 */

// No-ceiling topic → percent's intrinsic 0–maxPercent domain, nothing external to bite.
const pbCtx = { componentId: 'percent-bar', evalMode: 'convert', topic: 'Percents and benchmark fractions', gradeLevel: 'grade 6' };
// Explicit harness ceiling → proves the scope check bites (comparison targets are 60–90).
const pbScope50Ctx = { ...pbCtx, scopeMax: 50 };

// ── comparison / convert — trimmed straight from a real generation (grade 6) ──
// Each choice re-derives: pb-1 "more expensive" A=$54 > B=$12 ⇒ A; pb-2 B=$48 > A=$42 ⇒ B;
// pb-3 "cheaper" A=$14 < B=$30 ⇒ A; pb-4 B=$18 < A=$36 ⇒ B. All agree with correctOptionId.
const comparisonClean = {
  title: 'Mastering Deals and Discounts',
  description: 'Compute sale prices to find the best final value.',
  showCalculation: true,
  challenges: [
    {
      id: 'pb-1', type: 'comparison',
      scenario: 'SneakerHub sells sneakers for $60 at 10% off. FootZone sells the same sneakers for $20 at 40% off.',
      targetPercent: 90,
      steps: [
        { kind: 'place', prompt: 'Step 1', wholeValue: 60, targetPercent: 90, maxPercent: 100 },
        { kind: 'place', prompt: 'Step 2', wholeValue: 20, targetPercent: 60, maxPercent: 100 },
        { kind: 'choice', prompt: 'Step 3 — which is more expensive?', options: [{ id: 'A', label: 'SneakerHub', sublabel: '$54.00' }, { id: 'B', label: 'FootZone', sublabel: '$12.00' }], correctOptionId: 'A' },
      ],
    },
    {
      id: 'pb-2', type: 'comparison',
      scenario: 'AudioMart sells headphones for $60 at 30% off. SoundCity sells the same headphones for $80 at 40% off.',
      targetPercent: 70,
      steps: [
        { kind: 'place', prompt: 'Step 1', wholeValue: 60, targetPercent: 70, maxPercent: 100 },
        { kind: 'place', prompt: 'Step 2', wholeValue: 80, targetPercent: 60, maxPercent: 100 },
        { kind: 'choice', prompt: 'Step 3 — which is more expensive?', options: [{ id: 'A', label: 'AudioMart', sublabel: '$42.00' }, { id: 'B', label: 'SoundCity', sublabel: '$48.00' }], correctOptionId: 'B' },
      ],
    },
    {
      id: 'pb-3', type: 'comparison',
      scenario: 'Pack It sells a backpack for $20 at 30% off. Bag World sells the same backpack for $40 at 25% off.',
      targetPercent: 70,
      steps: [
        { kind: 'place', prompt: 'Step 1', wholeValue: 20, targetPercent: 70, maxPercent: 100 },
        { kind: 'place', prompt: 'Step 2', wholeValue: 40, targetPercent: 75, maxPercent: 100 },
        { kind: 'choice', prompt: 'Step 3 — which is cheaper?', options: [{ id: 'A', label: 'Pack It', sublabel: '$14.00' }, { id: 'B', label: 'Bag World', sublabel: '$30.00' }], correctOptionId: 'A' },
      ],
    },
    {
      id: 'pb-4', type: 'comparison',
      scenario: 'Outfitters sells a jacket for $60 at 40% off. StyleCo sells the same jacket for $20 at 10% off.',
      targetPercent: 60,
      steps: [
        { kind: 'place', prompt: 'Step 1', wholeValue: 60, targetPercent: 60, maxPercent: 100 },
        { kind: 'place', prompt: 'Step 2', wholeValue: 20, targetPercent: 90, maxPercent: 100 },
        { kind: 'choice', prompt: 'Step 3 — which is cheaper?', options: [{ id: 'A', label: 'Outfitters', sublabel: '$36.00' }, { id: 'B', label: 'StyleCo', sublabel: '$18.00' }], correctOptionId: 'B' },
      ],
    },
  ],
};

// ── addition / percent_total — real generation: step 2 total (~112%) on a 150 bar ──
const additionClean = {
  title: 'Tax, Tip, and Totals',
  description: 'Place the added rate, then the new total.',
  challenges: [
    { id: 'pb-1', type: 'addition', scenario: '$50 item, 12% tax', targetPercent: 112, maxPercent: 150, steps: [
      { kind: 'place', prompt: 'Step 1', wholeValue: 50, targetPercent: 12, maxPercent: 100 },
      { kind: 'place', prompt: 'Step 2', wholeValue: 50, targetPercent: 112, maxPercent: 150 },
    ] },
    { id: 'pb-2', type: 'addition', scenario: '$100 bill, 6% tip', targetPercent: 106, maxPercent: 150, steps: [
      { kind: 'place', prompt: 'Step 1', wholeValue: 100, targetPercent: 6, maxPercent: 100 },
      { kind: 'place', prompt: 'Step 2', wholeValue: 100, targetPercent: 106, maxPercent: 150 },
    ] },
    { id: 'pb-3', type: 'addition', scenario: '$30 order, 8% fee', targetPercent: 108, maxPercent: 150, steps: [
      { kind: 'place', prompt: 'Step 1', wholeValue: 30, targetPercent: 8, maxPercent: 100 },
      { kind: 'place', prompt: 'Step 2', wholeValue: 30, targetPercent: 108, maxPercent: 150 },
    ] },
  ],
};

// ── direct — single-step: NO `steps` array; the component synthesises one place
//    step from the legacy fields (mirrors buildDirect output). ──
const directClean = {
  title: 'Percent of a Number',
  description: 'Place the stated percent on the bar.',
  challenges: [
    { id: 'pb-1', type: 'direct', scenario: 'A batch of 40 cookies.', wholeValue: 40, targetPercent: 25, hint: 'x' },
    { id: 'pb-2', type: 'direct', scenario: 'A class of 25 students.', wholeValue: 25, targetPercent: 60, hint: 'x' },
    { id: 'pb-3', type: 'direct', scenario: 'A 50-point test.', wholeValue: 50, targetPercent: 80, hint: 'x' },
  ],
};

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

describe('percent-bar oracle', () => {
  it('passes clean comparison (convert) data', () => {
    expect(percentBarOracle.verify(comparisonClean, pbCtx).violations).toEqual([]);
  });

  it('passes clean addition (percent_total) data with extended (150%) bars', () => {
    expect(percentBarOracle.verify(additionClean, pbCtx).violations).toEqual([]);
  });

  it('passes clean single-step direct data (synthesised place step)', () => {
    expect(percentBarOracle.verify(directClean, pbCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — a place target off the bar (unreachable)', () => {
    const data = clone(additionClean);
    data.challenges[0].steps[1].targetPercent = 165; // > maxPercent 150
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pb-1.steps[1]')).toBe(true);
  });

  it('flags answer-key-desync — correctOptionId is not among the options', () => {
    const data = clone(comparisonClean);
    data.challenges[0].steps[2].correctOptionId = 'C'; // no such option
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pb-1.steps[2]' && /never be clicked/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — choice key disagrees with the re-derived pricier option', () => {
    const data = clone(comparisonClean);
    // pb-1 "more expensive": A=$54 > B=$12 ⇒ A. Flip the key to B.
    data.challenges[0].steps[2].correctOptionId = 'B';
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'pb-1.steps[2]' && /marked wrong/.test(x.detail))).toBe(true);
  });

  it('flags scope — place targets exceed an explicit harness ceiling', () => {
    const v = percentBarOracle.verify(comparisonClean, pbScope50Ctx).violations; // targets 60–90 > 50
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags clustering — every place target is the same percent', () => {
    const data = clone(directClean);
    data.challenges = [10, 20, 30, 40].map((i) => ({ id: `c${i}`, type: 'direct', scenario: `s${i}`, wholeValue: 40, targetPercent: 50, hint: 'x' }));
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate challenge card', () => {
    const data = clone(directClean);
    data.challenges.push(clone(directClean.challenges[0])); // byte-identical scenario+target+whole (new id ignored: same id here)
    data.challenges[data.challenges.length - 1].id = 'pb-dup';
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical challenge/.test(x.detail))).toBe(true);
  });

  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { ...directClean, challenges: [directClean.challenges[0]] };
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });

  it('flags schema — a non-numeric place target', () => {
    const data = clone(directClean);
    (data.challenges[0] as Record<string, unknown>).targetPercent = 'twenty-five';
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'schema' && /targetPercent/.test(x.detail))).toBe(true);
  });

  it('flags schema — a choice step with an empty options array', () => {
    const data = clone(comparisonClean);
    data.challenges[0].steps[2].options = [];
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'pb-1.steps[2]')).toBe(true);
  });
});

// ── find_part / find_whole: the amount step, built the way the generator builds it ──
import { selectPercentBarChallenges } from '../../../math/gemini-percent-bar';

describe('percent-bar oracle — amount steps (find_part, find_whole)', () => {
  const session = (type: 'part_of' | 'whole_of', difficulty: string) =>
    ({ title: 'Percents', description: '', challenges: selectPercentBarChallenges(type, 5, { difficulty }) });

  it.each([['part_of', 'easy'], ['part_of', 'hard'], ['whole_of', 'easy'], ['whole_of', 'medium'], ['whole_of', 'hard']] as const)(
    'passes generator-built %s sessions at %s', (type, difficulty) => {
      for (let run = 0; run < 10; run++) {
        const r = percentBarOracle.verify(session(type, difficulty), { ...pbCtx, evalMode: type === 'part_of' ? 'find_part' : 'find_whole' });
        expect(r.violations).toEqual([]);
        expect(r.uncheckedTypes).toEqual([]);
        expect(r.checkedChallenges).toBe(5);
      }
    });

  it('flags answer-key-desync — a part that is not the percent of the whole', () => {
    const data = clone(session('part_of', 'medium'));
    const step = data.challenges[0].steps![1] as unknown as Record<string, unknown>;
    step.part = Number(step.part) + 1;
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === `${data.challenges[0].id}.steps[1]`)).toBe(true);
  });

  it('flags answer-leak — a find-whole prompt that states the whole', () => {
    const data = clone(session('whole_of', 'medium'));
    const step = data.challenges[0].steps![1] as unknown as Record<string, unknown>;
    data.challenges[0].scenario += ` The whole is $${step.whole}.`;
    const v = percentBarOracle.verify(data, pbCtx).violations;
    expect(v.some((x) => x.check === 'answer-leak')).toBe(true);
  });
});
