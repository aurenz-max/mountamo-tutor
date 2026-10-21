/**
 * base-ten-blocks' in-item levers on both mats, as ONE lever set (`components/live-activity/bossLevers.ts`; approved
 * tables qa/support-levers/m1-lever-tables-2026-09-28.md). No real-learner evidence: the misses are what `plainMiss`,
 * `tradeMiss` and `baseTenSpokenMisses` observe, plus the catalog's documented struggles. A lever of one mat is never
 * offered on the other mat's item (read_blocks and regroup run on either mat).
 *
 * build_number:
 * - `column_counts` (help): the count of the learner's own blocks above each column. Answers one off, a ten off
 *   and swapped digits. Leak rule: counts the learner's blocks only; on build_number the number to build is
 *   printed already. The tier's `showColumnCounts` is its starting position.
 * - `blocks_total` (help): the running total of the learner's blocks. Answers far off. Leak rule: build_number only,
 *   never operate (there the total is the typed answer, contract R13). `showBlocksTotal` is its starting position.
 * - `ten_bracket` (help): a bracket round every column of the learner's that holds ten or more, with no count on
 *   it. Answers `not_traded_up`. Leak rule: only the learner's own full columns; offered only while one holds ten.
 * - `plainer_build` (simplify): an ungraded build of a plainer number first (same digit count, no zero, smaller
 *   digits), then the full item. Answers far off. Leak rule: never the number to build or its digits reversed.
 *
 * operate (add_with_blocks, subtract_with_blocks; the result is typed, so the total is never a lever, R13):
 * - `column_counts` (help): as above; answers one short and one over. `showColumnCounts` is its starting position.
 * - `ten_bracket` (help): as above; answers a ten off, which is what a carry left as ten ones reads as.
 * - `single_regroup` (simplify): an ungraded operation first with one carry or borrow fewer (floor one), new
 *   operands, the same places, M > S; then the full item. Answers a ten off and far off. Leak rule: never the
 *   item's operands (either order) or its result. `digits_swapped` has no lever on operate.
 *
 * - `trade_mark` (help): a mark on each column where this operation needs a trade (addition: the column that makes
 *   ten or more; subtraction: the column whose top digit is too small), with no count. Answers a ten off on every item
 *   with a regroup, including one-trade items and a mat the learner has not modelled (where `ten_bracket` is absent and
 *   `single_regroup` has no floor below). Leak rule: column positions only, never a digit, a count or the result.
 *
 * read_blocks and regroup on the click mat (a mixed payload; a homogeneous payload uses the spoken mat):
 * - `ten_model` (help): as on build_two_ways, beside the mat. read_blocks: answers a ten off and swapped digits (a
 *   big block read at the wrong worth). regroup: answers no trade and a changed value (a trade swaps one bigger block
 *   for ten smaller ones and keeps the value). Leak rule: drawn outside the learner's mat, no count, no number.
 * - `plainer_read` (simplify, read_blocks): an ungraded mat of `plainerNumber` (same places, fewer blocks in each
 *   column) to read first, then the full mat. Answers one off and far off. Leak rule: never the number or its reversal.
 *   regroup has no simplify: one trade is already the smallest trade.
 *
 * build_two_ways (open build, references/build-mode.md). Starts bare at every tier: keeping track of the blocks is the
 * task, so the counts come on a miss, and no total is ever offered (the value of the build IS the skill).
 * - `column_counts` (help): as above, on the learner's own blocks. Answers every value miss.
 * - `ten_model` (help): beside the mat, one ten-stick next to ten ones cubes (and one hundred-flat next to ten
 *   ten-sticks when the mat has hundreds), with no count. Answers `same_as_first`: a learner who cannot find a second
 *   way has not seen that one bigger block can be swapped for ten smaller ones.
 * - `smaller_number` (simplify): the same two-ways build on about half the number (at least ten, so a second way
 *   exists), ungraded, then the full item on an empty mat. Answers far off. Leak rule: never the number or its reversal.
 *
 * The spoken mat, read_blocks (count, then worth):
 * - `block_worth` (clue): a key beside the mat, ONE block of the asked size and what one is worth. Answers the
 *   count/value swap. Leak rule: its words are checked against the step's key, so it is not offered on the worth step
 *   when the mat holds one such block (the key would be the answer).
 * - `dim_others` (layout): the other sizes fade. Answers another size's count and the whole mat's value. Offered only
 *   when another size is on the mat.
 * - `group_fives` (layout): the asked blocks drawn five, gap, the rest. Answers one off. Offered from six blocks.
 * - `fewer_blocks` (easier): the same step on a mat with about half as many of the asked block. Leak rule: never the
 *   item's number or another session number.
 * The spoken mat, regroup (predict, then trade):
 * - `trade_model` (model): a model mat beside the learner's showing a DIFFERENT trade of the same sizes, before and
 *   after, with its counts. Leak rule: the model's starting count is not the item's or any session problem's, so its
 *   result is no session prediction; it never touches the learner's mat.
 * - `asked_column_glow` (marks, predict): the column the ten land in glows round the blocks already there. Answers
 *   "ten" (the blocks already there forgotten). No count.
 * - `small_start` (easier, predict): the prediction on a mat with one or two in the receiving column. Offered from
 *   three. Leak rule: never the item's number or another session number.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import { analyzeBorrows, buildAdditionOperands, buildSubtractionOperands, countCarries, toDigits } from './baseTenOperands';
import { BASE_TEN_MISSES_BY_MODE, type BaseTenMode } from './baseTenBlocks.card';
import { blockNoun, blockNounPlural, occupiedPlaces, placeValueOf, readCount, startingLowerCount, standardColumns,
  type BtProblem } from './baseTenModel';
import { baseTenItems, type BaseTenItem } from './baseTenScript';
import { baseTenKey, baseTenModeOf, isOperateType as isOperate, isSpokenItem, twoWaysInstruction, type BaseTenBlocksItem }
  from './baseTenWorkspace';

export const COUNTS_LEVER = 'column_counts';
export const TOTAL_LEVER = 'blocks_total';
export const BRACKET_LEVER = 'ten_bracket';
export const PLAINER_LEVER = 'plainer_build';
export const SIMPLER_OP_LEVER = 'single_regroup';
export const TEN_MODEL_LEVER = 'ten_model';
export const SMALLER_LEVER = 'smaller_number';
export const TRADE_MARK_LEVER = 'trade_mark';
export const PLAINER_READ_LEVER = 'plainer_read';

/** A simplify lever's practice item id is the session item's id plus this suffix. */
export const PRACTICE_SUFFIX: Readonly<Record<string, string>> = {
  [PLAINER_LEVER]: 'plainer', [PLAINER_READ_LEVER]: 'plainer', [SIMPLER_OP_LEVER]: 'simpler', [SMALLER_LEVER]: 'smaller',
};

