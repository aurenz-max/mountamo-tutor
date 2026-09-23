/**
 * Bar model on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch B1).
 *
 * Pure: the component, the adapter and the journey read the same assignment and scene. Ten modes
 * are answered on the graph and checked by the primitive's own code, so the tutor is never handed
 * `expectedValue`, `targetBarIndex`, `expectedCounts`, `expectedDataset` or `expectedScaleStep`.
 * The two spoken modes (say_what_it_shows, compare_two_graphs) are judged by the tutor against the
 * code-derived comparison facts the retired explanation pack judged against: a bounded set of true
 * claims about the rows on screen, published as `expectedAnswer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { BarModelChallenge, BarModelEvalMode } from './BarModel';
import { graphComparisonFacts, graphExplanationAsk } from './barModelExplanationScript';

export const SPOKEN_GRAPH_MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>(['say_what_it_shows', 'compare_two_graphs']);
export const ROW_TAP_MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>(['compare_bars', 'most_least', 'match_to_bar']);
export const OPTION_MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>([
  'read_one_to_one', 'read_scale', 'picture_graph', 'scaled_bar_graph', 'graph_word_problem']);

export const isSpokenGraph = (c: BarModelChallenge) => SPOKEN_GRAPH_MODES.has(c.evalMode);

/** What the tutor judges a spoken explanation against: every true claim, and what the ask requires of one. */
export function spokenGraphAnswer(c: BarModelChallenge): string {
  const focus = c.comparisonFocus ? ` It must name a ${c.comparisonFocus === 'same' ? 'similarity' : 'difference'}.` : '';
  const across = c.evalMode === 'compare_two_graphs'
    ? ` It must compare ${c.graphLabel} with ${c.secondGraphLabel}, not two rows of one graph.` : '';
  return `One true comparison is the whole answer; the learner does not compare every group. Any one of these, `
    + `in the learner's own words (fewer for more reversed is the same claim): `
    + `${graphComparisonFacts(c).join(' ')}${focus}${across}`;
}

export function workspaceAssignment(c: BarModelChallenge): TeachingAssignment {
  return isSpokenGraph(c)
    ? { id: c.id, task: graphExplanationAsk(c), response: 'speech', expectedAnswer: spokenGraphAnswer(c) }
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
