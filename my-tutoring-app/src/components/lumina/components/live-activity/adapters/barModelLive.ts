import type { BarModelChallenge, BarModelData, BarModelEvalMode } from '../../../primitives/visual-primitives/math/BarModel';
import { OPTION_MODES, ROW_TAP_MODES, isSpokenGraph, workspaceAssignment }
  from '../../../primitives/visual-primitives/math/barModelWorkspace';
import { graphComparisonFacts } from '../../../primitives/visual-primitives/math/barModelExplanationScript';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>(['read_one_to_one', 'most_least', 'compare_bars', 'match_to_bar',
  'build_one_to_one', 'say_what_it_shows', 'compare_two_graphs', 'read_scale', 'picture_graph', 'scaled_bar_graph',
  'graph_word_problem', 'build_graph']);
const count = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Can this challenge be answered as generated, by the check its mode uses? */
function answerable(c: BarModelChallenge): boolean {
  const rows = c.values.length;
  if (OPTION_MODES.has(c.evalMode)) return Array.isArray(c.options) && c.options.includes(c.expectedValue as number);
  if (ROW_TAP_MODES.has(c.evalMode)) return Number.isInteger(c.targetBarIndex) && c.targetBarIndex! >= 0 && c.targetBarIndex! < rows;
  if (c.evalMode === 'build_one_to_one') return Array.isArray(c.expectedCounts) && c.expectedCounts.length === rows
    && c.expectedCounts.every(count);
  if (c.evalMode === 'build_graph') return Array.isArray(c.expectedDataset) && c.expectedDataset.length === rows
    && c.expectedDataset.every(e => c.values.some(v => v.label === e.label) && count(e.value))
    && (c.availableScaleSteps ?? [1, 2, 5, 10]).includes(c.expectedScaleStep as number);
  // A spoken explanation is judged against the comparisons its rows support; none means nothing to judge.
  return isSpokenGraph(c) && graphComparisonFacts(c).length > 0;
}

/** Reject a graph session whose challenges cannot be attempted. */
export function validateBarModelData(value: unknown): BarModelData {
  const d = value as BarModelData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !MODES.has(c.evalMode)
        || typeof c.prompt !== 'string' || !c.prompt.trim()
        || !Array.isArray(c.values) || !c.values.length
        || c.values.some(v => !v || typeof v.label !== 'string' || !count(v.value))))
    throw new Error('Generated bar model has invalid lesson content.');
  if (d.challenges.some(c => !answerable(c))) throw new Error('A bar-model challenge cannot be answered as generated.');
  return d;
}

/** What the live adapter needs from the bar model; the catalog's `teachingWorkspace` declares the rest. */
export const barModelLiveDomain: WorkspaceDomain<BarModelData> = {
  validate: validateBarModelData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
