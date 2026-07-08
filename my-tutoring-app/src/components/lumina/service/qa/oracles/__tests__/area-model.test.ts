import { describe, expect, it } from 'vitest';
import { areaModelOracle } from '../area-model';

/**
 * Seeded-violation tests for the area-model oracle. One clean fixture (copied
 * verbatim from a real /api/lumina/eval-test find_area generation) plus one
 * mutated fixture per implemented check class that MUST fire. Mirrors the
 * array-grid block.
 */

// No-ceiling topic → the oracle falls back to the find_area intrinsic max (2500),
// so the real generation's products (up to 31×47=1457) stay in scope for the
// clean case.
const amCtx = { componentId: 'area-model', evalMode: 'find_area', topic: 'Multiplication with area models', gradeLevel: 'grade 4' };
// Scope-bearing topic → ceiling 100 on the product; used to prove the scope check
// bites (this is the real fidelity gap: find_area hardcodes 2-digit × 2-digit).
const amScopeCtx = { componentId: 'area-model', evalMode: 'find_area', topic: 'Multiplication with area models to 100', gradeLevel: 'grade 4' };

// Copied straight from a real generation (find_area, grade 4).
const areaModelClean = {
  title: 'Visualizing Multiplication with the Area Model',
  description: 'Break big multiplication problems into friendly place-value pieces.',
  challengeType: 'find_area',
  gradeLevel: 'Grade 4',
  challenges: [
    { id: 'area-model-1', factor1Parts: [20, 5], factor2Parts: [40, 7], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // 25×47=1175
    { id: 'area-model-2', factor1Parts: [30, 1], factor2Parts: [30, 7], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // 31×37=1147
    { id: 'area-model-3', factor1Parts: [30, 1], factor2Parts: [40, 6], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // 31×46=1426
    { id: 'area-model-4', factor1Parts: [10, 8], factor2Parts: [30, 9], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // 18×39=702
    { id: 'area-model-5', factor1Parts: [20, 4], factor2Parts: [20, 7], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // 24×27=648
  ],
};

// A clean perimeter session (single whole-number sides — NOT place-value parts).
const perimeterClean = {
  title: 'Perimeter of Rectangles',
  description: 'Add up the four sides to find the distance around each rectangle.',
  challengeType: 'perimeter',
  gradeLevel: 'Grade 4',
  challenges: [
    { id: 'p1', factor1Parts: [14], factor2Parts: [9], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // P=2(14+9)=46
    { id: 'p2', factor1Parts: [22], factor2Parts: [7], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // P=58
    { id: 'p3', factor1Parts: [18], factor2Parts: [25], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // P=86
    { id: 'p4', factor1Parts: [11], factor2Parts: [6], showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null }, // P=34
  ],
};

describe('area-model oracle', () => {
  it('passes clean find_area data', () => {
    expect(areaModelOracle.verify(areaModelClean, amCtx).violations).toEqual([]);
  });

  it('passes a clean perimeter session (whole-number sides are exempt from place-value integrity)', () => {
    expect(areaModelOracle.verify(perimeterClean, amCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — a non-place-value decomposition ([12, 5] for 17)', () => {
    const data = {
      ...areaModelClean,
      challenges: [
        { ...areaModelClean.challenges[0], id: 'bad', factor2Parts: [12, 5] }, // 12 is not d·10^k
        areaModelClean.challenges[1],
        areaModelClean.challenges[2],
      ],
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'bad')).toBe(true);
  });

  it('flags answer-key-desync — two parts share the same place ([10, 40])', () => {
    const data = {
      ...areaModelClean,
      challenges: [
        { ...areaModelClean.challenges[0], id: 'dup-place', factor1Parts: [10, 40] }, // both tens
        areaModelClean.challenges[1],
        areaModelClean.challenges[2],
      ],
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'dup-place')).toBe(true);
  });

  it('flags answer-key-desync — a non-positive part (unreachable correct cell)', () => {
    const data = {
      ...areaModelClean,
      challenges: [
        { ...areaModelClean.challenges[0], id: 'zero', factor1Parts: [20, 0] },
        areaModelClean.challenges[1],
        areaModelClean.challenges[2],
      ],
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'zero')).toBe(true);
  });

  it('flags answer-key-desync — a stored total that disagrees with the re-derived product', () => {
    const data = {
      ...areaModelClean,
      challenges: [
        { ...areaModelClean.challenges[0], id: 'desync', total: 999 }, // real product is 1175
        areaModelClean.challenges[1],
        areaModelClean.challenges[2],
      ],
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'desync' && /product/.test(x.detail))).toBe(true);
  });

  it('flags scope violation — product exceeds the topic ceiling (2-digit × 2-digit taught under "to 100")', () => {
    const v = areaModelOracle.verify(areaModelClean, amScopeCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'area-model-1')).toBe(true);
  });

  it('flags scope violation — perimeter exceeds the objective ceiling', () => {
    // Perimeter session under a "to 50" objective: P=86 and P=58 exceed it.
    const ctx = { ...amCtx, evalMode: 'perimeter', topic: 'Perimeter within 50' };
    const v = areaModelOracle.verify(perimeterClean, ctx).violations;
    expect(v.some((x) => x.check === 'scope' && /perimeter/.test(x.detail))).toBe(true);
  });

  it('flags clustering — every model has the same product', () => {
    const data = {
      ...areaModelClean,
      challenges: [1, 2, 3, 4].map((i) => ({
        ...areaModelClean.challenges[0], id: `c${i}`, factor1Parts: [20, 5], factor2Parts: [40, 7],
      })),
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate model card (same ordered Σf1 × Σf2)', () => {
    const data = {
      ...areaModelClean,
      challenges: [
        ...areaModelClean.challenges,
        { ...areaModelClean.challenges[0], id: 'area-model-6' }, // dup of #1 (25×47)
      ],
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('does NOT flag a transpose (25×47 and 47×25 are different model cards)', () => {
    const data = {
      ...areaModelClean,
      challenges: [
        { ...areaModelClean.challenges[0], id: 't1', factor1Parts: [20, 5], factor2Parts: [40, 7] }, // 25×47=1175
        { ...areaModelClean.challenges[0], id: 't2', factor1Parts: [40, 7], factor2Parts: [20, 5] }, // 47×25=1175 (transpose)
        { ...areaModelClean.challenges[0], id: 't3', factor1Parts: [10, 8], factor2Parts: [30, 9] }, // 18×39=702
        { ...areaModelClean.challenges[0], id: 't4', factor1Parts: [20, 4], factor2Parts: [20, 7] }, // 24×27=648
        { ...areaModelClean.challenges[0], id: 't5', factor1Parts: [30, 1], factor2Parts: [40, 6] }, // 31×46=1426
      ],
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...areaModelClean, challenges: [areaModelClean.challenges[0]] };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags a schema violation — non-integer / empty parts', () => {
    const data = {
      ...areaModelClean,
      challenges: [
        { ...areaModelClean.challenges[0], id: 'bad', factor1Parts: [20, 'five'] },
        areaModelClean.challenges[1],
        areaModelClean.challenges[2],
      ],
    };
    const v = areaModelOracle.verify(data, amCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'bad')).toBe(true);
  });
});
