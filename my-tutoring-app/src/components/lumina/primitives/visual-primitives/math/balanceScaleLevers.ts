/**
 * The in-item levers on balance-scale's spoken steps, as one lever set (`components/live-activity/bossLevers.ts`;
 * class sweep 2026-10-08, report qa/eval-reports/balance-scale-levers-2026-10-08.md). No real-learner evidence: the
 * misses are what `balanceSpokenMisses` names on each spoken step. Hands steps check no miss (an incomplete move is
 * exploration) and the explanation is judged on meaning, so neither offers a lever.
 *
 * Help (the problem is unchanged):
 * - `unit_cells` (layout): the learner's weights also drawn as unit squares in one row, a gap after every fifth. Sum
 *   steps (total, sum, resum, added). Answers one off. No count is printed.
 * - `balance_model` (model): a small level model scale beside the learner's, the same weight k on each side — a
 *   different balance, solved. Weight inference (equality infer, equality_hard infer). k is never the item's answer
 *   or any session answer.
 * - `part_whole_bar` (layout): one_step. A bar as long as the right side's weight split into the known left weight
 *   and an unlabelled part. Answers the whole, the given part, both added. The unknown part has no label.
 * - `one_group` (marks): share modes, each and infer. Group 1 and its parcel are ringed; the other groups fade.
 * - `on_scale_only` (marks): two_step remaining. The set-aside weights fade and one outline goes round all the parcels.
 *
 * Simplify (`easier`: the same step, ungraded, then the full item comes back blank):
 * - `two_blocks`: a sum step on a two-block load. `one_block`: an inference step on a one-block load.
 *   `smaller_load`: one_step with a single added block. `fewer_parcels`: a share mode with 2 parcels and a small
 *   share. The practice item's spoken answers are never the item's or any session answer, and its shape is never the
 *   learner's item. Each keeps the mode's floor (one parcel for one_step, 2+ parcels for the share modes, a known
 *   loose weight for two_step).
 *
 * On an item that is already the plainest shape (no simpler step exists) the step's help lever also answers the
 * far-off misses (`answersOn`), so every miss on every item has a lever.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { balanceScaleCard } from './balanceScale.card';
import { demonstratedBoard, equalityItems, WEIGHTS, type EqualityBoard, type EqualityItem } from './balanceEqualityModel';
import { isHands, STAGES, TRAY, initialWorkshopBoard, modelStage, workshopItems,
  type WorkshopBoard, type WorkshopItem, type WorkshopProblem, type WorkshopWeight } from './balanceWorkshopModel';
import { expectedOf, isEqualityItem, type BalanceItem } from './balanceScaleWorkspace';

export const UNIT_CELLS = 'unit_cells';
export const BALANCE_MODEL = 'balance_model';
export const PART_WHOLE = 'part_whole_bar';
export const ONE_GROUP = 'one_group';
export const ON_SCALE = 'on_scale_only';
export const TWO_BLOCKS = 'two_blocks';
export const ONE_BLOCK = 'one_block';
export const SMALLER_LOAD = 'smaller_load';
export const FEWER_PARCELS = 'fewer_parcels';

const ONE_OFF = ['one_short', 'one_over'] as const;
const FAR_OFF = ['short_by_more', 'over_by_more'] as const;

/** The lesson facts a lever reads: every spoken answer of the session, and how many blocks the learner's load has. */
export interface BalanceLeverCtx { used: ReadonlySet<number>; blocks: number }

/** Every spoken answer of a session: the numbers a lever or a practice item must never show or ask for. */
export const sessionAnswers = (items: readonly BalanceItem[]): Set<number> =>
  new Set(items.map(expectedOf).filter((n): n is number => n !== null));

/** The lever context for a session item: its answers, and the blocks on the learner's board. */
export const balanceLeverCtx = (items: readonly BalanceItem[], blocks: number): BalanceLeverCtx =>
  ({ used: sessionAnswers(items), blocks });

/** Weights from `tray` that add to `total`, largest first (the surfaces' own demonstration rule). */
export function greedy(total: number, tray: readonly number[]): number[] {
  const out: number[] = [];
  let left = total;
  for (const w of [...tray].sort((a, b) => b - a)) while (left >= w) { out.push(w); left -= w; }
  return out;
}
const blocks = (values: number[]): WorkshopWeight[] => values.map((value, i) => ({ id: -i - 1, value }));

