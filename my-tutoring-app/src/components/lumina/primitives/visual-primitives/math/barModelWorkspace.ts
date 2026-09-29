/**
 * Bar model on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch B1).
 *
 * Pure: the component, the adapter and the journey read the same assignment and scene. Ten modes
 * are answered on the graph and checked by the primitive's own code, so the tutor is never handed
 * `expectedValue`, `targetBarIndex`, `expectedCounts`, `expectedDataset` or `expectedScaleStep`.
 * The two spoken modes (say_what_it_shows, compare_two_graphs) are judged by the tutor against
 * code-derived comparison facts: a bounded set of true claims about the rows on screen, published as
 * `expectedAnswer`. The workspace is bar-model's only teaching path (the scripted explanation runner
 * was deleted, LA-14).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { BarModelChallenge, BarModelEvalMode } from './BarModel';

export const SPOKEN_GRAPH_MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>(['say_what_it_shows', 'compare_two_graphs']);
export const ROW_TAP_MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>(['compare_bars', 'most_least', 'match_to_bar']);
export const OPTION_MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>([
  'read_one_to_one', 'read_scale', 'picture_graph', 'scaled_bar_graph', 'graph_word_problem']);

export const isSpokenGraph = (c: BarModelChallenge) => SPOKEN_GRAPH_MODES.has(c.evalMode);

/** The judge gets facts computed from the displayed rows, never a generated key. */
export function graphComparisonFacts(ch: BarModelChallenge): string[] {
  const facts: string[] = [];
  if (ch.evalMode === 'compare_two_graphs') {
    if (!ch.secondValues || ch.secondValues.length !== ch.values.length) return [];
    ch.values.forEach((row, i) => {
      const other = ch.secondValues![i];
      if (other.label !== row.label) return;
      if (ch.comparisonFocus === 'same' && row.value !== other.value) return;
      if (ch.comparisonFocus === 'different' && row.value === other.value) return;
      const relation = row.value === other.value ? 'the same number of' : row.value > other.value ? 'more' : 'fewer';
      facts.push(`${ch.graphLabel} has ${relation} ${row.label} ${row.value === other.value ? 'as' : 'than'} ${ch.secondGraphLabel}.`);
    });
  } else {
    ch.values.forEach((a, i) => ch.values.slice(i + 1).forEach((b) => {
      facts.push(a.value === b.value ? `${a.label} and ${b.label} have the same number.`
        : `${a.value > b.value ? a.label : b.label} have more than ${a.value > b.value ? b.label : a.label}.`);
    }));
    const max = Math.max(...ch.values.map((v) => v.value));
    const min = Math.min(...ch.values.map((v) => v.value));
    if (ch.values.filter((v) => v.value === max).length === 1) facts.push(`${ch.values.find((v) => v.value === max)!.label} have the most.`);
    if (ch.values.filter((v) => v.value === min).length === 1) facts.push(`${ch.values.find((v) => v.value === min)!.label} have the fewest.`);
  }
  return facts;
}

/** The spoken ask: the row names, the prompt, and (below the hard tier) the comparison words. */
export const graphExplanationAsk = (ch: BarModelChallenge) => {
  const labels = ch.values.map((v) => v.label).join(', ');
  return `The rows show ${labels}. ${ch.prompt}${ch.supportTier !== 'hard' ? ' You can use more, fewer, or the same.' : ''}`;
};

/** What the tutor judges a spoken explanation against: every true claim, and what the ask requires of one. */
export function spokenGraphAnswer(c: BarModelChallenge): string {
  const focus = c.comparisonFocus ? ` It must name a ${c.comparisonFocus === 'same' ? 'similarity' : 'difference'}.` : '';
  const across = c.evalMode === 'compare_two_graphs'
    ? ` It must compare ${c.graphLabel} with ${c.secondGraphLabel}, not two rows of one graph.` : '';
  return `One true comparison is the whole answer; the learner does not compare every group. Any one of these, `
    + `in the learner's own words (fewer for more reversed is the same claim): `
    + `${graphComparisonFacts(c).join(' ')}${focus}${across}`
    + ' Judge only the comparison: a count the learner says on the way, right or wrong, does not change whether the comparison is true.';
}

