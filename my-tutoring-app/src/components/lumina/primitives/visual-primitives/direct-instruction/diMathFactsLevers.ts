/**
 * The in-item levers on di-math-facts (`/add-support-tiers`, the DI pilot; table
 * qa/support-levers/di-math-facts-lever-table-2026-10-02.md). No real-learner evidence: the misses are what
 * `mathFactSpokenMisses` names.
 *
 * User ruling 2026-10-02: DI's correction is a PARALLEL-ITEM model. The tutor models a different fact of the
 * same mode, solved, and then asks the learner's own fact again. The learner's own fact is never modelled.
 *
 * Help (the screen shows more; the question is unchanged):
 * - `model_fact` (every mode): a small card beside the problem shows a different fact of the same kind, solved.
 *   Leak rule (`modelLeaks`): never the item or its turnaround, no answer within one of the item's, never a
 *   number equal to the item's answer or a spoken word sequence containing it ("one hundred two" beside 100),
 *   never one step from the item (a shared number with the other one ±1).
 * - `dot_model` (answer_fact, fact_review): dots under each printed number, in separate groups. Never a total.
 * - `take_away_dots` (subtraction_fact): dots for the first number, the last ones crossed out. Never a count of
 *   what is left.
 * - `number_path` (counting_next): the two numbers before the printed one, then it, then an empty box. Never a
 *   number above the printed one.
 * Simplify (an ungraded easier item of the same mode, then the full item):
 * - `smaller_fact` (addition): the larger printed number + 1, or 1 + 1 when the item already adds one; none
 *   when the item adds zero.
 * - `take_one_away` (subtraction): the same start, take away one.
 * - `inside_decade` (counting_next on a number ending in 9): the number after one in the same decade.
 * - `single_digit` (name_numeral, 10 and up): a one-digit numeral that is not in the item.
 *
 * Name numeral gets no dots: counting to a numeral's name is the `recited_sequence` miss, a different act.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { spokenIntegerWord } from '../math/spokenNumberWords';
import { buildMathFactItems, type DiMathFactsChallenge, type DiMathFactsChallengeType, type MathFactItem }
  from './diMathFactsDomain';

export const MODEL_LEVER = 'model_fact';
export const DOTS_LEVER = 'dot_model';
export const TAKE_AWAY_LEVER = 'take_away_dots';
export const PATH_LEVER = 'number_path';
export const SMALLER_LEVER = 'smaller_fact';
export const TAKE_ONE_LEVER = 'take_one_away';
export const DECADE_LEVER = 'inside_decade';
export const DIGIT_LEVER = 'single_digit';

const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const MODE_MISSES: Record<DiMathFactsChallengeType, string[]> = {
  // The catalog declares the take-away misses on the addition modes too; the model answers any wrong number.
  answer_fact: ['said_addend', 'said_start', 'said_change', 'added_instead', 'teen_decade_swap', ...OFF_BY],
  fact_review: ['said_addend', 'said_start', 'said_change', 'added_instead', 'teen_decade_swap', ...OFF_BY],
  subtraction_fact: ['said_start', 'said_change', 'added_instead', 'teen_decade_swap', ...OFF_BY],
  counting_next: ['said_printed', 'said_before', 'said_two_after', 'decade_rollover', 'teen_decade_swap', ...OFF_BY],
  name_numeral: ['recited_sequence', 'look_alike_numeral', 'teen_decade_swap', ...OFF_BY],
};

/** The printed numbers of an item, in order, and its operator ('' for a bare numeral). */
export function factParts(item: Pick<MathFactItem, 'terms' | 'display'>) {
  const tokens = item.terms.length ? item.terms : [item.display];
  const nums = tokens.filter(t => /^[0-9]+$/.test(t)).map(Number);
  return { nums, op: tokens.find(t => !/^[0-9]+$/.test(t)) ?? '' };
}

const subtracts = (op: string) => op === '-' || op === '−';

