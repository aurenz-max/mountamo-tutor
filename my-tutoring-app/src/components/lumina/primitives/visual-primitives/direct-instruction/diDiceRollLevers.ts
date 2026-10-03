/**
 * The in-item levers on di-dice-roll (`/add-support-tiers`, DI family 2; table
 * qa/support-levers/di-dice-roll-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `diceSpokenMisses` names, and the catalog's `commonStruggles`.
 *
 * DI's correction is a PARALLEL-ITEM model (user ruling 2026-10-02): a different roll, solved, then the child's.
 *
 * Help (the screen shows more; the question is unchanged):
 * - `model_roll` (every mode): a small card with a different roll, solved. Count and sum: never the item's faces
 *   or their swap, no face the child's dice show, no total within one of the item's, the item's answer nowhere in it
 *   (faces, total, spoken words), never one step from the item. Compare (R1, 2026-10-03): THREE pairs, one per answer
 *   (left more, right more, same), sharing no face with the child's dice. One pair would point at an answer: the same
 *   relation hands it over, the other relation can be inverted.
 * - `touch_dots` (count_pips, sum_two_dice): the dots on the child's own dice can be tapped; a tapped dot gets a
 *   ring. Never a number or an order.
 * - `both_bracket` (sum_two_dice): one bracket under both dice. No number, no combined group.
 * Simplify (an ungraded easier roll of the same mode; the child rolls it, then the full roll comes back):
 * - `fewer_dots` (count_pips, 4 dots or more): a die with 2 or 3 dots.
 * - `far_pair` (compare_dice, a non-tie under 3 apart): a pair 3 or more apart with the OTHER relation.
 * - `smaller_dice` (sum_two_dice): the larger face and 1.
 *
 * compare_dice gets no in-item help: lines matching dots, glowing extra dots or dots in rows all show the answer.
 * A tie gets no simplify: an easier tie is answered "same", and the child would repeat it on the full roll.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { saysWords } from './diMathFactsLevers';
import { diceValuesFor, type DiDiceRollChallenge, type DiDiceRollChallengeType, type DieValue } from './diDiceRollScript';

export const MODEL_LEVER = 'model_roll';
export const TOUCH_LEVER = 'touch_dots';
export const BRACKET_LEVER = 'both_bracket';
export const FEWER_LEVER = 'fewer_dots';
export const FAR_LEVER = 'far_pair';
export const SMALLER_LEVER = 'smaller_dice';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const MODE_MISSES: Record<DiDiceRollChallengeType, string[]> = {
  count_pips: ['skipped_a_number', ...OFF_BY],
  compare_dice: ['other_die', 'said_same', 'picked_a_side', 'said_number'],
  sum_two_dice: ['said_addend', ...OFF_BY],
};

const relation = (a: number, b: number) => a === b ? 'same' as const : a > b ? 'left' as const : 'right' as const;

/** One roll of a mode, shaped the way the generator shapes it. The faces are final before the roll. */
export function diceItem(type: DiDiceRollChallengeType, a: number, b: number, id: string,
    supportTier?: DiDiceRollChallenge['supportTier']): DiDiceRollChallenge {
  const value = a as DieValue, secondValue = b as DieValue, tier = supportTier ? { supportTier } : {};
  if (type === 'compare_dice') {
    const comparison = relation(a, b);
    return { id, challengeType: type, action: type, answerKind: 'voice', responseClass: 'short_spoken_word', sides: 6,
      value, secondValue, comparison, spokenAnswer: comparison, asrAliases: [comparison], ...tier };
  }
  if (type === 'sum_two_dice') {
    const total = a + b;
    return { id, challengeType: type, action: type, answerKind: 'voice', responseClass: 'number_word_to_20', sides: 6,
      value, secondValue, total, spokenAnswer: WORDS[total], asrAliases: [WORDS[total], String(total)], ...tier };
  }
  return { id, challengeType: 'count_pips', action: 'count_pips', answerKind: 'voice', responseClass: 'number_word_to_20',
    sides: 6, value, spokenAnswer: WORDS[a], asrAliases: [WORDS[a], String(a)], ...tier };
}

/** The number a counted roll is answered with; null for a comparison. */
const answerOf = (item: DiDiceRollChallenge) =>
  item.challengeType === 'count_pips' ? item.value : item.challengeType === 'sum_two_dice' ? item.total : null;

