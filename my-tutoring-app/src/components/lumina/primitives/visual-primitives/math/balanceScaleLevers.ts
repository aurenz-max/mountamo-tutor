/**
 * The in-item levers on balance-scale's spoken steps (`/add-support-tiers`, class sweep 2026-10-08; report
 * qa/eval-reports/balance-scale-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `balanceSpokenMisses` names on each spoken step (catalog `teachingWorkspace.misses`). Hands steps check no miss
 * (an incomplete move is exploration) and get no lever here.
 *
 * Help (the problem is unchanged):
 * - `unit_cells` (shown): the learner's right-side weights also drawn as unit squares in one row, a gap after every
 *   fifth. Sum steps (total, sum, resum, added). Answers one off. No count is printed.
 * - `balance_model` (both): a small level model scale beside the learner's, the same weight k on each side. Weight
 *   inference (equality infer, equality_hard infer). Leak rule: k is never the item's answer or any session answer.
 * - `part_whole_bar` (shown): one_step. A bar as long as the right side's weight split into the known left weight
 *   and an unlabelled part. Answers the whole, the given part, both added. Leak rule: the unknown part has no label.
 * - `one_group` (shown): share modes, each and infer. Group 1 and its parcel are ringed; the other groups fade.
 *   Answers the weight before sharing, the number of parcels, the whole side, one off. No count is printed.
 * - `on_scale_only` (shown): two_step remaining. The set-aside weights fade and one outline goes round all the
 *   parcels. Answers the whole side, the set-aside weight, one parcel. No count is printed.
 *
 * Simplify (the same step, ungraded, then the full item comes back blank):
 * - `two_blocks`: a sum step on a two-block load. `one_block`: an inference step on a one-block load.
 *   `smaller_load`: one_step with a single added block. `fewer_parcels`: a share mode with 2 parcels and a small
 *   share. Leak rule: the practice item's spoken answers are never the item's or any session answer, and its
 *   shape is never the learner's item. Each keeps the mode's floor (one parcel for one_step, 2+ parcels for the
 *   share modes, a known loose weight for two_step).
 *
 * On an item that is already the plainest shape (no simpler build exists) the step's help lever also answers the
 * far-off misses, so every checked miss on every item has a lever.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { demonstratedBoard, equalityItems, WEIGHTS, type EqualityBoard, type EqualityItem, type EqualityProblem }
  from './balanceEqualityModel';
import { isHands, STAGES, TRAY, initialWorkshopBoard, modelStage, workshopExpected, workshopItems,
  type WorkshopBoard, type WorkshopItem, type WorkshopProblem, type WorkshopWeight } from './balanceWorkshopModel';

export const UNIT_CELLS = 'unit_cells';
export const BALANCE_MODEL = 'balance_model';
export const PART_WHOLE = 'part_whole_bar';
export const ONE_GROUP = 'one_group';
export const ON_SCALE = 'on_scale_only';
export const TWO_BLOCKS = 'two_blocks';
export const ONE_BLOCK = 'one_block';
export const SMALLER_LOAD = 'smaller_load';
export const FEWER_PARCELS = 'fewer_parcels';
export const BALANCE_SIMPLIFY = new Set([TWO_BLOCKS, ONE_BLOCK, SMALLER_LOAD, FEWER_PARCELS]);

const ONE_OFF = ['one_short', 'one_over'];
const FAR_OFF = ['short_by_more', 'over_by_more'];

/** Weights from `tray` that add to `total`, largest first (the surfaces' own demonstration rule). */
export function greedy(total: number, tray: readonly number[]): number[] {
  const out: number[] = [];
  let left = total;
  for (const w of [...tray].sort((a, b) => b - a)) while (left >= w) { out.push(w); left -= w; }
  return out;
}
const blocks = (values: number[]): WorkshopWeight[] => values.map((value, i) => ({ id: -i - 1, value }));

/** Every spoken answer of a session: the numbers a lever or a practice item must never show or ask for. */
export const equalitySessionAnswers = (session: readonly EqualityProblem[]) => new Set(session.map(p => p.target));
export function workshopSessionAnswers(session: readonly WorkshopProblem[]): Set<number> {
  return new Set(session.flatMap(p => STAGES[p.mode].filter(s => !isHands(s) && s !== 'explain').map(s => workshopExpected(p, s))));
}

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

/** equality / equality_hard sum step: a two-block load, below the item's total. Offered from three blocks. */
export function twoBlocksTarget(answer: number, loadBlocks: number, used: ReadonlySet<number>, tray: readonly number[]): number | null {
  return loadBlocks < 3 ? null : pick(twoBlockTotals(tray), answer, used, true);
}
/** equality / equality_hard inference: a single numbered block. Offered from two blocks. */
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