/** One item of a mode from its numbers, built and validated by the same path the generated pool takes. */
export function factItem(type: DiMathFactsChallengeType, a: number, b: number, id: string,
    supportTier: MathFactItem['supportTier'] = 'easy'): MathFactItem | null {
  const word = spokenIntegerWord;
  const answer = type === 'name_numeral' ? a : type === 'counting_next' ? a + 1 : type === 'subtraction_fact' ? a - b : a + b;
  if (answer < 0 || answer > 120) return null;
  const base = { id, challengeType: type, supportTier, a, b, answerNumeral: answer, answerWord: word(answer) };
  const c: DiMathFactsChallenge = type === 'name_numeral'
    ? { ...base, b: 0, display: `${a}`, problem: 'this number', solvedDisplay: `${a} = ${word(answer)}` }
    : type === 'counting_next'
      ? { ...base, b: 1, display: `${a} →`, problem: `the number after ${word(a)}`, solvedDisplay: `${a} → ${answer}` }
      : type === 'subtraction_fact'
        ? { ...base, display: `${a} - ${b}`, problem: `${word(a)} minus ${word(b)}`, solvedDisplay: `${a} - ${b} = ${answer}` }
        : { ...base, display: `${a} + ${b}`, problem: `${word(a)} plus ${word(b)}`, solvedDisplay: `${a} + ${b} = ${answer}` };
  return buildMathFactItems([c])[0] ?? null;
}

/**
 * The model's leak rule against the learner's item. The model is solved on screen and said aloud, so it must give
 * the learner no route to this item's answer but the one the model teaches: not the item or its turnaround, no
 * answer within one of the item's, the item's answer nowhere in it, and not one step from the item.
 */
export function modelLeaks(model: MathFactItem, item: MathFactItem): boolean {
  const m = factParts(model), i = factParts(item);
  if (model.display === item.display) return true;
  if (m.nums.length === 2 && i.nums.length === 2 && m.op === i.op && !subtracts(m.op)
    && m.nums[0] === i.nums[1] && m.nums[1] === i.nums[0]) return true;
  if (Math.abs(model.answerNumeral - item.answerNumeral) <= 1) return true;
  if ([...m.nums, model.answerNumeral].includes(item.answerNumeral)) return true;
  // Said aloud too: "one hundred two" beside 100 says "one hundred", and "twenty-nine" says "twenty".
  if (saysWords(`${model.problem} ${model.answerWord}`, item.answerWord)) return true;
  if (m.nums.length === 2 && i.nums.length === 2) {
    for (const [x, y] of [[0, 1], [1, 0]]) for (const [p, q] of [[0, 1], [1, 0]])
      if (m.nums[x] === i.nums[p] && Math.abs(m.nums[y] - i.nums[q]) <= 1) return true;
  }
  return false;
}

const spokenTokens = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** Whether `text`, spoken, contains the words of `answer` in order (hyphenated parts count as words). */
export function saysWords(text: string, answer: string): boolean {
  const t = spokenTokens(text), a = spokenTokens(answer);
  return t.some((_, k) => a.every((w, j) => t[k + j] === w));
}

/** The shape a model should share with the item, so the model teaches the step the item needs. */
function shapeOf(item: MathFactItem): string[] {
  const { nums } = factParts(item), [a = 0, b = 0] = nums, n = item.answerNumeral;
  switch (item.challengeType) {
    case 'name_numeral': return [String(String(n).length), n >= 13 && n <= 19 ? 'teen' : ''];
    case 'counting_next': return [String(String(a).length), a % 10 === 9 ? 'rollover' : '', n >= 13 && n <= 19 ? 'teen' : ''];
    case 'subtraction_fact': return [a > 10 ? 'from-teen' : a > 5 ? 'from-ten' : 'from-five', b === 1 ? 'one' : ''];
    default: return [n > 10 ? 'crosses-ten' : n > 5 ? 'within-ten' : 'within-five', a === b ? 'double' : '', b === 1 || a === 1 ? 'one' : '', a === 0 || b === 0 ? 'zero' : ''];
  }
}

/** Shape distance. A double is the strategy the item names, so losing it costs more than leaving the band. */
const mismatch = (x: string[], y: string[]) => x.reduce((d, v, k) => d + (v === y[k] ? 0 : v === 'double' || y[k] === 'double' ? 2 : 1), 0);

/**
 * The different fact `model_fact` shows: same mode, the item's shape where one exists, never leaking
 * (`modelLeaks`). Deterministic per item. Name numeral's look-alike pair (6 and 9) models the other one.
 */
