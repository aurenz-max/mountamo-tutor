import type { DiActionContract, JudgedCueOptions, JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import { enterWorkshopStage, initialWorkshopBoard, isHands, scene, stageSolved, STAGES, workshopExpected, workshopFeedback,
  type WorkshopBoard, type WorkshopProblem, type WorkshopStage } from './balanceWorkshopModel';

export interface WorkshopItem extends JudgedScriptItem { problem: WorkshopProblem; step: WorkshopStage; actionContract: DiActionContract }
const LABELS: Record<WorkshopStage, string> = {
  compose: 'Build a match', sum: 'Add the weights', recompose: 'Another combination', resum: 'Add again',
  complete: 'Complete the load', added: 'Find the added weight', relate: 'Name the missing part',
  separate: 'Set known weight aside', remaining: 'Find the remaining weight', share: 'Share equally',
  each: 'Count one group', infer: 'Find one weight', explain: 'Connect the equation',
};
export function workshopAsk(p: WorkshopProblem, stage: WorkshopStage): string {
  switch (stage) {
    case 'compose': return 'Add weights to the right until the scale balances.';
    case 'sum': return 'Add your right-side weights. What is their total?';
    case 'recompose': return 'Make the same weight again using a different combination of blocks.';
    case 'resum': return 'Add your new combination. What is its total weight?';
    case 'complete': return `The right side weighs ${p.total}. The left already has ${p.known}. Add weights to the left until it balances.`;
    case 'added': return 'Add up just the blocks you placed. How much weight did you add?';
    case 'relate': return `${p.known} and what make ${p.total}?`;
    case 'separate': return p.reverse ? `Show me what subtracting ${p.known} from both sides means. Move the weights to the set-aside areas.`
      : 'Set the known loose weight aside. Then set aside the same weight from the other side, leaving the parcels on the scale.';
    case 'remaining': return 'What weight belongs to the parcels together now?';
    case 'share': return p.reverse ? `Show what dividing both sides by ${p.parcels} means. Share the remaining weight into one equal group per parcel.`
      : `Share the weight into ${p.parcels} equal groups, one for each identical parcel. Tap a unit, then its group, or drag it there.`;
    case 'each': return 'How much weight is in each group?';
    case 'infer': return p.mode === 'equality_hard' ? 'Both combinations balanced the left block. What does the left block weigh?'
      : 'Since the identical parcels balance these equal groups, what does one parcel weigh?';
    case 'explain': return 'Why does dividing into equal groups tell us what one x is worth?';
  }
}
export const workshopItems = (problems: WorkshopProblem[]): WorkshopItem[] => problems.flatMap((problem) => STAGES[problem.mode].map((step) => ({
  id: `${problem.id}-${step}`, problem, step, action: step, answerKind: isHands(step) ? 'gesture' : 'voice',
  responseClass: isHands(step) ? 'manipulation' : step === 'explain' ? 'concept_statement'
    : workshopExpected(problem, step) <= 20 ? 'number_word_to_20' : 'number_word_to_120',
  actionContract: { id: step, label: LABELS[step], icon: isHands(step) ? '=' : '+', answerKind: isHands(step) ? 'gesture' : 'voice',
    instruction: workshopAsk(problem, step), checkingInstruction: isHands(step) ? 'Watching your weights settle.' : 'Listening to your answer.' },
})));
const WAIT = 'Never speak private rules or bracket tags. After the quoted line, wait. Only the app advances. ';
const HANDS = 'Do not judge microphone speech during hand work. [BW_CHANGE] is coaching only. Only [BW_CHECK] supplies a code-computed result. Never give the missing part, parcel weight, group count, or target sum during hand work. ';
export function workshopJudging(item: WorkshopItem): string {
  if (isHands(item.step)) return HANDS;
  if (item.step === 'explain') return 'Judge meaning: identical parcels have equal weights; sharing the combined weight equally gives one parcel, represented by x. '
    + 'Accept child language such as "one equal group goes with one parcel" or "they weigh the same so each gets an equal share". '
    + 'Reject a bare number, repeating the question, unequal sharing, or claiming dividing only one side preserves equality. '
    + 'If correct say exactly "Yes, one equal group matches one parcel, so its weight is x." '
    + 'If incorrect say exactly "My turn: the parcels weigh the same. One equal share matches one parcel, or x. Your turn. Why do we make equal groups?" '
    + 'Silence, questions and off-task speech are not wrong explanations. This explanation is coaching evidence. ';
  const expected = workshopExpected(item.problem, item.step);
  return `Private expected number: ${expected}. Judge the current spoken response only. Accept a clear number or short sentence, with or without units. `
    + 'Negated correct numbers, conflicting guesses, and numbers from a different stage are not correct. Counting without a final answer is unfinished. '
    + 'A previous spoken answer never counts for the new question, even if the expected number is the same. Wait for fresh speech. '
    + `If correct say exactly "Yes, that matches the weights." If wrong say exactly "My turn: the weight is ${expected}. Your turn. ${workshopAsk(item.problem, item.step)}" `
    + 'Help questions, silence and off-task speech are not incorrect answers. ';
}
export function workshopItemCue(item: WorkshopItem, opts: Partial<JudgedCueOptions> = {}, board = initialWorkshopBoard(item.problem)): string {
  const next = enterWorkshopStage(item.problem, item.step, board).board;
  const opening = opts.opening ? 'Let us work with the weights. You can move a weight back if you change your mind. ' : '';
  return `[BW_ITEM] Scene: ${scene(item.problem, next)} Say exactly: "${opening}${workshopAsk(item.problem, item.step)}" ` + workshopJudging(item) + WAIT;
}
export const workshopChangeCue = (item: WorkshopItem, board: WorkshopBoard) =>
  `[BW_CHANGE] Scene: ${scene(item.problem, board)} Say exactly: "${workshopFeedback(item.problem, item.step, board)}" ` + HANDS + WAIT;
export function workshopCheckCue(item: WorkshopItem, board: WorkshopBoard): string {
  const solved = stageSolved(item.problem, item.step, board);
  const success = item.step === 'share' ? 'Yes, every parcel has an equal group.' : item.step === 'separate'
    ? 'Yes, the same known weight is set aside on both sides.' : item.step === 'recompose'
      ? 'Yes, a different combination makes the same weight.' : 'Yes, the scale balances. Let us look at your weights.';
  return `[BW_CHECK] Scene: ${scene(item.problem, board)} Code computed solved=${solved}. Use this result. Say exactly: "${solved ? success
    : `My turn: ${workshopAsk(item.problem, item.step)}`}" ` + WAIT;
}
export function workshopMoveCue(item: WorkshopItem, next: WorkshopItem | null, board: WorkshopBoard): string {
  if (!next) return workshopCompleteCue();
  const prepared = enterWorkshopStage(next.problem, next.step, board);
  return `[BW_MOVE] Scene: ${scene(next.problem, prepared.board)} Say exactly: "${prepared.modeled
    ? 'I have shown this step with the weights. Now use my example. ' : 'Let us try the next part. '}${workshopAsk(next.problem, next.step)}" ` + workshopJudging(next) + WAIT;
}
export const workshopCompleteCue = () => '[BW_COMPLETE] Say exactly: "You used the weights to build and explain the math. Nice work!" Then stop.';
export const workshopHearCue = (item: WorkshopItem, board: WorkshopBoard) =>
  `[BW_HEAR] Scene: ${scene(item.problem, board)} Say exactly: "${workshopAsk(item.problem, item.step)}" Do not judge speech just heard. ` + workshopJudging(item) + WAIT;