/** The smaller number to show two ways first, or null: about half, at least ten, never the number or its reversal. */
export function smallerTwoWaysNumber(target: number): number | null {
  if (!Number.isInteger(target) || target <= 10) return null;
  const half = Math.max(10, Math.round(target / 2));
  // Half of 73 rounds to 37, its reversal: step down one.
  const smaller = half === reversed(target) && half > 10 ? half - 1 : half;
  return smaller < target && smaller !== reversed(target) ? smaller : null;
}

const reversed = (n: number) => Number(String(n).split('').reverse().join(''));

/** The plainer number to build first, or null: same digit count, every digit about half and at least one. */
export function plainerNumber(target: number): number | null {
  if (!Number.isInteger(target) || target < 2) return null;
  const digits = String(target).split('').map(Number).map(d => Math.max(1, Math.ceil(d / 2)));
  let plain = Number(digits.join(''));
  if (plain === target || plain === reversed(target)) {
    const ones = digits[digits.length - 1];
    digits[digits.length - 1] = ones < 9 ? ones + 1 : ones - 1;
    plain = Number(digits.join(''));
  }
  return plain !== target && plain !== reversed(target) && String(plain).length === String(target).length ? plain : null;
}

export { isOperateType as isOperate } from './baseTenWorkspace';

export interface LeverItem { type: string; targetNumber: number; secondNumber?: number }
export interface SimplerOperation { first: number; second: number; targetNumber: number; instruction: string }

/** An operate item's operands, place count and carries or borrows; null when they do not reconcile. */
export function operateShape(item: LeverItem): { first: number; second: number; places: number; regroups: number } | null {
  const second = item.secondNumber;
  if (!isOperate(item.type) || !Number.isInteger(item.targetNumber) || !Number.isInteger(second) || (second as number) <= 0) return null;
  const add = item.type === 'add_with_blocks';
  const first = add ? item.targetNumber - (second as number) : item.targetNumber + (second as number);
  if (first <= 0 || (!add && first <= (second as number))) return null;
  const places = String(Math.max(first, second as number)).length;
  const regroups = add ? countCarries(first, second as number, places) : analyzeBorrows(first, second as number, places).borrows;
  return { first, second: second as number, places, regroups };
}

