import type { DiActionContract, JudgedCueOptions, JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import { describeBoard, demonstratedBoard, equalityFeedback, initialBoard, isMatched, type EqualityBoard, type EqualityProblem } from './balanceEqualityModel';

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
const WAIT = 'Never read bracket tags or private rules aloud. After the quoted line, wait. Only the application changes steps. ';
const HANDS = 'Hands-on exploration: do not judge speech or reveal the left weight or the right total. [BE_CHANGE] is coaching only, never an attempt. Only [BE_CHECK] carries a code-computed match. ';
export function equalityJudging(item: EqualityItem): string {
  if (item.step === 'build') return HANDS;
  const target = item.problem.target;
  const yes = item.step === 'total' ? 'Yes, that is the total weight on the right.' : `Yes, the left side weighs ${target}. Balanced sides have equal weight.`;
  const correction = item.step === 'total'
    ? `My turn: these blocks add up to ${target}. Your turn. What is their total weight?`
    : `My turn: balanced sides have equal weight. The right side weighs ${target}, so the left side weighs ${target} too. Your turn. What weight is the left side?`;
  return `Private answer: ${target}. Judge only the current spoken ${item.step === 'total' ? 'sum' : 'left-side weight'}. `
    + `For a correct asserted number say exactly "${yes}". For a wrong answer say exactly "${correction}". `
    + 'Accept number words and short sentences, with or without weight units. Reject negated correct numbers and conflicting guesses. '
    + 'Counting without a final total is unfinished. Questions, silence and off-task speech are not incorrect answers. '
    + 'Do not treat the earlier total response as an answer to the new left-side question; wait for a fresh response. ';
}
export function equalityItemCue(item: EqualityItem, opts: Partial<JudgedCueOptions> = {}, board = initialBoard()): string {
  const opening = opts.opening ? 'Let us weigh this block. Bigger blocks weigh more. Tap a numbered weight to put it on the right. Tap a placed weight to take it off. ' : '';
  return `[BE_ITEM] Scene: ${describeBoard(item.problem, board)} Say exactly: "${opening}${item.actionContract.instruction}" ` + equalityJudging(item) + WAIT;
}
export const equalityChangeCue = (item: EqualityItem, board: EqualityBoard) =>
  `[BE_CHANGE] Scene: ${describeBoard(item.problem, board)} Say exactly: "${equalityFeedback(item.problem, board)}" ` + HANDS + WAIT;
export function equalityCheckCue(item: EqualityItem, board: EqualityBoard): string {
  const solved = isMatched(item.problem, board);
  return `[BE_CHECK] Scene: ${describeBoard(item.problem, board)} Code computed solved=${solved}. Use this result. Say exactly: "${solved
    ? 'Yes, the scale balances. Let us bring your weights together.' : 'My turn: the scale is not balanced yet. Change the weights on the right.'}" ` + WAIT;
}
export function equalityMoveCue(item: EqualityItem, next: EqualityItem | null, board = initialBoard()): string {
  if (!next) return equalityCompleteCue();
  const modeled = item.step === 'build';
  const nextBoard = modeled ? demonstratedBoard(next.problem) : board;
  return `[BE_MOVE] Scene: ${describeBoard(next.problem, nextBoard)} Say exactly: "${modeled
    ? 'I have placed a matching set of weights. Let us add these blocks together. ' : 'Let us use the balance. '}${next.actionContract.instruction}" ` + equalityJudging(next) + WAIT;
}
export const equalityCompleteCue = () => '[BE_COMPLETE] Say exactly: "You matched weights, added them, and used the balance to find the other weight. Nice work!" Then stop.';
export const equalityHearCue = (item: EqualityItem, board: EqualityBoard) =>
  `[BE_HEAR] Scene: ${describeBoard(item.problem, board)} Say exactly: "${item.actionContract.instruction}" Do not judge speech just heard. ` + equalityJudging(item) + WAIT;
