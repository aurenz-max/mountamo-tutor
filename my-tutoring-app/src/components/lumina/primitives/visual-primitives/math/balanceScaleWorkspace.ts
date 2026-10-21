/**
 * What the tutor and the observer read on a balance-scale step: the session's steps, the ask, a spoken step's key and
 * known misses, and the scene. Pure and React-free: the boss, the component and the probes read it.
 *
 * A session is one challenge type. `equality` runs on the match-and-add scale (build, total, infer); the other five
 * modes run on the weight workshop (`balanceWorkshopModel.ts`). Hands steps are checked by the scale, so their key (the
 * hidden weight, the parcel weight) never reaches the tutor.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { numberMisses, offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { BalanceScaleData } from './BalanceScale';
import { describeBoard, equalityItems, equalityProblem, usesEqualityPilot, WEIGHTS, type EqualityBoard, type EqualityItem }
  from './balanceEqualityModel';
import { isHands, scene, TRAY, usesBalanceWorkshop, workshopExpected, workshopItems, workshopProblem,
  type WorkshopBoard, type WorkshopItem } from './balanceWorkshopModel';

export { BALANCE_MISSES_BY_MODE, type SpokenBalanceMiss } from './balanceScale.card';

/** One step of a session, on either surface. */
export type BalanceItem = EqualityItem | WorkshopItem;

export type BalanceSurface = 'equality' | 'workshop';
/** The surface a session runs on; null for a session that mixes challenge types (no mode can run it). */
export const balanceSurface = (data: BalanceScaleData): BalanceSurface | null =>
  usesBalanceWorkshop(data) ? 'workshop' : usesEqualityPilot(data) ? 'equality' : null;

const tierOf = (data: BalanceScaleData): SupportTier | undefined => data.supportTier;

/** The match-and-add session's steps, each carrying the lesson's support tier. Throws on content it cannot ask. */
export const equalitySession = (data: BalanceScaleData): EqualityItem[] =>
  equalityItems((data.challenges ?? []).map(equalityProblem)).map(item => ({ ...item, tier: tierOf(data) }));

/** The weight workshop's steps, each carrying the lesson's support tier. Throws on content it cannot ask. */
export const workshopSession = (data: BalanceScaleData): WorkshopItem[] =>
  workshopItems((data.challenges ?? []).map(workshopProblem)).map(item => ({ ...item, tier: tierOf(data) }));

/** The session's steps for whichever surface the data routes to; none for a mixed session. Throws on bad content. */
export function balanceItems(data: BalanceScaleData): BalanceItem[] {
  const surface = balanceSurface(data);
  return surface === 'equality' ? equalitySession(data) : surface === 'workshop' ? workshopSession(data) : [];
}

export const isEqualityItem = (item: BalanceItem): item is EqualityItem => !('known' in item.problem);

/** The step an item is, as the card names it and the scene publishes it (`kind`). */
export const stepOf = (item: BalanceItem): string => item.step;

/** A step the learner does on the scale, which the scale checks. */
export const isHandsStep = (item: BalanceItem) => (isEqualityItem(item) ? item.step === 'build' : isHands(item.step));

/** The number a spoken number step asks for; null on a hands step or the explanation. */
export function expectedOf(item: BalanceItem): number | null {
  if (isHandsStep(item) || item.step === 'explain') return null;
  return isEqualityItem(item) ? item.problem.target : workshopExpected(item.problem, item.step);
}

/** What the learner is asked on one step. Never the answer. */
export const balanceAsk = (item: BalanceItem): string => item.actionContract.instruction;

/** What a correct two_step explanation says; the tutor judges its meaning. */
export const EXPLAIN_MEANING = 'The parcels are identical, so they weigh the same; sharing the remaining weight into one equal group per parcel gives one parcel\'s weight, which is x.';

/** The harness's explanation answers: one with the idea, one with only a number. */
export const explainHarnessAnswers = {
  correct: 'The parcels weigh the same, so each one gets one equal group, and one group is what x weighs.',
  plainWrong: 'Because it is seven.',
};

/** The key a spoken step is judged against (`spokenKeyText` writes it); null on a step the scale checks. */
export function balanceKey(item: BalanceItem): SpokenKey | null {
  if (item.step === 'explain') {
    return { answer: explainHarnessAnswers.correct, alsoAccept: [],
      meaning: { idea: EXPLAIN_MEANING, notIt: 'a number alone, or "because it balances" with no equal groups' } };
  }
  const n = expectedOf(item);
  return n === null ? null : { answer: String(n), alsoAccept: [] };
}

/** What the ask says by design: the relate step names the known weight and the whole load ("3 and what make 7?"). */
export function balanceGiven(item: BalanceItem): string[] {
  if (isEqualityItem(item) || item.step !== 'relate') return [];
  return [String(item.problem.known), String(item.problem.total)];
}

/**
 * A spoken step's known wrong answers, in precedence order, for the `spoken_miss` observer: the other numbers of this
 * problem (the whole load, the known weight, the weight before sharing, one parcel for all of them, the number of
 * parcels), then the off-by misses. The equality steps and the sums have only the off-by misses; the explanation and
 * the hands steps have none.
 */
export function balanceSpokenMisses(item: BalanceItem): KnownMiss[] {
  const a = expectedOf(item);
  if (a === null) return [];
  if (isEqualityItem(item)) return offByMisses(a, `the ${a} the weights add to`);
  const p = item.problem;
  const own = (() => {
    switch (item.step) {
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

// ── Scenes: only this primitive's own facts (how to answer is the card's `moves`) ──

/** The match-and-add scale as the tutor reads it. The load is what the build step is about; its total stays unsaid. */
export function equalityScene(item: EqualityItem, board: EqualityBoard): SceneOf {
  return { objects: [], facts: {
    kind: item.step, scale: describeBoard(item.problem, board), trayWeights: WEIGHTS.join(', '),
    ...(item.step === 'build' ? { weightsOnRight: board.blocks.length }
      : { additionRow: 'The right-side weights are gathered into an addition row with no total printed.' }),
  } };
}

/** The weight workshop as the tutor reads it. */
export function workshopScene(item: WorkshopItem, board: WorkshopBoard): SceneOf {
  return { objects: [], facts: {
    mode: item.problem.mode, kind: item.step, scale: scene(item.problem, board),
    ...(item.problem.parcels === 1 ? { trayWeights: TRAY.join(', ') } : {}),
  } };
}

// ── Harness answers (the boss's drive) ────────────────────────────────────────

/** Weights from `tray` that add to `total`, largest first. */
export function weightsFor(total: number, tray: readonly number[]): number[] {
  const out: number[] = [];
  let left = total;
  for (const w of [...tray].sort((a, b) => b - a)) while (left >= w) { out.push(w); left -= w; }
  return out;
}
