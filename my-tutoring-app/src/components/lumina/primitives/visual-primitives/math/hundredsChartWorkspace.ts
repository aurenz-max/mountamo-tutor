/**
 * Hundreds chart on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C9), plain shape: `useWorkspaceProgress` in place of
 * `useChallengeProgress`. Every challenge is one checked gesture; the chart's own Check is the judge
 * and no key reaches the tutor:
 *   - highlight_sequence / complete_sequence: the learner taps cells and presses Check;
 *   - identify_pattern / find_skip_value: the learner taps a choice and presses Check.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { HundredsChartChallenge } from './HundredsChart';

export const CELL_TYPES = new Set<HundredsChartChallenge['type']>(['highlight_sequence', 'complete_sequence']);

export function hundredsChartAssignment(c: HundredsChartChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

/** The cells a cell-mode challenge wants the learner to add: the pattern minus the cells already shown. */
export const neededCells = (c: HundredsChartChallenge) => {
  const given = new Set(c.givenCells ?? []);
  return (c.correctCells ?? []).filter(n => !given.has(n));
};

/** The chart's own check. */
export function hundredsChartMatches(c: HundredsChartChallenge, view: { cells: Set<number>; option: string | null }): boolean {
  if (CELL_TYPES.has(c.type)) {
    const needed = neededCells(c);
    return needed.length === view.cells.size && needed.every(n => view.cells.has(n));
  }
  if (c.type === 'identify_pattern') return view.option === c.correctAnswer;
  return view.option === String(c.skipValue);
}

/** The learner's checked work in their terms, never the key. */
export function describeHundredsChartCheck(c: HundredsChartChallenge, view: { cells: Set<number>; option: string | null }): string {
  if (CELL_TYPES.has(c.type)) {
    const cells = Array.from(view.cells).sort((a, b) => a - b);
    return cells.length ? `Tapped ${cells.join(', ')}` : 'Tapped no numbers';
  }
  return `Chose "${view.option ?? '?'}"`;
}

const CONSTRAINTS: Record<HundredsChartChallenge['type'], string> = {
  highlight_sequence: 'The learner taps every number in the pattern and presses Check; the chart checks the whole set. '
    + 'Which numbers belong is the answer.',
  complete_sequence: 'The first numbers of the pattern are already highlighted. The learner taps the rest and presses '
    + 'Check; the chart checks the whole set. The numbers still to tap are the answer.',
  identify_pattern: 'The learner picks the description that matches the shape the highlighted cells make and presses '
    + 'Check; the chart checks it. The shape is the answer: never name it or point to the matching choice.',
  find_skip_value: 'The learner picks how much is added each step and presses Check; the chart checks it. The skip '
    + 'value is the answer: never say it or the difference between two highlighted numbers.',
};

/** How far the tutor may go at this support tier, so it never says what the tier withheld on screen. */
function coaching(c: HundredsChartChallenge): string | undefined {
  if (!c.supportTier) return undefined;
  if (c.type === 'identify_pattern') {
    return c.supportTier === 'easy' ? 'You may use shape words (rows, columns, diagonal) to guide looking.'
      : c.supportTier === 'medium' ? 'Nudge where to look.' : 'Terse coaching only.';
  }
  return c.supportTier === 'easy' ? 'You may name the strategy (count by the same amount; the ones digits repeat).'
    : c.supportTier === 'medium' ? 'Nudge the counting; do not name the count-by rule.'
      : 'Do not name the count-by rule. Ask what changes from one highlighted number to the next.';
}

export function hundredsChartScene(c: HundredsChartChallenge, view: { gridMax: number }): WorkspaceScene {
  const tip = coaching(c);
  return { objects: [], facts: {
    kind: c.type,
    board: `A chart of the numbers 1 to ${view.gridMax}, ten to a row`,
    ...(c.givenCells?.length ? { highlighted: c.givenCells.join(', ') } : {}),
    ...(c.options?.length && !CELL_TYPES.has(c.type) ? { choices: c.options.join(' | ') } : {}),
    ...(c.supportTier ? { supportTier: c.supportTier } : {}),
    ...(tip ? { coaching: tip } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

type HarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string };

/**
 * The journey's inputs for one challenge, through the real controls: every needed cell (or a choice)
 * and Check. `wrong` taps one number outside the pattern in place of the last needed one (or leaves
 * the last one out when every free number belongs), or picks another choice.
 */
export function hundredsChartHarnessInputs(c: HundredsChartChallenge, wrong: boolean, gridMax = 100): HarnessInput[] {
  // The driver's `check` presses the first button matching /check/i, which a choice such as
  // "A checkerboard pattern" would be; press the Check button by its whole label instead.
  const check: HarnessInput = { type: 'choose', label: 'Check Answer' };
  if (CELL_TYPES.has(c.type)) {
    const needed = neededCells(c);
    let cells = needed;
    if (wrong) {
      const taken = new Set([...(c.givenCells ?? []), ...(c.correctCells ?? [])]);
      const stray = Array.from({ length: gridMax }, (_, i) => i + 1).find(n => !taken.has(n));
      cells = [...needed.slice(0, -1), ...(stray ? [stray] : [])];
    }
    return [...cells.map(n => ({ type: 'touch' as const, target: `cell-${n}` })), check];
  }
  const key = c.type === 'identify_pattern' ? c.correctAnswer : String(c.skipValue);
  const pick = wrong ? c.options.find(o => o !== key)! : key;
  return [{ type: 'touch', target: `option-${pick}` }, check];
}