/** The board a practice step opens on: every hands step before it done, as the surface's own model does it. */
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

const practiceWorkshopItem = (item: WorkshopItem, p: WorkshopProblem): WorkshopItem | null => {
  const step = workshopItems([p]).find(i => i.step === item.step);
  return step ? { ...step, id: `${item.id}~simpler` } : null;
};

/** The practice item a simplify lever opens on the weight workshop, with the board it opens on. */
export function workshopPracticeItem(item: WorkshopItem, lever: string, board: WorkshopBoard,
  session: readonly WorkshopProblem[]): { item: WorkshopItem; board: WorkshopBoard } | null {
  const used = workshopSessionAnswers(session), p = item.problem;
  let problem: WorkshopProblem | null = null;
  if (lever === TWO_BLOCKS || lever === ONE_BLOCK) {
    const t = lever === TWO_BLOCKS ? twoBlocksTarget(p.target, board.weights.length, used, TRAY)
      : oneBlockTarget(p.target, board.weights.length, used, TRAY);
    problem = t === null || p.mode !== 'equality_hard' ? null : { ...p, id: `${p.id}~simpler`, target: t, total: t };
  } else if (lever === SMALLER_LOAD) problem = smallerLoadProblem(item, board.weights.length, used);
  else if (lever === FEWER_PARCELS) problem = fewerParcelsProblem(item, used);
  const built = problem && practiceWorkshopItem(item, problem);
  return built && problem ? { item: built, board: practiceBoard(problem, item.step) } : null;
}

/** The practice item a simplify lever opens on the match-and-add surface (`equality`). */
export function equalityPracticeItem(item: EqualityItem, lever: string, board: EqualityBoard,
  session: readonly EqualityProblem[]): { item: EqualityItem; board: EqualityBoard } | null {
  const used = equalitySessionAnswers(session);
  const t = lever === TWO_BLOCKS && item.step === 'total' ? twoBlocksTarget(item.problem.target, board.blocks.length, used, WEIGHTS)
    : lever === ONE_BLOCK && item.step === 'infer' ? oneBlockTarget(item.problem.target, board.blocks.length, used, WEIGHTS) : null;
  if (t === null) return null;
  const problem: EqualityProblem = { ...item.problem, id: `${item.problem.id}~simpler`, target: t };
  const step = equalityItems([problem]).find(i => i.step === item.step);
  return step ? { item: { ...step, id: `${item.id}~simpler` }, board: demonstratedBoard(problem) } : null;
}

// ── Lever declarations ───────────────────────────────────────────────────────

type Kind = WorkspaceLever['kind'];
const lever = (pulled: readonly string[], id: string, kind: Kind, carrier: WorkspaceLever['carrier'], answers: string[],
  when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });

const unitCells = (pulled: readonly string[], far: boolean) => lever(pulled, UNIT_CELLS, 'help', 'shown',
  [...ONE_OFF, ...(far ? FAR_OFF : [])], 'The learner loses count adding the weights.',
  'Draws the same weights again as unit squares in one row, with a gap after every fifth square. No total is printed; the learner counts or adds.');
const balanceModel = (pulled: readonly string[], k: number, far: boolean) => lever(pulled, BALANCE_MODEL, 'help', 'both',
  [...ONE_OFF, ...(far ? FAR_OFF : [])], 'The learner does not use the balance to find the left weight.',
  `Shows a small model scale with a ${k} weight on each side, level. Talk about the model only; never say what the learner's left weight is.`);
const sumSimplify = (pulled: readonly string[]) => lever(pulled, TWO_BLOCKS, 'simplify', 'shown', FAR_OFF,
  'The learner is far off adding this many weights.',
  'Opens the same question on a load of just two weights first. It is not graded; the full item comes back after it.');
const inferSimplify = (pulled: readonly string[]) => lever(pulled, ONE_BLOCK, 'simplify', 'shown', FAR_OFF,
  'The learner is far off finding the left weight.',
  'Opens the same question on a scale balanced by one numbered weight first. It is not graded; the full item comes back after it.');

/** The match-and-add surface's levers on its session item (spoken steps only). */
export function equalityLevers(item: EqualityItem | null, board: EqualityBoard, pulled: readonly string[],
  session: readonly EqualityProblem[]): WorkspaceLever[] {
  if (!item || item.step === 'build') return [];
  const used = equalitySessionAnswers(session), t = item.problem.target;
  if (item.step === 'total') {
    const simpler = twoBlocksTarget(t, board.blocks.length, used, WEIGHTS) !== null;
    return [unitCells(pulled, !simpler), ...(simpler ? [sumSimplify(pulled)] : [])];
  }
  const k = modelWeight(t, used), simpler = oneBlockTarget(t, board.blocks.length, used, WEIGHTS) !== null;
  return [...(k !== null ? [balanceModel(pulled, k, !simpler)] : []), ...(simpler ? [inferSimplify(pulled)] : [])];
}

