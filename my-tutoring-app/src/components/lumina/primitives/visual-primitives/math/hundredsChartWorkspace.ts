/**
 * Hundreds chart on the shared tutor/JEV teaching workspace: the ask, the spoken key, the chart's own check and the
 * scene, which the boss (`hundredsChart.boss.ts`), the component, the levers and the tests read. Every challenge is
 * one workspace item:
 *   - highlight_sequence / complete_sequence: the learner taps cells and presses Check; the chart checks the whole
 *     set (a board). No key;
 *   - identify_pattern / find_skip_value: the learner says the choice, or taps it and presses Check (VB-1,
 *     2026-10-13). The tutor judges the words against the key; a tap and Check is checked by the chart.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { HundredsChartChallenge } from './HundredsChart';
import { HUNDREDS_MISSES, type HundredsChartMiss } from './hundredsChart.card';

export { HUNDREDS_MISSES, type HundredsChartMiss };

export const CELL_TYPES = new Set<HundredsChartChallenge['type']>(['highlight_sequence', 'complete_sequence']);

/** The choice a spoken item is answered with: the description or the skip value; null on the cell modes. */
export const answerChoice = (c: HundredsChartChallenge): string | null =>
  c.type === 'identify_pattern' ? (c.correctAnswer || null) : c.type === 'find_skip_value' ? String(c.skipValue) : null;

/** What the learner is asked: the instruction, which the generator writes in code and never names a choice. */
export const hundredsChartAsk = (c: HundredsChartChallenge): string => c.instruction;

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const place = (c: HundredsChartChallenge, option: string) => {
  const i = c.options.indexOf(option);
  return i >= 0 && ORDINAL[i] ? `the ${ORDINAL[i]} one` : null;
};

/** The key a spoken answer is judged against; null on a cell item, which the chart checks. */
export function hundredsChartKey(c: HundredsChartChallenge): SpokenKey | null {
  const key = answerChoice(c);
  if (key === null) return null;
  if (c.type === 'identify_pattern') {
    const at = place(c, key);
    const others = c.options.filter(o => o !== key).map(o => `"${o}"`).join(', ');
    return {
      answer: key,
      alsoAccept: at ? [at] : [],
      acceptRule: 'The same shape the highlighted cells make, described in the learner\'s own words, counts.',
      ...(others ? { signatureError: `Describing what another choice describes (${others}) is not it.` } : {}),
    };
  }
  const S = c.skipValue;
  const cells = c.givenCells ?? [];
  return {
    answer: String(S),
    alsoAccept: Array.from(new Set([spokenNumber(S), `by ${S}s`, `plus ${S}`, `${S} each time`])),
    acceptRule: `${S} said alone, or in a sentence about how much is added each step, counts.`,
    signatureError: `A highlighted number that is not the step, ${cells.length !== S ? 'the number of highlighted cells, ' : ''}`
      + 'or any other number is not it.',
  };
}

/**
 * A spoken item's known wrong answers, with the tap's ids (`hundredsChartMiss`, the card's lists). identify_pattern:
 * each other choice under the id of the shape it describes (`describedShape`), choices sharing a shape in one entry.
 * find_skip_value: `twice_the_step`, `half_the_step`, `one_short`, `one_over`, then the two ranges. A number that is
 * the key is never an example.
 */
export function hundredsChartSpokenMisses(c: HundredsChartChallenge): KnownMiss[] {
  const key = answerChoice(c);
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

/** The journey's spoken answers: the key's own words, and another printed choice. */
export function hundredsChartHarnessWords(c: HundredsChartChallenge): { correct: string; plainWrong: string } {
  const key = answerChoice(c) ?? '';
  return { correct: key, plainWrong: c.options.find(o => o !== key) ?? String(c.skipValue + 3) };
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

/** What a description sentence describes, for the miss on a wrong one. */
export function describedShape(option: string): 'chose_diagonal' | 'chose_columns' | 'chose_rows' | 'chose_scattered' {
  const o = option.toLowerCase();
  return /diagonal|zigzag|shift/.test(o) ? 'chose_diagonal' : /column/.test(o) ? 'chose_columns'
    : /row/.test(o) ? 'chose_rows' : 'chose_scattered';
}

/** What a wrong Check shows, from the same work the check reads (the ids are the card's `HundredsChartMiss`). */
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

/** What each mode's answer is, which the tutor never says before the learner answers. */
const CONSTRAINTS: Record<HundredsChartChallenge['type'], string> = {
  highlight_sequence: 'Which numbers belong is the answer: never say them, and never count the pattern on for the learner.',
  complete_sequence: 'The numbers still to tap are the answer: never say them, and never count on past the highlighted '
    + 'numbers or give the difference between two of them.',
  identify_pattern: 'The shape the highlighted cells make is the answer: before the learner has answered, never name '
    + 'the shape or point to the matching choice.',
  find_skip_value: 'The skip value is the answer: before the learner has answered, never say it or the difference '
    + 'between two highlighted numbers.',
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
export function hundredsChartScene(c: HundredsChartChallenge, view: { gridMax: number; option?: string | null }): SceneOf {
  const tip = coaching(c);
  const choice = !CELL_TYPES.has(c.type);
  return { objects: [], facts: {
    kind: c.type,
    board: `A chart of the numbers 1 to ${view.gridMax}, ten to a row`,
    ...(c.givenCells?.length ? { highlighted: c.givenCells.join(', ') } : {}),
    ...(c.options?.length && choice ? { choices: c.options.join(' | ') } : {}),
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
  const key = answerChoice(c) ?? '';
  const pick = wrong ? c.options.find(o => o !== key)! : key;
  return [{ type: 'touch', target: `option-${pick}` }, check];
}
