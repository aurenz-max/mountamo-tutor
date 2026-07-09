import { describe, expect, it } from 'vitest';
import { ratioTableOracle } from '../ratio-table';

/**
 * Seeded-violation tests for the ratio-table oracle. Two clean fixtures (trimmed
 * from real /api/lumina/eval-test generations — missing_value and build_ratio,
 * grade 6) plus one mutated fixture per implemented check class that MUST fire,
 * including a stored targetValue that disagrees with baseRatio × multiplier.
 */

// No-ceiling topic → the oracle falls back to the loose intrinsic (1000), so the
// real generation's quantities stay in scope for the clean case.
const ctx = { componentId: 'ratio-table', evalMode: 'missing_value', topic: 'Equivalent ratios and unit rate', gradeLevel: 'grade 6' };
// Scope-bearing topic → ceiling 15 on the largest on-screen quantity; proves scope bites.
const scopeCtx = { componentId: 'ratio-table', evalMode: 'missing_value', topic: 'Equivalent ratios within 15', gradeLevel: 'grade 6' };

// Trimmed straight from a real generation (missing_value, grade 6).
const missingClean = {
  title: 'Ratio Adventures: Scaling Up and Down',
  description: 'Scale ingredients, distances, and quantities.',
  maxMultiplier: 10,
  showBarChart: true,
  showUnitRate: true,
  challenges: [
    { id: 'rt1', type: 'missing-value', instruction: 'If 2 cups of flour make 6 muffins, how many muffins with 4 cups?', baseRatio: [2, 6], rowLabels: ['Cups of Flour', 'Muffins'], targetMultiplier: 2, hint: 'x2', hiddenValue: 'scaled-second', tolerance: 1 }, // ans 12
    { id: 'rt2', type: 'missing-value', instruction: 'A car travels 4 in in 1 s. In 5 s?', baseRatio: [1, 4], rowLabels: ['Time (s)', 'Distance (in)'], targetMultiplier: 5, hint: 'x5', hiddenValue: 'scaled-second', tolerance: 1 }, // ans 20
    { id: 'rt3', type: 'missing-value', instruction: '3 apples per 2 servings. 15 apples → ?', baseRatio: [3, 2], rowLabels: ['Apples', 'Servings'], targetMultiplier: 5, hint: 'x5', hiddenValue: 'scaled-second', tolerance: 1 }, // ans 10
    { id: 'rt4', type: 'missing-value', instruction: '8 blue to 2 yellow. 1 yellow → ?', baseRatio: [8, 2], rowLabels: ['Blue', 'Yellow'], targetMultiplier: 0.5, hint: 'x0.5', hiddenValue: 'scaled-first', tolerance: 1 }, // ans 4
  ],
};

// Trimmed straight from a real generation (build_ratio, grade 6).
const buildClean = {
  title: 'Ratio Adventures: Scaling Up!',
  description: 'Build equivalent ratios.',
  maxMultiplier: 10,
  showBarChart: true,
  showUnitRate: true,
  challenges: [
    { id: 'rt1', type: 'build-ratio', instruction: '2 sugar : 4 flour, ×3?', baseRatio: [2, 4], rowLabels: ['Sugar', 'Flour'], targetMultiplier: 3, hint: 'slide to 3' },
    { id: 'rt2', type: 'build-ratio', instruction: '3 apples cost 6, ×4?', baseRatio: [3, 6], rowLabels: ['Apples', 'Cost'], targetMultiplier: 4, hint: 'x4' },
    { id: 'rt3', type: 'build-ratio', instruction: '5 in in 2 s, ×6?', baseRatio: [5, 2], rowLabels: ['Distance', 'Time'], targetMultiplier: 6, hint: 'x6' },
  ],
};

describe('ratio-table oracle', () => {
  it('passes clean missing_value data', () => {
    expect(ratioTableOracle.verify(missingClean, ctx).violations).toEqual([]);
  });

  it('passes clean build_ratio data (all multipliers within the slider span)', () => {
    expect(ratioTableOracle.verify(buildClean, ctx).violations).toEqual([]);
  });

  it('flags answer-key-desync — build-ratio targetMultiplier outside the slider span (unreachable)', () => {
    const data = {
      ...buildClean,
      challenges: [
        { ...buildClean.challenges[0] },
        { ...buildClean.challenges[1], id: 'rt2', targetMultiplier: 14 }, // 14 > maxMultiplier (10) — slider can't reach it
        { ...buildClean.challenges[2] },
      ],
    };
    const v = ratioTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'rt2')).toBe(true);
  });

  it('flags answer-key-desync — a stored targetValue that does NOT match baseRatio × multiplier', () => {
    const data = {
      ...missingClean,
      challenges: [
        { ...missingClean.challenges[0], targetValue: 99 }, // derived is 6×2 = 12, stored says 99
        { ...missingClean.challenges[1] },
        { ...missingClean.challenges[2] },
      ],
    };
    const v = ratioTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'rt1' && /disagrees/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — non-positive baseRatio term (divide-by-zero unit rate / degenerate cell)', () => {
    const data = {
      ...missingClean,
      challenges: [
        { ...missingClean.challenges[0], baseRatio: [0, 6] }, // b÷a divides by zero
        { ...missingClean.challenges[1] },
        { ...missingClean.challenges[2] },
      ],
    };
    const v = ratioTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'rt1')).toBe(true);
  });

  it('flags scope — largest on-screen quantity exceeds the topic ceiling', () => {
    // Under "within 15": rt2 scales 1:4 ×5 → 5:20 (20 > 15), rt1 → 12 (ok).
    const v = ratioTableOracle.verify(missingClean, scopeCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'rt2')).toBe(true);
  });

  it('flags clustering — every challenge shares the same multiplier/answer', () => {
    const data = {
      ...buildClean,
      challenges: [1, 2, 3, 4].map((i) => ({
        id: `c${i}`, type: 'build-ratio', instruction: 'x', baseRatio: [2, 4], rowLabels: ['A', 'B'], targetMultiplier: 3, hint: 'h',
      })),
    };
    const v = ratioTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate card (same type + baseRatio + multiplier + hiddenValue)', () => {
    const data = {
      ...missingClean,
      challenges: [
        ...missingClean.challenges,
        { id: 'rt5', type: 'missing-value', instruction: 'dup', baseRatio: [2, 6], rowLabels: ['Cups of Flour', 'Muffins'], targetMultiplier: 2, hint: 'x2', hiddenValue: 'scaled-second', tolerance: 1 }, // dup of rt1
      ],
    };
    const v = ratioTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...missingClean, challenges: [missingClean.challenges[0]] };
    const v = ratioTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });

  it('flags a schema violation — baseRatio not a 2-number array', () => {
    const data = {
      ...missingClean,
      challenges: [
        { ...missingClean.challenges[0], baseRatio: [2] },
        { ...missingClean.challenges[1] },
        { ...missingClean.challenges[2] },
      ],
    };
    const v = ratioTableOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'rt1' && /baseRatio/.test(x.detail))).toBe(true);
  });

  it('records an unknown challenge type in uncheckedTypes', () => {
    const data = {
      ...missingClean,
      challenges: [
        { ...missingClean.challenges[0] },
        { ...missingClean.challenges[1] },
        { id: 'rtX', type: 'triple-ratio', instruction: '?', baseRatio: [1, 2], rowLabels: ['A', 'B'], targetMultiplier: 2, hint: 'h' },
      ],
    };
    const res = ratioTableOracle.verify(data, ctx);
    expect(res.uncheckedTypes).toContain('triple-ratio');
  });
});