export const operateInstruction = (type: string, first: number, second: number) =>
  type === 'add_with_blocks' ? `Add ${first} + ${second} using blocks.` : `Subtract ${second} from ${first} using blocks.`;

/** A seeded source, so an item always gets the same practice operation. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The operation to do first: one carry or borrow fewer, never below one; null when the item has one or none. */
export function simplerOperation(item: LeverItem): SimplerOperation | null {
  const shape = operateShape(item);
  if (!shape || shape.places < 2 || shape.regroups < 2) return null;
  const add = item.type === 'add_with_blocks';
  // The builders keep the top column free of a regroup, so a place count caps the regroups it can hold.
  const want = Math.min(shape.regroups - 1, shape.places - 1);
  const rand = seeded(shape.first * 1009 + shape.second * 31 + (add ? 1 : 2));
  for (let tries = 0; tries < 40; tries++) {
    const [first, second] = add ? buildAdditionOperands(shape.places, want, false, rand)
      : buildSubtractionOperands(shape.places, want, false, rand);
    const targetNumber = add ? first + second : first - second;
    const built = operateShape({ type: item.type, targetNumber, secondNumber: second });
    const sameOperands = [first, second].sort().join() === [shape.first, shape.second].sort().join();
    if (built?.regroups === want && built.places === shape.places && !sameOperands && targetNumber !== item.targetNumber)
      return { first, second, targetNumber, instruction: operateInstruction(item.type, first, second) };
  }
  return null;
}

const WHOLE_PLACES = ['ones', 'tens', 'hundreds', 'thousands'];

/**
 * The columns where an operate item needs a trade, by place name: addition, each column that makes ten or more
 * (with the carry in); subtraction, each column whose top digit (after a borrow out) is smaller than the bottom one.
 */
export function tradeColumns(item: LeverItem): string[] {
  const shape = operateShape(item);
  if (!shape) return [];
  const a = toDigits(shape.first, shape.places), b = toDigits(shape.second, shape.places);
  const add = item.type === 'add_with_blocks';
  const out: string[] = [];
  let carry = 0;
  for (let i = 0; i < shape.places; i++) {
    const trades = add ? a[i] + b[i] + carry >= 10 : a[i] - carry < b[i];
    if (trades) out.push(WHOLE_PLACES[i]);
    carry = trades ? 1 : 0;
  }
  return out;
}

type PracticeSource = LeverItem & { id: string; instruction: string };

/** The practice item a simplify lever opens in place of the session item, or null when the item has none. */
export function practiceItem<T extends PracticeSource>(challenge: T, lever: string): T | null {
  const id = `${challenge.id}~${PRACTICE_SUFFIX[lever]}`;
  if (lever === SMALLER_LEVER && challenge.type === 'build_two_ways') {
    const n = smallerTwoWaysNumber(challenge.targetNumber);
    return n === null ? null : { ...challenge, id, targetNumber: n, instruction: twoWaysInstruction(n) };
  }
  if (lever === PLAINER_LEVER && challenge.type === 'build_number') {
    const n = plainerNumber(challenge.targetNumber);
    return n === null ? null : { ...challenge, id, targetNumber: n, instruction: `Build the number ${n} with blocks.` };
  }
  // The read instruction names no number (BT-3), so the practice mat keeps it.
  if (lever === PLAINER_READ_LEVER && challenge.type === 'read_blocks') {
    const n = plainerNumber(challenge.targetNumber);
    return n === null ? null : { ...challenge, id, targetNumber: n };
  }
  if (lever === SIMPLER_OP_LEVER && isOperate(challenge.type)) {
    const op = simplerOperation(challenge);
    return op === null ? null : { ...challenge, id, targetNumber: op.targetNumber, secondNumber: op.second, instruction: op.instruction };
  }
  return null;
}

/** Rebuilds a practice item from its session item and its id (`<item>~<suffix>`), with the lever's own builder. */
export function practiceFromId<T extends PracticeSource>(challenge: T, practiceId: string): T | null {
  const suffix = practiceId.split('~')[1];
  for (const lever of Object.keys(PRACTICE_SUFFIX)) {
    const built = PRACTICE_SUFFIX[lever] === suffix ? practiceItem(challenge, lever) : null;
    if (built) return built;
  }
  return null;
}