/** The model's leak rule against the child's roll (see the module docblock). */
export function modelLeaks(model: DiDiceRollChallenge, item: DiDiceRollChallenge): boolean {
  const m = diceValuesFor(model), i = diceValuesFor(item);
  if (m.join() === i.join() || (m.length === 2 && m[0] === i[1] && m[1] === i[0])) return true;
  // A model naming a face the child's dice show ("six dots and three dots" beside a 3) counts that die for them.
  if (m.some(v => i.includes(v))) return true;
  if (item.challengeType === 'compare_dice') return false;
  const mine = answerOf(model)!, theirs = answerOf(item)!;
  if (Math.abs(mine - theirs) <= 1) return true;
  if ([...m, mine].includes(theirs)) return true;
  if (saysWords(model.spokenAnswer, item.spokenAnswer)) return true;
  if (m.length === 2 && i.length === 2) {
    for (const [x, y] of [[0, 1], [1, 0]]) for (const [p, q] of [[0, 1], [1, 0]])
      if (m[x] === i[p] && Math.abs(m[y] - i[q]) <= 1) return true;
  }
  return false;
}

/** The different roll `model_roll` shows. Deterministic per item; null when no roll passes the leak rule. */
export function modelFor(item: DiDiceRollChallenge): DiDiceRollChallenge | null {
  const id = `${item.id}~model`, faces = [1, 2, 3, 4, 5, 6];
  const [a, b = 0] = diceValuesFor(item);
  const pass = (c: DiDiceRollChallenge) => !modelLeaks(c, item);
  if (item.challengeType === 'count_pips') {
    return faces.map(v => diceItem('count_pips', v, 0, id)).filter(pass)
      .sort((p, q) => Math.abs(p.value - a) - Math.abs(q.value - a) || p.value - q.value)[0] ?? null;
  }
  const pairs = faces.flatMap(x => faces.map(y => diceItem(item.challengeType, x, y, id))).filter(pass);
  if (item.challengeType === 'compare_dice') return compareModels(item)?.[0] ?? null;
  const total = a + b;
  return pairs.sort((p, q) => Math.abs(answerOf(p)! - total) - Math.abs(answerOf(q)! - total)
    || q.value - p.value || (diceValuesFor(p)[1] ?? 0) - (diceValuesFor(q)[1] ?? 0))[0] ?? null;
}

/**
 * The compare model (R1): a left-more pair, its swap (right more) and a tie, in that fixed order, sharing no face with
 * the child's dice. The pair is as far apart as the child's (2 for a tie), so it shows the same kind of difference.
 */
export function compareModels(item: DiDiceRollChallenge): DiDiceRollChallenge[] | null {
  if (item.challengeType !== 'compare_dice') return null;
  const [a, b = a] = diceValuesFor(item), gap = Math.abs(a - b) || 2;
  const free = [1, 2, 3, 4, 5, 6].filter(v => v !== a && v !== b);
  const pairs = free.flatMap(x => free.filter(y => y < x).map(y => [x, y] as const))
    .sort((p, q) => Math.abs(p[0] - p[1] - gap) - Math.abs(q[0] - q[1] - gap) || q[0] - p[0]);
  if (!pairs.length) return null;
  const [hi, lo] = pairs[0];
  const tie = free.find(v => v !== hi && v !== lo) ?? hi;
  return [diceItem('compare_dice', hi, lo, `${item.id}~model-left`), diceItem('compare_dice', lo, hi, `${item.id}~model-right`),
    diceItem('compare_dice', tie, tie, `${item.id}~model-same`)];
}

/** The easier roll a simplify lever opens, or null when the child's roll is already that simple. */
export function simplerRoll(item: DiDiceRollChallenge, lever: string): DiDiceRollChallenge | null {
  const id = `${item.id}~simpler`, [a, b = 0] = diceValuesFor(item), tier = item.supportTier;
  switch (lever) {
    case FEWER_LEVER:
      return item.challengeType === 'count_pips' && a >= 4 ? diceItem('count_pips', a >= 5 ? 3 : 2, 0, id, tier) : null;
    case FAR_LEVER: {
      if (item.challengeType !== 'compare_dice' || a === b || Math.abs(a - b) >= 3) return null;
      // The other relation, three apart: the child's word is not the practice answer.
      return item.comparison === 'left' ? diceItem('compare_dice', 2, 5, id, tier) : diceItem('compare_dice', 5, 2, id, tier);
    }
    case SMALLER_LEVER: {
      if (item.challengeType !== 'sum_two_dice') return null;
      const [hi, lo] = a >= b ? [a, b] : [b, a];
      const easier = lo >= 2 ? diceItem('sum_two_dice', hi, 1, id, tier) : hi >= 2 ? diceItem('sum_two_dice', 1, 1, id, tier) : null;
      return easier && answerOf(easier) !== answerOf(item) && !(easier.value === b && diceValuesFor(easier)[1] === a) ? easier : null;
    }
    default: return null;
  }
}

