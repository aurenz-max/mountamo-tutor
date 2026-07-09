import { describe, expect, it } from 'vitest';
import { barModelOracle } from '../bar-model';

/**
 * Seeded-violation tests for the bar-model oracle. Clean fixtures mirror real
 * /api/lumina/eval-test generations (read_scale / compare_bars / build_graph,
 * grade 2-3), plus one mutated fixture per implemented check class that MUST fire.
 */

const readCtx = { componentId: 'bar-model', evalMode: 'read_scale', topic: 'reading bar graphs', gradeLevel: 'grade 3' };
const compareCtx = { ...readCtx, evalMode: 'compare_bars' };
const buildCtx = { ...readCtx, evalMode: 'build_graph' };

// ── read_scale — expectedValue == values[targetBarIndex].value, ∈ options ──
const readClean = {
  title: 'Favorite Fruit', description: 'Read the graph.',
  challenges: [
    { id: 'r1', evalMode: 'read_scale', graphStyle: 'scaled_bar', scale: { step: 2, max: 18 }, prompt: 'How many picked Apples?', targetBarIndex: 0, expectedValue: 12, options: [10, 12, 14, 16], values: [{ label: 'Apples', value: 12 }, { label: 'Bananas', value: 5 }, { label: 'Grapes', value: 18 }, { label: 'Oranges', value: 8 }] },
    { id: 'r2', evalMode: 'read_scale', graphStyle: 'scaled_bar', scale: { step: 2, max: 16 }, prompt: 'How many did Ava eat?', targetBarIndex: 3, expectedValue: 15, options: [11, 13, 15, 17], values: [{ label: 'Mia', value: 4 }, { label: 'Leo', value: 12 }, { label: 'Sam', value: 7 }, { label: 'Ava', value: 15 }] },
    { id: 'r3', evalMode: 'read_scale', graphStyle: 'scaled_bar', scale: { step: 1, max: 10 }, prompt: 'How many Dogs?', targetBarIndex: 1, expectedValue: 9, options: [5, 7, 9, 11], values: [{ label: 'Cats', value: 6 }, { label: 'Dogs', value: 9 }, { label: 'Fish', value: 3 }, { label: 'Birds', value: 8 }] },
    { id: 'r4', evalMode: 'read_scale', graphStyle: 'scaled_bar', scale: { step: 2, max: 16 }, prompt: 'How many Red?', targetBarIndex: 0, expectedValue: 14, options: [10, 12, 14, 16], values: [{ label: 'Red', value: 14 }, { label: 'Blue', value: 6 }, { label: 'Green', value: 10 }, { label: 'Yellow', value: 4 }] },
  ],
};

// ── compare_bars — targetBarIndex == argmax for a "more" prompt ──
const compareClean = {
  title: 'Which Has More?', description: 'Compare the bars.',
  challenges: [
    { id: 'c1', evalMode: 'compare_bars', graphStyle: 'bar', prompt: 'Which fruit has more picked?', targetBarIndex: 0, expectedValue: null, values: [{ label: 'Apples', value: 8 }, { label: 'Pears', value: 3 }] },
    { id: 'c2', evalMode: 'compare_bars', graphStyle: 'bar', prompt: 'Which has more items?', targetBarIndex: 1, expectedValue: null, values: [{ label: 'Apples', value: 4 }, { label: 'Oranges', value: 7 }] },
    { id: 'c3', evalMode: 'compare_bars', graphStyle: 'bar', prompt: 'Which vegetable has more?', targetBarIndex: 0, expectedValue: null, values: [{ label: 'Carrots', value: 8 }, { label: 'Tomatoes', value: 3 }] },
    { id: 'c4', evalMode: 'compare_bars', graphStyle: 'bar', prompt: 'Which pet has more?', targetBarIndex: 1, expectedValue: null, values: [{ label: 'Cats', value: 5 }, { label: 'Dogs', value: 9 }] },
  ],
};

