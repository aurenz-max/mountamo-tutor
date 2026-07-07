import { describe, expect, it } from 'vitest';
import { coinCounterOracle } from '../coin-counter';

/**
 * Seeded-violation tests for the coin-counter oracle. Clean fixtures trimmed from
 * real /api/lumina/eval-test generations (count-mixed, compare, make-change,
 * make-amount, identify), plus one mutated fixture per implemented check class
 * that MUST fire. Mirrors the math-fact-fluency / array-grid blocks.
 */

// Scope-bearing topic → ceiling 25¢; clean count totals (≤25) stay in scope.
const ctx25 = { componentId: 'coin-counter', evalMode: 'count-mixed', topic: 'Counting coins to 25 cents', gradeLevel: 'grade 2' };
// Tighter ceiling → proves the scope check bites on the same fixture.
const ctx10 = { componentId: 'coin-counter', evalMode: 'count-mixed', topic: 'Counting coins to 10 cents', gradeLevel: 'grade 1' };
// No numeric ceiling → intrinsic 100¢; used for the ≤100¢ modes.
const ctx100 = { componentId: 'coin-counter', evalMode: 'count-mixed', topic: 'Counting and using coins', gradeLevel: 'grade 2' };

// ── Clean fixtures (trimmed from real generations) ────────────────────────────

const cleanCount = {
  title: 'Counting Coins Fun!',
  description: 'Practice counting coins.',
  gradeBand: '2',
  challenges: [
    { id: 'c1', type: 'count', instruction: 'Count these.', displayedCoins: [{ type: 'dime', count: 2 }, { type: 'penny', count: 3 }], correctTotal: 23 },
    { id: 'c2', type: 'count', instruction: 'Count these.', displayedCoins: [{ type: 'dime', count: 2 }, { type: 'nickel', count: 1 }], correctTotal: 25 },
    { id: 'c3', type: 'count', instruction: 'Count these.', displayedCoins: [{ type: 'nickel', count: 3 }, { type: 'penny', count: 5 }], correctTotal: 20 },
    { id: 'c4', type: 'count', instruction: 'Count these.', displayedCoins: [{ type: 'nickel', count: 2 }, { type: 'penny', count: 3 }], correctTotal: 13 },
    { id: 'c5', type: 'count', instruction: 'Count these.', displayedCoins: [{ type: 'dime', count: 1 }, { type: 'penny', count: 2 }], correctTotal: 12 },
  ],
};

const cleanCompare = {
  title: 'Compare Coins',
  description: 'Which group is worth more?',
  gradeBand: '2',
  challenges: [
    { id: 'c1', type: 'compare', instruction: 'Which is more?', groupA: [{ type: 'dime', count: 1 }, { type: 'penny', count: 2 }], groupB: [{ type: 'nickel', count: 2 }, { type: 'penny', count: 1 }], correctGroup: 'A' }, // 12 vs 11
    { id: 'c2', type: 'compare', instruction: 'Which is more?', groupA: [{ type: 'quarter', count: 1 }, { type: 'nickel', count: 1 }], groupB: [{ type: 'dime', count: 3 }, { type: 'penny', count: 2 }], correctGroup: 'B' }, // 30 vs 32
    { id: 'c3', type: 'compare', instruction: 'Which is more?', groupA: [{ type: 'dime', count: 1 }], groupB: [{ type: 'nickel', count: 2 }], correctGroup: 'equal' }, // 10 vs 10
    { id: 'c4', type: 'compare', instruction: 'Which is more?', groupA: [{ type: 'nickel', count: 1 }], groupB: [{ type: 'quarter', count: 1 }], correctGroup: 'B' }, // 5 vs 25
  ],
};

