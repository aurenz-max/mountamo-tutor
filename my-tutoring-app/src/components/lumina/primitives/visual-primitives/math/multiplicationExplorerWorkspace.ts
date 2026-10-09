/**
 * Multiplication explorer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C15).
 *
 * Pure: the component and any probe read the same fact, ask, scene and check. Every mode is one typed number checked
 * by the activity itself (`multiplicationAnswerCorrect`), so the tutor is never handed the product or, on
 * missing_factor, the hidden factor. This module also owns what the screen may show while an item is open: the asked
 * value is a `?` in the equation, and a picture that would show it (a factor's groups, a fluency fact's array) is not
 * drawn (`modelShown`).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { MultiplicationExplorerChallenge, MultiplicationRepresentation } from './MultiplicationExplorer';

export interface ExplorerFactValue { factor1: number; factor2: number; product: number }
export type ExplorerChallengeType = MultiplicationExplorerChallenge['type'];
export type AskedSlot = 'factor1' | 'factor2' | 'product';

/**
 * Parse a per-challenge `targetFact` string ("3 × 4 = 12") into its factors. Back-compat only: new data ships the
 * structured `challenge.fact`. Product is recomputed from the factors; a shipped "= p" that disagrees is never trusted.
 */
export function parseTargetFact(targetFact?: string): ExplorerFactValue | null {
  if (!targetFact) return null;
  const nums = targetFact.match(/-?\d+/g);
  if (!nums || nums.length < 2) return null;
  const factor1 = parseInt(nums[0], 10);
  const factor2 = parseInt(nums[1], 10);
  if (!Number.isFinite(factor1) || !Number.isFinite(factor2)) return null;
  return { factor1, factor2, product: factor1 * factor2 };
}

/**
 * The fact a challenge is asked, drawn AND judged on: the structured per-challenge `fact`, then a parsed `targetFact`,
 * then the session fact. Product always recomputed. (History in `MultiplicationExplorer.tsx`: the panels once drew
 * the session fact while grading read the challenge's, a split-brain fixed 2026-08-10.)
 */
export function resolveChallengeFact(challenge: Pick<MultiplicationExplorerChallenge, 'fact' | 'targetFact'> | null,
  sessionFact: ExplorerFactValue): ExplorerFactValue {
  const own = challenge?.fact;
  if (own && Number.isFinite(own.factor1) && Number.isFinite(own.factor2)) {
    return { factor1: own.factor1, factor2: own.factor2, product: own.factor1 * own.factor2 };
  }
  return parseTargetFact(challenge?.targetFact) ?? sessionFact;
}

/** The value the learner types. A missing hiddenValue asks the product (the component always graded it so). */
export const askedSlot = (c: Pick<MultiplicationExplorerChallenge, 'hiddenValue'>): AskedSlot => c.hiddenValue ?? 'product';
export const expectedAnswer = (c: Pick<MultiplicationExplorerChallenge, 'hiddenValue'>, fact: ExplorerFactValue) =>
  fact[askedSlot(c)];

/**
 * Whether the representation panels may be drawn while the item is open. A factor's groups, rows or jumps ARE the
 * missing factor; a fluency item is recall, and a countable array beside it turns it into counting.
 */
export const modelShown = (c: Pick<MultiplicationExplorerChallenge, 'hiddenValue' | 'type'>) =>
  askedSlot(c) === 'product' && c.type !== 'fluency';

/** The equation as the screen prints it: the asked value is `?`; the product is printed when it is given. */
export function equationText(c: Pick<MultiplicationExplorerChallenge, 'hiddenValue'>, fact: ExplorerFactValue, flipped = false): string {
  const slot = askedSlot(c);
  const f1 = slot === 'factor1' ? '?' : String(fact.factor1);
  const f2 = slot === 'factor2' ? '?' : String(fact.factor2);
  const [left, right] = flipped ? [f2, f1] : [f1, f2];
  return `${left} × ${right} = ${slot === 'product' ? '?' : fact.product}`;
}

/** The numbers an item gives: its factors and product, less the one asked. */
const givens = (c: Pick<MultiplicationExplorerChallenge, 'hiddenValue'>, fact: ExplorerFactValue) => {
  const slot = askedSlot(c);
  return (['factor1', 'factor2', 'product'] as const).filter(s => s !== slot).map(s => fact[s]);
};

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** A number word's value ("seven", "sevens", "twenty-one", "hundred" is not read), else null. */
function wordValue(word: string): number | null {
  const plain = (w: string): number | null => {
    if (UNITS.includes(w)) return UNITS.indexOf(w);
    const [tens, unit] = w.split('-');
    const t = TENS.indexOf(tens);
    if (t < 2) return null;
    if (unit === undefined) return t * 10;
    const u = UNITS.indexOf(unit);
    return u >= 1 && u <= 9 ? t * 10 + u : null;
  };
  // "threes", "sixes", "twenties" are the skip-count by that number.
  return plain(word) ?? (word.endsWith('es') ? plain(word.slice(0, -2)) : null)
    ?? (word.endsWith('ies') ? plain(`${word.slice(0, -3)}y`) : null) ?? (word.endsWith('s') ? plain(word.slice(0, -1)) : null);
}

