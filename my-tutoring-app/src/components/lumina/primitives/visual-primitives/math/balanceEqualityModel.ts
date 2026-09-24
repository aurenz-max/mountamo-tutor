import type { BalanceScaleChallenge, BalanceScaleData } from './BalanceScale';
import type { DiActionContract, JudgedScriptItem } from '../../../hooks/judgedScriptContract';

export interface EqualityProblem { id: string; target: number; mode: 'equality' | 'equality_hard' }
export interface WeightBlock { id: number; value: number }
export interface EqualityBoard { blocks: WeightBlock[] }
export interface EqualityChange { before: EqualityBoard; after: EqualityBoard; description: string }
export const WEIGHTS = [1, 2, 3, 5] as const;

// Homogeneous sessions only: keep the component and audio resolver in agreement.
export const usesEqualityPilot = (data: BalanceScaleData): boolean => {
  const mode = data.challenges?.[0]?.type;
  return (mode === 'equality' || mode === 'equality_hard')
    && !!data.challenges?.length && data.challenges.every((challenge) => challenge.type === mode);
};
export function equalityProblem(challenge: BalanceScaleChallenge, index: number): EqualityProblem {
  if ((challenge.type !== 'equality' && challenge.type !== 'equality_hard')
    || !Number.isInteger(challenge.variableValue) || challenge.variableValue < 1 || challenge.variableValue > 20) {
    throw new Error('Weight matching requires an equality target from 1 to 20.');
  }
  // Reuse the established number pool. Legacy equation blocks are not the student's scene.
  return { id: `balance-${index + 1}`, target: challenge.variableValue, mode: challenge.type };
}
export const initialBoard = (_problem?: EqualityProblem): EqualityBoard => ({ blocks: [] });
export const rightWeight = (board: EqualityBoard): number => board.blocks.reduce((sum, block) => sum + block.value, 0);
export function balanceState(problem: EqualityProblem, board: EqualityBoard): 'balanced' | 'left-heavy' | 'right-heavy' {
  const difference = problem.target - rightWeight(board);
  return difference === 0 ? 'balanced' : difference > 0 ? 'left-heavy' : 'right-heavy';
}
export const isMatched = (problem: EqualityProblem, board: EqualityBoard): boolean => balanceState(problem, board) === 'balanced';
export function addWeight(board: EqualityBoard, value: number, id: number): EqualityBoard | null {
  if (!(WEIGHTS as readonly number[]).includes(value) || !Number.isInteger(id)
    || board.blocks.some((block) => block.id === id) || board.blocks.length >= 20 || rightWeight(board) + value > 30) return null;
  return { blocks: [...board.blocks, { id, value }] };
}
export const removeWeight = (board: EqualityBoard, id: number): EqualityBoard => ({ blocks: board.blocks.filter((block) => block.id !== id) });
export function demonstratedBoard(problem: EqualityProblem): EqualityBoard {
  let remaining = problem.target;
  const blocks: WeightBlock[] = [];
  while (remaining > 0) {
    const value = [...WEIGHTS].reverse().find((weight) => weight <= remaining)!;
    blocks.push({ id: -(blocks.length + 1), value }); remaining -= value;
  }
  return { blocks };
}
export const describeBoard = (problem: EqualityProblem, board: EqualityBoard): string =>
  `Left: one unnumbered weight block. Right blocks: ${board.blocks.map((block) => block.value).join(', ') || 'none'}. Scale: ${balanceState(problem, board)}.`;
export function equalityFeedback(problem: EqualityProblem, board: EqualityBoard): string {
  const state = balanceState(problem, board);
  return state === 'balanced' ? 'The scale is balanced.' : state === 'left-heavy'
    ? 'The left side is heavier. Try adding weight on the right.'
    : 'The right side is heavier. Try taking a block off or swapping it for a lighter one.';
}

// ── The session's steps: build (hands), total and infer (spoken), per problem ──

export type EqualityStep = 'build' | 'total' | 'infer';
export interface EqualityItem extends JudgedScriptItem {
  problem: EqualityProblem; step: EqualityStep; actionContract: DiActionContract;
}
const ACTIONS: Record<EqualityStep, DiActionContract> = {
  build: { id: 'build', label: 'Balance the weights', icon: '=', answerKind: 'gesture',
    instruction: 'Put weights on the right until the scale balances.', checkingInstruction: 'The scale is settling.' },
  total: { id: 'total', label: 'Add your weights', icon: '+', answerKind: 'voice',
    instruction: 'Add the numbers on your right-side blocks. What is their total weight?', checkingInstruction: 'Listening to your total.' },
  infer: { id: 'infer', label: 'Find the left weight', icon: '=', answerKind: 'voice',
    instruction: 'Since the scales are balanced, what weight is the left side?', checkingInstruction: 'Listening to your answer.' },
};
export const equalityItems = (problems: EqualityProblem[]): EqualityItem[] => problems.flatMap((problem) =>
  (['build', 'total', 'infer'] as const).map((step) => ({ id: `${problem.id}-${step}`, problem, step, action: step,
    answerKind: ACTIONS[step].answerKind, actionContract: ACTIONS[step],
    responseClass: step === 'build' ? 'manipulation' : 'number_word_to_20' })));
