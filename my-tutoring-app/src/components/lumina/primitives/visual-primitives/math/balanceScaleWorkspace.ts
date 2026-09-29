/**
 * Balance scale on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B1).
 *
 * Pure: the three surfaces and any probe read the same assignments and scenes. The
 * default export routes by data: `equality` sessions to the match-and-add surface,
 * the other five homogeneous modes to the weight workshop, and anything else to the
 * plain equation solver. Hands steps and the solver's typed x are checked by code, so
 * the tutor is never handed the left weight, the parcel weight or x.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberMisses, offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { BalanceScaleChallenge, BalanceScaleData, BalanceScaleObject } from './BalanceScale';
import { describeBoard, equalityItems, equalityProblem, usesEqualityPilot, WEIGHTS, type EqualityBoard, type EqualityItem }
  from './balanceEqualityModel';
import { isHands, scene, TRAY, usesBalanceWorkshop, workshopAsk, workshopExpected, workshopItems, workshopProblem,
  type WorkshopBoard, type WorkshopItem } from './balanceWorkshopModel';

export type BalanceSurface = 'equality' | 'workshop' | 'plain';
export const balanceSurface = (data: BalanceScaleData): BalanceSurface =>
  usesBalanceWorkshop(data) ? 'workshop' : usesEqualityPilot(data) ? 'equality' : 'plain';

/** The session's asks for whichever surface the data routes to. Throws on content that surface cannot ask. */
export function balanceTasks(data: BalanceScaleData): string[] {
  const challenges = data.challenges ?? [];
  switch (balanceSurface(data)) {
    case 'equality': return equalityItems(challenges.map(equalityProblem)).map(i => equalityAssignment(i).task);
    case 'workshop': return workshopItems(challenges.map(workshopProblem)).map(i => workshopAssignment(i).task);
    default: return challenges.map((c, i) => plainAssignment(c, `bs-${i + 1}`).task);
  }
}

// ── Match and add (`equality`) ────────────────────────────────────────────────

/** What a wrong spoken weight shows (handoff 20 Part B). */
export type SpokenBalanceMiss = OffByMiss | 'said_whole' | 'said_given_part' | 'added_both' | 'said_change' | 'said_one_parcel'
  | 'said_remaining' | 'said_parcels';

/**
 * A spoken step's known wrong answers, in precedence order, for the `spoken_miss` observer: the other numbers of this
 * problem (the whole load, the known weight, the weight before sharing, one parcel for all of them, the number of
 * parcels), then the off-by misses. The equality steps and the sums have only the off-by misses; the explanation has none.
 */
export function balanceSpokenMisses(item: EqualityItem | WorkshopItem): KnownMiss[] {
  const step = item.step;
  if (step === 'build' || step === 'explain' || isHands(step as WorkshopItem['step'])) return [];
  if (!('known' in item.problem)) return offByMisses(item.problem.target, `the ${item.problem.target} the weights add to`);
  const p = item.problem, a = workshopExpected(p, step as WorkshopItem['step']);
  const own = (() => {
    switch (step) {
      case 'added': case 'relate': return numberMisses(a, [
        { id: 'said_whole', value: p.total, pattern: n => `The right side weighs ${n}. The learner's answer is ${n}, the whole load, not the part added to the ${p.known}.` },
        { id: 'said_given_part', value: p.known, pattern: n => `The left already had ${n}. The learner's answer is ${n}, that known weight again, not the weight added.` },
        { id: 'added_both', value: p.total + p.known, pattern: n => `The numbers are ${p.known} and ${p.total}. The learner's answer is ${n}, those two added together.` }]);
      case 'remaining': return numberMisses(a, [
        { id: 'said_whole', value: p.total, pattern: n => `The side without parcels weighs ${n} before anything is set aside. The learner's answer is ${n}, that whole side, with nothing set aside.` },
        { id: 'said_change', value: p.known, pattern: n => `${n} was set aside from each side. The learner's answer is ${n}, the weight set aside, not what is left for the parcels.` },
        { id: 'said_one_parcel', value: p.parcels > 1 ? p.target : undefined, pattern: n => `The ${p.parcels} parcels together weigh ${a}. The learner's answer is ${n}, one parcel's weight, not all the parcels together.` }]);
      case 'each': case 'infer': return numberMisses(a, [
        { id: 'said_remaining', value: p.parcels > 1 ? p.parcels * p.target : undefined, pattern: n => `The parcels together weigh ${n}, shared into ${p.parcels} equal groups. The learner's answer is ${n}, the weight before it is shared.` },
        { id: 'said_parcels', value: p.parcels > 1 ? p.parcels : undefined, pattern: n => `There are ${n} parcels and ${n} equal groups. The learner's answer is ${n}, how many groups, not the weight in one.` },
        { id: 'said_whole', value: p.known > 0 ? p.total : undefined, pattern: n => `The side without parcels weighs ${n} in all. The learner's answer is ${n}, that whole side, before anything is set aside or shared.` }]);
      default: return [];
    }
  })();
  return [...own, ...offByMisses(a, `the ${a} asked for`)];
}

