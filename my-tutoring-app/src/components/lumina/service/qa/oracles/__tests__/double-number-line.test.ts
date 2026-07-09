import { describe, expect, it } from 'vitest';
import { doubleNumberLineOracle } from '../double-number-line';

/**
 * Seeded-violation tests for the double-number-line oracle. The clean fixture is a
 * real /api/lumina/eval-test generation (find_missing, grade 6, "Bikes to Wheels",
 * unitRate 2), plus one mutated fixture per implemented check class that MUST fire.
 */

const ctx = { componentId: 'double-number-line', evalMode: 'find_missing', topic: 'ratios and proportions', gradeLevel: 'grade 6' };

const clean = {
  title: 'Bicycle Wheels', description: 'Bikes to wheels.',
  topLabel: 'Bicycles', bottomLabel: 'Wheels', unitRate: 2, contextQuestion: 'How many wheels?',
  challenges: [
    { id: 'dnl-1', challengeType: 'find_missing', prompt: 'Find wheels for 3 bikes.', hint: '×2', givenPoints: [{ topValue: 0, bottomValue: 0 }, { topValue: 2, bottomValue: 4 }], targetPoints: [{ topValue: 3, bottomValue: 6 }], topScale: { min: 0, max: 8, interval: 1 }, bottomScale: { min: 0, max: 16, interval: 2 } },
    { id: 'dnl-2', challengeType: 'find_missing', prompt: 'Find wheels for 4 bikes.', hint: '×2', givenPoints: [{ topValue: 0, bottomValue: 0 }, { topValue: 2, bottomValue: 4 }], targetPoints: [{ topValue: 4, bottomValue: 8 }], topScale: { min: 0, max: 8, interval: 1 }, bottomScale: { min: 0, max: 16, interval: 2 } },
    { id: 'dnl-3', challengeType: 'find_missing', prompt: 'Find wheels for 5 bikes.', hint: '×2', givenPoints: [{ topValue: 0, bottomValue: 0 }, { topValue: 2, bottomValue: 4 }], targetPoints: [{ topValue: 5, bottomValue: 10 }], topScale: { min: 0, max: 8, interval: 1 }, bottomScale: { min: 0, max: 16, interval: 2 } },
    { id: 'dnl-4', challengeType: 'find_missing', prompt: 'Find wheels for 6 bikes.', hint: '×2', givenPoints: [{ topValue: 0, bottomValue: 0 }, { topValue: 2, bottomValue: 4 }], targetPoints: [{ topValue: 6, bottomValue: 12 }], topScale: { min: 0, max: 8, interval: 1 }, bottomScale: { min: 0, max: 16, interval: 2 } },
  ],
};

describe('double-number-line oracle', () => {
  it('passes clean find_missing', () => {
    expect(doubleNumberLineOracle.verify(clean, ctx).violations).toEqual([]);
  });

  // ── answer-key-desync ──
  it('flags answer-key-desync — a target bottomValue breaks the session ratio', () => {
    const data = { ...clean, challenges: clean.challenges.map((c) => c.id === 'dnl-1' ? { ...c, targetPoints: [{ topValue: 3, bottomValue: 7 }] } : c) };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'dnl-1' && /session ratio/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — unitRate disagrees with the given anchor', () => {
    const data = { ...clean, unitRate: 3 };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /unitRate/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — a target lands off the rendered bottom scale', () => {
    const data = { ...clean, challenges: clean.challenges.map((c) => c.id === 'dnl-4' ? { ...c, targetPoints: [{ topValue: 10, bottomValue: 20 }] } : c) };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'dnl-4' && /off the (top|bottom) scale/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — inconsistent given anchors', () => {
    const data = { ...clean, challenges: clean.challenges.map((c) => c.id === 'dnl-1' ? { ...c, givenPoints: [{ topValue: 2, bottomValue: 4 }, { topValue: 3, bottomValue: 9 }] } : c) };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'dnl-1')).toBe(true);
  });

  // ── scope ──
  it('flags scope — a produced quantity exceeds a "within 10" ceiling', () => {
    const v = doubleNumberLineOracle.verify(clean, { ...ctx, topic: 'ratios within 10' }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  // ── clustering ──
  it('flags clustering — every answer collapses to the same value', () => {
    const data = {
      ...clean,
      challenges: clean.challenges.map((c, i) => ({ ...c, id: `k${i}`, targetPoints: [{ topValue: 4, bottomValue: 8 }] })),
    };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });
  it('flags clustering — an exact-duplicate card', () => {
    const dup = { ...clean.challenges[0], id: 'dnl-dup' };
    const data = { ...clean, challenges: [...clean.challenges, dup] };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  // ── schema ──
  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { ...clean, challenges: [clean.challenges[0]] };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
  it('flags schema — a degenerate scale', () => {
    const data = { ...clean, challenges: clean.challenges.map((c) => c.id === 'dnl-1' ? { ...c, bottomScale: { min: 5, max: 5, interval: 1 } } : c) };
    const v = doubleNumberLineOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'dnl-1')).toBe(true);
  });
});
