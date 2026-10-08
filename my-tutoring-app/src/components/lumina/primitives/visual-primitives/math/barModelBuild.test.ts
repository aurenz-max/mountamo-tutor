import { expect, it } from 'vitest';
import { MAKE_GRAPH_MISSES, makeGraphAsk, makeGraphLevers, makeGraphMiss, makeGraphVerdict, twoBarPractice, type GraphRule }
  from './barModelBuild';
import { barModelMiss } from './barModelWorkspace';
import type { BarModelChallenge } from './BarModel';

const most: GraphRule = { kind: 'most', a: 0 }, fewest: GraphRule = { kind: 'fewest', a: 0 };
const same: GraphRule = { kind: 'same', a: 0, b: 1 }, twoMore: GraphRule = { kind: 'more_than', a: 0, b: 1, by: 2 };
const LABELS = ['apples', 'pears', 'plums'];
const item = (graphRule: GraphRule, rows = 3): BarModelChallenge => ({ id: 'g1', evalMode: 'make_graph', graphStyle: 'picture',
  values: LABELS.slice(0, rows).map(label => ({ label, value: 0 })), graphRule, prompt: makeGraphAsk(LABELS, graphRule) });

it.each([
  // Any data that fits passes.
  [most, [5, 2, 3], undefined], [most, [1, 0, 0], undefined], [most, [9, 8, 1], undefined],
  // A tie when "most" was asked; another bar highest; the named bar the fewest.
  [most, [3, 3, 1], 'tied'], [most, [2, 3, 1], 'other_row'], [most, [1, 2, 3], 'reversed'],
  [fewest, [1, 2, 3], undefined], [fewest, [3, 2, 1], 'reversed'], [fewest, [1, 1, 3], 'tied'], [fewest, [2, 1, 3], 'other_row'],
  [same, [2, 2, 5], undefined], [same, [4, 4, 0], undefined], [same, [2, 3, 0], 'not_same'], [same, [0, 0, 4], 'left_empty'],
  [twoMore, [4, 2, 0], undefined], [twoMore, [7, 5, 9], undefined], [twoMore, [2, 4, 0], 'reversed'], [twoMore, [3, 2, 0], 'one_short'],
  [twoMore, [5, 2, 0], 'one_over'], [twoMore, [2, 2, 0], 'short_by_more'], [twoMore, [9, 2, 0], 'over_by_more'],
] as const)('row %#: %j on %j', (rule, bars, miss) => {
  expect(makeGraphMiss(rule, bars)).toBe(miss);
  // The workspace's checked miss is the same check, read from the built rows.
  const built = bars.map((value, i) => ({ label: LABELS[i], value }));
  expect(barModelMiss(item(rule), { built, selectedOption: null, selectedRow: null, chosenStep: null })).toBe(miss);
});

it('the ask states the rule and its rows, and the verdict describes the learner\'s own graph without saying what to change', () => {
  expect(makeGraphAsk(LABELS, most)).toBe('Make a graph where apples have the most.');
  expect(makeGraphAsk(LABELS, same)).toBe('Make a graph where apples and pears have the same number.');
  expect(makeGraphAsk(LABELS, twoMore)).toBe('Make a graph where there are two more apples than pears.');
  expect(makeGraphVerdict(item(most), [3, 3, 1])).toBe('On your graph apples are tied with pears.');
  expect(makeGraphVerdict(item(most), [2, 3, 1])).toBe('On your graph pears have the most.');
  expect(makeGraphVerdict(item(most), [4, 3, 1])).toBe('Your graph shows apples with the most.');
  for (const [rule, bars] of [[most, [3, 3, 1]], [fewest, [3, 2, 1]], [same, [2, 3, 0]], [twoMore, [3, 2, 0]]] as const) {
    expect(makeGraphVerdict(item(rule), bars)).not.toMatch(/\d|\b(add|take|put|more pictures|fewer pictures)\b/i);
  }
});

it('levers start bare, name the build, and between them answer every miss the check names', () => {
  const answered = new Set<string>();
  for (const rule of [most, fewest, same, twoMore]) {
    const levers = makeGraphLevers(item(rule), []);
    expect(levers.map(l => [l.id, l.kind, l.pulled])).toEqual([['level_line', 'help', false], ['bar_counts', 'help', false],
      ['two_bars', 'simplify', false]]);
    for (const l of levers) {
      expect(`${l.when} ${l.does}`).toMatch(/\b(puts?|makes?|put in)\b/);
      // No number the ask needs: the only digits a lever could carry are none.
      expect(`${l.when} ${l.does}`).not.toMatch(/\d/);
      l.answers?.forEach(m => answered.add(m));
    }
  }
  expect([...MAKE_GRAPH_MISSES].filter(m => !answered.has(m))).toEqual([]);
  expect(makeGraphLevers(item(most), ['bar_counts']).find(l => l.id === 'bar_counts')?.pulled).toBe(true);
  expect(makeGraphLevers({ ...item(most), evalMode: 'most_least' }, [])).toEqual([]);
});

it('simplify keeps the ask on two empty bars, and a two-bar graph has no easier version', () => {
  const easier = twoBarPractice({ ...item({ kind: 'same', a: 2, b: 0 }), values: LABELS.map(label => ({ label, value: 4 })) })!;
  expect(easier.id).toBe('g1~two');
  expect(easier.values.map(v => [v.label, v.value])).toEqual([['apples', 0], ['plums', 0]]);
  expect(easier.graphRule).toEqual({ kind: 'same', a: 1, b: 0 });
  expect(easier.prompt).toBe('Make a graph where plums and apples have the same number.');
  expect(twoBarPractice(item(most, 2))).toBeNull();
  expect(twoBarPractice(easier)).toBeNull();
  expect(makeGraphLevers(item(most, 2), []).map(l => l.id)).toEqual(['level_line', 'bar_counts']);
});
