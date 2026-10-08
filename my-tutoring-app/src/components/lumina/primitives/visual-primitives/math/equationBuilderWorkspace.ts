/**
 * Equation builder on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C9), plain shape: `useWorkspaceProgress` in place of
 * `useChallengeProgress`. Every challenge is one checked gesture; the builder's own Check is the
 * judge and no key reaches the tutor:
 *   - build / rewrite: tiles placed in the slot row, then Check;
 *   - missing-value: a number option tapped, then Check;
 *   - true-false: True or False tapped, then Check;
 *   - balance: a number typed into the box, then Check;
 *   - make-n (open build): tiles from an unlimited bank into the row, then "I'm done!". Any number sentence that
 *     makes the total passes; a two-way item asks for a different one after the first. Try again keeps the row.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { EquationBuilderChallenge } from './EquationBuilder';

/** Parse a display equation like "3 + 2 = 5" into tokens. */
export function parseEquationTokens(eq: string): string[] {
  return eq.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

/** The value of one side: a number, "a + b" or "a - b"; null when it is none of those. */
function evalSide(side: string): number | null {
  const num = parseInt(side, 10);
  if (!isNaN(num) && String(num) === side) return num;
  const add = side.match(/^(\d+)\+(\d+)$/);
  if (add) return parseInt(add[1], 10) + parseInt(add[2], 10);
  const sub = side.match(/^(\d+)-(\d+)$/);
  if (sub) return parseInt(sub[1], 10) - parseInt(sub[2], 10);
  return null;
}

/** The value both sides share when an equation is true, else null. */
function trueValue(eq: string): number | null {
  // A "−" tile is the same minus (RP-4): judge it by value, not only by exact string.
  const parts = eq.replace(/\s+/g, '').replace(/−/g, '-').split('=');
  if (parts.length !== 2) return null;
  const left = evalSide(parts[0]), right = evalSide(parts[1]);
  return left !== null && left === right ? left : null;
}

/** Whether a simple equation string is mathematically true. */
export const evaluateEquation = (eq: string) => trueValue(eq) !== null;

const sortedTokens = (tokens: string[]) => [...tokens].sort().join(' ');

/**
 * Build: the target itself, or a true equation made of exactly the target's tiles with the same value
 * ("2 + 3 = 5" or "5 = 3 + 2" for "3 + 2 = 5"). The instruction describes the goal and never prints the
 * target, so an order-only difference is the same answer.
 */
export function buildMatches(built: string[], target: string): boolean {
  if (built.join('') === target.replace(/\s+/g, '')) return true;
  const value = trueValue(built.join(' '));
  return value !== null && value === trueValue(target)
    && sortedTokens(built) === sortedTokens(parseEquationTokens(target));
}

/** Rewrite: one of the accepted forms. */
export function matchesAcceptedForm(built: string[], acceptedForms: string[]): boolean {
  const builtStr = built.join('');
  return acceptedForms.some(form => form.replace(/\s+/g, '') === builtStr);
}

// ── Open build (make-n): any number sentence that makes the total ────────────

const isNumberTile = (t: string) => /^\d+$/.test(t);
const signOf = (t: string) => t === '+' ? 1 : t === '-' || t === '−' ? -1 : 0;

/**
 * The value of a row read as number (sign number)+, left to right, by plain integer arithmetic; null when the row
 * is not that shape (a lone number, two numbers side by side, a sign at either end, or two signs together).
 */
export function sentenceValue(tiles: readonly string[]): number | null {
  if (tiles.length < 3 || tiles.length % 2 === 0) return null;
  let value = 0;
  for (let i = 0; i < tiles.length; i += 2) {
    const sign = i === 0 ? 1 : signOf(tiles[i - 1]);
    if (!isNumberTile(tiles[i]) || !sign) return null;
    value += sign * parseInt(tiles[i], 10);
  }
  return value;
}

/** Two sentences are the same way when they add the same numbers in any order, or are the same tiles in order. */
export function sameWay(a: readonly string[], b: readonly string[]): boolean {
  const key = (t: readonly string[]) => t.some(x => signOf(x) === -1)
    ? t.map(x => x.replace('−', '-')).join(' ')
    : t.filter(isNumberTile).map(Number).sort((x, y) => x - y).join('+');
  return key(a) === key(b);
}

/** What a make-n row shows when it does not pass; undefined when it makes the total in a way not made before. */
export function makeNMiss(target: number, row: readonly string[], made: readonly (readonly string[])[] = []): EquationBuilderMiss | undefined {
  if (row.length === 1 && isNumberTile(row[0])) return 'bare_number';
  const value = sentenceValue(row);
  if (value === null) return 'unfinished_sentence';
  if (value !== target) return value === target - 1 ? 'one_short' : value === target + 1 ? 'one_over' : value < target ? 'short_by_more' : 'over_by_more';
  return made.some(w => sameWay(w, row)) ? 'same_way' : undefined;
}

/** How many sentences a make-n item asks for. */
export const waysAsked = (c: EquationBuilderChallenge) => c.type === 'make-n' ? Math.max(1, c.ways ?? 1) : 1;

/** Whether the bank holds every tile of a sentence (it is unlimited, so presence is enough). */
const inBank = (c: EquationBuilderChallenge, tiles: string[]) => tiles.every(t => (c.availableTiles ?? []).includes(t));

/** Reference ways the bank can make, as many as the item asks for (1 + (N−1), then 1 + 1 + (N−2)); null when it cannot. */
export function referenceWays(c: EquationBuilderChallenge): string[][] | null {
  const n = c.target ?? 0;
  if (n < 3) return null;
  const ways = [['1', '+', String(n - 1)], ['1', '+', '1', '+', String(n - 2)]].slice(0, waysAsked(c));
  return ways.every(w => inBank(c, w)) ? ways : null;
}

/** The learner's work on the current challenge. */
export interface EquationBuilderView {
  slots: string[];
  option: number | null;
  truth: boolean | null;
  entry: string;
  /** make-n: the sentences already accepted on this item, before the one in the row. */
  made?: string[][];
}

export function equationBuilderAssignment(c: EquationBuilderChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

/** The builder's own check. */
export function equationBuilderMatches(c: EquationBuilderChallenge, v: EquationBuilderView): boolean {
  switch (c.type) {
    case 'build': return buildMatches(v.slots, c.targetEquation ?? '');
    case 'rewrite': return matchesAcceptedForm(v.slots, c.acceptedForms ?? []);
    case 'missing-value': return v.option !== null && v.option === c.correctValue;
    case 'true-false': return v.truth !== null && v.truth === c.isTrue;
    case 'balance': return v.entry !== '' && parseInt(v.entry, 10) === c.correctAnswer;
    case 'make-n': return c.target !== undefined && makeNMiss(c.target, v.slots, v.made) === undefined
      && (v.made?.length ?? 0) + 1 >= waysAsked(c);
  }
}

/**
 * What a wrong Check shows (`TeachingAttempt.miss`, handoff 20), from the same work the check reads:
 * - tiles (build, rewrite): `unfinished_equation` (not two sides around one =), `false_equation` (the sides
 *   differ), `other_operation` (true, the target's numbers with the other sign), `other_numbers` (true, other
 *   numbers); rewrite also `same_as_printed` (the printed equation again) and `other_form` (true, the printed
 *   numbers, not a form this item accepts);
 * - a number (missing-value, balance): `printed_number` (one already in the equation), `sum_of_printed`
 *   (missing-value: the printed numbers added), `other_side_total` (balance: the value of the side with no ?),
 *   then `one_short` / `one_over` / `short_by_more` / `over_by_more`;
 * - true-false: `said_true` (True for a false equation), `said_false`;
 * - make-n: `bare_number` (one number tile, no sign), `unfinished_sentence` (not number, sign, number...), then the
 *   sentence's value against the total (`one_short` / `one_over` / `short_by_more` / `over_by_more`), and on a two-way
 *   item `same_way` (the numbers of a way already made, in any order).
 */
export type EquationBuilderMiss = 'unfinished_equation' | 'false_equation' | 'other_operation' | 'other_numbers'
  | 'same_as_printed' | 'other_form' | 'printed_number' | 'sum_of_printed' | 'other_side_total'
  | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more' | 'said_true' | 'said_false'
  | 'bare_number' | 'unfinished_sentence' | 'same_way';

const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);
const sameNumbers = (a: string, b: string) => numbersIn(a).sort((x, y) => x - y).join() === numbersIn(b).sort((x, y) => x - y).join();
/** Two sides around one =, each a number or number op number, whether or not it is true. */
const isEquationShape = (text: string) => /^\d+([+\-−]\d+)?=\d+([+\-−]\d+)?$/.test(text.replace(/\s+/g, ''));

const numberMiss = (got: number, want: number, printed: number[], extra?: { id: EquationBuilderMiss; value: number | null }) => {
  if (got === want) return undefined;
  if (extra && extra.value === got) return extra.id;
  if (printed.includes(got)) return 'printed_number';
  return got === want - 1 ? 'one_short' : got === want + 1 ? 'one_over' : got < want ? 'short_by_more' : 'over_by_more';
};

export function equationBuilderMiss(c: EquationBuilderChallenge | null, v: EquationBuilderView): EquationBuilderMiss | undefined {
  if (!c || equationBuilderMatches(c, v)) return undefined;
  switch (c.type) {
    case 'build':
    case 'rewrite': {
      const built = v.slots.join(' ');
      if (!isEquationShape(built)) return 'unfinished_equation';
      if (!evaluateEquation(built.replace(/−/g, '-'))) return 'false_equation';
      const source = (c.type === 'build' ? c.targetEquation : c.originalEquation) ?? '';
      if (c.type === 'rewrite' && built.replace(/\s+/g, '') === source.replace(/\s+/g, '')) return 'same_as_printed';
      if (!sameNumbers(built, source)) return 'other_numbers';
      return c.type === 'rewrite' ? 'other_form' : 'other_operation';
    }
    case 'missing-value': {
      if (v.option === null || c.correctValue === undefined) return undefined;
      const printed = numbersIn(c.equation ?? '');
      return numberMiss(v.option, c.correctValue, printed, { id: 'sum_of_printed', value: printed.reduce((a, b) => a + b, 0) });
    }
    case 'balance': {
      const got = parseInt(v.entry, 10);
      if (isNaN(got) || c.correctAnswer === undefined) return undefined;
      const known = [c.leftSide, c.rightSide].find(s => s && !s.includes('?'));
      return numberMiss(got, c.correctAnswer, numbersIn(`${c.leftSide} ${c.rightSide}`),
        { id: 'other_side_total', value: known ? evalSide(known.replace(/\s+/g, '').replace(/−/g, '-')) : null });
    }
    case 'true-false': return v.truth === null ? undefined : v.truth ? 'said_true' : 'said_false';
    case 'make-n': return c.target === undefined ? undefined : makeNMiss(c.target, v.slots, v.made);
  }
}

/** The learner's checked work in their terms, never the key. */
export function describeEquationBuilderCheck(c: EquationBuilderChallenge, v: EquationBuilderView): string {
  switch (c.type) {
    case 'build':
    case 'rewrite': return v.slots.length ? `Built ${v.slots.join(' ')}` : 'Built nothing';
    case 'missing-value': return `Chose ${v.option ?? '?'}`;
    case 'true-false': return `Chose ${v.truth === null ? '?' : v.truth ? 'True' : 'False'}`;
    case 'balance': return `Entered ${v.entry || 'nothing'}`;
    case 'make-n': {
      const built = v.slots.length ? `Built ${v.slots.join(' ')} = ${c.target}` : 'Built nothing';
      return v.made?.length ? `${built}, after making ${v.made.map(w => `${w.join(' ')} = ${c.target}`).join(' and ')}` : built;
    }
  }
}

/** The equation the builder prints for a challenge, with its "?"; build prints none. */
export function printedEquation(c: EquationBuilderChallenge): string | undefined {
  switch (c.type) {
    case 'missing-value': return c.equation;
    case 'true-false': return c.displayEquation;
    case 'balance': return `${c.leftSide} = ${c.rightSide}`;
    case 'rewrite': return c.originalEquation;
    default: return undefined;
  }
}

const CONSTRAINTS: Record<EquationBuilderChallenge['type'], string> = {
  build: 'The learner taps tiles into the slot row to build the equation the instruction asks for and presses Check; '
    + 'the builder checks it. The equation is the answer: never say it or which tiles go where.',
  'missing-value': 'The learner taps the number that replaces the "?" and presses Check; the builder checks it. '
    + 'The missing number is the answer: never say it or point to its choice.',
  'true-false': 'The learner taps True or False and presses Check; the builder checks it. Whether the equation is '
    + 'true is the answer: never say it, or the value of either side.',
  balance: 'The learner types the number that replaces the "?" and presses Check; the builder checks it. The missing '
    + 'number is the answer: never say it.',
  rewrite: 'The learner taps tiles into the slot row to write the printed equation another way and presses Check; '
    + 'the builder checks it. A rewritten equation is the answer: never say one or which tiles go where.',
  'make-n': 'The learner makes their own number sentence for the total from the tile bank and presses "I\'m done!"; '
    + 'the builder checks it, and any sentence that makes the total passes. Never say what the learner\'s sentence '
    + 'makes, whether it is right before they check, a sentence that works, or which tile to add or take out.',
};

/** How far the tutor may coach at this support tier, so it never says what the tier withheld on screen. */
function coaching(c: EquationBuilderChallenge, tier: EquationBuilderTier | undefined): string | undefined {
  if (!tier) return undefined;
  if (tier === 'medium') return 'The strategy is on screen: nudge the next step only; do not name the whole strategy.';
  if (tier === 'hard') return 'Do not name the strategy or set up the equation. Ask what the learner sees.';
  switch (c.type) {
    case 'build': return 'You may name the building strategy (two numbers joined by + or −, then = and the total).';
    case 'balance': return 'You may walk the strategy: work out the left side first, then find what makes the right side match.';
    case 'rewrite': return 'You may remind the learner that the = can flip: the same amounts on either side.';
    case 'missing-value': return 'You may name the relationship: both sides of = are the same amount.';
    case 'true-false': return 'You may name the strategy: work out each side, then compare.';
    case 'make-n': return 'You may name the shape of a sentence: a number, a + or −, another number.';
  }
}

export type EquationBuilderTier = 'easy' | 'medium' | 'hard';

/**
 * The learner's make-n work as the tutor is told it: the row in their own tiles, and how many tiles and numbers they
 * placed (numbers, so the work's history records each turn back); on a two-way item, how many ways are done and which.
 * Never what the row makes.
 */
export function makeNFacts(c: EquationBuilderChallenge, v: Pick<EquationBuilderView, 'slots' | 'made'>): Record<string, string | number> {
  return {
    row: v.slots.join(' '),
    tilesPlaced: v.slots.length,
    numbersPlaced: v.slots.filter(isNumberTile).length,
    ...(waysAsked(c) > 1 ? { waysAsked: waysAsked(c), waysMade: v.made?.length ?? 0,
      ...(v.made?.length ? { madeBefore: v.made.map(w => w.join(' ')).join(' | ') } : {}) } : {}),
  };
}

/** The bank in reading order: numbers up, then the signs. */
export const bankOrder = (tiles: readonly string[]) => [...tiles.filter(isNumberTile).map(Number).sort((a, b) => a - b).map(String),
  ...tiles.filter(t => !isNumberTile(t))];

export function equationBuilderScene(c: EquationBuilderChallenge, view: { supportTier?: EquationBuilderTier;
  work?: Pick<EquationBuilderView, 'slots' | 'made'> }): WorkspaceScene {
  const printed = printedEquation(c);
  const tip = coaching(c, view.supportTier);
  const tiles = c.type === 'build' || c.type === 'rewrite' ? c.availableTiles ?? [] : [];
  return { objects: [], facts: {
    kind: c.type,
    ...(printed ? { equation: printed } : {}),
    ...(tiles.length ? { tiles: [...tiles].sort().join(' ') } : {}),
    ...(c.type === 'make-n' ? { total: c.target ?? '', tileBank: bankOrder(c.availableTiles ?? []).join(' '),
      ...makeNFacts(c, view.work ?? { slots: [] }) } : {}),
    ...(c.type === 'missing-value' && c.options?.length ? { choices: c.options.join(' | ') } : {}),
    ...(c.type === 'true-false' ? { choices: 'True | False' } : {}),
    ...(view.supportTier ? { supportTier: view.supportTier } : {}),
    ...(tip ? { coaching: tip } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

type HarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string } | { type: 'write'; label: string; text: string };

/** The accessible names the harness presses: a pool tile, the number box, and make-n's controls. */
export const tileLabel = (tile: string) => `Tile ${tile}`;
export const ENTRY_LABEL = 'Missing number';
export const DONE_LABEL = "I'm done!";
export const CLEAR_LABEL = 'Clear';

/** The first accepted rewrite the tile pool can make. */
function buildableForm(c: EquationBuilderChallenge): string | undefined {
  return (c.acceptedForms ?? []).find(form => {
    const pool = [...(c.availableTiles ?? [])];
    return parseEquationTokens(form).every(t => { const i = pool.indexOf(t); if (i < 0) return false; pool.splice(i, 1); return true; });
  });
}

/**
 * The journey's inputs for one challenge, through the real controls, ending with Check. `wrong` leaves
 * the last tile off a build or rewrite, picks another number or the other truth value, or types one more.
 */
export function equationBuilderHarnessInputs(c: EquationBuilderChallenge, wrong: boolean): HarnessInput[] {
  const check: HarnessInput = { type: 'choose', label: 'Check' };
  if (c.type === 'make-n') {
    // wrong: the total alone (`bare_number`). Right clears first, because Try again keeps the row.
    const done: HarnessInput = { type: 'choose', label: DONE_LABEL };
    if (wrong) return [{ type: 'choose', label: tileLabel(String(c.target)) }, done];
    const ways = referenceWays(c);
    if (!ways) throw new Error(`No buildable make-n sentence for ${c.id}`);
    return [{ type: 'choose', label: CLEAR_LABEL },
      ...ways.flatMap(w => [...w.map(t => ({ type: 'choose' as const, label: tileLabel(t) })), done])];
  }
  if (c.type === 'build' || c.type === 'rewrite') {
    const form = c.type === 'build' ? c.targetEquation : buildableForm(c);
    if (!form) throw new Error(`No buildable ${c.type} form for ${c.id}`);
    const tokens = parseEquationTokens(form);
    return [...(wrong ? tokens.slice(0, -1) : tokens).map(t => ({ type: 'choose' as const, label: tileLabel(t) })), check];
  }
  if (c.type === 'missing-value') {
    const pick = wrong ? c.options!.find(o => o !== c.correctValue)! : c.correctValue!;
    return [{ type: 'touch', target: `option-${pick}` }, check];
  }
  if (c.type === 'true-false') return [{ type: 'touch', target: `truth-${wrong ? !c.isTrue : !!c.isTrue}` }, check];
  return [{ type: 'write', label: ENTRY_LABEL, text: String(c.correctAnswer! + (wrong ? 1 : 0)) }, check];
}