// ── build_graph — expectedScaleStep ∈ availableScaleSteps, dataset on-axis ──
const buildClean = {
  title: 'Build a Graph', description: 'Build and scale.',
  challenges: [
    { id: 'b1', evalMode: 'build_graph', graphStyle: 'scaled_bar', prompt: 'Build: Tomatoes=14, Carrots=18, Peppers=10, Cucumbers=12.', scale: { step: 2, max: 18 }, availableScaleSteps: [1, 2, 5, 10], expectedScaleStep: 2, expectedDataset: [{ label: 'Tomatoes', value: 14 }, { label: 'Carrots', value: 18 }, { label: 'Peppers', value: 10 }, { label: 'Cucumbers', value: 12 }], values: [] },
    { id: 'b2', evalMode: 'build_graph', graphStyle: 'scaled_bar', prompt: 'Build: Ladybugs=14, Bees=18, Ants=12, Butterflies=10.', scale: { step: 2, max: 18 }, availableScaleSteps: [1, 2, 5, 10], expectedScaleStep: 2, expectedDataset: [{ label: 'Ladybugs', value: 14 }, { label: 'Bees', value: 18 }, { label: 'Ants', value: 12 }, { label: 'Butterflies', value: 10 }], values: [] },
    { id: 'b3', evalMode: 'build_graph', graphStyle: 'scaled_bar', prompt: 'Build: A=5, B=15, C=25, D=10.', scale: { step: 5, max: 25 }, availableScaleSteps: [1, 2, 5, 10], expectedScaleStep: 5, expectedDataset: [{ label: 'A', value: 5 }, { label: 'B', value: 15 }, { label: 'C', value: 25 }, { label: 'D', value: 10 }], values: [] },
  ],
};

describe('bar-model oracle', () => {
  // ── clean generations pass ──
  it('passes clean read_scale', () => {
    expect(barModelOracle.verify(readClean, readCtx).violations).toEqual([]);
  });
  it('passes clean compare_bars', () => {
    expect(barModelOracle.verify(compareClean, compareCtx).violations).toEqual([]);
  });
  it('passes clean build_graph', () => {
    expect(barModelOracle.verify(buildClean, buildCtx).violations).toEqual([]);
  });

  // ── answer-key-desync ──
  it('flags answer-key-desync — read expectedValue disagrees with the named bar', () => {
    const data = { ...readClean, challenges: readClean.challenges.map((c) => c.id === 'r1' ? { ...c, expectedValue: 14, options: [10, 14, 16, 18] } : c) };
    const v = barModelOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'r1' && /named bar/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — read expectedValue absent from options', () => {
    const data = { ...readClean, challenges: readClean.challenges.map((c) => c.id === 'r1' ? { ...c, options: [10, 14, 16, 18] } : c) };
    const v = barModelOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'r1' && /never be selected/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — compare targetBarIndex points at the wrong bar', () => {
    const data = { ...compareClean, challenges: compareClean.challenges.map((c) => c.id === 'c1' ? { ...c, targetBarIndex: 1 } : c) };
    const v = barModelOracle.verify(data, compareCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1')).toBe(true);
  });
  it('flags answer-key-desync — compare targetBarIndex out of range', () => {
    const data = { ...compareClean, challenges: compareClean.challenges.map((c) => c.id === 'c1' ? { ...c, targetBarIndex: 5 } : c) };
    const v = barModelOracle.verify(data, compareCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'c1' && /valid bar index/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — build expectedScaleStep not among availableScaleSteps', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'b1' ? { ...c, expectedScaleStep: 3 } : c) };
    const v = barModelOracle.verify(data, buildCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'b1' && /never be chosen/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — build dataset value exceeds the axis max', () => {
    const data = { ...buildClean, challenges: buildClean.challenges.map((c) => c.id === 'b1' ? { ...c, expectedDataset: [...c.expectedDataset!.slice(1), { label: 'Tomatoes', value: 40 }] } : c) };
    const v = barModelOracle.verify(data, buildCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'b1' && /axis max/.test(x.detail))).toBe(true);
  });

  // ── scope ──
  it('flags scope — a bar value exceeds an explicit ceiling', () => {
    const v = barModelOracle.verify(readClean, { ...readCtx, scopeMax: 10 }).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  // ── clustering ──
  it('flags clustering — every read answer is the same value', () => {
    const data = { ...readClean, challenges: readClean.challenges.map((c) => ({ ...c, targetBarIndex: 0, expectedValue: 12, options: [10, 12, 14, 16], values: [{ label: 'X', value: 12 }, { label: 'Y', value: 5 }, { label: 'Z', value: 8 }, { label: 'W', value: 3 }] })) };
    const v = barModelOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });
  it('flags clustering — an exact-duplicate read card', () => {
    const dup = { ...readClean.challenges[0], id: 'r-dup' };
    const data = { ...readClean, challenges: [...readClean.challenges, dup] };
    const v = barModelOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  // ── schema ──
  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { ...readClean, challenges: [readClean.challenges[0]] };
    const v = barModelOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
  it('flags schema — malformed values array', () => {
    const data = { ...compareClean, challenges: compareClean.challenges.map((c) => c.id === 'c1' ? { ...c, values: [] } : c) };
    const v = barModelOracle.verify(data, compareCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'c1')).toBe(true);
  });
});