/** Every number `text` names, in digits or words. */
export const numbersIn = (text: string): number[] => [
  ...(text.match(/\d+/g) ?? []).map(n => parseInt(n, 10)),
  ...(text.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? []).map(wordValue).filter((n): n is number => n !== null),
];

/** Whether `text` names the answer (in digits or words) when it is not also one of the item's givens. */
export function textLeaks(text: string, c: Pick<MultiplicationExplorerChallenge, 'hiddenValue'>, fact: ExplorerFactValue): boolean {
  const answer = expectedAnswer(c, fact);
  if (givens(c, fact).includes(answer)) return false;
  return numbersIn(text).includes(answer);
}

/** The code-built ask for a type and fact: the generator's no-LLM fallback wording, and the practice item's. */
export function codeAsk(type: ExplorerChallengeType, slot: AskedSlot, fact: ExplorerFactValue): string {
  const { factor1: a, factor2: b, product: p } = fact;
  switch (type) {
    case 'connect': return `All the pictures show ${a} × ${b}. How many are there in total?`;
    case 'commutative': return `${a} × ${b} and ${b} × ${a} make the same total. What is it?`;
    case 'distributive': return `Break ${a} × ${b} into easier parts. What is the total?`;
    case 'missing_factor':
      return slot === 'factor2' ? `${a} × ? = ${p}. What is the missing number?` : `? × ${b} = ${p}. What is the missing number?`;
    case 'fluency': return `What is ${a} × ${b}?`;
    default: return `Find ${a} groups of ${b}. How many is that in total?`;
  }
}

/** What the learner is asked: the generated instruction, or the code ask when the instruction prints the answer. */
export function askFor(c: MultiplicationExplorerChallenge, fact: ExplorerFactValue): string {
  const text = (c.instruction ?? '').trim();
  return text && !textLeaks(text, c, fact) ? text : codeAsk(c.type, askedSlot(c), fact);
}

/** The hint a wrong answer shows, or a plain line when the generated hint prints the answer ("Count up: 4, 8, 12"). */
export function hintFor(c: MultiplicationExplorerChallenge, fact: ExplorerFactValue): string {
  const text = (c.hint ?? '').trim();
  return text && !textLeaks(text, c, fact) ? `Not quite. ${text}` : 'Not quite. Try again!';
}

export function workspaceAssignment(c: MultiplicationExplorerChallenge, sessionFact: ExplorerFactValue): TeachingAssignment {
  return { id: c.id, task: askFor(c, resolveChallengeFact(c, sessionFact)), response: 'gesture' };
}

/** Whether a typed answer is right, by the activity's own rule. */
export function multiplicationAnswerCorrect(c: MultiplicationExplorerChallenge, fact: ExplorerFactValue, typed: string): boolean {
  return parseInt(typed, 10) === expectedAnswer(c, fact);
}

export function describeAnswer(c: Pick<MultiplicationExplorerChallenge, 'hiddenValue'>, typed: string): string {
  const what = askedSlot(c) === 'product' ? 'the answer' : 'the missing factor';
  return typed.trim() ? `Typed ${typed.trim()} as ${what}` : `No answer typed yet`;
}

/** The split the break-apart display draws: factor1 as at most 5 plus the rest. */
export const distributiveSplit = (fact: ExplorerFactValue) => {
  const first = Math.min(5, fact.factor1 - 1);
  return [first, fact.factor1 - first] as const;
};

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the typed number, drawn from the catalog's
 * commonStruggles (groups confused with items per group, the distributive parts, missing-factor confusion). Only the
 * observable pattern:
 * - the product asked: `added_factors` (the two factors added), `one_part_only` (distributive: one of the two partial
 *   products on the break-apart), `one_group_short` / `one_group_over` (one group of either factor too few or too
 *   many), `off_by_one`, `other_product`;
 * - a factor asked: `gave_product` (the product typed back), `gave_known_factor` (the factor already shown),
 *   `subtracted` (the product less the known factor), `one_jump_off` (one more or less than the factor), `other_factor`.
 */
export type MultiplicationMiss = 'added_factors' | 'one_part_only' | 'one_group_short' | 'one_group_over' | 'off_by_one' | 'other_product'
  | 'gave_product' | 'gave_known_factor' | 'subtracted' | 'one_jump_off' | 'other_factor';

