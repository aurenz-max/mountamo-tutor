/**
 * Equation builder on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C9), plain shape: `useWorkspaceProgress` in place of
 * `useChallengeProgress`. Every challenge is one checked gesture; the builder's own Check is the
 * judge and no key reaches the tutor:
 *   - build / rewrite: tiles placed in the slot row, then Check;
 *   - missing-value: a number option tapped, then Check;
 *   - true-false: True or False tapped, then Check;
 *   - balance: a number typed into the box, then Check.
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
  const parts = eq.replace(/\s+/g, '').split('=');
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

/** The learner's work on the current challenge. */
export interface EquationBuilderView {
  slots: string[];
  option: number | null;
  truth: boolean | null;
  entry: string;
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
  }
}

export type EquationBuilderTier = 'easy' | 'medium' | 'hard';

export function equationBuilderScene(c: EquationBuilderChallenge, view: { supportTier?: EquationBuilderTier }): WorkspaceScene {
  const printed = printedEquation(c);
  const tip = coaching(c, view.supportTier);
  const tiles = c.type === 'build' || c.type === 'rewrite' ? c.availableTiles ?? [] : [];
  return { objects: [], facts: {
    kind: c.type,
    ...(printed ? { equation: printed } : {}),
    ...(tiles.length ? { tiles: [...tiles].sort().join(' ') } : {}),
    ...(c.type === 'missing-value' && c.options?.length ? { choices: c.options.join(' | ') } : {}),
    ...(c.type === 'true-false' ? { choices: 'True | False' } : {}),
    ...(view.supportTier ? { supportTier: view.supportTier } : {}),
    ...(tip ? { coaching: tip } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

type HarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string } | { type: 'write'; label: string; text: string };

/** The accessible names the harness presses: a pool tile, and the number box. */
export const tileLabel = (tile: string) => `Tile ${tile}`;
export const ENTRY_LABEL = 'Missing number';

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
