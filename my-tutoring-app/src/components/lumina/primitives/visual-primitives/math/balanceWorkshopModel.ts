import type { BalanceScaleChallenge, BalanceScaleData, BalanceScaleChallengeType } from './BalanceScale';

export const WORKSHOP_MODES = ['equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step'] as const;
export type WorkshopMode = typeof WORKSHOP_MODES[number];
export type WorkshopStage = 'compose' | 'sum' | 'recompose' | 'resum' | 'complete' | 'added' | 'relate'
  | 'separate' | 'remaining' | 'share' | 'each' | 'infer' | 'explain';
export interface WorkshopProblem { id: string; mode: WorkshopMode; target: number; known: number; parcels: number; total: number; reverse: boolean }
export interface WorkshopWeight { id: number; value: number }
export interface WorkshopBoard {
  weights: WorkshopWeight[];
  first: WorkshopWeight[];
  leftAside: boolean;
  /** One entry per original unit: -1 = pool, -2 = set aside, 0..n-1 = parcel group. */
  units: number[];
}
export const TRAY = [1, 2, 3, 5, 10] as const;
export const TITLES: Record<WorkshopMode, string> = {
  equality_hard: 'Make It Another Way', one_step: 'Complete the Load', one_step_hard: 'Share the Weight',
  two_step_intro: 'Unpack and Share', two_step: 'Build the Equation',
};
export const STAGES: Record<WorkshopMode, WorkshopStage[]> = {
  equality_hard: ['compose', 'sum', 'recompose', 'resum', 'infer'],
  one_step: ['complete', 'added', 'relate'],
  one_step_hard: ['share', 'each', 'infer'],
  two_step_intro: ['separate', 'remaining', 'share', 'each', 'infer'],
  two_step: ['separate', 'remaining', 'share', 'each', 'infer', 'explain'],
};
export const isHands = (stage: WorkshopStage) => ['compose', 'recompose', 'complete', 'separate', 'share'].includes(stage);
export const usesBalanceWorkshop = (data: BalanceScaleData) => !!data.challenges?.length
  && (WORKSHOP_MODES as readonly string[]).includes(data.challenges[0].type)
  && data.challenges.every((challenge) => challenge.type === data.challenges![0].type);

export function workshopProblem(challenge: BalanceScaleChallenge, index: number): WorkshopProblem {
  if (!(WORKSHOP_MODES as readonly string[]).includes(challenge.type)) throw new Error('Unsupported weight workshop mode.');
  const mode = challenge.type as WorkshopMode;
  const target = challenge.variableValue;
  if (!Number.isInteger(target) || target < (mode === 'equality_hard' ? 2 : 1) || target > 30)
    throw new Error('This weight workshop needs a whole-number target from 1 to 30 (at least 2 for another combination). Regenerate this activity.');
  if (mode === 'equality_hard') return { id: `workshop-${index + 1}`, mode, target, known: 0, parcels: 1, total: target, reverse: false };
  const constants = [...challenge.leftSide, ...challenge.rightSide].filter((block) => !block.isVariable);
  const variables = challenge.leftSide.filter((block) => block.isVariable);
  const parcels = variables.reduce((sum, block) => sum + block.value, 0);
  const known = challenge.leftSide.reduce((sum, block) => sum + (block.isVariable ? 0 : block.value), 0);
  const total = challenge.rightSide.reduce((sum, block) => sum + block.value, 0);
  if (constants.some((block) => !Number.isInteger(block.value) || block.value < 0)
    || variables.some((block) => !Number.isInteger(block.value) || block.value < 1)
    || challenge.rightSide.some((block) => block.isVariable) || total !== parcels * target + known
    || total > 120 || parcels < 1 || parcels > 6
    || (mode === 'one_step' ? parcels !== 1 : parcels < 2)
    || (mode === 'one_step_hard' && known !== 0)
    || ((mode === 'two_step' || mode === 'two_step_intro') && known < 1)) {
    throw new Error('Weight workshop requires a consistent positive parcel-and-weight equation.');
  }
  return { id: `workshop-${index + 1}`, mode, target, known, parcels, total, reverse: mode === 'two_step' && index % 2 === 1 };
}
export const initialWorkshopBoard = (p: WorkshopProblem): WorkshopBoard => ({ weights: [], first: [], leftAside: false,
  units: p.parcels > 1 ? Array(p.total).fill(-1) : [] });
export const weightSum = (weights: WorkshopWeight[]) => weights.reduce((sum, block) => sum + block.value, 0);
export const signature = (weights: WorkshopWeight[]) => weights.map((block) => block.value).sort((a, b) => a - b).join(',');
export const groupCounts = (p: WorkshopProblem, b: WorkshopBoard) => Array.from({ length: p.parcels }, (_, group) => b.units.filter((place) => place === group).length);
export const asideCount = (b: WorkshopBoard) => b.units.filter((place) => place === -2).length;
export const separated = (p: WorkshopProblem, b: WorkshopBoard) => b.leftAside && asideCount(b) === p.known;
export const shared = (p: WorkshopProblem, b: WorkshopBoard) => !b.units.includes(-1)
  && (p.known === 0 || b.leftAside) && asideCount(b) === p.known && groupCounts(p, b).every((count) => count === p.target);