/** Levers an item's tier starts with on screen (no tier is easy here). Not a pull; never recorded. */
export const startingLevers = (item: DiDiceRollChallenge): string[] =>
  (item.supportTier ?? 'easy') === 'easy' && modelFor(item) ? [MODEL_LEVER] : [];

export function diceLevers(item: DiDiceRollChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const practice = 'Opens an easier roll of the same kind first; the learner rolls it. It is not graded; the full roll comes back after it.';
  const out: WorkspaceLever[] = [];
  if (modelFor(item)) out.push(lever(MODEL_LEVER, 'help', 'both', MODE_MISSES[item.challengeType],
    'The learner gave a wrong answer, or does not know how to start.',
      item.challengeType === 'compare_dice'
        // R1: one pair per answer, so the card points at none of them; all three are voiced, in order, every time.
        ? 'Shows a small card beside the dice with THREE different pairs, solved: the left die has more, the right die has '
          + 'more, and the same. Say all three as your turn, in that order, pointing at each ("My turn: here the left die has '
          + 'more…"); never only one. Then ask about the learner\'s own dice again.'
        : 'Shows a small card beside the dice with a DIFFERENT roll, solved (onScreen names it). Say it as your turn ("My turn: …"), '
          + 'then ask about the learner\'s own dice again. Never say what the model means for their dice.'));
  if (item.challengeType !== 'compare_dice') out.push(lever(TOUCH_LEVER, 'help', 'shown', ['skipped_a_number', 'one_short', 'one_over'],
    'The learner skips a dot or counts one twice.',
    'Lets the learner tap each dot as they count it; a tapped dot gets a ring. No numbers.'));
  if (item.challengeType === 'sum_two_dice') out.push(lever(BRACKET_LEVER, 'help', 'both', ['said_addend'],
    'The learner says the dots on one die only.',
    'Draws one bracket under both dice: the question is about all the dots on both.'));
  if (simplerRoll(item, FEWER_LEVER)) out.push(lever(FEWER_LEVER, 'simplify', 'both', ['skipped_a_number', ...OFF_BY],
    'This many dots is too many to count yet.', practice));
  if (simplerRoll(item, FAR_LEVER)) out.push(lever(FAR_LEVER, 'simplify', 'both', ['other_die', 'said_same'],
    'These two are too close to tell apart yet.', practice));
  if (simplerRoll(item, SMALLER_LEVER)) out.push(lever(SMALLER_LEVER, 'simplify', 'both', ['said_addend', ...OFF_BY],
    'Adding these two dice is too much yet.', practice));
  return out;
}

const dots = (n: number) => `${WORDS[n]} dot${n === 1 ? '' : 's'}`;

/** What the pulled levers put on screen, as a scene fact. Names the model; never the child's answer. */
export function diceLeverFacts(item: DiDiceRollChallenge | null, pulled: readonly string[]): string {
  if (!item) return '';
  const model = pulled.includes(MODEL_LEVER) ? modelFor(item) : null;
  const shown = !model ? '' : model.challengeType === 'count_pips'
    ? `a single die with ${dots(model.value)}, answered ${model.spokenAnswer}`
    : model.challengeType === 'sum_two_dice'
      ? `a pair of dice with ${dots(model.value)} and ${dots(model.secondValue)}, ${model.spokenAnswer} altogether`
      : 'three pairs of dice: in the first the left die has more, in the second the right die has more, in the third they '
        + 'are the same; a star marks the die with more';
  return [
    model && `Beside the dice, a model card shows ${model.challengeType === 'compare_dice' ? 'different rolls' : 'a different roll'}, solved: ${shown}. It is not this roll.`,
    pulled.includes(TOUCH_LEVER) && item.challengeType !== 'compare_dice' && 'The dots on the learner\'s dice can be tapped; each tapped dot gets a ring.',
    pulled.includes(BRACKET_LEVER) && item.challengeType === 'sum_two_dice' && 'A bracket under both dice shows the question is about all their dots.',
  ].filter((s): s is string => !!s).join(' ');
}