/** The model scale's weight: no session answer, so the model never shows one. Null when none is free. */
export function modelWeight(answer: number, used: ReadonlySet<number>): number | null {
  return [4, 3, 6, 2, 7, 8, 9, 5, 10, 11, 12, 13, 14].find(k => k !== answer && !used.has(k)) ?? null;
}

/** Below the item's answer first (simpler), then above it; never a session answer or the answer itself. */
const pick = (candidates: number[], answer: number, used: ReadonlySet<number>, below = false) => {
  const free = candidates.filter(t => t !== answer && !used.has(t));
  const lower = free.filter(t => t < answer).sort((a, b) => b - a);
  return lower[0] ?? (below ? null : free.filter(t => t > answer).sort((a, b) => a - b)[0] ?? null);
};
const twoBlockTotals = (tray: readonly number[]) =>
  Array.from({ length: 19 }, (_, i) => i + 2).filter(t => greedy(t, tray).length === 2);

// ── Practice problems (simplify) ─────────────────────────────────────────────

/** A sum step: a two-block load, below the item's total. Offered from three blocks. */
export function twoBlocksTarget(answer: number, loadBlocks: number, used: ReadonlySet<number>, tray: readonly number[]): number | null {
  return loadBlocks < 3 ? null : pick(twoBlockTotals(tray), answer, used, true);
}
/** An inference step: a single numbered block. Offered from two blocks. */
export function oneBlockTarget(answer: number, loadBlocks: number, used: ReadonlySet<number>, tray: readonly number[]): number | null {
  return loadBlocks < 2 ? null : pick(tray.filter(t => t > 1 && t <= 10), answer, used);
}
/** one_step: the same known weight with one block to add, smaller than the item's missing part. From two added blocks. */
export function smallerLoadProblem(item: WorkshopItem, loadBlocks: number, used: ReadonlySet<number>): WorkshopProblem | null {
  const p = item.problem;
  if (p.mode !== 'one_step' || loadBlocks < 2) return null;
  const t = pick(TRAY.filter(v => v > 1), p.target, used, true);
  return t === null ? null : { ...p, id: `${p.id}~simpler`, target: t, total: p.known + t, reverse: false };
}
/** Share modes: two parcels and a small share, smaller in parcels or share than the item. */
export function fewerParcelsProblem(item: WorkshopItem, used: ReadonlySet<number>): WorkshopProblem | null {
  const p = item.problem;
  if (p.parcels < 2) return null;
  const known = p.mode === 'one_step_hard' ? 0 : Math.min(p.known, 2);
  // Smaller in shape: two parcels, and a load under the item's own (a share under the item's when it already has two).
  const share = [3, 2, 4, 5, 6].find(t => t !== p.target && !used.has(t) && !used.has(2 * t)
    && (p.parcels > 2 ? 2 * t < p.parcels * p.target : t < p.target));
  return share === undefined ? null
    : { ...p, id: `${p.id}~simpler`, target: share, parcels: 2, known, total: 2 * share + known };
}

/** The board a workshop practice step opens on: every hands step before it done, as the surface's own model does it. */
export function practiceBoard(p: WorkshopProblem, step: WorkshopItem['step']): WorkshopBoard {
  if (p.mode === 'equality_hard') {
    // The step's own row is the simpler load; a first combination, when the step has one, is all ones.
    const ones = blocks(Array(p.target).fill(1));
    return step === 'sum' ? { weights: blocks(greedy(p.target, TRAY)), first: [], leftAside: false, units: [] }
      : { weights: blocks(greedy(p.target, TRAY)), first: ones, leftAside: false, units: [] };
  }
  let board = initialWorkshopBoard(p);
  for (const stage of STAGES[p.mode]) {
    if (stage === step) break;
    if (isHands(stage)) board = modelStage(p, stage, board);
  }
  return board;
}

/** The board an equality practice step opens on: the tutor's matching load. */
export const equalityPracticeBoard = (item: EqualityItem): EqualityBoard => demonstratedBoard(item.problem);