/** The weight workshop's levers on its session item (spoken number steps only; the explanation has none). */
export function workshopLevers(item: WorkshopItem | null, board: WorkshopBoard, pulled: readonly string[],
  session: readonly WorkshopProblem[]): WorkspaceLever[] {
  if (!item || isHands(item.step) || item.step === 'explain') return [];
  const used = workshopSessionAnswers(session), p = item.problem, step = item.step, n = board.weights.length;
  if (p.mode === 'equality_hard') {
    if (step === 'infer') {
      const k = modelWeight(p.target, used), simpler = oneBlockTarget(p.target, n, used, TRAY) !== null;
      return [...(k !== null ? [balanceModel(pulled, k, !simpler)] : []), ...(simpler ? [inferSimplify(pulled)] : [])];
    }
    const simpler = twoBlocksTarget(p.target, n, used, TRAY) !== null;
    return [unitCells(pulled, !simpler), ...(simpler ? [sumSimplify(pulled)] : [])];
  }
  if (p.mode === 'one_step') {
    const simpler = !!smallerLoadProblem(item, n, used);
    return [
      lever(pulled, PART_WHOLE, 'help', 'shown',
        ['said_whole', 'said_given_part', 'added_both', ...(step === 'relate' ? ONE_OFF : []), ...(simpler || step === 'added' ? [] : FAR_OFF)],
        `The learner gives the whole load, the ${p.known} already there, or both together.`,
        `Draws a bar as long as the right side's ${p.total}, split into the left's ${p.known} and an unlabelled part. The unlabelled part has no number.`),
      ...(step === 'added' ? [unitCells(pulled, !simpler)] : []),
      ...(simpler ? [lever(pulled, SMALLER_LOAD, 'simplify', 'shown', FAR_OFF, 'The learner is far off on the missing part.',
        `Opens the same question with the same ${p.known} and only one block to add first. It is not graded; the full item comes back after it.`)] : []),
    ];
  }
  const simpler = !!fewerParcelsProblem(item, used);
  const help = step === 'remaining'
    ? lever(pulled, ON_SCALE, 'help', 'shown', ['said_whole', 'said_change', 'said_one_parcel', ...ONE_OFF, ...(simpler ? [] : FAR_OFF)],
      'The learner counts the set-aside weight, the whole side, or one parcel instead of what the parcels share.',
      'Fades both set-aside areas and draws one outline round all the parcels together. No count is printed.')
    : lever(pulled, ONE_GROUP, 'help', 'shown', ['said_remaining', 'said_parcels', 'said_whole', ...ONE_OFF, ...(simpler ? [] : FAR_OFF)],
      'The learner gives the weight before sharing, the number of parcels, or loses count of one group.',
      'Rings group 1 and its parcel and fades the other groups. No count is printed; the learner counts that one group.');
  return [help, ...(simpler ? [lever(pulled, FEWER_PARCELS, 'simplify', 'shown', FAR_OFF, 'The learner is far off sharing this load.',
    'Opens the same question with two parcels and a smaller load first. It is not graded; the full item comes back after it.')] : [])];
}

// ── What the pulled levers put on screen, as a scene fact. Never the step's answer. ──

export function equalityLeverFacts(item: EqualityItem, pulled: readonly string[], session: readonly EqualityProblem[]): string {
  const k = modelWeight(item.problem.target, equalitySessionAnswers(session));
  return [
    pulled.includes(UNIT_CELLS) && 'The right-side weights are also drawn as unit squares in one row, with a gap after every fifth square.',
    pulled.includes(BALANCE_MODEL) && k !== null && `A small model scale beside the learner's has a ${k} weight on each side, and it is level.`,
  ].filter((s): s is string => !!s).join(' ');
}

export function workshopLeverFacts(item: WorkshopItem, pulled: readonly string[], session: readonly WorkshopProblem[]): string {
  const p = item.problem, k = modelWeight(p.target, workshopSessionAnswers(session));
  return [
    pulled.includes(UNIT_CELLS) && 'The chosen weights are also drawn as unit squares in one row, with a gap after every fifth square.',
    pulled.includes(BALANCE_MODEL) && k !== null && `A small model scale beside the learner's has a ${k} weight on each side, and it is level.`,
    pulled.includes(PART_WHOLE) && `A bar as long as the right side's ${p.total} is split into the left's known ${p.known} and an unlabelled part.`,
    pulled.includes(ONE_GROUP) && 'Group 1 and its parcel are ringed; the other groups are faded.',
    pulled.includes(ON_SCALE) && `Both set-aside areas are faded, and one outline goes round all ${p.parcels} parcels together.`,
  ].filter((s): s is string => !!s).join(' ');
}