export function workshopBalance(p: WorkshopProblem, b: WorkshopBoard): 'balanced' | 'left-heavy' | 'right-heavy' {
  const difference = p.mode === 'equality_hard' ? p.target - weightSum(b.weights)
    : p.mode === 'one_step' ? p.known + weightSum(b.weights) - p.total
    : p.parcels * p.target + (b.leftAside ? 0 : p.known) - (p.total - asideCount(b));
  return difference === 0 ? 'balanced' : difference > 0 ? 'left-heavy' : 'right-heavy';
}
export function stageSolved(p: WorkshopProblem, stage: WorkshopStage, b: WorkshopBoard): boolean {
  if (stage === 'separate') return separated(p, b);
  if (stage === 'share') return shared(p, b);
  if (stage === 'recompose') return weightSum(b.weights) === p.target && signature(b.weights) !== signature(b.first);
  return weightSum(b.weights) === p.target;
}
export function placeWorkshopWeight(b: WorkshopBoard, value: number, id: number): WorkshopBoard | null {
  if (!(TRAY as readonly number[]).includes(value) || !Number.isInteger(id) || b.weights.some((block) => block.id === id)
    || b.weights.length >= 40 || weightSum(b.weights) + value > 60) return null;
  return { ...b, weights: [...b.weights, { id, value }] };
}
export const removeWorkshopWeight = (b: WorkshopBoard, id: number): WorkshopBoard => ({ ...b, weights: b.weights.filter((block) => block.id !== id) });
export function moveWorkshopUnit(p: WorkshopProblem, b: WorkshopBoard, index: number, destination: number, stage: WorkshopStage): WorkshopBoard | null {
  if (!Number.isInteger(index) || index < 0 || index >= b.units.length || !Number.isInteger(destination)) return null;
  const from = b.units[index];
  if (from === destination) return null;
  if (stage === 'separate') {
    if (![-1, -2].includes(from) || ![-1, -2].includes(destination)) return null;
  } else if (stage === 'share') {
    if (from === -2 || destination < -1 || destination >= p.parcels) return null;
  } else return null;
  return { ...b, units: b.units.map((place, i) => i === index ? destination : place) };
}
export function scene(p: WorkshopProblem, b: WorkshopBoard): string {
  if (p.mode === 'equality_hard') return `Unnumbered left weight; chosen right blocks: ${b.weights.map((v) => v.value).join(', ') || 'none'}. First combination: ${b.first.map((v) => v.value).join(', ') || 'none'}. Scale ${workshopBalance(p, b)}.`;
  if (p.mode === 'one_step') return `Left known weight ${p.known}, added blocks ${b.weights.map((v) => v.value).join(', ') || 'none'}. Right known weight ${p.total}. Scale ${workshopBalance(p, b)}.`;
  return `${p.parcels} identical sealed parcels. Known loose weight ${p.known}; moved aside on left: ${b.leftAside}. Original right weight ${p.total}; right units set aside: ${asideCount(b)}. Group counts: ${groupCounts(p, b).join(', ')}. Scale ${workshopBalance(p, b)}.`;
}
export function workshopFeedback(p: WorkshopProblem, stage: WorkshopStage, b: WorkshopBoard): string {
  if (stage === 'share') return 'Move the weight units into equal groups, one group for each parcel.';
  if (stage === 'recompose' && workshopBalance(p, b) === 'balanced') return 'That balances. Use a different combination from your first one.';
  if (stage === 'separate' && workshopBalance(p, b) === 'balanced') return 'Set the known loose weight aside, and set aside the same amount from the other side.';
  const state = workshopBalance(p, b);
  return state === 'balanced' ? 'The scale balances.' : `The ${state === 'left-heavy' ? 'left' : 'right'} side is heavier. Watch what changes as you move a weight.`;
}
function makeWeights(target: number, alternativeTo: WorkshopWeight[] = []): WorkshopWeight[] {
  const values: number[] = [];
  let remaining = target;
  for (const value of [...TRAY].reverse()) while (remaining >= value) { values.push(value); remaining -= value; }
  if (values.join(',') === [...alternativeTo].map((v) => v.value).sort((a, b) => b - a).join(',')) {
    return Array.from({ length: target }, (_, i) => ({ id: -i - 1, value: 1 }));
  }
  return values.map((value, i) => ({ id: -i - 1, value }));
}
/** Used only after a capped hand turn, with explicit tutor attribution. */
export function modelStage(p: WorkshopProblem, stage: WorkshopStage, b: WorkshopBoard): WorkshopBoard {
  if (stage === 'separate') return { ...b, leftAside: true, units: b.units.map((_, i) => i < p.known ? -2 : -1) };
  if (stage === 'share') return { ...b, leftAside: p.known > 0, units: b.units.map((_, i) => i < p.known ? -2 : Math.floor((i - p.known) / p.target)) };
  return { ...b, weights: makeWeights(p.target, stage === 'recompose' ? b.first : []) };
}
export function enterWorkshopStage(p: WorkshopProblem, stage: WorkshopStage, b: WorkshopBoard): { board: WorkshopBoard; modeled: boolean } {
  if (stage === 'recompose' && b.first.length === 0) return { board: { ...b, first: [...b.weights], weights: [] }, modeled: false };
  const prerequisite: Partial<Record<WorkshopStage, WorkshopStage>> = { sum: 'compose', resum: 'recompose', added: 'complete', remaining: 'separate', each: 'share' };
  const needed = prerequisite[stage];
  if (needed && !stageSolved(p, needed, b)) return { board: modelStage(p, needed, b), modeled: true };
  return { board: b, modeled: false };
}
export const workshopExpected = (p: WorkshopProblem, stage: WorkshopStage) => stage === 'remaining' ? p.parcels * p.target : p.target;
export const workshopMode = (mode: BalanceScaleChallengeType): mode is WorkshopMode => (WORKSHOP_MODES as readonly string[]).includes(mode);