export function equalityAssignment(item: EqualityItem): TeachingAssignment {
  const task = item.actionContract.instruction;
  // The build step is checked by the scale; its key, the left weight, stays off the packet.
  if (item.step === 'build') return { id: item.id, task, response: 'gesture' };
  const misses = balanceSpokenMisses(item);
  return { id: item.id, task, response: 'speech', expectedAnswer: String(item.problem.target), ...(misses.length ? { misses } : {}) };
}

export function equalityScene(item: EqualityItem, board: EqualityBoard): WorkspaceScene {
  return { objects: [], facts: {
    step: item.step, scale: describeBoard(item.problem, board), trayWeights: WEIGHTS.join(', '),
    // The load is what the build step is about; later steps ask for its total, which stays unsaid.
    ...(item.step === 'build' ? { weightsOnRight: board.blocks.length } : {}),
    constraints: item.step === 'build'
      ? 'The learner taps numbered weights onto the right pan. The scale commits the load once it balances and the learner stops; an unbalanced load is exploration, not an answer.'
      : 'The learner says the number. The right-side weights are gathered into an addition row with no total printed.',
  } };
}

// ── Weight workshop (the other five modes) ────────────────────────────────────

/** What a correct two_step explanation says; the observer judges meaning against it. */
export const EXPLAIN_MEANING = 'The parcels are identical, so they weigh the same; sharing the remaining weight into one equal group per parcel gives one parcel\'s weight, which is x.';

export function workshopAssignment(item: WorkshopItem): TeachingAssignment {
  const task = workshopAsk(item.problem, item.step);
  if (isHands(item.step)) return { id: item.id, task, response: 'gesture' };
  const misses = balanceSpokenMisses(item);
  return { id: item.id, task, response: 'speech',
    expectedAnswer: item.step === 'explain' ? EXPLAIN_MEANING : String(workshopExpected(item.problem, item.step)),
    ...(misses.length ? { misses } : {}) };
}

export function workshopScene(item: WorkshopItem, board: WorkshopBoard): WorkspaceScene {
  return { objects: [], facts: {
    mode: item.problem.mode, step: item.step, scale: scene(item.problem, board),
    ...(item.problem.parcels === 1 ? { trayWeights: TRAY.join(', ') } : {}),
    constraints: isHands(item.step)
      ? 'The learner moves weights or units with the controls. The activity checks the move once it is complete and the learner stops; an incomplete move is exploration, not an answer.'
      : item.step === 'explain' ? 'The learner explains aloud in their own words.' : 'The learner says the number.',
  } };
}

// ── Plain equation solver (heterogeneous sessions) ────────────────────────────

/** The component's own challenge id (`bs-<n>`) names the item. */
export function plainAssignment(challenge: BalanceScaleChallenge, id: string): TeachingAssignment {
  return { id, task: challenge.instruction, response: 'gesture' };
}

const side = (objects: readonly BalanceScaleObject[]) =>
  objects.map(o => o.isVariable ? o.label || 'x' : o.label || String(o.value)).join(' + ') || '0';

export interface PlainView { left: readonly BalanceScaleObject[]; right: readonly BalanceScaleObject[]; phase: string; steps: number }

/** The learner's typed value, in their terms. */
export const describeVerify = (typed: number) => `Typed x = ${typed}`;

export function plainScene(challenge: BalanceScaleChallenge, view: PlainView): WorkspaceScene {
  return { objects: [], facts: {
    kind: challenge.type, equationNow: `${side(view.left)} = ${side(view.right)}`, phase: view.phase, stepsTaken: view.steps,
    constraints: 'The learner removes matching blocks or applies an operation to both sides until x stands alone, then types x and presses Check; the scale checks the typed value.',
  } };
}

// ── Harness answers (liveJourneySpec) ─────────────────────────────────────────

/** Weights from `tray` that add to `total`, largest first. */
export function weightsFor(total: number, tray: readonly number[]): number[] {
  const out: number[] = [];
  let left = total;
  for (const w of [...tray].sort((a, b) => b - a)) while (left >= w) { out.push(w); left -= w; }
  return out;
}

export const explainHarnessAnswers = {
  correct: 'The parcels weigh the same, so each one gets one equal group, and one group is what x weighs.',
  plainWrong: 'Because it is seven.',
};