/** What a wrong spoken comparison shows (handoff 20 Part B). */
export type SpokenGraphMiss = 'reversed_comparison' | 'same_for_different' | 'rows_not_graphs' | 'no_comparison';

/**
 * A spoken comparison's known wrong answers, in precedence order, for the `spoken_miss` observer, stated against the
 * rows on screen: a comparison turned around, "the same" for rows that differ, two rows of one graph where two graphs
 * were asked, and a bare count or row name with no comparison.
 */
export function barModelSpokenMisses(c: BarModelChallenge): KnownMiss[] {
  if (!isSpokenGraph(c) || !c.values.length) return [];
  const rows = (vs: readonly { label: string; value: number }[]) => vs.map(v => `${v.label} ${v.value}`).join(', ');
  const sorted = [...c.values].sort((x, y) => y.value - x.value), big = sorted[0], small = sorted[sorted.length - 1];
  const shown = c.secondValues ? `${c.graphLabel} shows ${rows(c.values)}; ${c.secondGraphLabel} shows ${rows(c.secondValues)}.`
    : `The graph shows ${rows(c.values)}.`;
  const differ = c.secondValues ? c.values.find((v, i) => v.value !== c.secondValues![i]?.value) : big.value !== small.value ? big : undefined;
  const reversed = c.secondValues && differ ? (() => {
    const other = c.secondValues!.find(v => v.label === differ.label)!;
    const [more, less] = differ.value > other.value ? [c.graphLabel, c.secondGraphLabel] : [c.secondGraphLabel, c.graphLabel];
    return `${less} has more ${differ.label} than ${more}`;
  })() : big.value !== small.value ? `There are more ${small.label} than ${big.label}` : undefined;
  return [
    ...(reversed ? [{ id: 'reversed_comparison', pattern: `${shown} The learner says one has more (or the most) where the graph shows it `
      + 'has fewer (or the fewest), or the other way round: a comparison turned around.', examples: [reversed] }] : []),
    ...(differ ? [{ id: 'same_for_different', pattern: `${shown} The learner says two amounts are the same where the graph shows different numbers.`,
      examples: [c.secondValues ? `${c.graphLabel} and ${c.secondGraphLabel} have the same number of ${differ.label}`
        : `${big.label} and ${small.label} are the same`] }] : []),
    ...(c.secondValues && c.values.length >= 2 ? [{ id: 'rows_not_graphs', pattern: `${shown} The question asks to compare ${c.graphLabel} with `
      + `${c.secondGraphLabel}. The learner compares two rows inside one graph instead, for example ${c.values[0].label} with ${c.values[1].label}.`,
      examples: [`${c.values[0].label} and ${c.values[1].label} are different`] }] : []),
    { id: 'no_comparison', pattern: `${shown} The learner's whole answer is one number or one row name, with no comparison word `
      + 'such as more, fewer or the same.', examples: [big.label, String(big.value)] },
  ];
}

export function workspaceAssignment(c: BarModelChallenge): TeachingAssignment {
  const misses = barModelSpokenMisses(c);
  return isSpokenGraph(c)
    ? { id: c.id, task: graphExplanationAsk(c), response: 'speech', expectedAnswer: spokenGraphAnswer(c), ...(misses.length ? { misses } : {}) }
    : { id: c.id, task: c.prompt, response: 'gesture' };
}

export interface BarModelView {
  /** The rows as the learner has set them (build modes) or as drawn. */
  built: readonly { label: string; value: number }[];
  selectedOption: number | null;
  selectedRow: number | null;
  chosenStep: number | null;
}