const cleanChange = {
  title: 'Make Change',
  description: 'How much change?',
  gradeBand: '2',
  challenges: [
    { id: 'c1', type: 'make-change', instruction: 'Change?', paidAmount: 25, itemCost: 10, correctChange: 15 },
    { id: 'c2', type: 'make-change', instruction: 'Change?', paidAmount: 25, itemCost: 15, correctChange: 10 },
    { id: 'c3', type: 'make-change', instruction: 'Change?', paidAmount: 100, itemCost: 60, correctChange: 40 },
    { id: 'c4', type: 'make-change', instruction: 'Change?', paidAmount: 50, itemCost: 25, correctChange: 25 },
  ],
};

const cleanAmount = {
  title: 'Make Amount',
  description: 'Build the amount.',
  gradeBand: '2',
  challenges: [
    { id: 'c1', type: 'make-amount', instruction: 'Make 12.', targetAmount: 12, availableCoins: ['penny', 'nickel', 'dime'] },
    { id: 'c2', type: 'make-amount', instruction: 'Make 25.', targetAmount: 25, availableCoins: ['penny', 'dime', 'nickel'] },
    { id: 'c3', type: 'make-amount', instruction: 'Make 45.', targetAmount: 45, availableCoins: ['quarter', 'dime', 'nickel'] },
    { id: 'c4', type: 'make-amount', instruction: 'Make 30.', targetAmount: 30, availableCoins: ['penny', 'dime', 'quarter'] },
  ],
};

const cleanIdentify = {
  title: 'Identify Coins',
  description: 'Find the coin.',
  gradeBand: '1',
  challenges: [
    { id: 'c1', type: 'identify', instruction: 'Find the penny.', targetCoin: 'penny', options: ['penny', 'nickel', 'dime'], coins: [{ type: 'penny', count: 1 }, { type: 'nickel', count: 1 }, { type: 'dime', count: 1 }] },
    { id: 'c2', type: 'identify', instruction: 'Find the dime.', targetCoin: 'dime', options: ['quarter', 'dime', 'nickel'], coins: [{ type: 'quarter', count: 1 }, { type: 'dime', count: 1 }, { type: 'nickel', count: 1 }] },
    { id: 'c3', type: 'identify', instruction: 'Find the quarter.', targetCoin: 'quarter', options: ['quarter', 'dime', 'penny'], coins: [{ type: 'quarter', count: 1 }, { type: 'dime', count: 1 }, { type: 'penny', count: 1 }] },
    { id: 'c4', type: 'identify', instruction: 'Find the nickel.', targetCoin: 'nickel', options: ['nickel', 'penny', 'dime'], coins: [{ type: 'nickel', count: 1 }, { type: 'penny', count: 1 }, { type: 'dime', count: 1 }] },
  ],
};

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

