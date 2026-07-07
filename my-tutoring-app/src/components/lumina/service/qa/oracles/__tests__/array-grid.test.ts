import { describe, expect, it } from 'vitest';
import { arrayGridOracle } from '../array-grid';

/**
 * Seeded-violation tests for the array-grid oracle. One clean fixture (trimmed
 * from a real /api/lumina/eval-test generation) plus one mutated fixture per
 * implemented check class that MUST fire. Mirrors the math-fact-fluency block.
 */

// No-ceiling topic → the oracle falls back to the intrinsic product max (6×8=48),
// so the real generation's products (up to 40) stay in scope for the clean case.
const agCtx = { componentId: 'array-grid', evalMode: 'multiply_array', topic: 'Arrays and multiplication', gradeLevel: 'grade 3' };
// Scope-bearing topic → ceiling 20 on the product; used to prove the scope check bites.
const agScopeCtx = { componentId: 'array-grid', evalMode: 'multiply_array', topic: 'Arrays and multiplication to 20', gradeLevel: 'grade 3' };

// Trimmed straight from a real generation (multiply_array, grade 3).
const arrayGridClean = {
  title: 'Array Mastery Challenge',
  description: 'Explore the power of arrays by turning rows and columns into multiplication sentences.',
  challengeType: 'multiply_array',
  iconType: 'dot',
  showLabels: true,
  maxRows: 6,
  maxColumns: 8,
  challenges: [
    { id: 'array-grid-1', targetRows: 3, targetColumns: 8 }, // 24
    { id: 'array-grid-2', targetRows: 2, targetColumns: 5 }, // 10
    { id: 'array-grid-3', targetRows: 5, targetColumns: 8 }, // 40
    { id: 'array-grid-4', targetRows: 3, targetColumns: 7 }, // 21
    { id: 'array-grid-5', targetRows: 6, targetColumns: 2 }, // 12
    { id: 'array-grid-6', targetRows: 4, targetColumns: 5 }, // 20
    { id: 'array-grid-7', targetRows: 5, targetColumns: 6 }, // 30
  ],
};

describe('array-grid oracle', () => {
  it('passes clean data', () => {
    expect(arrayGridOracle.verify(arrayGridClean, agCtx).violations).toEqual([]);
  });

  it('passes a clean build_array session with in-panel dimensions', () => {
    const data = {
      ...arrayGridClean,
      challengeType: 'build_array',
      challenges: [
        { id: 'b1', targetRows: 2, targetColumns: 3 },
        { id: 'b2', targetRows: 4, targetColumns: 5 },
        { id: 'b3', targetRows: 3, targetColumns: 5 },
      ],
    };
    expect(arrayGridOracle.verify(data, agCtx).violations).toEqual([]);
  });

  it('flags answer-key desync — build-mode target row exceeds the button panel (unreachable state)', () => {
    const data = {
      ...arrayGridClean,
      challengeType: 'build_array',
      challenges: [
        { id: 'b1', targetRows: 2, targetColumns: 3 },
        { id: 'b2', targetRows: 7, targetColumns: 4 }, // 7 > rowButtonCap (6) — can never be built
        { id: 'b3', targetRows: 3, targetColumns: 5 },
      ],
    };
    const v = arrayGridOracle.verify(data, agCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'b2')).toBe(true);
  });

  it('flags scope violation — product exceeds the topic ceiling (the "multiplication to 20 taught to 40" class)', () => {
    // Same clean fixture, but under a "to 20" objective: 3×8=24, 5×8=40, etc. exceed it.
    const v = arrayGridOracle.verify(arrayGridClean, agScopeCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'array-grid-3')).toBe(true);
  });

  it('flags clustering — every array has the same product', () => {
    const data = {
      ...arrayGridClean,
      challenges: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, targetRows: 3, targetColumns: 4 })),
    };
    const v = arrayGridOracle.verify(data, agCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate array card (same ordered rows × columns)', () => {
    const data = {
      ...arrayGridClean,
      challenges: [...arrayGridClean.challenges, { id: 'array-grid-8', targetRows: 3, targetColumns: 8 }], // dup of grid-1
    };
    const v = arrayGridOracle.verify(data, agCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('does NOT flag a commutative reflection (3×5 and 5×3 are different student tasks)', () => {
    const data = {
      ...arrayGridClean,
      challenges: [
        { id: 'c1', targetRows: 3, targetColumns: 5 }, // 15
        { id: 'c2', targetRows: 5, targetColumns: 3 }, // 15 (reflection — distinct ordered pair)
        { id: 'c3', targetRows: 2, targetColumns: 7 }, // 14
        { id: 'c4', targetRows: 4, targetColumns: 6 }, // 24
        { id: 'c5', targetRows: 6, targetColumns: 2 }, // 12
      ],
    };
    const v = arrayGridOracle.verify(data, agCtx).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...arrayGridClean, challenges: [{ id: 'c1', targetRows: 3, targetColumns: 4 }] };
    const v = arrayGridOracle.verify(data, agCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags a schema violation — non-integer dimensions', () => {
    const data = {
      ...arrayGridClean,
      challenges: [
        { id: 'c1', targetRows: 3, targetColumns: 'four' },
        { id: 'c2', targetRows: 2, targetColumns: 5 },
        { id: 'c3', targetRows: 4, targetColumns: 6 },
      ],
    };
    const v = arrayGridOracle.verify(data, agCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });
});
