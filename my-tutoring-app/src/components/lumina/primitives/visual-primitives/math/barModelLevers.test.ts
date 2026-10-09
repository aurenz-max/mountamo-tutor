/**
 * bar-model levers (`barModelLevers.ts`) on the twelve modes other than make_graph: which lever answers which miss,
 * each leak rule, and the easier graphs over many generated shapes, on the saved payloads and on built items.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { BarModelChallenge, BarModelEvalMode } from './BarModel';
import { barModelMiss } from './barModelWorkspace';
import {
  BAR_VALUES, DATA_BESIDE, GROUP_FIVES, GUIDE_LINE, ICON_VALUES, MARK_BARS, MARK_ROW, MINOR_TICKS, PAIR_ROWS, PILE_ROW, SIMPLER,
  SORT_PILE, STEP_MARKS, WORD_MODEL, barModelLevers, barValuesLeak, dataBesideLeaks, fivesRows, leverFacts, leverRefusal, markRowLeaks,
  namedRows, simplerGraph, simplerLeaks, simplerParent, stepMarks, wordModel, wordModelLeaks,
} from './barModelLevers';

const MODES: BarModelEvalMode[] = ['read_one_to_one', 'most_least', 'compare_bars', 'match_to_bar', 'build_one_to_one',
  'say_what_it_shows', 'compare_two_graphs', 'read_scale', 'picture_graph', 'scaled_bar_graph', 'graph_word_problem', 'build_graph'];
const payload = (mode: string): BarModelChallenge[] => JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/bar-model.${mode}.json`), 'utf8')).data.challenges;
const ids = (c: BarModelChallenge, pulled: string[] = []) => barModelLevers(c, pulled).map(l => l.id);
const entry = getComponentById('bar-model')!.teachingWorkspace!;

const K = (mode: BarModelEvalMode, counts: number[], extra: Partial<BarModelChallenge> = {}): BarModelChallenge => ({
  id: 'g1', evalMode: mode, graphStyle: 'picture', prompt: 'How many apples?', scale: { step: 1, max: 10, iconValue: 1, iconEmoji: '🍎' },
  values: counts.map((value, i) => ({ label: ['Apples', 'Pears', 'Plums', 'Figs', 'Kiwis'][i], value, emoji: ['🍎', '🍐', '🟣', '🟤', '🥝'][i] })),
  ...extra });
const scaled = (mode: BarModelEvalMode, step: number, values: number[], target: number, extra: Partial<BarModelChallenge> = {}) =>
  K(mode, values, { graphStyle: 'scaled_bar', scale: { step, max: step * 10 }, targetBarIndex: target, expectedValue: values[target],
    options: [values[target] - step, values[target], values[target] + step], ...extra });

describe('which lever answers which miss', () => {
  it.each([
    [K('read_one_to_one', [8, 3, 6], { targetBarIndex: 0, expectedValue: 8, showTargetHighlight: false }), 'another_row', MARK_ROW],
    [K('read_one_to_one', [8, 3, 6], { targetBarIndex: 0, expectedValue: 8 }), 'one_short', GROUP_FIVES],
    [K('read_one_to_one', [4, 3, 6], { targetBarIndex: 0, expectedValue: 4 }), 'one_over', SIMPLER],
    [K('most_least', [5, 8, 7], { targetBarIndex: 1 }), 'reversed', WORD_MODEL],
    [K('most_least', [5, 8, 7], { targetBarIndex: 1 }), 'other_row', GROUP_FIVES],
    [K('most_least', [5, 4, 3], { targetBarIndex: 0 }), 'other_row', SIMPLER],
    [K('compare_bars', [3, 4], { graphStyle: 'bar', targetBarIndex: 1 }), 'reversed', WORD_MODEL],
    [K('match_to_bar', [6, 8, 10, 2], { targetBarIndex: 0, stimulusCount: 6 }), 'one_over', PILE_ROW],
    [K('build_one_to_one', [0, 0, 0], { expectedCounts: [5, 3, 2], sourceScattered: true }), 'rows_swapped', SORT_PILE],
    [K('say_what_it_shows', [8, 3, 7]), 'reversed_comparison', WORD_MODEL],
    [K('say_what_it_shows', [8, 3, 7]), 'same_for_different', GROUP_FIVES],
    [K('compare_two_graphs', [3, 4], { secondValues: [{ label: 'Apples', value: 1 }, { label: 'Pears', value: 4 }] }), 'rows_not_graphs', PAIR_ROWS],
    [scaled('read_scale', 2, [8, 4, 12], 0, { showTargetHighlight: false }), 'another_row', MARK_ROW],
    [scaled('scaled_bar_graph', 5, [14, 10, 20], 0), 'one_step_off', GUIDE_LINE],
    [scaled('scaled_bar_graph', 5, [14, 10, 20], 0), 'one_short', GUIDE_LINE],
    [K('picture_graph', [10, 15, 20], { scale: { step: 5, max: 20, iconValue: 5, iconEmoji: '🧸' }, targetBarIndex: 1, expectedValue: 15 }),
      'picked_icon_count', ICON_VALUES],
    [scaled('graph_word_problem', 5, [17, 8, 3, 15], 0, { prompt: 'How many more cars than dolls?', expectedValue: 9, targetBarIndex: undefined,
      values: [{ label: 'Cars', value: 17 }, { label: 'Dolls', value: 8 }, { label: 'Balls', value: 3 }, { label: 'Trains', value: 15 }] }),
      'another_row', MARK_BARS],
    [scaled('graph_word_problem', 5, [17, 8, 3, 15], 0, { prompt: 'How many more cars than dolls?', expectedValue: 9, showBarValues: false,
      targetBarIndex: undefined }), 'one_short', BAR_VALUES],
  ] as const)('#%#: after %s, %s', (item, miss, lever) => {
    expect(nextLever(barModelLevers(item, []), miss)).toBe(lever);
  });

  it('after the guide line, a one-short read on a step-5 axis gets the unlabelled marks, then the easier graph', () => {
    const c = scaled('scaled_bar_graph', 5, [14, 10, 20], 0);
    expect(nextLever(barModelLevers(c, [GUIDE_LINE]), 'one_short')).toBe(MINOR_TICKS);
    expect(nextLever(barModelLevers(c, [GUIDE_LINE, MINOR_TICKS]), 'one_short')).toBe(SIMPLER);
  });

  it('a help the tier already shows starts pulled, and that is not a pull', () => {
    const marked = K('read_one_to_one', [8, 3], { targetBarIndex: 0, expectedValue: 8 });
    expect(barModelLevers(marked, []).find(l => l.id === MARK_ROW)!.pulled).toBe(true);
    expect(barModelLevers({ ...marked, showTargetHighlight: false }, []).find(l => l.id === MARK_ROW)!.pulled).toBe(false);
  });

  it('every lever answers only its mode\'s catalog misses; on the saved payloads every catalog miss is answered', () => {
    for (const mode of MODES) {
      const items = payload(mode);
      const answered = new Set(items.flatMap(c => barModelLevers(c, []).flatMap(l => l.answers ?? [])));
      const declared = entry.misses![mode];
      answered.forEach(m => expect(declared, mode).toContain(m));
      expect(declared.filter(m => !answered.has(m)), mode).toEqual(entry.unanswered?.[mode] ?? []);
    }
  });

  it('the miss a graph check names on a scaled graph is never picked_icon_count, and two bars never name other_row', () => {
    const view = { built: [], selectedRow: null, chosenStep: null };
    const read = scaled('read_scale', 1, [8, 4, 12], 0);
    for (let n = 0; n <= 30; n++) expect(barModelMiss(read, { ...view, selectedOption: n })).not.toBe('picked_icon_count');
    const two = K('compare_bars', [3, 7], { graphStyle: 'bar', targetBarIndex: 1 });
    expect(barModelMiss(two, { ...view, selectedOption: null, selectedRow: 0 })).toBe('reversed');
  });
});

describe('leak rules', () => {
  it('mark_row only where the answer is a row\'s number', () => {
    for (const mode of ['most_least', 'compare_bars', 'match_to_bar'] as const) {
      expect(markRowLeaks(K(mode, [3, 5], { targetBarIndex: 1 }))).toBe(true);
      expect(ids(K(mode, [3, 5], { targetBarIndex: 1 }))).not.toContain(MARK_ROW);
    }
    expect(markRowLeaks(K('read_one_to_one', [3, 5], { targetBarIndex: 1 }))).toBe(false);
  });
  it('group_fives: on read_one_to_one only when the asked row is long; never on a picture key above one', () => {
    expect(fivesRows(K('read_one_to_one', [8, 3, 6], { targetBarIndex: 1 }))).toEqual([]);
    expect(fivesRows(K('read_one_to_one', [8, 3, 6], { targetBarIndex: 0 }))).toEqual([0, 2]);
    expect(fivesRows(K('picture_graph', [10, 15], { scale: { step: 5, max: 20, iconValue: 5 } }))).toEqual([]);
  });
  it('word_model: on every saved payload, pictures the item does not use and rows that are not the item\'s', () => {
    for (const mode of ['most_least', 'compare_bars', 'say_what_it_shows', 'compare_two_graphs'] as const) for (const c of payload(mode)) {
      const m = wordModel(c)!;
      expect(m, `${mode} ${c.id}`).not.toBeNull();
      expect(wordModelLeaks(m, c)).toBe(false);
      expect([...c.values, ...(c.secondValues ?? [])].map(v => v.emoji)).not.toContain(m.glyph);
    }
    expect(wordModelLeaks({ glyph: '🍎', rows: [{ count: 5, word: 'more' }] }, K('most_least', [3, 5]))).toBe(true);
  });
  it('bar_values is withheld when the answer is a bar\'s number; data_beside only states numbers the question states', () => {
    expect(barValuesLeak(scaled('graph_word_problem', 5, [17, 8], 0, { expectedValue: 8 }))).toBe(true);
    expect(ids(scaled('graph_word_problem', 5, [17, 8, 4], 0, { expectedValue: 8, showBarValues: false }))).not.toContain(BAR_VALUES);
    const build = K('build_graph', [0, 0], { graphStyle: 'scaled_bar', prompt: 'Build the graph: Apples=12, Pears=16.',
      expectedDataset: [{ label: 'Apples', value: 12 }, { label: 'Pears', value: 16 }], expectedScaleStep: 2, availableScaleSteps: [1, 2, 5] });
    expect(dataBesideLeaks(build)).toBe(false);
    expect(dataBesideLeaks({ ...build, prompt: 'Build the graph from the survey.' })).toBe(true);
    expect(ids({ ...build, prompt: 'Build the graph from the survey.' })).toEqual([STEP_MARKS]);
    for (const c of payload('build_graph')) expect(dataBesideLeaks(c), c.id).toBe(false);
  });
  it('step_marks counts to the learner\'s own tallest bar and refuses before a bar is set', () => {
    const build = payload('build_graph')[0];
    expect(stepMarks([1, 2, 5, 10], [{ value: 0 }])).toBeNull();
    expect(leverRefusal(build, STEP_MARKS, build.values)).toMatch(/Set a bar first/);
    expect(stepMarks([1, 2, 5, 10], [{ value: 12 }, { value: 20 }])).toEqual({ 1: 20, 2: 10, 5: 4, 10: 2 });
  });
  it('mark_bars marks only rows the question names', () => {
    const wp = payload('graph_word_problem')[0];
    expect(namedRows(wp).map(i => wp.values[i].label)).toEqual(['Cars', 'Dolls']);
  });
  it('no scene fact states an answer: on every saved payload with every lever pulled, the fact names no key number on K modes', () => {
    for (const mode of MODES) for (const c of payload(mode)) {
      const levers = barModelLevers(c, []).map(l => l.id);
      const fact = leverFacts(c, id => levers.includes(id), c.values) ?? '';
      expect(fact).not.toMatch(/\b(answer|correct|is the (most|fewest))\b/i);
      if (['read_one_to_one', 'most_least', 'match_to_bar', 'build_one_to_one', 'say_what_it_shows', 'compare_two_graphs'].includes(mode)) {
        const own = [...c.values.map(v => v.value), ...(c.expectedCounts ?? []), c.stimulusCount ?? -1, c.expectedValue ?? -1].filter(n => n > 0);
        // The word model's own row lengths are the only numbers; none is a count on the item unless it is a model row.
        const numbers = (fact.replace(/a row of \d+/g, '').match(/\d+/g) ?? []).map(Number);
        numbers.forEach(n => expect(own, `${mode} ${c.id}: ${fact}`).not.toContain(n));
      }
      for (const l of barModelLevers(c, [])) expect(`${l.when} ${l.does}`).not.toContain(String(c.expectedValue ?? '§'));
    }
  });
});

/** Seeded generated shapes per mode. */
function randomItems(seed: number): BarModelChallenge[] {
  let s = seed;
  const rnd = (n: number) => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
  const k = (n: number) => Array.from({ length: n }, () => 1 + rnd(10));
  const rows = 2 + rnd(4);
  const counts = k(rows), t = rnd(rows);
  const step = [2, 5, 10][rnd(3)], iv = [2, 5][rnd(2)];
  const sv = Array.from({ length: 4 }, () => step * (1 + rnd(10)));
  const most = counts.indexOf(Math.max(...counts));
  const pg = Array.from({ length: 4 }, () => iv * (1 + rnd(5)));
  return [
    K('read_one_to_one', counts, { targetBarIndex: t, expectedValue: counts[t], options: [counts[t], counts[t] + 1] }),
    K('most_least', counts, { targetBarIndex: most }),
    K('compare_bars', counts.slice(0, 2).map((v, i) => i === 0 && v === counts[1] ? v + 1 : v), { graphStyle: 'bar', targetBarIndex: rnd(2) }),
    K('match_to_bar', counts, { targetBarIndex: t, stimulusCount: counts[t], sourceScattered: rnd(2) === 0,
      sourceItems: Array.from({ length: counts[t] }, () => ({ emoji: '🧱', categoryIndex: 0 })) }),
    K('build_one_to_one', counts.map(() => 0), { expectedCounts: counts, sourceScattered: rnd(2) === 0,
      sourceItems: counts.flatMap((n, i) => Array.from({ length: n }, () => ({ emoji: '🍎', categoryIndex: i }))) }),
    scaled('read_scale', [1, 2][rnd(2)], sv.map(v => v / step), 1),
    scaled('scaled_bar_graph', step, sv.map(v => v + rnd(step)), 1),
    K('picture_graph', pg, { scale: { step: iv, max: 25, iconValue: iv, iconEmoji: '🧸' }, targetBarIndex: 1, expectedValue: pg[1],
      prompt: `How many pears? Each 🧸 stands for ${iv}.` }),
    scaled('graph_word_problem', step, sv, 0, { prompt: 'How many more apples than pears?', expectedValue: Math.abs(sv[0] - sv[1]) || 1,
      targetBarIndex: undefined }),
  ];
}