/** Levers the tier starts pulled: a starting position, never a recorded pull. */
export function startLevers(type: string | undefined, show: { showColumnCounts?: boolean; showBlocksTotal?: boolean }): string[] {
  if (isOperate(type)) return show.showColumnCounts ?? true ? [COUNTS_LEVER] : [];
  if (type !== 'build_number') return [];
  return [...(show.showColumnCounts ?? true ? [COUNTS_LEVER] : []), ...(show.showBlocksTotal ?? true ? [TOTAL_LEVER] : [])];
}

/** The learner's columns a `ten_bracket` draws round: only their own, only ten or more. */
export const bracketColumns = (columns: Readonly<Record<string, number>>) =>
  Object.entries(columns).filter(([, n]) => n >= 10).map(([place]) => place);


// ── The spoken mat's builders ──────────────────────────────────────────────

export const WORTH_LEVER = 'block_worth';
export const DIM_LEVER = 'dim_others';
export const FIVES_LEVER = 'group_fives';
export const FEWER_LEVER = 'fewer_blocks';
export const MODEL_LEVER = 'trade_model';
export const GLOW_LEVER = 'asked_column_glow';
export const SMALL_START_LEVER = 'small_start';

const withDigit = (n: number, place: number, digit: number) =>
  n + (digit - Math.floor(n / placeValueOf(place)) % 10) * placeValueOf(place);

/** A practice problem of the same mode and place, or null when it would be a session number. */
function practiceProblem(item: BaseTenItem, target: number, session: readonly BtProblem[]): BtProblem | null {
  const { problem } = item;
  if (target === problem.target || session.some(p => p.target === target)) return null;
  return { ...problem, id: `${problem.id}~simpler`, target, start: standardColumns(target) };
}

/** read_blocks: the same mat with about half as many of the asked block (never one fewer: that is not simpler). */
export function fewerBlocksProblem(item: BaseTenItem, session: readonly BtProblem[]): BtProblem | null {
  const count = readCount(item.problem);
  if (item.problem.mode !== 'read_blocks' || count < 3) return null;
  for (let fewer = Math.ceil(count / 2); fewer >= 1; fewer--) {
    const built = practiceProblem(item, withDigit(item.problem.target, item.problem.place, fewer), session);
    if (built) return built;
  }
  return null;
}

/** regroup: the prediction on a mat with one or two in the receiving column. */
export function smallStartProblem(item: BaseTenItem, session: readonly BtProblem[]): BtProblem | null {
  const { problem } = item;
  if (problem.mode !== 'regroup' || item.step !== 'predict' || startingLowerCount(problem) < 3) return null;
  for (const small of [1, 2]) {
    const built = practiceProblem(item, withDigit(problem.target, problem.place - 1, small), session);
    if (built) return built;
  }
  return null;
}

/** The practice item a spoken simplify lever opens: the same step, built by the pack's own plan, with its own id. */
export function spokenPracticeItem(item: BaseTenItem, lever: string, session: readonly BtProblem[]): BaseTenItem | null {
  const problem = lever === FEWER_LEVER ? fewerBlocksProblem(item, session)
    : lever === SMALL_START_LEVER ? smallStartProblem(item, session) : null;
  const step = problem && baseTenItems([problem]).find(i => i.step === item.step);
  return step ? { ...step, id: `${item.id}~simpler` } : null;
}

/** The model trade: the item's sizes, a starting count no session problem uses (so its result is no prediction). */
export function tradeModel(item: BaseTenItem, session: readonly BtProblem[]): { place: number; before: number; after: number } | null {
  if (item.problem.mode !== 'regroup') return null;
  const used = new Set([item.problem, ...session].map(startingLowerCount));
  const before = [2, 3, 1, 4, 5, 6, 7, 8, 9].find(m => !used.has(m));
  return before === undefined ? null : { place: item.problem.place, before, after: before + 10 };
}

/** What the worth key would show, or null where it is the answer (worth step, one block). */
export function worthKey(item: BaseTenItem): { place: number; worth: number } | null {
  const { problem } = item;
  if (problem.mode !== 'read_blocks' || (item.step === 'worth' && readCount(problem) === 1)) return null;
  return { place: problem.place, worth: placeValueOf(problem.place) };
}

