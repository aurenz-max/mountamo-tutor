import { describe, expect, it } from 'vitest';
import { numberLineOracle } from '../number-line';

/**
 * Seeded-violation tests for the number-line oracle. Clean fixtures are trimmed
 * verbatim from real /api/lumina/eval-test generations (jump/plot/order — grade 1,
 * "…within 20"), plus one mutated fixture per implemented check class that MUST
 * fire. The find_between "desync" case is a REAL generation whose stored bounds
 * (up to 5) fell outside a line rendered only to [0,1] — a live reachability bug.
 */

const withinCtx = { componentId: 'number-line', evalMode: 'jump', topic: 'Addition and subtraction within 20', gradeLevel: 'grade 1' };
// Scope-bearing "to 10" topic → ceiling 10; proves scope bites on the 0–20 line + 11/13/17 values.
const to10Ctx = { ...withinCtx, topic: 'Addition and subtraction within 10' };

// ── show_jump — real generation (grade 1, within 20) ──
const jumpClean = {
  title: 'Jump Along the Number Line', description: 'Show operations as jumps.',
  range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'jump',
  highlights: [], operations: [{ type: 'add', startValue: 7, changeValue: 2, showJumpArc: false }],
  challenges: [
    { id: 'show_jump-0', type: 'show_jump', instruction: '?', targetValues: [9], hint: '?', startValue: 7, operations: [{ type: 'add', startValue: 7, changeValue: 2, showJumpArc: false }] },
    { id: 'show_jump-1', type: 'show_jump', instruction: '?', targetValues: [8], hint: '?', startValue: 5, operations: [{ type: 'add', startValue: 5, changeValue: 3, showJumpArc: false }] },
    { id: 'show_jump-2', type: 'show_jump', instruction: '?', targetValues: [9], hint: '?', startValue: 11, operations: [{ type: 'subtract', startValue: 11, changeValue: 2, showJumpArc: false }] },
    { id: 'show_jump-3', type: 'show_jump', instruction: '?', targetValues: [13], hint: '?', startValue: 17, operations: [{ type: 'subtract', startValue: 17, changeValue: 4, showJumpArc: false }] },
  ],
};

// ── plot_point — real generation (grade 1, numbers to 20) ──
const plotClean = {
  title: 'Find the Number', description: 'Plot the target.',
  range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'plot',
  highlights: [], operations: [],
  challenges: [
    { id: 'plot_point-0', type: 'plot_point', instruction: '?', targetValues: [12], hint: '?' },
    { id: 'plot_point-1', type: 'plot_point', instruction: '?', targetValues: [10], hint: '?' },
    { id: 'plot_point-2', type: 'plot_point', instruction: '?', targetValues: [7], hint: '?' },
    { id: 'plot_point-3', type: 'plot_point', instruction: '?', targetValues: [6], hint: '?' },
    { id: 'plot_point-4', type: 'plot_point', instruction: '?', targetValues: [9], hint: '?' },
  ],
};

// ── order_values — real generation (grade 1, order to 20) ──
const orderClean = {
  title: 'Put Them In Order', description: 'Arrange the values.',
  range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'order',
  highlights: [], operations: [],
  challenges: [
    { id: 'order_values-0', type: 'order_values', instruction: '?', targetValues: [14, 9, 10], hint: '?' },
    { id: 'order_values-1', type: 'order_values', instruction: '?', targetValues: [15, 12, 14], hint: '?' },
    { id: 'order_values-2', type: 'order_values', instruction: '?', targetValues: [15, 12, 13], hint: '?' },
    { id: 'order_values-3', type: 'order_values', instruction: '?', targetValues: [12, 10, 15], hint: '?' },
  ],
};

// ── find_between — hand-built clean fixture (well-formed integer bounds in-range) ──
const betweenCtx = { componentId: 'number-line', evalMode: 'between', topic: 'Find a number between', gradeLevel: 'grade 3' };
const betweenClean = {
  title: 'Find Between', description: 'Find a value between the marks.',
  range: { min: 0, max: 10 }, gradeBand: '3-5', numberType: 'integer', interactionMode: 'compare',
  highlights: [], operations: [],
  challenges: [
    { id: 'find_between-0', type: 'find_between', instruction: '?', targetValues: [2, 8], hint: '?' },
    { id: 'find_between-1', type: 'find_between', instruction: '?', targetValues: [1, 5], hint: '?' },
    { id: 'find_between-2', type: 'find_between', instruction: '?', targetValues: [3, 9], hint: '?' },
    { id: 'find_between-3', type: 'find_between', instruction: '?', targetValues: [0, 6], hint: '?' },
  ],
};

