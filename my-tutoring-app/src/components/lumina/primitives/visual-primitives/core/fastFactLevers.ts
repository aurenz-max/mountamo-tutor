/**
 * fast-fact's in-item levers (`/add-support-tiers`; report qa/eval-reports/fast-fact-levers-2026-10-09.md). The misses
 * are what `fastFactMiss` observes on a tapped choice; there is no real-learner evidence. The drill is subject-agnostic
 * and untimed, so every lever is built by code from what the item already carries, and none adds a clock.
 *
 * - `spread_pictures` (help, shown): a counting question ("how many", "count") over a picture of one repeated glyph
 *   gets the same glyph drawn again apart, one per box, each box touchable to mark it counted. Answers the count misses.
 *   Withheld by `spreadLeak`; the boxes carry no number and the scene fact never says how many.
 * - `count_model` (help, shown): a two-number sum, difference or product in the question ("7 + 3 = ?") gets a dot model:
 *   one group of dots per number for a sum, the first number's dots with the second's drawn hollow for a difference,
 *   rows for a product. Answers the arithmetic misses. Withheld by `modelLeak` (the key is not that expression's value,
 *   too many dots, a negative or fractional result); the model carries no numeral and never draws the result as one
 *   group, and the scene fact never says how many there are in all.
 * - `drop_far_choice` (simplify, shown, on the item): greys out one wrong choice the learner has not tapped, the farthest
 *   from a numeric key, else the last untried one. Knowledge-check's lever (user ruling 09-27: removing a choice is
 *   allowed and is assisted work). Guard: at least two untried choices remain after the drop, so it never leaves the
 *   answer alone. A drill item has no code-built twin in an arbitrary subject, so this is its only simplify.
 *
 * No lever on a two-choice item, or on a three-choice item that is neither counting nor arithmetic once a choice has
 * been tapped wrong: dropping one would leave only the answer, and code cannot picture an arbitrary fact.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FastFactChallenge } from './FastFact';
import { isAnswerCorrect, parseExpression, type FastFactMiss } from './fastFactWorkspace';

export const SPREAD_LEVER = 'spread_pictures';
export const MODEL_LEVER = 'count_model';
export const DROP_LEVER = 'drop_far_choice';

/** Per item: the levers pulled, the choices greyed out, and the choices tapped wrong. */
export interface FastFactLeverState {
  pulled: readonly string[];
  dropped: readonly string[];
  picked: readonly string[];
}
export const NO_LEVERS: FastFactLeverState = { pulled: [], dropped: [], picked: [] };

const NUM = /^\s*-?\d+(\.\d+)?\s*$/;
const asNumber = (s: string) => (NUM.test(s) ? Number(s) : NaN);
const keyNumber = (c: FastFactChallenge) => asNumber(c.correctAnswer);
const graphemes = (text: string) =>
  Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.trim()), s => s.segment).filter(g => g.trim());

const MAX_SPREAD = 20;
const COUNTING = /\bhow many\b|\bcount\b/i;

/** The repeated glyph and how many times it is drawn, when the picture is one glyph repeated. */
export function pictureRun(c: FastFactChallenge): { picture: string; count: number } | null {
  const v = c.prompt.visual;
  if (v?.type !== 'emoji' || !v.emoji) return null;
  const gs = graphemes(v.emoji);
  return gs.length && gs.every(g => g === gs[0]) ? { picture: gs[0], count: gs.length } : null;
}

/** Why the picture may not be spread out, or null when it may. */
export function spreadLeak(c: FastFactChallenge): string | null {
  if (Number.isNaN(keyNumber(c))) return 'the answer is not a number';
  if (!COUNTING.test(`${c.prompt.subtext ?? ''} ${c.prompt.text}`)) return 'the question does not ask to count the picture';
  const run = pictureRun(c);
  if (!run) return 'no picture of one repeated glyph';
  if (run.count > MAX_SPREAD) return `more than ${MAX_SPREAD} pictures`;
  return null;
}

/** The dot model for a two-number expression: groups (sum), taken away (difference) or rows (product). */
export interface CountModel { kind: 'sum' | 'difference' | 'product'; a: number; b: number }
const MAX_DOTS = 30;

/** Why the expression may not be modelled with dots, or null when it may. */
export function modelLeak(c: FastFactChallenge): string | null {
  const key = keyNumber(c);
  if (Number.isNaN(key)) return 'the answer is not a number';
  const e = parseExpression(`${c.prompt.text} ${c.prompt.visual?.type === 'text-large' ? c.prompt.visual.largeText ?? '' : ''}`);
  if (!e || e.op === '÷') return 'no sum, difference or product in the question';
  const { a, b } = e;
  if (![a, b].every(n => Number.isInteger(n) && n >= 0)) return 'a number is not a whole number';
  const value = e.op === '+' ? a + b : e.op === '-' ? a - b : a * b;
  // "9 + 9 = 8 + ___": the expression parsed is not the one the key answers.
  if (value !== key) return 'the answer is not the value of the expression in the question';
  if (value < 0) return 'the difference is negative';
  const dots = e.op === '+' ? a + b : e.op === '-' ? a : a * b;
  if (dots > MAX_DOTS || dots === 0) return `${dots === 0 ? 'no' : 'too many'} dots to draw`;
  return null;
}

