/**
 * balance-scale challenges from item spaces (service/itemSpace, skill /add-item-space).
 *
 * The tier changed only the on-screen aids; every tier drew from the same random builders (x 1..25 and
 * b 1..20 for one_step at easy and hard alike). With a tier, code now picks each mode's numbers:
 *   - one_step (complete a known load): add-sub-20, additions with the change unknown (a + ? = c). A
 *     start-unknown item puts the same scale on screen, so its word-problem difficulty would not apply.
 *   - one_step_hard (share among parcels): mult-div-facts, c ÷ k = ? with k the parcel count, 2..6 (the
 *     scale draws six parcels), one parcel 2..9. Only three such facts are hard for the strand (6 × 7,
 *     6 × 8, 6 × 9), so `tierPick` takes thirds of the drawable facts.
 *   - two_step_intro, two_step (unpack and share): two-step-equations, px + q = r. Every unit of r is
 *     dragged on screen, so intro keeps r ≤ 40 and two_step r ≤ 60 (the builders' own loads were 29, 58);
 *     intro also keeps p ≤ 4 as its builder did.
 *   - equality, equality_hard (match one unnumbered weight): the difficulty is one ordered quantity,
 *     the target, so each tier takes its window of targets (`tierWindow`), no space.
 * A space path ships only when every challenge of the session came from it; otherwise the builders run.
 */
import { tierWindow, type ItemSpaceId } from '../itemSpace';
import type { AddSub20Item } from '../itemSpace/addSub20';
import type { MultDivItem } from '../itemSpace/multDivFacts';
import { twoStepTotal, type TwoStepItem } from '../itemSpace/twoStepEquations';
import type { BalanceScaleChallenge, BalanceScaleObject } from '../../primitives/visual-primitives/math/BalanceScale';

type Mode = BalanceScaleChallenge['type'];
export type BalanceSides = Pick<BalanceScaleChallenge, 'leftSide' | 'rightSide' | 'variableValue'>;

/** The space each mode draws from, and the task the resolver reads (scoped by the lesson). */
export const BALANCE_SPACES: Partial<Record<Mode, { space: ItemSpaceId; task: string }>> = {
  one_step: { space: 'add-sub-20', task: 'adds weight to the lighter pan of a balance to complete a known load: finds the missing addend that makes a known weight equal a total (a + ? = c) within 20' },
  one_step_hard: { space: 'mult-div-facts', task: 'shares a known weight equally among identical parcels on a balance to find one parcel weight: division facts as equal sharing (c ÷ k = ?)' },
  two_step_intro: { space: 'two-step-equations', task: 'sets known loose weight aside from both pans of a balance, then shares what is left among identical parcels: a two-step equation px + q = r' },
  two_step: { space: 'two-step-equations', task: 'sets known loose weight aside from both pans of a balance, then shares what is left among identical parcels: a two-step equation px + q = r' },
};

const VAR = (label: string): BalanceScaleObject => ({ value: 1, label, isVariable: true });
const CONST = (n: number): BalanceScaleObject => ({ value: n, label: String(n) });

/** The scale an item puts on screen, or null when the mode cannot draw it. */
export function balanceSidesOf(mode: Mode, item: unknown): BalanceSides | null {
  if (mode === 'one_step') {
    const it = item as AddSub20Item;
    if (it.steps.length !== 1 || it.steps[0].op !== '+' || it.unknown !== 'change') return null;
    const { a, b } = it.steps[0];
    // The total stands as one weight: a decomposed right pan would print the answer as a block.
    return { leftSide: [VAR('x'), CONST(a)], rightSide: [CONST(a + b)], variableValue: b };
  }
  if (mode === 'one_step_hard') {
    const it = item as MultDivItem;
    // k × ? = c puts the same scale on screen; taking both would count one fact twice in `tierPick`.
    if (it.form !== 'quotient' || it.a < 2 || it.a > 6 || it.b < 2 || it.b > 9) return null;
    return { leftSide: Array.from({ length: it.a }, () => VAR('x')), rightSide: [CONST(it.a * it.b)], variableValue: it.b };
  }
  if (mode === 'two_step_intro' || mode === 'two_step') {
    const it = item as TwoStepItem;
    const r = twoStepTotal(it);
    if (mode === 'two_step_intro' ? it.p > 4 || r > 40 : r > 60) return null;
    return { leftSide: [...Array.from({ length: it.p }, () => VAR('x')), CONST(it.q)], rightSide: [CONST(r)], variableValue: it.x };
  }
  return null;
}

/** Targets for a matching mode at a tier: `count` distinct values from the tier's window. */
export function equalityTargets(mode: 'equality' | 'equality_hard', tier: 'easy' | 'medium' | 'hard', count: number,
  rand: () => number = Math.random): number[] {
  // equality matches 2..20 with weights 1, 2, 3, 5; equality_hard needs at least 3 to make two ways.
  const all = Array.from({ length: mode === 'equality' ? 19 : 18 }, (_, i) => i + (mode === 'equality' ? 2 : 3));
  return tierWindow(all, tier, count).sort(() => rand() - 0.5).slice(0, count).sort((x, y) => x - y);
}

/** A matching challenge: one unnumbered weight on the left, its value the target. */
export const equalitySides = (target: number): BalanceSides => ({ leftSide: [VAR('?')], rightSide: [CONST(target)], variableValue: target });