/** The same step on a simpler problem, as an ungraded practice item (`<id>~simpler`), with the parent's tier. */
function practiceItem(item: BalanceItem, target: number | null, problem?: WorkshopProblem | null): BalanceItem | null {
  if (isEqualityItem(item)) {
    if (target === null) return null;
    const step = equalityItems([{ ...item.problem, id: `${item.problem.id}~simpler`, target }]).find(i => i.step === item.step);
    return step ? { ...step, id: `${item.id}~simpler`, tier: item.tier } : null;
  }
  const p = problem ?? (target === null ? null : { ...item.problem, id: `${item.problem.id}~simpler`, target, total: target });
  const step = p && workshopItems([p]).find(i => i.step === item.step);
  return step ? { ...step, id: `${item.id}~simpler`, tier: item.tier } : null;
}

const SUM_STEPS = new Set(['total', 'sum', 'resum']);
const isSum = (item: BalanceItem) => SUM_STEPS.has(item.step) || item.step === 'added';
const isInfer = (item: BalanceItem) => item.step === 'infer' && item.problem.mode !== 'one_step_hard'
  && !(!isEqualityItem(item) && item.problem.parcels > 1);
const trayOf = (item: BalanceItem) => (isEqualityItem(item) ? WEIGHTS : TRAY);

/** The practice item the step's simplify lever opens, or null when the item is already the plainest shape. */
function simplerOf(lever: string, item: BalanceItem, ctx: BalanceLeverCtx): BalanceItem | null {
  const t = item.problem.target;
  switch (lever) {
    case TWO_BLOCKS: return SUM_STEPS.has(item.step) ? practiceItem(item, twoBlocksTarget(t, ctx.blocks, ctx.used, trayOf(item))) : null;
    case ONE_BLOCK: return isInfer(item) ? practiceItem(item, oneBlockTarget(t, ctx.blocks, ctx.used, trayOf(item))) : null;
    case SMALLER_LOAD: return !isEqualityItem(item) && expectedOf(item) !== null
      ? practiceItem(item, null, smallerLoadProblem(item, ctx.blocks, ctx.used)) : null;
    case FEWER_PARCELS: return !isEqualityItem(item) && expectedOf(item) !== null && item.problem.parcels > 1
      ? practiceItem(item, null, fewerParcelsProblem(item, ctx.used)) : null;
    default: return null;
  }
}
const SIMPLIFY = [TWO_BLOCKS, ONE_BLOCK, SMALLER_LOAD, FEWER_PARCELS];
/** Whether some simplify lever has a simpler step for this item: if not, the help lever also answers far-off misses. */
const hasSimpler = (item: BalanceItem, ctx: BalanceLeverCtx) => SIMPLIFY.some(id => simplerOf(id, item, ctx) !== null);
const plus = (base: readonly string[], item: BalanceItem, ctx: BalanceLeverCtx, extra: readonly string[] = []) =>
  [...base, ...extra, ...(hasSimpler(item, ctx) ? [] : FAR_OFF)];

const known = (item: BalanceItem) => (isEqualityItem(item) ? 0 : item.problem.known);
const total = (item: BalanceItem) => (isEqualityItem(item) ? item.problem.target : item.problem.total);
const parcels = (item: BalanceItem) => (isEqualityItem(item) ? 1 : item.problem.parcels);
const EASIER_DOES = 'It is not graded; the full item comes back after it.';

