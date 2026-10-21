/**
 * Strategy picker's domain on the teaching workspace: the picker's own check, the miss it names, the scene the tutor
 * reads and the harness inputs. How each mode is wired is the card (`strategyPicker.card.ts`); the boss
 * (`strategyPicker.boss.ts`) builds the assignment. Compare is a reflection with no wrong answer: every choice counts.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { StrategyId, StrategyPickerChallenge } from './StrategyPicker';
import type { StrategyPickerMiss } from './strategyPicker.card';

export { STRATEGY_PICKER_MISSES_BY_MODE, type StrategyPickerMiss } from './strategyPicker.card';

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  'counting-on': 'Counting On',
  'counting-back': 'Counting Back',
  'make-ten': 'Make Ten',
  'doubles': 'Doubles',
  'near-doubles': 'Near Doubles',
  'tally-marks': 'Tally Marks',
  'draw-objects': 'Draw Objects',
};
export const strategyLabel = (s: string) => STRATEGY_LABELS[s as StrategyId] ?? s;
export const BOTH_SAME = 'both-same';

/** The learner's work on the current challenge. */
export interface StrategyPickerView {
  /** The stepper's number, '' before the first press. */
  answer: string;
  chosen: StrategyId | null;
  match: string | null;
  compare: string | null;
}

const solves = (c: StrategyPickerChallenge) =>
  c.type === 'guided-strategy' || c.type === 'try-another' || c.type === 'choose-your-strategy';

/** What the learner is asked: the instruction, and on compare its question. */
export const strategyPickerAsk = (c: StrategyPickerChallenge) =>
  (c.type === 'compare' && c.comparisonQuestion ? `${c.instruction} ${c.comparisonQuestion}` : c.instruction);

/** The picker's own check. Compare is a reflection: any choice counts. */
export function strategyPickerMatches(c: StrategyPickerChallenge, v: StrategyPickerView): boolean {
  if (solves(c)) return v.answer !== '' && parseInt(v.answer, 10) === c.problem.result;
  if (c.type === 'match-strategy') return v.match !== null && v.match === c.correctStrategy;
  return v.compare !== null;
}

/** Strategies that draw the same kind of picture: a number line, equal groups, or every object counted. */
export const PICTURE_KIND: Record<StrategyId, string> = {
  'counting-on': 'line', 'counting-back': 'line', doubles: 'groups', 'near-doubles': 'groups',
  'tally-marks': 'count-all', 'draw-objects': 'count-all', 'make-ten': 'frame',
};

/** What a wrong Check shows (`TeachingAttempt.miss`); the misses are listed on the card. */
export function strategyPickerMiss(c: StrategyPickerChallenge | null, v: StrategyPickerView): StrategyPickerMiss | undefined {
  if (!c || strategyPickerMatches(c, v)) return undefined;
  if (c.type === 'match-strategy') {
    if (!v.match || !c.correctStrategy) return undefined;
    return PICTURE_KIND[v.match as StrategyId] === PICTURE_KIND[c.correctStrategy as StrategyId] ? 'similar_strategy' : 'different_strategy';
  }
  if (!solves(c) || v.answer === '') return undefined;
  const got = parseInt(v.answer, 10), want = c.problem.result;
  const { operand1: a, operand2: b } = c.problem;
  if (got === (c.problem.operation === 'addition' ? Math.abs(a - b) : a + b)) return 'other_operation';
  if (got === a || got === b) return 'printed_number';
  return got === want - 1 ? 'one_short' : got === want + 1 ? 'one_over' : got < want ? 'short_by_more' : 'over_by_more';
}

/** The learner's checked work in their terms, never the key. */
export function describeStrategyPickerCheck(c: StrategyPickerChallenge, v: StrategyPickerView): string {
  if (solves(c)) {
    const using = c.type === 'choose-your-strategy' && v.chosen ? ` using ${strategyLabel(v.chosen)}` : '';
    return `Answered ${v.answer || 'nothing'}${using}`;
  }
  if (c.type === 'match-strategy') return `Chose ${v.match ? strategyLabel(v.match) : 'nothing'}`;
  return `Chose ${v.compare === BOTH_SAME ? 'Both the same' : v.compare ? strategyLabel(v.compare) : 'nothing'}`;
}

/** What each strategy picture draws, in words, never where it ends. */
const PICTURES: Record<StrategyId, string> = {
  'counting-on': 'a number line with a dot on the first number and one +1 hop for each of the second',
  'counting-back': 'a number line with a dot on the first number and one −1 hop for each of the second',
  'make-ten': 'a ten frame: the first number in blue counters, the second in yellow',
  'doubles': 'two equal groups of dots',
  'near-doubles': 'two equal groups of dots and one extra dot',
  'tally-marks': 'tally marks for both numbers together',
  'draw-objects': 'a circle for each of both numbers together',
};