export function modelFor(item: MathFactItem): MathFactItem | null {
  const type = item.challengeType, { nums } = factParts(item), [a = 0] = nums, n = item.answerNumeral;
  const id = `${item.id}~model`;
  const candidates: MathFactItem[] = [];
  // Zero models nothing about a fact without zero in it.
  const zeroOk = nums.includes(0);
  const push = (x: number, y: number) => {
    if (!zeroOk && type !== 'name_numeral' && type !== 'counting_next' && (x === 0 || y === 0)) return;
    const c = factItem(type, x, y, id); if (c && !modelLeaks(c, item)) candidates.push(c);
  };
  if (type === 'name_numeral') {
    if (n === 6 || n === 9) { const c = factItem(type, n === 6 ? 9 : 6, 0, id); if (c && !modelLeaks(c, item)) return c; }
    for (let x = 0; x <= Math.max(20, n + 10); x++) push(x, 0);
  } else if (type === 'counting_next') {
    for (let x = 0; x <= Math.min(119, Math.max(20, a + 20)); x++) push(x, 1);
  } else {
    // The item's band and the next one up: a within-five fact has too few numbers left once the leak rule runs.
    const ceiling = n > 10 || a > 10 ? 20 : n > 5 || a > 5 ? 20 : 10;
    for (let x = 0; x <= ceiling; x++) for (let y = 0; y <= ceiling; y++) {
      if (type === 'subtraction_fact' ? y <= x : x + y <= ceiling) push(x, y);
    }
  }
  const shape = shapeOf(item);
  const printed = (c: MathFactItem) => factParts(c).nums[0] ?? 0;
  candidates.sort((p, q) => mismatch(shapeOf(p), shape) - mismatch(shapeOf(q), shape)
    || Math.abs(p.answerNumeral - n) - Math.abs(q.answerNumeral - n)
    || printed(p) - printed(q) || p.answerNumeral - q.answerNumeral);
  return candidates[0] ?? null;
}

/** `dot_model`: the dots under each printed number of an addition fact. Only ever the printed numbers. */
export function dotGroups(item: MathFactItem): number[] | null {
  const { nums, op } = factParts(item);
  if (item.challengeType !== 'answer_fact' && item.challengeType !== 'fact_review') return null;
  return op === '+' && nums.length === 2 && nums.every(v => v <= 20) ? nums : null;
}

/** `take_away_dots`: the start as dots, the amount taken away crossed out. What is left is never counted. */
export function takeAwayDots(item: MathFactItem): { total: number; crossed: number } | null {
  const { nums, op } = factParts(item);
  return item.challengeType === 'subtraction_fact' && subtracts(op) && nums.length === 2 && nums[0] <= 20
    ? { total: nums[0], crossed: nums[1] } : null;
}

/** `number_path`: up to two numbers before the printed one, then it. The empty box after it is the question. */
export function numberPath(item: MathFactItem): number[] | null {
  const { nums } = factParts(item), a = nums[0];
  if (item.challengeType !== 'counting_next' || a === undefined) return null;
  return [a - 2, a - 1, a].filter(v => v >= 0);
}

/** The easier item a simplify lever opens, or null when this item is already that simple. */
export function simplerItem(item: MathFactItem, lever: string): MathFactItem | null {
  const { nums } = factParts(item), [a = 0, b = 0] = nums, id = `${item.id}~simpler`;
  const keep = (c: MathFactItem | null) => c && c.display !== item.display && c.answerNumeral !== item.answerNumeral
    && !(c.challengeType !== 'subtraction_fact' && factParts(c).nums.length === 2
      && factParts(c).nums[0] === b && factParts(c).nums[1] === a) ? c : null;
  switch (lever) {
    case SMALLER_LEVER:
      // Adding zero is already the simplest fact; one that adds one steps down to 1 + 1.
      if (dotGroups(item) === null || Math.min(a, b) === 0) return null;
      return Math.min(a, b) >= 2 ? keep(factItem(item.challengeType, Math.max(a, b), 1, id, item.supportTier))
        : Math.max(a, b) >= 2 ? keep(factItem(item.challengeType, 1, 1, id, item.supportTier)) : null;
    case TAKE_ONE_LEVER:
      return takeAwayDots(item) && b >= 2 ? keep(factItem('subtraction_fact', a, 1, id, item.supportTier)) : null;
    case DECADE_LEVER:
      return item.challengeType === 'counting_next' && a % 10 === 9 ? keep(factItem('counting_next', a - 4, 1, id, item.supportTier)) : null;
    case DIGIT_LEVER: {
      if (item.challengeType !== 'name_numeral' || a < 10) return null;
      const digits = new Set(String(a).split('').map(Number));
      const pick = [3, 5, 7, 2, 8, 4, 1].find(d => !digits.has(d));
      return pick === undefined ? null : keep(factItem('name_numeral', pick, 0, id, item.supportTier));
    }
    default: return null;
  }
}

