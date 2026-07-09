import { describe, expect, it } from 'vitest';
import { fractionCirclesOracle } from '../fraction-circles';

/**
 * Seeded-violation tests for the fraction-circles oracle. Clean fixtures are
 * trimmed straight from real /api/lumina/eval-test generations (equivalent + compare,
 * grade 4, topic "…denominators to 12"); each mutated fixture below MUST fire the
 * named check — especially the flagship equivalent-mode UNREACHABLE case.
 */

// Topic carries a "to 12" ceiling → denominators up to 12 stay in scope.
const eqCtx = { componentId: 'fraction-circles', evalMode: 'equivalent', topic: 'Equivalent fractions with denominators to 12', gradeLevel: 'grade 4' };
const cmpCtx = { componentId: 'fraction-circles', evalMode: 'compare', topic: 'Comparing fractions with denominators to 12', gradeLevel: 'grade 4' };

// ── REAL equivalent generation (grade 4). Every eq is reachable & in-scope. ──
const equivalentClean = {
  title: 'Fraction Explorers: Finding Equivalents',
  description: 'Students explore equivalent fractions.',
  gradeBand: '3-5',
  challenges: [
    { id: 'fc1', type: 'equivalent', instruction: '…', hint: '…', narration: '…', denominator: 2, numerator: 1, equivalentDenominator: 4 },  // 1×4/2=2
    { id: 'fc2', type: 'equivalent', instruction: '…', hint: '…', narration: '…', denominator: 3, numerator: 2, equivalentDenominator: 6 },  // 2×6/3=4
    { id: 'fc3', type: 'equivalent', instruction: '…', hint: '…', narration: '…', denominator: 4, numerator: 3, equivalentDenominator: 8 },  // 3×8/4=6
    { id: 'fc4', type: 'equivalent', instruction: '…', hint: '…', narration: '…', denominator: 10, numerator: 6, equivalentDenominator: 5 }, // 6×5/10=3
    { id: 'fc5', type: 'equivalent', instruction: '…', hint: '…', narration: '…', denominator: 12, numerator: 6, equivalentDenominator: 2 }, // 6×2/12=1
  ],
};

// ── REAL compare generation (grade 4). Distinct, in-scope, non-identical operands. ──
const compareClean = {
  title: 'Compare the Circles',
  gradeBand: '3-5',
  challenges: [
    { id: 'fc1', type: 'compare', instruction: '…', hint: '…', narration: '…', denominator: 3, numerator: 1, compareFraction: { numerator: 2, denominator: 8 } },
    { id: 'fc2', type: 'compare', instruction: '…', hint: '…', narration: '…', denominator: 6, numerator: 1, compareFraction: { numerator: 2, denominator: 4 } },
    { id: 'fc3', type: 'compare', instruction: '…', hint: '…', narration: '…', denominator: 10, numerator: 9, compareFraction: { numerator: 2, denominator: 10 } },
    { id: 'fc4', type: 'compare', instruction: '…', hint: '…', narration: '…', denominator: 12, numerator: 8, compareFraction: { numerator: 1, denominator: 2 } },
  ],
};

describe('fraction-circles oracle', () => {
  it('passes a real equivalent generation', () => {
    expect(fractionCirclesOracle.verify(equivalentClean, eqCtx).violations).toEqual([]);
  });

  it('passes a real compare generation', () => {
    expect(fractionCirclesOracle.verify(compareClean, cmpCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — UNREACHABLE equivalent (1/3 with equivalentDenominator 4 has no whole numerator)', () => {
    const data = {
      ...equivalentClean,
      challenges: [
        { id: 'u1', type: 'equivalent', denominator: 3, numerator: 1, equivalentDenominator: 4 }, // 1×4/3 = 4/3 — unreachable
        { id: 'u2', type: 'equivalent', denominator: 3, numerator: 2, equivalentDenominator: 6 },
        { id: 'u3', type: 'equivalent', denominator: 2, numerator: 1, equivalentDenominator: 4 },
      ],
    };
    const v = fractionCirclesOracle.verify(data, eqCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'u1' && /unreachable/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — build/identify target with numerator > denominator (unreachable shaded state)', () => {
    const data = {
      gradeBand: '3-5',
      challenges: [
        { id: 'b1', type: 'build', denominator: 4, numerator: 6 }, // 6 > 4 — size can never equal it
        { id: 'b2', type: 'build', denominator: 4, numerator: 1 },
        { id: 'b3', type: 'build', denominator: 3, numerator: 2 },
      ],
    };
    const v = fractionCirclesOracle.verify(data, eqCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'b1')).toBe(true);
  });

  it('flags answer-key-desync — compare operand identical to the base (nothing to compare)', () => {
    const data = {
      ...compareClean,
      challenges: [
        { id: 'c1', type: 'compare', denominator: 4, numerator: 1, compareFraction: { numerator: 1, denominator: 4 } }, // identical
        { id: 'c2', type: 'compare', denominator: 3, numerator: 1, compareFraction: { numerator: 2, denominator: 8 } },
        { id: 'c3', type: 'compare', denominator: 6, numerator: 5, compareFraction: { numerator: 1, denominator: 2 } },
      ],
    };
    const v = fractionCirclesOracle.verify(data, cmpCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /identical/.test(x.detail))).toBe(true);
  });

  it('flags scope — a denominator exceeds the topic ceiling ("to 12" taught with sixteenths)', () => {
    const data = {
      ...equivalentClean,
      challenges: [
        { id: 's1', type: 'identify', denominator: 16, numerator: 5 }, // 16 > 12
        { id: 's2', type: 'identify', denominator: 4, numerator: 1 },
        { id: 's3', type: 'identify', denominator: 3, numerator: 2 },
      ],
    };
    const v = fractionCirclesOracle.verify(data, eqCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 's1')).toBe(true);
  });

  it('flags clustering — every card is the same fraction value (2/4 and 1/2 collapse)', () => {
    const data = {
      gradeBand: '3-5',
      challenges: [
        { id: 'k1', type: 'identify', denominator: 2, numerator: 1 },
        { id: 'k2', type: 'identify', denominator: 4, numerator: 2 }, // = 1/2
        { id: 'k3', type: 'identify', denominator: 6, numerator: 3 }, // = 1/2
        { id: 'k4', type: 'identify', denominator: 8, numerator: 4 }, // = 1/2
      ],
    };
    const v = fractionCirclesOracle.verify(data, eqCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /cluster/.test(x.detail))).toBe(true);
  });

  it('flags clustering — an exact-duplicate fraction card', () => {
    const data = {
      gradeBand: '3-5',
      challenges: [
        { id: 'd1', type: 'build', denominator: 4, numerator: 1 },
        { id: 'd2', type: 'build', denominator: 3, numerator: 2 },
        { id: 'd3', type: 'build', denominator: 4, numerator: 1 }, // exact dup of d1
      ],
    };
    const v = fractionCirclesOracle.verify(data, eqCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical fraction card/.test(x.detail))).toBe(true);
  });

  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { gradeBand: '3-5', challenges: [{ id: 'x1', type: 'identify', denominator: 4, numerator: 1 }] };
    const v = fractionCirclesOracle.verify(data, eqCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags schema — non-integer numerator/denominator', () => {
    const data = {
      gradeBand: '3-5',
      challenges: [
        { id: 'n1', type: 'identify', denominator: 'four', numerator: 1 },
        { id: 'n2', type: 'identify', denominator: 4, numerator: 1 },
        { id: 'n3', type: 'identify', denominator: 3, numerator: 2 },
      ],
    };
    const v = fractionCirclesOracle.verify(data, eqCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'n1')).toBe(true);
  });
});