const hasOtherSizes = (problem: BtProblem) => occupiedPlaces(problem.start).some(p => p !== problem.place);

// ── The lever set ───────────────────────────────────────────────────────────

/**
 * What a lever reads beyond the item: the session's problems (a spoken practice item or model is never one of them),
 * the learner's columns on the click mat (`ten_bracket` is offered only while one holds ten), and the levers the
 * click mat's tier starts pulled (a starting position, so their scene fact is not news).
 */
export interface BaseTenLeverContext {
  problems: readonly BtProblem[];
  columns: Readonly<Record<string, number>>;
  started: readonly string[];
}

export const baseTenLeverContext = (ctx: Partial<BaseTenLeverContext> = {}): BaseTenLeverContext =>
  ({ problems: ctx.problems ?? [], columns: ctx.columns ?? {}, started: ctx.started ?? [] });

/** The session's problems, from its items (a click-mat session has none). */
export const problemsOf = (items: readonly BaseTenBlocksItem[]): BtProblem[] =>
  Array.from(new Map(items.filter(isSpokenItem).map(i => [i.problem.id, i.problem] as const)).values());

const clickOf = (item: BaseTenBlocksItem) => (isSpokenItem(item) ? null : item);
const spokenOf = (item: BaseTenBlocksItem) => (isSpokenItem(item) ? item : null);
/** A fact the tier did not already put on screen. */
const unlessStarted = (id: string, fact: string) => (_c: unknown, _i: BaseTenBlocksItem, ctx: BaseTenLeverContext) =>
  (ctx.started.includes(id) ? '' : fact);

const COUNTS_DOES = 'Shows above each column how many of its blocks the learner has placed.';
const COUNTS_FACT = "Each column shows how many of the learner's blocks are in it.";
const BRACKET_DOES = 'Draws a bracket round any column where the learner has ten or more blocks, with no count on it.';
const BRACKET_FACT = 'Any column holding ten or more blocks has a bracket round it.';
const TEN_MODEL_DOES = 'Shows beside the mat a ten-stick next to the ones cubes it is worth, and a hundred-flat next to the '
  + 'ten-sticks it is worth, with no count.';
const TEN_MODEL_FACT = 'Beside the mat, a big block is shown next to the smaller blocks it is worth.';
const fullColumn = (_i: BaseTenBlocksItem, ctx: BaseTenLeverContext) => bracketColumns(ctx.columns).length > 0;
const many = (item: BaseTenBlocksItem) => (isSpokenItem(item) ? blockNounPlural(item.problem.place) : 'blocks');
const lower = (item: BaseTenBlocksItem) => (isSpokenItem(item) ? blockNounPlural(item.problem.place - 1) : 'blocks');
const one = (item: BaseTenBlocksItem) => (isSpokenItem(item) ? blockNoun(item.problem.place, 1) : 'block');
const onStep = (step: string) => (item: BaseTenBlocksItem) => isSpokenItem(item) && item.step === step;
const counting = onStep('count'), predicting = onStep('predict');

