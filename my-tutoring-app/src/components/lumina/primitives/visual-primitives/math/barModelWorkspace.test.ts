import { expect, it } from 'vitest';
import { barModelMiss, barModelSpokenMisses, workspaceAssignment, workspaceScene, type BarModelView } from './barModelWorkspace';
import type { BarModelChallenge } from './BarModel';

const rows = (...vs: number[]) => vs.map((value, i) => ({ label: `r${i}`, value }));
const ch = (evalMode: BarModelChallenge['evalMode'], extra: Partial<BarModelChallenge>): BarModelChallenge =>
  ({ id: evalMode, evalMode, values: rows(3, 5, 2), graphStyle: 'bar', prompt: '', targetBarIndex: 1, ...extra });
const pick = (selectedOption: number): BarModelView => ({ built: [], selectedOption, selectedRow: null, chosenStep: null });
const tap = (selectedRow: number): BarModelView => ({ built: [], selectedOption: null, selectedRow, chosenStep: null });
const built = (values: number[], chosenStep: number | null = null): BarModelView =>
  ({ built: rows(...values), selectedOption: null, selectedRow: null, chosenStep });

const read = ch('read_one_to_one', { expectedValue: 5 });
const picture = ch('picture_graph', { graphStyle: 'picture', values: rows(10, 25, 15), expectedValue: 25, scale: { step: 5, max: 30, iconValue: 5 } });
const scaled = ch('read_scale', { values: rows(10, 40, 20), expectedValue: 40, scale: { step: 10, max: 50 } });
const most = ch('most_least', {}), fewest = ch('most_least', { targetBarIndex: 2 });
const match = ch('match_to_bar', { values: rows(3, 5, 7), stimulusCount: 5 });
const stickers = ch('build_one_to_one', { expectedCounts: [3, 5, 2] });
const graph = ch('build_graph', { expectedDataset: rows(3, 5, 2), expectedScaleStep: 2 });

it.each([
  [read, pick(5), undefined], [read, pick(3), 'another_row'], [read, pick(4), 'one_short'], [read, pick(7), 'over_by_more'],
  [picture, pick(5), 'picked_icon_count'], [picture, pick(15), 'another_row'], [picture, pick(20), 'one_step_off'],
  [picture, pick(24), 'one_short'], [scaled, pick(30), 'one_step_off'], [scaled, pick(20), 'another_row'],
  [most, tap(2), 'reversed'], [most, tap(0), 'other_row'], [fewest, tap(1), 'reversed'], [most, tap(1), undefined],
  [match, tap(0), 'short_by_more'], [match, tap(2), 'over_by_more'],
  [stickers, built([3, 5, 2]), undefined], [stickers, built([2, 5, 2]), 'one_short'], [stickers, built([3, 5, 5]), 'over_by_more'],
  [stickers, built([5, 3, 2]), 'rows_swapped'], [stickers, built([4, 4, 2]), 'several_rows_off'],
  [graph, built([3, 5, 2], 2), undefined], [graph, built([3, 5, 2], 5), 'wrong_step'], [graph, built([3, 6, 2], 2), 'one_over'],
  [ch('say_what_it_shows', {}), pick(1), undefined],
] as const)('row %#', (c, view, miss) => {
  expect(barModelMiss(c, view)).toBe(miss);
});

const twoGraphs = ch('compare_two_graphs', { graphLabel: 'Morning', secondGraphLabel: 'Afternoon', values: rows(3, 5, 2),
  secondValues: rows(3, 4, 2) });
it.each([
  [ch('say_what_it_shows', {}), ['reversed_comparison', 'same_for_different', 'no_comparison'],
    ['There are more r2 than r1', 'r1 and r2 are the same', 'r1', '5']],
  [twoGraphs, ['reversed_comparison', 'same_for_different', 'rows_not_graphs', 'no_comparison'],
    ['Afternoon has more r1 than Morning', 'Morning and Afternoon have the same number of r1', 'r0 and r1 are different', 'r1', '5']],
  [ch('say_what_it_shows', { values: rows(4, 4) }), ['no_comparison'], ['r0', '4']],
] as const)('spoken %#: known misses in order, none a true comparison', (c, ids, examples) => {
  const misses = barModelSpokenMisses(c);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(misses.flatMap(m => m.examples ?? [])).toEqual(examples);
  expect(workspaceAssignment(c).misses).toEqual(misses);
});

it('a graph answered on screen lists none', () => expect(barModelSpokenMisses(read)).toEqual([]));

it('build_graph: the scene numbers the axis by the learner\'s step, never the key step', () => {
  const scaledBuild = ch('build_graph', { graphStyle: 'scaled_bar', expectedDataset: rows(12, 16, 20), expectedScaleStep: 2,
    scale: { step: 2, max: 20 }, availableScaleSteps: [1, 2, 5, 10] });
  expect(workspaceScene(scaledBuild, built([0, 0, 0])).facts.axis).toBe('numbered only at 0 and 20 until a step is chosen');
  expect(workspaceScene(scaledBuild, built([12, 16, 20], 5)).facts.axis).toBe('numbered in steps of 5 up to 20');
  expect(workspaceScene({ ...scaled, graphStyle: 'scaled_bar' }, pick(10)).facts.axis).toBe('numbered in steps of 10 up to 50');
});