/** The learner's work in their own terms, never the key. */
export function describeGraphWork(c: BarModelChallenge, view: BarModelView): string {
  if (OPTION_MODES.has(c.evalMode)) return view.selectedOption == null ? 'No number chosen yet' : `Chose ${view.selectedOption}`;
  if (ROW_TAP_MODES.has(c.evalMode)) {
    const row = view.selectedRow == null ? null : c.values[view.selectedRow]?.label;
    return row ? `Tapped the ${row} row` : 'No row tapped yet';
  }
  const rows = view.built.map(r => `${r.label} ${r.value}`).join(', ');
  if (c.evalMode === 'build_one_to_one') return `Stickers placed: ${rows}`;
  if (c.evalMode === 'build_graph') return `Bars set to ${rows}; scale step ${view.chosenStep ?? 'not chosen'}`;
  return 'Answers aloud';
}

/**
 * What a wrong answer on the graph shows (`TeachingAttempt.miss`, handoff 20), from the same work the check reads:
 * - a number chosen: `picked_icon_count` (a picture graph's icon count, not what the icons stand for),
 *   `another_row` (the value of a row other than the one asked about), `one_step_off` (one axis step or one
 *   picture's worth either way, where that is more than one), then `one_short` / `one_over` / `short_by_more` /
 *   `over_by_more`;
 * - a row tapped: `reversed` (the other extreme: the fewest for the most, the shorter of two for the taller),
 *   `other_row`; on match_to_bar the tapped row's count against the pile: `one_short` ... `over_by_more`;
 * - a sticker chart or built graph: `rows_swapped` (the right counts in the wrong rows), `several_rows_off`,
 *   one row `one_short` ... `over_by_more`; `wrong_step` (every bar right, the scale step not).
 * The spoken modes name none: the tutor judges them.
 */
export type BarModelMiss = 'picked_icon_count' | 'another_row' | 'one_step_off' | 'one_short' | 'one_over' | 'short_by_more'
  | 'over_by_more' | 'reversed' | 'other_row' | 'rows_swapped' | 'several_rows_off' | 'wrong_step';

const offBy = (got: number, want: number): BarModelMiss | undefined => got === want ? undefined
  : got === want - 1 ? 'one_short' : got === want + 1 ? 'one_over' : got < want ? 'short_by_more' : 'over_by_more';

const rowsMiss = (want: readonly number[], got: readonly number[]): BarModelMiss | undefined => {
  const wrong = want.map((n, i) => [got[i] ?? 0, n] as const).filter(([g, n]) => g !== n);
  if (wrong.length === 0) return undefined;
  if (wrong.length === 1) return offBy(...wrong[0]);
  const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b).join();
  return sorted(want) === sorted(got) ? 'rows_swapped' : 'several_rows_off';
};

export function barModelMiss(c: BarModelChallenge | null, view: BarModelView): BarModelMiss | undefined {
  if (!c || isSpokenGraph(c)) return undefined;
  const values = c.values.map(v => v.value);
  if (OPTION_MODES.has(c.evalMode)) {
    const got = view.selectedOption, want = c.expectedValue;
    if (got == null || want == null || got === want) return undefined;
    const icon = c.graphStyle === 'picture' ? c.scale?.iconValue ?? 1 : 1;
    if (icon > 1 && got * icon === want) return 'picked_icon_count';
    if (values.some((v, i) => v === got && i !== c.targetBarIndex)) return 'another_row';
    const step = c.graphStyle === 'picture' ? icon : c.scale?.step ?? 1;
    if (step > 1 && Math.abs(got - want) === step) return 'one_step_off';
    return offBy(got, want);
  }
  if (ROW_TAP_MODES.has(c.evalMode)) {
    const row = view.selectedRow, target = c.targetBarIndex;
    if (row == null || target == null || row === target) return undefined;
    if (c.evalMode === 'match_to_bar') return offBy(values[row] ?? 0, c.stimulusCount ?? values[target]);
    const most = values[target] === Math.max(...values);
    return values[row] === (most ? Math.min(...values) : Math.max(...values)) ? 'reversed' : 'other_row';
  }
  if (c.evalMode === 'build_one_to_one') return rowsMiss(c.expectedCounts ?? [], view.built.map(r => r.value));
  if (c.evalMode === 'build_graph') {
    const want = c.expectedDataset ?? [];
    return rowsMiss(want.map(e => e.value), want.map(e => view.built.find(b => b.label === e.label)?.value ?? 0))
      ?? (view.chosenStep !== c.expectedScaleStep ? 'wrong_step' : undefined);
  }
  return undefined;
}

