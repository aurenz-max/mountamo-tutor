/**
 * Hundreds chart on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C9), plain shape: `useWorkspaceProgress` in place of
 * `useChallengeProgress`. The chart's own Check judges every tap, and the scene never states the key:
 *   - highlight_sequence / complete_sequence: the learner taps cells and presses Check (gesture only: the
 *     answer is a set of cells, tapped one by one);
 *   - identify_pattern / find_skip_value: the learner taps a choice and presses Check, or says the choice
 *     (VB-1, 2026-10-13): the item is spoken with `acceptsGesture`, JEV judges the spoken description or skip
 *     value from the tutor's feedback against `expectedAnswer`, and a tap and Check is still checked by the chart.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberMisses, spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { HundredsChartChallenge } from './HundredsChart';

export const CELL_TYPES = new Set<HundredsChartChallenge['type']>(['highlight_sequence', 'complete_sequence']);

/** The choice a spoken item is judged against: the description or the skip value; null on the cell modes. */
export const hundredsChartKey = (c: HundredsChartChallenge): string | null =>
  c.type === 'identify_pattern' ? (c.correctAnswer || null) : c.type === 'find_skip_value' ? String(c.skipValue) : null;

export function hundredsChartAssignment(c: HundredsChartChallenge): TeachingAssignment {
  const expectedAnswer = hundredsChartExpectedAnswer(c);
  if (!expectedAnswer) return { id: c.id, task: c.instruction, response: 'gesture' };
  const how = c.type === 'identify_pattern' ? 'saying which description matches' : 'saying the skip value';
  return { id: c.id, task: `${c.instruction} The learner answers by ${how}, or tapping it and pressing Check.`,
    response: 'speech', acceptsGesture: true, expectedAnswer, misses: hundredsChartSpokenMisses(c) };
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const place = (c: HundredsChartChallenge, option: string) => {
  const i = c.options.indexOf(option);
  return i >= 0 && ORDINAL[i] ? `the ${ORDINAL[i]} one` : null;
};

/** The answer a spoken item is judged against, with the ways of saying it and what is not it. */
export function hundredsChartExpectedAnswer(c: HundredsChartChallenge): string | undefined {
  const key = hundredsChartKey(c);
  if (key === null) return undefined;
  const at = place(c, key);
  if (c.type === 'identify_pattern') {
    const others = c.options.filter(o => o !== key).map(o => `"${o}"`).join(', ');
    return `the choice "${key}"${at ? ` (${at} of the ${c.options.length} choices)` : ''}: the shape the highlighted cells `
      + `make. Said as its words, the same shape in the learner's own words${at ? `, or by its place ("${at}")` : ''}. `
      + `Describing what another choice describes${others ? ` (${others})` : ''} is not it.`;
  }
  const S = c.skipValue;
  return `${S}: ${S} is added each step; said as "${S}", "${spokenNumber(S)}", "by ${S}s", "plus ${S}", "it counts by ${S}s". `
    + 'A highlighted number that is not the step, the number of highlighted cells, or any other number is not it.';
}

/**
 * A spoken item's known wrong answers, with the tap's ids (`hundredsChartMiss`, the catalog's lists). identify_pattern:
 * each other choice under the id of the shape it describes (`describedShape`), choices sharing a shape in one entry.
 * find_skip_value: `twice_the_step`, `half_the_step`, `one_short`, `one_over`, then the two ranges. A number that is
 * the key is never an example.
 */
export function hundredsChartSpokenMisses(c: HundredsChartChallenge): KnownMiss[] {
  const key = hundredsChartKey(c);
  if (key === null) return [];
  if (c.type === 'identify_pattern') {
    const byShape = new Map<string, string[]>();
    for (const o of c.options) if (o !== key) byShape.set(describedShape(o), [...(byShape.get(describedShape(o)) ?? []), o]);
    return Array.from(byShape, ([id, opts]) => ({ id, pattern: `The learner names ${opts.map(o => `"${o}"`).join(' or ')}`
      + ', which does not describe the highlighted cells.',
      examples: opts.flatMap(o => [o, place(c, o)].filter((e): e is string => !!e)).slice(0, 6) }));
  }
  const S = c.skipValue;
  return [
    ...numberMisses(S, [
      { id: 'twice_the_step', value: 2 * S, pattern: n => `The learner says ${n}, twice the skip value (two steps at once).` },
      { id: 'half_the_step', value: S % 2 === 0 ? S / 2 : undefined, pattern: n => `The learner says ${n}, half the skip value.` },
      { id: 'one_short', value: S - 1, pattern: n => `The learner says ${n}, one less than the skip value.` },
      { id: 'one_over', value: S + 1, pattern: n => `The learner says ${n}, one more than the skip value.` },
    ]),
    ...(S - 2 >= 1 ? [{ id: 'short_by_more', pattern: `Any other number below ${S}.` }] : []),
    { id: 'over_by_more', pattern: `Any other number above ${S}.` },
  ];
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

/**
 * What a wrong Check shows (`TeachingAttempt.miss`, handoff 20), from the same work the check reads:
 * - cells: `stopped_early` (only pattern numbers, the last ones left untapped), `gaps_left` (only pattern
 *   numbers, some in the middle left), `extra_cells` (the whole pattern and more), `other_step` (a run that
 *   counts by another amount), `stray_cells` (numbers outside the pattern in place of some in it);
 * - a skip value: `twice_the_step`, `half_the_step`, then `one_short` / `one_over` / `short_by_more` / `over_by_more`;
 * - a description (identify_pattern), by what the chosen sentence describes: `chose_diagonal` (a diagonal, zigzag or
 *   shifting shape), `chose_columns`, `chose_rows`, else `chose_scattered` (no shape: scattered, checkerboard, whole grid).
 */
export type HundredsChartMiss = 'stopped_early' | 'gaps_left' | 'extra_cells' | 'other_step' | 'stray_cells'
  | 'twice_the_step' | 'half_the_step' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more'
  | 'chose_diagonal' | 'chose_columns' | 'chose_rows' | 'chose_scattered';

/** What a description sentence describes, for the miss on a wrong one. */
export function describedShape(option: string): 'chose_diagonal' | 'chose_columns' | 'chose_rows' | 'chose_scattered' {
  const o = option.toLowerCase();
  return /diagonal|zigzag|shift/.test(o) ? 'chose_diagonal' : /column/.test(o) ? 'chose_columns'
    : /row/.test(o) ? 'chose_rows' : 'chose_scattered';
}

export function hundredsChartMiss(c: HundredsChartChallenge | null, view: { cells: Set<number>; option: string | null }):
  HundredsChartMiss | undefined {
  if (!c || hundredsChartMatches(c, view)) return undefined;
  if (c.type === 'identify_pattern') return view.option === null ? undefined : describedShape(view.option);
  if (c.type === 'find_skip_value') {
    const got = Number(view.option), want = c.skipValue;
    if (view.option === null || Number.isNaN(got)) return undefined;
    if (got === want * 2) return 'twice_the_step';
    if (got * 2 === want) return 'half_the_step';
    return got === want - 1 ? 'one_short' : got === want + 1 ? 'one_over' : got < want ? 'short_by_more' : 'over_by_more';
  }
  const needed = neededCells(c).sort((a, b) => a - b);
  const tapped = Array.from(view.cells).sort((a, b) => a - b);
  const inPattern = tapped.filter(n => needed.includes(n));
  if (inPattern.length === tapped.length) {
    return tapped.every((n, i) => n === needed[i]) ? 'stopped_early' : 'gaps_left';
  }
  if (inPattern.length === needed.length) return 'extra_cells';
  // A run counting by one amount, alone or continuing the highlighted start cells.
  const step = (run: number[]) => {
    const steps = Array.from(new Set(run.slice(1).map((n, i) => n - run[i])));
    return steps.length === 1 ? steps[0] : null;
  };
  const withGiven = Array.from(new Set([...(c.givenCells ?? []), ...tapped])).sort((a, b) => a - b);
  const counted = [tapped.length >= 3 ? step(tapped) : null, withGiven.length >= 3 ? step(withGiven) : null];
  if (counted.some(s => s !== null && s !== c.skipValue)) return 'other_step';
  return 'stray_cells';
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
  identify_pattern: 'The learner says the description that matches the shape the highlighted cells make, or taps it '
    + 'and presses Check; a Check is checked by the chart. A spoken answer is a real answer: say plainly whether it is '
    + 'right. Before the learner has answered, never name the shape or point to the matching choice.',
  find_skip_value: 'The learner says how much is added each step, or taps it and presses Check; a Check is checked by '
    + 'the chart. A spoken answer is a real answer: say plainly whether it is right. Before the learner has answered, '
    + 'never say the skip value or the difference between two highlighted numbers.',
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

/** `option`: the choice tapped so far on a choice mode, published as the learner's work (as the other families do). */
export function hundredsChartScene(c: HundredsChartChallenge, view: { gridMax: number; option?: string | null }): WorkspaceScene {
  const tip = coaching(c);
  const choice = !CELL_TYPES.has(c.type);
  return { objects: [], facts: {
    kind: c.type,
    board: `A chart of the numbers 1 to ${view.gridMax}, ten to a row`,
    ...(c.givenCells?.length ? { highlighted: c.givenCells.join(', ') } : {}),
    ...(c.options?.length && !CELL_TYPES.has(c.type) ? { choices: c.options.join(' | ') } : {}),
    ...(c.supportTier ? { supportTier: c.supportTier } : {}),
    ...(tip ? { coaching: tip } : {}),
    ...(choice ? { learnerWork: view.option ? `Tapped "${view.option}"` : 'No choice tapped yet' } : {}),
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
