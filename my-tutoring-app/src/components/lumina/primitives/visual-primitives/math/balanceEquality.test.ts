import { describe, expect, it } from 'vitest';
import { addWeight, removeWeight, balanceState, describeBoard, equalityItems, equalityProblem, initialBoard,
  demonstratedBoard, isMatched, usesEqualityPilot, rightWeight } from './balanceEqualityModel';
import { equalityAssignment, equalityScene } from './balanceScaleWorkspace';
import type { BalanceScaleChallenge, BalanceScaleData } from './BalanceScale';

const challenge: BalanceScaleChallenge = { type: 'equality', leftSide: [], rightSide: [], variableValue: 8,
  instruction: 'Match the weight.', hint: 'Watch the scale.' };
const problem = equalityProblem(challenge, 0);
const items = equalityItems([problem]);

describe('weight matching model', () => {
  it('starts empty, responds to weight rather than block count, and allows overshooting', () => {
    const start = initialBoard();
    const five = addWeight(start, 5, 1)!;
    const eight = addWeight(five, 3, 2)!;
    expect(balanceState(problem, start)).toBe('left-heavy');
    expect(balanceState(problem, five)).toBe('left-heavy');
    expect(isMatched(problem, eight)).toBe(true);
    expect(rightWeight(eight)).toBe(8);
    expect(balanceState(problem, addWeight(eight, 1, 3)!)).toBe('right-heavy');
    expect(balanceState(problem, removeWeight(eight, 2))).toBe('left-heavy');
    expect(start.blocks).toEqual([]);
  });
  it('preserves the chosen partition and matches every target from 1 to 20', () => {
    for (let target = 1; target <= 20; target++) {
      const p = { ...problem, target };
      let board = initialBoard();
      for (let i = 0; i < target; i++) board = addWeight(board, 1, i)!;
      expect(isMatched(p, board)).toBe(true);
      expect(isMatched(p, demonstratedBoard(p))).toBe(true);
      expect(board.blocks).toHaveLength(target);
    }
  });
  it('rejects invalid blocks, duplicate identities, overflow and invalid targets', () => {
    const board = addWeight(initialBoard(), 5, 0)!;
    expect(addWeight(board, 2, 0)).toBeNull();
    expect(addWeight(board, -1, 1)).toBeNull();
    expect(addWeight(board, 1.5, 1)).toBeNull();
    let full = initialBoard();
    for (let i = 0; i < 6; i++) full = addWeight(full, 5, i)!;
    expect(addWeight(full, 1, 7)).toBeNull();
    for (const value of [0, -1, 21, 1.5]) expect(() => equalityProblem({ ...challenge, variableValue: value }, 0)).toThrow();
  });
  it('routes both homogeneous equality modes and keeps mixed or algebra sessions out', () => {
    for (const type of ['equality', 'equality_hard'] as const) {
      expect(usesEqualityPilot({ challenges: [{ ...challenge, type }] } as BalanceScaleData)).toBe(true);
    }
    expect(usesEqualityPilot({ challenges: [challenge, { ...challenge, type: 'one_step' }] } as BalanceScaleData)).toBe(false);
    expect(usesEqualityPilot({ challenges: [challenge, { ...challenge, type: 'equality_hard' }] } as BalanceScaleData)).toBe(false);
    expect(usesEqualityPilot({} as BalanceScaleData)).toBe(false);
  });
});

describe('match, compose, infer on the teaching workspace', () => {
  it('uses one gesture followed by two distinct spoken-number turns', () => {
    expect(items.map((item) => [item.step, item.answerKind])).toEqual([['build', 'gesture'], ['total', 'voice'], ['infer', 'voice']]);
  });
  it('withholds the target during building: the ask, the key and the scene', () => {
    expect(describeBoard(problem, initialBoard())).not.toContain('8');
    const build = equalityAssignment(items[0]);
    expect(build).toMatchObject({ response: 'gesture' });
    expect(build.expectedAnswer).toBeUndefined();
    expect(build.task).not.toMatch(/\b(8|eight)\b/);
    expect(JSON.stringify(equalityScene(items[0], addWeight(initialBoard(), 3, 1)!))).not.toMatch(/\b(8|eight)\b/);
  });
  it('asks the sum before the left weight, and never says either number in the ask', () => {
    const [, total, infer] = items.map(equalityAssignment);
    expect(total.task).toContain('total weight');
    expect(infer.task).toBe('Since the scales are balanced, what weight is the left side?');
    for (const ask of [total, infer]) {
      expect(ask).toMatchObject({ response: 'speech', expectedAnswer: '8' });
      expect(ask.task).not.toContain('8');
    }
  });
});
