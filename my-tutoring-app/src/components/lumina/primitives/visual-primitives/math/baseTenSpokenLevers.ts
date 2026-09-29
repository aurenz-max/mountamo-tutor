/**
 * The in-item levers on base-ten-blocks' spoken mat (`read_blocks`, `regroup`; `/add-support-tiers`, handoff 21 M1
 * spoken slice; table qa/support-levers/m1-lever-tables-2026-09-28.md). No real-learner evidence: the misses are
 * what `baseTenSpokenMisses` and `tradeMiss` observe, plus the three signature errors the pack was built for
 * (the value for the count, the count for the value, "ten" for the prediction).
 *
 * read_blocks (count, then worth):
 * - `block_worth` (help, both): a key beside the mat, ONE block of the asked size and what one is worth. Answers the
 *   count/value swap. Leak rule: refused on the worth step when the mat holds one such block (the key would be the answer).
 * - `dim_others` (help, shown): the other sizes fade. Answers another size's count and the whole mat's value.
 *   Offered only when another size is on the mat.
 * - `group_fives` (help, shown): the asked blocks drawn five, gap, the rest. Answers one off. Offered from six blocks.
 * - `fewer_blocks` (simplify): the same step on a mat with about half as many of the asked block; ungraded, then
 *   the full item. Leak rule: never the item's number or another session number.
 *
 * regroup (predict, then trade):
 * - `trade_model` (help, both): a model mat beside the learner's showing a DIFFERENT trade of the same sizes, before
 *   and after, with its counts. Leak rule: the model's starting count is not the item's or any session problem's,
 *   so its result is no session prediction; it never touches the learner's mat.
 * - `asked_column_glow` (help, predict): the column the ten land in glows round the blocks already there. Answers
 *   "ten" (the blocks already there forgotten). No count.
 * - `small_start` (simplify, predict): the prediction on a mat with one or two in the receiving column; ungraded,
 *   then the full item. Offered from three. Leak rule: never the item's number or another session number.
 *
 * Unanswered: regroup `no_trade`, `value_changed` and read_blocks `one_ten_off`, `digits_swapped` come only from the
 * click mat of a mixed payload, whose regroup and read_blocks items have no levers.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { blockNoun, blockNounPlural, occupiedPlaces, placeValueOf, readCount, startingLowerCount, standardColumns,
  type BtProblem } from './baseTenModel';
import { baseTenItems, type BaseTenItem } from './baseTenScript';

export const WORTH_LEVER = 'block_worth';
export const DIM_LEVER = 'dim_others';
export const FIVES_LEVER = 'group_fives';
export const FEWER_LEVER = 'fewer_blocks';
export const MODEL_LEVER = 'trade_model';
export const GLOW_LEVER = 'asked_column_glow';
export const SMALL_START_LEVER = 'small_start';
export const SPOKEN_SIMPLIFY = new Set([FEWER_LEVER, SMALL_START_LEVER]);

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

/** The practice item a simplify lever opens: the same step, built by the pack's own plan, with its own id. */
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

export function baseTenSpokenLevers(item: BaseTenItem | null, pulled: readonly string[],
  session: readonly BtProblem[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const { problem } = item, many = blockNounPlural(problem.place);
  if (problem.mode === 'read_blocks') {
    const count = item.step === 'count';
    return [
      ...(worthKey(item) ? [lever(WORTH_LEVER, 'help', 'both', count ? ['said_value'] : ['said_count'],
        count ? 'The learner says what the blocks are worth when asked how many there are.'
          : 'The learner says how many blocks there are when asked what they are worth.',
        `Shows one ${blockNoun(problem.place, 1)} beside the mat with what one is worth. Say what one is worth; never the total.`)] : []),
      ...(hasOtherSizes(problem) ? [lever(DIM_LEVER, 'help', 'shown', ['other_block_count', 'said_total'],
        `The learner counts other blocks, or the whole mat, instead of the ${many}.`,
        `Fades every other size of block so only the ${many} stand out.`)] : []),
      ...(readCount(problem) >= 6 ? [lever(FIVES_LEVER, 'help', 'shown', count ? ['one_short', 'one_over'] : ['one_block_off'],
        `The learner loses count of the ${many}.`, `Draws the ${many} as a row of five, a gap, then the rest.`)] : []),
      ...(fewerBlocksProblem(item, session) ? [lever(FEWER_LEVER, 'simplify', 'shown', ['short_by_more', 'over_by_more'],
        `The learner is far off on this many ${many}.`,
        `Opens the same question on a mat with fewer ${many} first. It is not graded; the full item comes back after it.`)] : []),
    ];
  }
  const lower = blockNounPlural(problem.place - 1);
  const model = tradeModel(item, session);
  const modelLever = model ? [lever(MODEL_LEVER, 'help', 'both',
    item.step === 'predict' ? ['said_ten', 'said_start', 'one_short', 'one_over'] : ['other_block', 'traded_twice'],
    item.step === 'predict' ? `The learner cannot picture what the ${lower} will be after the trade.`
      : 'The learner breaks the wrong block, or more than one.',
    `Shows a small model mat with a different trade of one ${blockNoun(problem.place, 1)}, before and after, with its counts. The learner's mat is unchanged.`)] : [];
  if (item.step !== 'predict') return modelLever;
  return [
    ...modelLever,
    lever(GLOW_LEVER, 'help', 'shown', ['said_ten'], `The learner forgets the ${lower} already on the mat.`,
      `Makes the ${lower} column glow round the ${lower} already there, with no count.`),
    ...(smallStartProblem(item, session) ? [lever(SMALL_START_LEVER, 'simplify', 'shown', ['short_by_more', 'over_by_more'],
      `The learner is far off when adding ten to this many ${lower}.`,
      `Opens the same prediction on a mat with only one or two ${lower} first. It is not graded; the full item comes back after it.`)] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Never the step's answer. */
export function spokenLeverFacts(item: BaseTenItem, pulled: readonly string[], session: readonly BtProblem[]): string {
  const { problem } = item, key = worthKey(item), model = tradeModel(item, session);
  const lower = blockNounPlural(problem.place - 1);
  return [
    pulled.includes(WORTH_LEVER) && key && `A key beside the mat shows one ${blockNoun(key.place, 1)}, worth ${key.worth}.`,
    pulled.includes(DIM_LEVER) && `Every size of block except the ${blockNounPlural(problem.place)} is faded.`,
    pulled.includes(FIVES_LEVER) && `The ${blockNounPlural(problem.place)} are drawn as a row of five, a gap, then the rest.`,
    pulled.includes(MODEL_LEVER) && model && `A model mat beside the learner's shows one ${blockNoun(model.place, 1)} and ${model.before} `
      + `${blockNoun(model.place - 1, model.before)} traded into ${model.after} ${lower}.`,
    pulled.includes(GLOW_LEVER) && item.step === 'predict' && `The ${lower} column glows round the ${lower} already on the mat.`,
  ].filter((s): s is string => !!s).join(' ');
}