describe('easier graphs over 300 generated items', () => {
  it('same mode, the ~simpler id, never the item\'s answer or rows, solvable and in band', () => {
    let built = 0;
    for (let seed = 1; seed <= 300; seed++) for (const c of randomItems(seed)) {
      const p = simplerGraph(c);
      if (!p) continue;
      built++;
      expect(p.id).toBe('g1~simpler');
      expect(p.evalMode).toBe(c.evalMode);
      expect(simplerLeaks(p, c)).toBe(false);
      expect(simplerParent(p.id, [c])).toBe(c);
      expect(simplerGraph(p)).toBeNull();
      const vs = p.values.map(v => v.value);
      if (c.graphStyle === 'picture' && (c.scale?.iconValue ?? 1) === 1) {
        vs.forEach(v => { expect(v).toBeGreaterThanOrEqual(c.evalMode === 'build_one_to_one' ? 0 : 1); expect(v).toBeLessThanOrEqual(10); });
        expect(p.values.length).toBeLessThanOrEqual(c.values.length);
      }
      if (p.expectedValue != null && p.options) expect(p.options).toContain(p.expectedValue);
      switch (p.evalMode) {
        case 'most_least': {
          const ext = vs[p.targetBarIndex!];
          expect(vs.filter(v => v === ext)).toHaveLength(1);
          expect([Math.max(...vs), Math.min(...vs)]).toContain(ext);
          expect(Math.max(...vs) === ext).toBe(c.values[c.targetBarIndex!].value === Math.max(...c.values.map(v => v.value)));
          break;
        }
        case 'compare_bars': expect(Math.abs(vs[0] - vs[1])).toBeGreaterThanOrEqual(4); break;
        case 'match_to_bar':
          expect(vs[p.targetBarIndex!]).toBe(p.stimulusCount);
          expect(p.sourceItems).toHaveLength(p.stimulusCount!);
          expect(vs.filter(v => v === p.stimulusCount)).toHaveLength(1);
          break;
        case 'build_one_to_one':
          expect(p.sourceItems!.length).toBe(p.expectedCounts!.reduce((a, b) => a + b, 0));
          expect(p.values.length).toBe(2);
          break;
        case 'read_one_to_one': case 'read_scale': case 'scaled_bar_graph': case 'picture_graph':
          expect(vs[p.targetBarIndex!]).toBe(p.expectedValue);
          expect(vs[p.targetBarIndex!]).toBeLessThanOrEqual((p.scale?.max ?? 0));
          if (p.evalMode !== 'read_one_to_one') expect(p.scale!.step).toBeLessThan(c.scale!.step);
          if (p.evalMode === 'picture_graph') expect(p.prompt).toMatch(/stands for 2\b/);
          break;
        case 'graph_word_problem':
          expect(p.values).toHaveLength(2);
          expect(vs[0] - vs[1]).toBe(p.expectedValue);
          break;
      }
    }
    expect(built).toBeGreaterThan(1000);
  });
  it('the plainest shapes have no easier graph', () => {
    expect(simplerGraph(K('read_one_to_one', [2, 6], { targetBarIndex: 0, expectedValue: 2 }))).toBeNull();
    expect(simplerGraph(K('compare_bars', [2, 7], { graphStyle: 'bar', targetBarIndex: 1 }))).toBeNull();
    expect(simplerGraph(K('most_least', [7, 4, 2], { targetBarIndex: 0 }))).toBeNull();
    expect(simplerGraph(scaled('read_scale', 1, [8, 4], 0))).toBeNull();
    expect(simplerGraph(K('picture_graph', [4, 6], { scale: { step: 2, max: 10, iconValue: 2 }, targetBarIndex: 0, expectedValue: 4 }))).toBeNull();
    expect(simplerGraph(K('build_one_to_one', [0, 0], { expectedCounts: [3, 2] }))).toBeNull();
    for (const mode of ['say_what_it_shows', 'compare_two_graphs', 'build_graph'] as const) expect(ids(payload(mode)[0])).not.toContain(SIMPLER);
  });
});