/** Levers an item's tier starts with on screen. A starting position is not a pull and is never recorded. */
export const startingLevers = (item: MathFactItem): string[] => item.supportTier === 'easy' && modelFor(item) ? [MODEL_LEVER] : [];

export function mathFactLevers(item: MathFactItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const misses = MODE_MISSES[item.challengeType];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const practice = 'Opens an easier one of the same kind first. It is not graded; the full problem comes back after it.';
  const out: WorkspaceLever[] = [];
  if (modelFor(item)) out.push(lever(MODEL_LEVER, 'help', 'both', misses,
    'The learner gave a wrong number, or does not know how to start.',
    'Shows a small card beside the problem with a DIFFERENT one solved (onScreen names it). Say it as your turn ("My turn: …"), '
      + 'then ask the learner\'s own question again. Never say what the model means for this problem, and never say its answer.'));
  if (dotGroups(item)) out.push(lever(DOTS_LEVER, 'help', 'shown', ['said_addend', ...OFF_BY],
    'The learner says one of the printed numbers, or lands near the total.',
    'Puts dots under each printed number, one group per number. The total is never drawn: let the learner count them all.'));
  if (takeAwayDots(item)) out.push(lever(TAKE_AWAY_LEVER, 'help', 'shown', ['said_start', 'said_change', 'added_instead', ...OFF_BY],
    'The learner says a printed number, adds, or lands near the answer.',
    'Shows the first number as dots with the amount taken away crossed out. What is left is not counted for them.'));
  if (numberPath(item)) out.push(lever(PATH_LEVER, 'help', 'shown', ['said_printed', 'said_before', 'said_two_after', ...OFF_BY],
    'The learner repeats the number, goes back, or skips one.',
    'Shows the numbers just before the printed one, then it, then an empty box. Let the learner say what goes in the box.'));
  if (simplerItem(item, SMALLER_LEVER)) out.push(lever(SMALLER_LEVER, 'simplify', 'both', ['said_addend', ...OFF_BY],
    'This fact is too big to work out yet.', practice));
  if (simplerItem(item, TAKE_ONE_LEVER)) out.push(lever(TAKE_ONE_LEVER, 'simplify', 'both', ['said_start', 'said_change', 'added_instead'],
    'Taking this many away is too much yet.', practice));
  if (simplerItem(item, DECADE_LEVER)) out.push(lever(DECADE_LEVER, 'simplify', 'both', ['decade_rollover'],
    'The learner cannot yet cross into the next ten.', practice));
  if (simplerItem(item, DIGIT_LEVER)) out.push(lever(DIGIT_LEVER, 'simplify', 'both', ['teen_decade_swap'],
    'Two-digit numerals are too much yet.', practice));
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Names the model; never this item's answer. */
export function mathFactLeverFacts(item: MathFactItem | null, pulled: readonly string[]): string {
  if (!item) return '';
  const model = pulled.includes(MODEL_LEVER) ? modelFor(item) : null;
  const take = pulled.includes(TAKE_AWAY_LEVER) ? takeAwayDots(item) : null;
  return [
    model && `Beside the problem, a model card shows a different problem solved: ${model.challengeType === 'name_numeral'
      ? `the numeral ${model.display}, ${model.answerWord}` : model.solvedDisplay} (${model.problem} is ${model.answerWord}). It is not this problem.`,
    pulled.includes(DOTS_LEVER) && dotGroups(item) && 'Under each printed number is a group of that many dots. No total is shown.',
    take && 'The first number is drawn as dots, and the amount taken away is crossed out. What is left is not counted.',
    pulled.includes(PATH_LEVER) && numberPath(item) && 'A number path shows the numbers just before the printed number, then it, then an empty box.',
  ].filter((s): s is string => !!s).join(' ');
}