export const BALANCE_LEVERS = leverSet<BalanceItem, BalanceLeverCtx>({
  modeOf: item => item.problem.mode,
  missesOf: mode => balanceScaleCard.modes[mode].misses,
  // The model lever's tier is the lesson's; a payload with none teaches at medium (a model after a miss).
  support: { tier: item => item.tier ?? 'medium', different: 'a different balanced scale', own: "this scale's hidden weight" },
  specs: [
    { id: PART_WHOLE, type: 'layout', modes: ['one_step'],
      answers: ['said_whole', 'said_given_part', 'added_both', ...ONE_OFF, ...FAR_OFF],
      answersOn: (item, ctx) => (item.step === 'added' ? ['said_whole', 'said_given_part', 'added_both']
        : plus(['said_whole', 'said_given_part', 'added_both'], item, ctx, ONE_OFF)),
      when: item => `The learner gives the whole load, the ${known(item)} already there, or both together.`,
      does: item => `Draws a bar as long as the right side's ${total(item)}, split into the left's ${known(item)} and an unlabelled part. The unlabelled part has no number.`,
      content: item => (item.step === 'added' || item.step === 'relate' ? true : null),
      fact: (_c, item) => `A bar as long as the right side's ${total(item)} is split into the left's known ${known(item)} and an unlabelled part.` },
    { id: UNIT_CELLS, type: 'layout', modes: ['equality', 'equality_hard', 'one_step'], answers: [...ONE_OFF, ...FAR_OFF],
      answersOn: (item, ctx) => plus(ONE_OFF, item, ctx),
      when: 'The learner loses count adding the weights.',
      does: 'Draws the same weights again as unit squares in a single row, with a gap after every fifth square. No total is printed; the learner counts or adds.',
      content: item => (isSum(item) ? true : null),
      fact: (_c, item) => `The ${isEqualityItem(item) ? 'right-side' : 'chosen'} weights are also drawn as unit squares in a single row, with a gap after every fifth square.` },
    { id: BALANCE_MODEL, type: 'model', modes: ['equality', 'equality_hard'], answers: [...ONE_OFF, ...FAR_OFF],
      answersOn: (item, ctx) => plus(ONE_OFF, item, ctx),
      when: 'The learner does not use the balance to find the left weight.',
      does: (item, ctx) => `Shows a small model scale with a ${modelWeight(item.problem.target, ctx.used)} weight on each side, level. Talk about the model only.`,
      content: (item, ctx) => (item.step === 'infer' ? modelWeight(item.problem.target, ctx.used) : null),
      fact: k => `A small model scale beside the learner's has a ${k} weight on each side, and it is level.` },
    { id: ONE_GROUP, type: 'marks', modes: ['one_step_hard', 'two_step_intro', 'two_step'],
      answers: ['said_remaining', 'said_parcels', 'said_whole', ...ONE_OFF, ...FAR_OFF],
      answersOn: (item, ctx) => plus(['said_remaining', 'said_parcels', 'said_whole'], item, ctx, ONE_OFF),
      when: 'The learner gives the weight before sharing, the number of parcels, or loses count of one group.',
      does: 'Rings group 1 and its parcel and fades the other groups. No count is printed; the learner counts that one group.',
      content: item => (item.step === 'each' || item.step === 'infer' ? true : null),
      fact: 'Group 1 and its parcel are ringed; the other groups are faded.' },
    { id: ON_SCALE, type: 'marks', modes: ['two_step_intro', 'two_step'],
      answers: ['said_whole', 'said_change', 'said_one_parcel', ...ONE_OFF, ...FAR_OFF],
      answersOn: (item, ctx) => plus(['said_whole', 'said_change', 'said_one_parcel'], item, ctx, ONE_OFF),
      when: 'The learner counts the set-aside weight, the whole side, or one parcel instead of what the parcels share.',
      does: 'Fades both set-aside areas and draws one outline round all the parcels together. No count is printed.',
      content: item => (item.step === 'remaining' ? true : null),
      fact: (_c, item) => `Both set-aside areas are faded, and one outline goes round all ${parcels(item)} parcels together.` },
    { id: TWO_BLOCKS, type: 'easier', modes: ['equality', 'equality_hard'], answers: [...FAR_OFF],
      when: 'The learner is far off adding this many weights.',
      does: `Opens the same question on a load of just two weights first. ${EASIER_DOES}`,
      content: (item, ctx) => simplerOf(TWO_BLOCKS, item, ctx) },
    { id: ONE_BLOCK, type: 'easier', modes: ['equality', 'equality_hard'], answers: [...FAR_OFF],
      when: 'The learner is far off finding the left weight.',
      does: `Opens the same question on a scale balanced by one numbered weight first. ${EASIER_DOES}`,
      content: (item, ctx) => simplerOf(ONE_BLOCK, item, ctx) },
    { id: SMALLER_LOAD, type: 'easier', modes: ['one_step'], answers: [...FAR_OFF],
      when: 'The learner is far off on the missing part.',
      does: item => `Opens the same question with the same ${known(item)} and only one block to add first. ${EASIER_DOES}`,
      content: (item, ctx) => simplerOf(SMALLER_LOAD, item, ctx) },
    { id: FEWER_PARCELS, type: 'easier', modes: ['one_step_hard', 'two_step_intro', 'two_step'], answers: [...FAR_OFF],
      when: 'The learner is far off sharing this load.',
      does: `Opens the same question with two parcels and a smaller load first. ${EASIER_DOES}`,
      content: (item, ctx) => simplerOf(FEWER_PARCELS, item, ctx) },
  ],
});