export const PRODUCT_MISSES: readonly MultiplicationMiss[] = ['added_factors', 'one_group_short', 'one_group_over', 'off_by_one', 'other_product'];
export const DISTRIBUTIVE_MISSES: readonly MultiplicationMiss[] = ['added_factors', 'one_part_only', 'one_group_short', 'one_group_over',
  'off_by_one', 'other_product'];
export const FACTOR_MISSES: readonly MultiplicationMiss[] = ['gave_product', 'gave_known_factor', 'subtracted', 'one_jump_off', 'other_factor'];

export const missesFor = (type: ExplorerChallengeType): readonly MultiplicationMiss[] =>
  type === 'missing_factor' ? FACTOR_MISSES : type === 'distributive' ? DISTRIBUTIVE_MISSES : PRODUCT_MISSES;

export function multiplicationMiss(c: MultiplicationExplorerChallenge | null, fact: ExplorerFactValue, typed: string): MultiplicationMiss | undefined {
  if (!c) return undefined;
  const n = parseInt(typed, 10);
  const answer = expectedAnswer(c, fact);
  if (n === answer) return undefined;
  const { factor1: a, factor2: b, product: p } = fact;
  const slot = askedSlot(c);
  if (slot !== 'product') {
    const known = slot === 'factor1' ? b : a;
    if (!Number.isInteger(n)) return 'other_factor';
    if (n === p) return 'gave_product';
    if (n === known) return 'gave_known_factor';
    if (n === p - known) return 'subtracted';
    if (Math.abs(n - answer) === 1) return 'one_jump_off';
    return 'other_factor';
  }
  if (!Number.isInteger(n)) return 'other_product';
  if (n === a + b) return 'added_factors';
  if (c.type === 'distributive') {
    const [x, y] = distributiveSplit(fact);
    if (x > 0 && (n === x * b || n === y * b)) return 'one_part_only';
  }
  if (n === p - a || n === p - b) return 'one_group_short';
  if (n === p + a || n === p + b) return 'one_group_over';
  if (Math.abs(n - p) === 1) return 'off_by_one';
  return 'other_product';
}

/** What is on screen of the learner's work and the panels, beside what the item draws. */
export interface ExplorerView {
  answer: string;
  /** The panel in view: a representation tab, or 'all' (connect, or the Connect phase). */
  representation: MultiplicationRepresentation | 'all';
  flipped: boolean;
  /** The break-apart display is open (the Strategy phase's "Break It Up!"). */
  breakdownShown: boolean;
  /** A wrong check still on screen, in the learner's terms, until Try again clears it. */
  lastWrong: string | null;
}

const PANEL: Record<Exclude<MultiplicationRepresentation, 'all'>, (g: number, n: number) => string> = {
  groups: (g, n) => `equal groups: ${g} circles with ${n} dots in each`,
  array: (g, n) => `an array of ${g} rows and ${n} columns of squares`,
  repeated_addition: (g, n) => `repeated addition: ${n} written ${g} times with plus signs, no sum`,
  number_line: (g, n) => `a number line with ${g} jumps of ${n} from 0; the multiples before the landing point are labelled, the landing point is not`,
  area_model: (g, n) => `an area model: a rectangle of ${g} by ${n} unit squares, sides labelled ${g} and ${n}`,
};

/** What is drawn and asked. Every number here is printed on the screen; the asked value is not. */
export function workspaceScene(c: MultiplicationExplorerChallenge, fact: ExplorerFactValue, view: ExplorerView): WorkspaceScene {
  const drawn: Record<string, string | number> = { equation: equationText(c, fact, view.flipped) };
  const groups = view.flipped ? fact.factor2 : fact.factor1, each = view.flipped ? fact.factor1 : fact.factor2;
  if (!modelShown(c)) {
    drawn.picture = c.type === 'fluency' ? 'none: a bare fact to recall' : 'none: a picture of the groups would show the missing factor';
  } else if (view.representation === 'all') {
    drawn.picture = `the same fact five ways side by side: ${Object.values(PANEL).map(f => f(groups, each)).join('; ')}`;
  } else {
    drawn.picture = PANEL[view.representation](groups, each);
  }
  if (modelShown(c) && view.breakdownShown) {
    const [x, y] = distributiveSplit(fact);
    drawn.breakApart = `${x} × ${fact.factor2} + ${y} × ${fact.factor2} = ${x * fact.factor2} + ${y * fact.factor2} = ?`;
  }
  return {
    objects: [],
    facts: {
      kind: c.type,
      ...drawn,
      learnerWork: view.lastWrong ? `${view.lastWrong}, marked wrong` : describeAnswer(c, view.answer),
      constraints: 'The learner types one number in the answer box and presses Check; the activity checks it '
        + 'itself. The learner may switch the picture tabs. You cannot type or press for the learner.',
    },
  };
}