export const BASE_TEN_LEVERS = leverSet<BaseTenBlocksItem, BaseTenLeverContext>({
  modeOf: baseTenModeOf,
  missesOf: mode => BASE_TEN_MISSES_BY_MODE[mode as BaseTenMode] ?? [],
  answersOf: item => { const key = baseTenKey(item); return key ? keyAnswers(key) : []; },
  // The tier sets when the model trade comes. The click mat has no model lever, so its items get no support fact.
  support: { tier: item => (isSpokenItem(item) ? item.supportTier ?? 'medium' : 'medium'),
    different: 'a different trade', own: "this trade's answer" },
  specs: [
    // build_number
    { id: COUNTS_LEVER, type: 'marks', modes: ['build_number'], answers: ['one_short', 'one_over', 'one_ten_off', 'digits_swapped'],
      when: 'The learner miscounts a column, or puts blocks in the wrong column.', does: COUNTS_DOES,
      fact: unlessStarted(COUNTS_LEVER, COUNTS_FACT) },
    { id: TOTAL_LEVER, type: 'marks', modes: ['build_number'], answers: ['short_by_more', 'over_by_more'],
      when: 'The learner cannot tell how far their blocks are from the number.', does: "Shows the total of the learner's blocks under the mat.",
      fact: unlessStarted(TOTAL_LEVER, "The total of the learner's blocks is under the mat.") },
    { id: BRACKET_LEVER, type: 'marks', modes: ['build_number'], answers: ['not_traded_up'], offer: fullColumn,
      when: 'The learner leaves ten or more blocks in a column instead of trading them up.', does: BRACKET_DOES, fact: BRACKET_FACT },
    { id: PLAINER_LEVER, type: 'easier', modes: ['build_number'], answers: ['short_by_more', 'over_by_more'],
      content: item => { const c = clickOf(item); return c && practiceItem(c, PLAINER_LEVER); },
      when: 'The learner cannot build a number this big yet.',
      does: 'Opens an easier number to build first, with the same number of places. It is not graded; the full item comes back after it.' },
    // operate (the result is typed, so the total is never a lever, R13)
    { id: COUNTS_LEVER, type: 'marks', modes: ['operate'], answers: ['one_short', 'one_over'],
      when: 'The learner miscounts the blocks after modelling the operation.', does: COUNTS_DOES,
      fact: unlessStarted(COUNTS_LEVER, COUNTS_FACT) },
    { id: BRACKET_LEVER, type: 'marks', modes: ['operate'], answers: ['one_ten_off'], offer: fullColumn,
      when: 'The learner has ten or more blocks in a column and reads the result without trading them.', does: BRACKET_DOES, fact: BRACKET_FACT },
    { id: TRADE_MARK_LEVER, type: 'marks', modes: ['operate'], answers: ['one_ten_off'],
      content: item => { const c = clickOf(item); return c && tradeColumns(c).length ? tradeColumns(c) : null; },
      when: 'The learner loses a carry or a borrow: a trade the operation needs was not made.',
      does: 'Marks each column where this operation needs a trade, with no count on it.',
      fact: 'The columns where this operation needs a trade are marked.' },
    { id: SIMPLER_OP_LEVER, type: 'easier', modes: ['operate'], answers: ['one_ten_off', 'short_by_more', 'over_by_more'],
      content: item => { const c = clickOf(item); return c && practiceItem(c, SIMPLER_OP_LEVER); },
      when: 'The learner loses track when an operation needs several trades.',
      does: 'Opens an easier operation first, needing fewer trades, with the same number of places. It is not graded; the full item comes back after it.' },
    // build_two_ways (starts bare at every tier; no total is ever offered: the value of the build is the skill)
    { id: COUNTS_LEVER, type: 'marks', modes: ['build_two_ways'],
      answers: ['one_short', 'one_over', 'one_ten_off', 'digits_swapped', 'short_by_more', 'over_by_more'],
      when: 'The learner miscounts the blocks in a column, so the build is not the number.', does: COUNTS_DOES, fact: COUNTS_FACT },
    { id: TEN_MODEL_LEVER, type: 'legend', modes: ['build_two_ways'], answers: ['same_as_first'],
      when: 'The learner cannot find a second way and builds the first way again.', does: TEN_MODEL_DOES, fact: TEN_MODEL_FACT },
    { id: SMALLER_LEVER, type: 'easier', modes: ['build_two_ways'], answers: ['short_by_more', 'over_by_more'],
      content: item => { const c = clickOf(item); return c && practiceItem(c, SMALLER_LEVER); },
      when: 'The learner cannot build a number this big yet.',
      does: 'Opens a smaller number to build both ways first. It is not graded; the full item comes back after it, on an empty mat.' },
    // read_blocks and regroup on the click mat (a mixed payload)
    { id: TEN_MODEL_LEVER, type: 'legend', modes: ['read_blocks'], answers: ['one_ten_off', 'digits_swapped'], content: clickOf,
      when: 'The learner reads a big block at the wrong worth, so a place comes out wrong.', does: TEN_MODEL_DOES, fact: TEN_MODEL_FACT },
    { id: PLAINER_READ_LEVER, type: 'easier', modes: ['read_blocks'], answers: ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
      content: item => { const c = clickOf(item); return c && practiceItem(c, PLAINER_READ_LEVER); },
      when: 'The learner loses count on a mat with this many blocks.',
      does: 'Opens a mat with fewer blocks in each column to read first, with the same places. It is not graded; the full item comes back after it.' },
    { id: TEN_MODEL_LEVER, type: 'legend', modes: ['regroup'], answers: ['no_trade', 'value_changed'], content: clickOf,
      when: 'The learner does not see that a bigger block can be swapped for ten smaller ones and keep the value.',
      does: TEN_MODEL_DOES, fact: TEN_MODEL_FACT },
    // read_blocks on the spoken mat
    { id: WORTH_LEVER, type: 'clue', modes: ['read_blocks'], answers: ['said_value', 'said_count'],
      answersOn: item => (counting(item) ? ['said_value'] : ['said_count']),
      content: item => { const s = spokenOf(item); return s && worthKey(s); },
      when: item => (counting(item) ? 'The learner says what the blocks are worth when asked how many there are.'
        : 'The learner says how many blocks there are when asked what they are worth.'),
      does: item => `Shows a single ${one(item)} beside the mat with what one is worth. Say what one is worth; never the total.`,
      fact: (key: { place: number; worth: number }) => `A key beside the mat shows a single ${blockNoun(key.place, 1)}, worth ${key.worth}.` },
    { id: DIM_LEVER, type: 'layout', modes: ['read_blocks'], answers: ['other_block_count', 'said_total'],
      content: item => { const s = spokenOf(item); return !!s && hasOtherSizes(s.problem); },
      when: item => `The learner counts other blocks, or the whole mat, instead of the ${many(item)}.`,
      does: item => `Fades every other size of block so only the ${many(item)} stand out.`,
      fact: (_c: unknown, item: BaseTenBlocksItem) => `Every size of block except the ${many(item)} is faded.` },
    { id: FIVES_LEVER, type: 'layout', modes: ['read_blocks'], answers: ['one_short', 'one_over', 'one_block_off'],
      answersOn: item => (counting(item) ? ['one_short', 'one_over'] : ['one_block_off']),
      content: item => { const s = spokenOf(item); return !!s && readCount(s.problem) >= 6; },
      when: item => `The learner loses count of the ${many(item)}.`,
      does: item => `Draws the ${many(item)} as a row of five, a gap, then the rest.`,
      fact: (_c: unknown, item: BaseTenBlocksItem) => `The ${many(item)} are drawn as a row of five, a gap, then the rest.` },
    { id: FEWER_LEVER, type: 'easier', modes: ['read_blocks'], answers: ['short_by_more', 'over_by_more'],
      content: (item, ctx) => { const s = spokenOf(item); return s && spokenPracticeItem(s, FEWER_LEVER, ctx.problems); },
      when: item => `The learner is far off on this many ${many(item)}.`,
      does: item => `Opens the same question on a mat with fewer ${many(item)} first. It is not graded; the full item comes back after it.` },
    // regroup on the spoken mat
    { id: MODEL_LEVER, type: 'model', modes: ['regroup'],
      answers: ['said_ten', 'said_start', 'one_short', 'one_over', 'other_block', 'traded_twice'],
      answersOn: item => (predicting(item) ? ['said_ten', 'said_start', 'one_short', 'one_over'] : ['other_block', 'traded_twice']),
      content: (item, ctx) => { const s = spokenOf(item); return s && tradeModel(s, ctx.problems); },
      when: item => (predicting(item) ? `The learner cannot picture what the ${lower(item)} will be after the trade.`
        : 'The learner breaks the wrong block, or more than one.'),
      does: item => `Shows a small model mat with a different trade of one ${one(item)}, before and after, with its counts. `
        + "The learner's mat is unchanged.",
      fact: (model: { place: number; before: number; after: number }) => `A model mat beside the learner's shows one `
        + `${blockNoun(model.place, 1)} and ${model.before} ${blockNoun(model.place - 1, model.before)} traded into `
        + `${model.after} ${blockNounPlural(model.place - 1)}.` },
    { id: GLOW_LEVER, type: 'marks', modes: ['regroup'], answers: ['said_ten'], content: predicting,
      when: item => `The learner forgets the ${lower(item)} already on the mat.`,
      does: item => `Makes the ${lower(item)} column glow round the ${lower(item)} already there, with no count.`,
      fact: (_c: unknown, item: BaseTenBlocksItem) => `The ${lower(item)} column glows round the ${lower(item)} already on the mat.` },
    { id: SMALL_START_LEVER, type: 'easier', modes: ['regroup'], answers: ['short_by_more', 'over_by_more'],
      content: (item, ctx) => { const s = spokenOf(item); return s && spokenPracticeItem(s, SMALL_START_LEVER, ctx.problems); },
      when: item => `The learner is far off when adding ten to this many ${lower(item)}.`,
      does: item => `Opens the same prediction on a mat with only one or two ${lower(item)} first. It is not graded; the full item comes back after it.` },
  ],
});