const CHANNEL: Record<string, string> = {
  options: 'The learner taps one of the numbers under the graph; the graph checks it.',
  rows: 'The learner taps a row of the graph; the graph checks it.',
  stickers: 'The learner taps a row to put one sticker in it (Take one off removes one), then presses Check my chart; '
    + 'the chart checks every row.',
  build: 'The learner sets each bar with its plus and minus buttons, picks a scale step, then presses Submit graph; '
    + 'the graph checks the bars and the step.',
  speech: 'The learner answers aloud with a comparison; nothing on screen is tapped.',
};

/** What is drawn and asked. Row counts only where the rows are what the item asks about (the spoken modes). */
export function workspaceScene(c: BarModelChallenge, view: BarModelView): WorkspaceScene {
  const channel = isSpokenGraph(c) ? 'speech' : OPTION_MODES.has(c.evalMode) ? 'options' : ROW_TAP_MODES.has(c.evalMode) ? 'rows'
    : c.evalMode === 'build_one_to_one' ? 'stickers' : 'build';
  const drawn: Record<string, string | number> = { rows: c.values.map(v => v.label).join(', ') };
  if (isSpokenGraph(c)) {
    const counts = (rows: BarModelChallenge['values']) => rows.map(v => `${v.label} ${v.value}`).join(', ');
    drawn.rows = c.secondValues ? `${c.graphLabel}: ${counts(c.values)}; ${c.secondGraphLabel}: ${counts(c.secondValues)}` : counts(c.values);
  }
  if (c.graphStyle === 'picture' && (c.scale?.iconValue ?? 1) > 1) drawn.key = `one picture stands for ${c.scale?.iconValue}`;
  if (c.graphStyle === 'scaled_bar' && c.scale) drawn.axis = `numbered in steps of ${c.scale.step} up to ${c.scale.max}`;
  if (OPTION_MODES.has(c.evalMode) && c.options?.length) drawn.choices = c.options.join(', ');
  if (c.sourceItems?.length) drawn.pile = c.evalMode === 'build_one_to_one' ? 'a pile of objects to record' : 'a group of objects to count';
  if (c.evalMode === 'build_graph' && c.availableScaleSteps?.length) drawn.steps = c.availableScaleSteps.join(', ');
  return {
    objects: [],
    facts: {
      kind: c.evalMode, graph: c.graphStyle, ...drawn,
      ...(isSpokenGraph(c) ? {} : { learnerWork: describeGraphWork(c, view) }),
      constraints: `${CHANNEL[channel]} You cannot tap, place, set or choose anything for the learner.`,
    },
  };
}

/** A spoken journey's utterances: a true comparison from the rows, and the same claim reversed. */
export function barModelHarnessAnswers(c: BarModelChallenge): { correct: string; plainWrong: string } {
  if (c.secondValues) {
    const i = c.values.findIndex((v, k) => c.comparisonFocus === 'same' ? v.value === c.secondValues![k].value
      : v.value !== c.secondValues![k].value);
    const a = c.values[Math.max(0, i)], b = c.secondValues[Math.max(0, i)];
    if (a.value === b.value) return { correct: `${c.graphLabel} and ${c.secondGraphLabel} have the same number of ${a.label}.`,
      plainWrong: `${c.graphLabel} has more ${a.label} than ${c.secondGraphLabel}.` };
    const [more, less] = a.value > b.value ? [c.graphLabel, c.secondGraphLabel] : [c.secondGraphLabel, c.graphLabel];
    return { correct: `${more} has more ${a.label} than ${less}.`, plainWrong: `${less} has more ${a.label} than ${more}.` };
  }
  const sorted = [...c.values].sort((x, y) => y.value - x.value);
  const [big, small] = [sorted[0], sorted[sorted.length - 1]];
  return { correct: `There are more ${big.label} than ${small.label}.`, plainWrong: `There are more ${small.label} than ${big.label}.` };
}