// ── find_between — REAL buggy generation: bounds up to 5 on a line rendered to [0,1] ──
const betweenRealBuggy = {
  title: 'Fractions Between', description: 'Find between benchmarks.',
  range: { min: 0, max: 1 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'compare',
  highlights: [], operations: [],
  challenges: [
    { id: 'find_between-0', type: 'find_between', instruction: '?', targetValues: [0, 5], hint: '?' },
    { id: 'find_between-1', type: 'find_between', instruction: '?', targetValues: [0, 3], hint: '?' },
    { id: 'find_between-2', type: 'find_between', instruction: '?', targetValues: [0, 2], hint: '?' },
    { id: 'find_between-3', type: 'find_between', instruction: '?', targetValues: [0, 4], hint: '?' },
  ],
};

describe('number-line oracle', () => {
  // ── clean generations pass ──
  it('passes clean show_jump', () => {
    expect(numberLineOracle.verify(jumpClean, withinCtx).violations).toEqual([]);
  });
  it('passes clean plot_point', () => {
    expect(numberLineOracle.verify(plotClean, { ...withinCtx, evalMode: 'plot', topic: 'Numbers to 20' }).violations).toEqual([]);
  });
  it('passes clean order_values', () => {
    expect(numberLineOracle.verify(orderClean, { ...withinCtx, evalMode: 'order', topic: 'Order numbers to 20' }).violations).toEqual([]);
  });
  it('passes clean find_between', () => {
    expect(numberLineOracle.verify(betweenClean, betweenCtx).violations).toEqual([]);
  });

  // ── answer-key-desync ──
  it('flags answer-key-desync — a show_jump stored target disagrees with start±change', () => {
    const data = { ...jumpClean, challenges: jumpClean.challenges.map((c) => c.id === 'show_jump-0' ? { ...c, targetValues: [99] } : c) };
    const v = numberLineOracle.verify(data, withinCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'show_jump-0')).toBe(true);
  });
  it('flags answer-key-desync — a show_jump landing falls off the rendered line', () => {
    const offLine = { id: 'show_jump-0', type: 'show_jump', instruction: '?', targetValues: [28], hint: '?', startValue: 18, operations: [{ type: 'add', startValue: 18, changeValue: 10, showJumpArc: false }] };
    const data = { ...jumpClean, challenges: jumpClean.challenges.map((c) => c.id === 'show_jump-0' ? offLine : c) };
    const v = numberLineOracle.verify(data, withinCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'show_jump-0' && /outside the line/.test(x.detail))).toBe(true);
  });
  it('flags answer-key-desync — a plot target sits off the rendered line', () => {
    const data = { ...plotClean, challenges: plotClean.challenges.map((c) => c.id === 'plot_point-0' ? { ...c, targetValues: [99] } : c) };
    const v = numberLineOracle.verify(data, { ...withinCtx, topic: 'Numbers to 20' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'plot_point-0')).toBe(true);
  });
  it('flags answer-key-desync — an order value sits off the rendered line', () => {
    const data = { ...orderClean, challenges: orderClean.challenges.map((c) => c.id === 'order_values-0' ? { ...c, targetValues: [14, 9, 99] } : c) };
    const v = numberLineOracle.verify(data, { ...withinCtx, topic: 'Order numbers to 20' }).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'order_values-0')).toBe(true);
  });
  it('flags answer-key-desync — REAL find_between bounds fall outside the line', () => {
    const v = numberLineOracle.verify(betweenRealBuggy, betweenCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync')).toBe(true);
  });
  it('flags answer-key-desync — find_between bounds within one snap step (no value strictly between)', () => {
    const data = { ...betweenClean, challenges: betweenClean.challenges.map((c) => c.id === 'find_between-0' ? { ...c, targetValues: [2, 3] } : c) };
    const v = numberLineOracle.verify(data, betweenCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'find_between-0')).toBe(true);
  });

  // ── scope ──
  it('flags scope — a 0–20 line and 11/13/17 values exceed a "within 10" ceiling', () => {
    const v = numberLineOracle.verify(jumpClean, to10Ctx).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  // ── clustering ──
  it('flags clustering — every jump lands on the same value', () => {
    const data = {
      ...jumpClean,
      challenges: [
        { id: 'j0', type: 'show_jump', instruction: '?', targetValues: [10], hint: '?', startValue: 8, operations: [{ type: 'add', startValue: 8, changeValue: 2, showJumpArc: false }] },
        { id: 'j1', type: 'show_jump', instruction: '?', targetValues: [10], hint: '?', startValue: 7, operations: [{ type: 'add', startValue: 7, changeValue: 3, showJumpArc: false }] },
        { id: 'j2', type: 'show_jump', instruction: '?', targetValues: [10], hint: '?', startValue: 6, operations: [{ type: 'add', startValue: 6, changeValue: 4, showJumpArc: false }] },
        { id: 'j3', type: 'show_jump', instruction: '?', targetValues: [10], hint: '?', startValue: 5, operations: [{ type: 'add', startValue: 5, changeValue: 5, showJumpArc: false }] },
      ],
    };
    const v = numberLineOracle.verify(data, withinCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });
  it('flags clustering — an exact-duplicate plot card', () => {
    const dup = { id: 'plot_point-dup', type: 'plot_point', instruction: 'dup', targetValues: [12], hint: '?' };
    const data = { ...plotClean, challenges: [...plotClean.challenges, dup] };
    const v = numberLineOracle.verify(data, { ...withinCtx, topic: 'Numbers to 20' }).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  // ── schema ──
  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = { ...plotClean, challenges: [plotClean.challenges[0]] };
    const v = numberLineOracle.verify(data, { ...withinCtx, topic: 'Numbers to 20' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
  it('flags schema — a non-integer target on an integer line', () => {
    const data = { ...plotClean, challenges: plotClean.challenges.map((c) => c.id === 'plot_point-0' ? { ...c, targetValues: [7.5] } : c) };
    const v = numberLineOracle.verify(data, { ...withinCtx, topic: 'Numbers to 20' }).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'plot_point-0')).toBe(true);
  });
});