/** What only this picker knows; the card's moves and the doctrine say the rest. */
const PICTURE_END = 'Where the picture ends is the answer: never say it.';
const CONSTRAINTS: Record<StrategyPickerChallenge['type'], string> = {
  'guided-strategy': PICTURE_END,
  'try-another': PICTURE_END,
  'choose-your-strategy': `Any strategy on the menu works: never pick one for the learner. ${PICTURE_END}`,
  'match-strategy': 'The worked solution never names its strategy; on screen nothing marks the one it used.',
  compare: 'Both strategies give the same answer, printed on screen. Every choice counts and there is no wrong answer: '
    + 'ask why they chose it.',
};

export type StrategyPickerTier = 'easy' | 'medium' | 'hard';

/** How far the tutor may coach at this support tier (the old tutorRevealClause, now a fact). */
function coaching(c: StrategyPickerChallenge, tier: StrategyPickerTier | undefined): string | undefined {
  if (!tier) return undefined;
  if (c.type === 'match-strategy') {
    if (tier === 'easy') return 'Never name the strategy. Describe the features to look for in the worked solution (hops on a number line? a ten frame? equal groups? tally marks?) and let the learner match.';
    if (tier === 'medium') return 'Never name the strategy. Point back to one telling detail in the worked solution and ask what it suggests.';
    return 'Never name or hint the strategy. Only ask what the learner notices in the worked solution.';
  }
  if (c.type === 'compare') return undefined;
  if (tier === 'easy') return 'You may name the strategy and walk its setup step by step, but never say the final number.';
  if (tier === 'medium') return 'Nudge the next step of the strategy only; do not re-explain it from the start.';
  return 'Do not re-teach the strategy. Ask what the learner sees in the picture.';
}

export function strategyPickerScene(c: StrategyPickerChallenge, view: { chosen: StrategyId | null; supportTier?: StrategyPickerTier },
  introduced: StrategyId[] = []): SceneOf {
  const tier = c.supportTier ?? view.supportTier;
  const tip = coaching(c, tier);
  const drawn = c.assignedStrategy ?? (c.type === 'choose-your-strategy' ? view.chosen : null);
  const menu = c.type === 'choose-your-strategy' ? (c.availableStrategies ?? introduced) : [];
  return { objects: [], facts: {
    kind: c.type,
    problem: c.problem.equation,
    ...(c.assignedStrategy ? { strategy: strategyLabel(c.assignedStrategy) } : {}),
    ...((c.type === 'guided-strategy' || c.type === 'try-another') && c.strategySteps?.length
      ? { steps: c.strategySteps.map((s, i) => `${i + 1}. ${s}`).join(' ') } : {}),
    ...(menu.length ? { menu: menu.map(strategyLabel).join(' | ') } : {}),
    ...(c.type === 'choose-your-strategy' ? { chosen: view.chosen ? strategyLabel(view.chosen) : 'none yet' } : {}),
    ...(drawn && solves(c) ? { picture: PICTURES[drawn] } : {}),
    ...(c.type === 'match-strategy' ? {
      workedSolution: c.workedSolution ?? '',
      choices: (c.strategyOptions ?? []).map(strategyLabel).join(' | '),
    } : {}),
    ...(c.type === 'compare' ? {
      strategies: (c.strategies ?? []).map(strategyLabel).join(' and '),
      printed: `Same answer: ${c.problem.result}`,
      choices: [...(c.strategies ?? []).map(strategyLabel), 'Both the same'].join(' | '),
    } : {}),
    ...(tier ? { supportTier: tier } : {}),
    ...(tip ? { coaching: tip } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

type HarnessInput = { type: 'choose'; label: string };

/** The accessible names the harness presses. */
export const STEP_UP = 'One more';
export const STEP_DOWN = 'One less';
export const CHECK_LABEL = 'Check Answer';
export const menuLabel = (s: string) => `Use ${strategyLabel(s)}`;
export const optionLabel = (s: string) => (s === BOTH_SAME ? 'Both the same' : strategyLabel(s));

/**
 * The journey's inputs for one challenge, through the real controls, ending with Check. `wrong` sets
 * one more than the answer, or taps another option. Compare has no wrong answer and throws. `picked`:
 * the menu choice already made (Try again keeps it), so the menu is not on screen.
 */
export function strategyPickerHarnessInputs(c: StrategyPickerChallenge, wrong: boolean, picked = false): HarnessInput[] {
  const check: HarnessInput = { type: 'choose', label: CHECK_LABEL };
  if (solves(c)) {
    const menu = c.type === 'choose-your-strategy' && !picked ? [{ type: 'choose' as const, label: menuLabel(c.availableStrategies?.[0] ?? 'counting-on') }] : [];
    const target = c.problem.result + (wrong ? 1 : 0);
    return [...menu, ...Array.from({ length: target }, () => ({ type: 'choose' as const, label: STEP_UP })), check];
  }
  if (c.type === 'match-strategy') {
    const pick = wrong ? (c.strategyOptions ?? []).find(o => o !== c.correctStrategy) : c.correctStrategy;
    if (!pick) throw new Error(`match-strategy ${c.id} has no ${wrong ? 'other' : 'correct'} option`);
    return [{ type: 'choose', label: optionLabel(pick) }, check];
  }
  if (wrong) throw new Error('strategy-picker compare has no wrong answer');
  return [{ type: 'choose', label: optionLabel(c.strategies?.[0] ?? BOTH_SAME) }, check];
}