describe('coin-counter oracle', () => {
  // ── Clean pass ──
  it('passes clean count data (totals ≤ ceiling)', () => {
    expect(coinCounterOracle.verify(cleanCount, ctx25).violations).toEqual([]);
  });
  it('passes clean compare data', () => {
    expect(coinCounterOracle.verify(cleanCompare, ctx100).violations).toEqual([]);
  });
  it('passes clean make-change data', () => {
    expect(coinCounterOracle.verify(cleanChange, ctx100).violations).toEqual([]);
  });
  it('passes clean make-amount data', () => {
    expect(coinCounterOracle.verify(cleanAmount, ctx100).violations).toEqual([]);
  });
  it('passes clean identify data', () => {
    expect(coinCounterOracle.verify(cleanIdentify, ctx100).violations).toEqual([]);
  });

  // ── answer-key-desync (one per type) ──
  it('flags answer-key-desync — count correctTotal disagrees with the coin sum', () => {
    const data = clone(cleanCount);
    data.challenges[0].correctTotal = 99; // 2 dime + 3 penny = 23, not 99
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags answer-key-desync — compare correctGroup contradicts the group totals', () => {
    const data = clone(cleanCompare);
    data.challenges[0].correctGroup = 'B'; // 12 vs 11 → should be A
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags answer-key-desync — make-change correctChange ≠ paid − cost', () => {
    const data = clone(cleanChange);
    data.challenges[0].correctChange = 20; // 25 − 10 = 15
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags answer-key-desync — make-amount target unreachable from available coins', () => {
    const data = clone(cleanAmount);
    data.challenges[0] = { id: 'c1', type: 'make-amount', instruction: 'Make 3.', targetAmount: 3, availableCoins: ['nickel', 'dime'] }; // 3 unreachable from {5,10}
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags answer-key-desync — identify targetCoin absent from selectable options', () => {
    const data = clone(cleanIdentify);
    data.challenges[0].options = ['nickel', 'dime', 'quarter']; // target penny not selectable
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where.startsWith('c1'))).toBe(true);
  });

  // ── scope ──
  it('flags scope — count totals exceed a tighter objective ceiling', () => {
    // Same clean count fixture, but under a "to 10 cents" objective: 23¢, 25¢… exceed it.
    const v = coinCounterOracle.verify(cleanCount, ctx10).violations;
    expect(v.some((x) => x.check === 'scope' && x.where.startsWith('c1'))).toBe(true);
  });

  it('flags scope — a coin denomination above the ceiling', () => {
    const data = clone(cleanIdentify);
    // Under a to-10 topic a quarter (25¢) is out of scope.
    const v = coinCounterOracle.verify(data, { ...ctx100, topic: 'Identifying coins to 10 cents' }).violations;
    expect(v.some((x) => x.check === 'scope' && /quarter/.test(x.detail))).toBe(true);
  });

  it('flags scope — make-change with non-positive change (paid ≤ cost)', () => {
    const data = clone(cleanChange);
    data.challenges[0] = { id: 'c1', type: 'make-change', instruction: 'Change?', paidAmount: 20, itemCost: 30, correctChange: -10 };
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'scope' && x.where.startsWith('c1'))).toBe(true);
  });

  // ── clustering ──
  it('flags clustering — every count challenge has the same total', () => {
    const data = clone(cleanCount);
    data.challenges = [
      { id: 'c1', type: 'count', instruction: 'x', displayedCoins: [{ type: 'dime', count: 2 }], correctTotal: 20 },
      { id: 'c2', type: 'count', instruction: 'x', displayedCoins: [{ type: 'nickel', count: 4 }], correctTotal: 20 },
      { id: 'c3', type: 'count', instruction: 'x', displayedCoins: [{ type: 'dime', count: 1 }, { type: 'nickel', count: 2 }], correctTotal: 20 },
      { id: 'c4', type: 'count', instruction: 'x', displayedCoins: [{ type: 'penny', count: 20 }], correctTotal: 20 },
    ];
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate count card', () => {
    const data = clone(cleanCount);
    data.challenges.push({ id: 'c6', type: 'count', instruction: 'Count these.', displayedCoins: [{ type: 'dime', count: 2 }, { type: 'penny', count: 3 }], correctTotal: 23 }); // dup of c1
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('does NOT flag two compares with the same answer but different coin sets', () => {
    const data = clone(cleanCompare); // answers A,B,equal,B — no single value > 60%
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.filter((x) => x.check === 'clustering')).toEqual([]);
  });

  // ── schema ──
  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = clone(cleanCount);
    data.challenges = [data.challenges[0]];
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags a schema violation — non-integer coin count', () => {
    const data = clone(cleanCount);
    (data.challenges[0].displayedCoins[0] as { count: unknown }).count = 'two';
    const v = coinCounterOracle.verify(data, ctx100).violations;
    expect(v.some((x) => x.check === 'schema' && x.where.startsWith('c1'))).toBe(true);
  });

  it('reports an unknown challenge type in uncheckedTypes', () => {
    const data = clone(cleanCount);
    (data.challenges[0] as { type: string }).type = 'mystery-mode';
    const r = coinCounterOracle.verify(data, ctx100);
    expect(r.uncheckedTypes).toContain('mystery-mode');
  });
});