export function countModel(c: FastFactChallenge): CountModel | null {
  if (modelLeak(c)) return null;
  const e = parseExpression(`${c.prompt.text} ${c.prompt.visual?.type === 'text-large' ? c.prompt.visual.largeText ?? '' : ''}`)!;
  return { kind: e.op === '+' ? 'sum' : e.op === '-' ? 'difference' : 'product', a: e.a, b: e.b };
}

/**
 * The wrong choice `drop_far_choice` greys out now, or null when none may go: fewer than two untried choices would
 * remain. Numeric menus drop the choice farthest from the key; any other menu, the last untried wrong choice.
 */
export function farChoice(c: FastFactChallenge, s: FastFactLeverState): string | null {
  const live = c.options.filter(o => !s.dropped.includes(o));
  const tried = new Set(s.picked.filter(p => live.includes(p))).size;
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(o => !isAnswerCorrect(o, c) && !s.picked.includes(o));
  const want = keyNumber(c);
  if (!Number.isNaN(want) && live.every(o => !Number.isNaN(asNumber(o)))) {
    return [...foils].sort((x, y) => Math.abs(asNumber(y) - want) - Math.abs(asNumber(x) - want))[0] ?? null;
  }
  return foils.at(-1) ?? null;
}

/** The misses each lever answers (J9, J12). */
const COUNT_ANSWERS = ['one_less', 'one_more', 'other_number'] satisfies FastFactMiss[];
const MODEL_ANSWERS = ['wrong_operation', 'one_less', 'one_more', 'other_number'] satisfies FastFactMiss[];
const DROP_ANSWERS = ['wrong_operation', 'one_less', 'one_more', 'other_number', 'other_choice'] satisfies FastFactMiss[];

/** The levers this item declares, with their state. A lever that cannot be pulled now and was not pulled is left out. */
export function fastFactLevers(c: FastFactChallenge | null | undefined, s: FastFactLeverState): WorkspaceLever[] {
  if (!c) return [];
  const levers: WorkspaceLever[] = [];
  if (!spreadLeak(c)) levers.push({ id: SPREAD_LEVER, kind: 'help', carrier: 'shown', pulled: s.pulled.includes(SPREAD_LEVER),
    answers: COUNT_ANSWERS,
    when: 'The learner taps a number one off, or another number, when counting the picture.',
    does: 'Draws the pictures again spread apart, one per box; touching a box marks it counted. The boxes carry no '
      + 'numbers. Never say how many there are; the learner counts.' });
  if (!modelLeak(c)) levers.push({ id: MODEL_LEVER, kind: 'help', carrier: 'shown', pulled: s.pulled.includes(MODEL_LEVER),
    answers: MODEL_ANSWERS,
    when: 'The learner taps a wrong number on a sum, difference or product, or is stuck on one.',
    does: 'Draws the numbers in the question as dots: a group for each number of a sum, the dots taken away drawn '
      + 'hollow for a difference, rows for a product. No numbers are drawn. Never say how many in all; the learner counts.' });
  const dropPulled = s.pulled.includes(DROP_LEVER);
  if (dropPulled || farChoice(c, s)) levers.push({ id: DROP_LEVER, kind: 'simplify', carrier: 'shown', pulled: dropPulled,
    answers: DROP_ANSWERS,
    when: 'The learner still taps a wrong choice after help, or is stuck between too many choices.',
    does: 'Greys out one wrong choice the learner has not tapped, so fewer remain. The next answer counts as helped.' });
  return levers;
}

/** What the pulled levers put on screen, for the tutor and JEV. Names a greyed-out choice, never the key or a total. */
export function leversOnScreen(c: FastFactChallenge, s: FastFactLeverState): string | null {
  const parts: string[] = [];
  const run = pictureRun(c);
  if (s.pulled.includes(SPREAD_LEVER) && run && !spreadLeak(c))
    parts.push(`under the picture, the ${run.picture} are drawn again spread apart, one per box, with no numbers; the `
      + 'learner can touch a box to mark it counted');
  const model = s.pulled.includes(MODEL_LEVER) ? countModel(c) : null;
  if (model) parts.push(model.kind === 'sum'
    ? `under the question, ${model.a} dots and ${model.b} dots in two colors, one group for each number; how many in all is not given`
    : model.kind === 'difference'
      ? `under the question, ${model.a} dots with ${model.b} of them drawn hollow, taken away; how many are left is not given`
      : `under the question, ${model.a} rows of ${model.b} dots; how many in all is not given`);
  for (const d of s.dropped) {
    const i = c.options.indexOf(d);
    if (i >= 0) parts.push(`choice ${i + 1}, "${d}", is greyed out and is not the answer`);
  }
  return parts.length ? parts.join('; ') : null;
}
