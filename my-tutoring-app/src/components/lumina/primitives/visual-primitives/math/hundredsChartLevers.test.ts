/**
 * hundreds-chart levers (`hundredsChartLevers.ts`): each leak rule, each simpler-chart builder over many items, which
 * lever answers which miss, and per item on the saved journey payloads that every catalog miss has a lever there.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { HundredsChartChallenge } from './HundredsChart';
import { hundredsChartMatches, neededCells } from './hundredsChartWorkspace';
import {
  DOTS_LEVER, MODEL_LEVER, PATTERN_DESCRIPTIONS, SIMPLER_LEVER, TALLY_LEVER, dotsLeak, hopDots, hundredsChartLevers, modelChart,
  modelLeaks, practiceItem, practiceLeaks, practiceParent, rowTally, tallyLeaks,
} from './hundredsChartLevers';
import complete from '../../../components/live-activity/runtime/testing/w1-payloads/hundreds-chart.complete_sequence.json';
import find from '../../../components/live-activity/runtime/testing/w1-payloads/hundreds-chart.find_skip_value.json';
import highlight from '../../../components/live-activity/runtime/testing/w1-payloads/hundreds-chart.highlight_sequence.json';
import identify from '../../../components/live-activity/runtime/testing/w1-payloads/hundreds-chart.identify_pattern.json';

type Type = HundredsChartChallenge['type'];
const seq = (sv: number, end: number) => Array.from({ length: Math.floor(end / sv) }, (_, i) => sv * (i + 1));

/** An item shaped the way the generator builds it (start = the skip value). */
function item(id: string, type: Type, sv: number, end = 100, prefill = 3, tier?: 'easy' | 'medium' | 'hard'): HundredsChartChallenge {
  const full = seq(sv, end);
  const base = { id, type, instruction: 'Do it.', skipValue: sv, startNumber: sv, hint: '', supportTier: tier,
    givenCells: [] as number[], correctCells: full, correctAnswer: '', options: [] as string[] };
  switch (type) {
    case 'highlight_sequence': return base;
    case 'complete_sequence': return { ...base, givenCells: full.slice(0, prefill), correctCells: full.slice(prefill) };
    case 'identify_pattern': {
      const d = PATTERN_DESCRIPTIONS[sv];
      return { ...base, givenCells: full, correctAnswer: d.correct, options: [d.correct, ...d.distractors] };
    }
    case 'find_skip_value': {
      const given = full.slice(0, Math.max(3, prefill));
      return { ...base, givenCells: given, correctCells: given, correctAnswer: String(sv),
        options: [sv, ...[2, 3, 5, 10].filter(x => x !== sv).slice(0, 3)].map(String) };
    }
  }
}
const right = (c: HundredsChartChallenge) => ({ cells: new Set(neededCells(c)),
  option: c.type === 'identify_pattern' ? c.correctAnswer : c.type === 'find_skip_value' ? String(c.skipValue) : null });

let s = 7;
const rnd = (n: number) => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
const ENDS = [20, 30, 50, 100];
const randomItem = (type: Type, i: number) => {
  const end = ENDS[rnd(ENDS.length)];
  const svs = [2, 3, 4, 5, 6, 10].filter(v => 3 * v <= end);
  return item(`r${i}`, type, svs[rnd(svs.length)], end, 2 + rnd(4));
};
const TYPES: Type[] = ['highlight_sequence', 'complete_sequence', 'identify_pattern', 'find_skip_value'];

describe('hop_dots: the leak rule', () => {
  it('over 400 random items and taps: only cells passed over, nothing past the last mark; with no taps, never a number to find', () => {
    for (let i = 0; i < 400; i++) {
      const type = (['highlight_sequence', 'complete_sequence', 'find_skip_value'] as const)[i % 3];
      const c = randomItem(type, i);
      const pool = Array.from({ length: c.correctCells.at(-1)! }, (_, k) => k + 1).filter(n => !c.givenCells.includes(n));
      const tapped = type === 'find_skip_value' ? [] : pool.filter(() => rnd(4) === 0).slice(0, 8);
      for (const taps of [[], tapped]) {
        const dots = hopDots(c, taps)!;
        expect(dots).not.toBeNull();
        expect(dotsLeak(c, taps, dots)).toBe(false);
      }
      expect(hopDots(c, [])!.length).toBeGreaterThan(0);
    }
  });
  it('what is drawn: highlight from 1 to before the first number; complete and find between the highlighted numbers', () => {
    expect(hopDots(item('h', 'highlight_sequence', 5), [])).toEqual([1, 2, 3, 4]);
    expect(hopDots(item('h', 'highlight_sequence', 5), [5, 15])).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(hopDots(item('c', 'complete_sequence', 2), [])).toEqual([3, 5]);
    expect(hopDots(item('f', 'find_skip_value', 2, 100, 4), [])).toEqual([3, 5, 7]);
  });
  it('not on a count by 1 (every passed cell would be a missing number), nor on identify', () => {
    expect(hopDots(item('h', 'highlight_sequence', 1, 10), [])).toBeNull();
    expect(hopDots(item('i', 'identify_pattern', 2), [])).toBeNull();
  });
});

describe('row_tally: the leak rule', () => {
  it('over 200 random taps, the tally holds only what is marked', () => {
    for (let i = 0; i < 200; i++) {
      const c = randomItem(i % 2 ? 'complete_sequence' : 'highlight_sequence', i);
      const taps = Array.from({ length: rnd(12) }, () => 1 + rnd(c.correctCells.at(-1)!)).filter(n => !c.givenCells.includes(n));
      const tally = rowTally(c, taps, 100);
      expect(tallyLeaks(c, taps, tally)).toBe(false);
    }
  });
  it('a dot per marked number in its row; no tally on a one-row board', () => {
    expect(rowTally(item('c', 'complete_sequence', 5, 30), [20, 25], 30)).toEqual([2, 2, 1]);
    expect(hundredsChartLevers(item('h', 'highlight_sequence', 2, 10), { gridMax: 10 }, []).map(l => l.id)).not.toContain(TALLY_LEVER);
  });
});

describe('model_chart: the leak rule', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('identify by %is: another count, never its description, a wrong choice when one has a model', sv => {
    const c = item('i', 'identify_pattern', sv);
    const model = modelChart(c, { challenges: [c] })!;
    expect(modelLeaks(model, c, { challenges: [c] })).toBe(false);
    expect(model.step).not.toBe(sv);
    expect(model.caption).toBe(PATTERN_DESCRIPTIONS[model.step].correct);
    expect(model.cells.every(n => n % model.step === 0 && n <= 30)).toBe(true);
    const modelled = [1, 2, 5, 10, 3, 4].filter(k => k !== sv && c.options.includes(PATTERN_DESCRIPTIONS[k].correct));
    if (modelled.length) expect(c.options).toContain(model.caption);
  });
  it('never a later item\'s answer', () => {
    const a = item('a', 'identify_pattern', 5), b = item('b', 'identify_pattern', 2);
    expect(modelChart(a, { challenges: [a, b] })!.caption).not.toBe(b.correctAnswer);
  });
});

describe('simpler charts: the builders', () => {
  it('over 400 random lessons: same mode, its own id, solvable, a plainer count, never the item\'s answer', () => {
    let built = 0;
    for (let i = 0; i < 400; i++) {
      const lesson = TYPES.map((t, k) => randomItem(t, i * 4 + k));
      const session = { challenges: lesson, gridMax: Math.max(...lesson.map(c => c.correctCells.at(-1) ?? 0)) };
      for (const c of lesson) {
        const p = practiceItem(c, session);
        if (!p) continue;
        built++;
        expect(p).toMatchObject({ id: `${c.id}~simpler`, type: c.type });
        expect(p.skipValue).not.toBe(c.skipValue);
        expect(practiceLeaks(p, c, session)).toBe(false);
        expect(hundredsChartMatches(p, right(p))).toBe(true);
        expect(hundredsChartMatches(p, right(c))).toBe(false);
        expect(practiceParent(p.id, lesson)).toBe(c);
        if (c.type === 'identify_pattern' || c.type === 'find_skip_value') expect(p.options).toHaveLength(2);
        else expect(neededCells(p).length).toBeLessThanOrEqual(5);
      }
    }
    expect(built).toBeGreaterThan(600);
  });
  it.each([
    ['counting in order', item('h', 'highlight_sequence', 1, 10)],
    ['highlight by 10s', item('h', 'highlight_sequence', 10)],
    ['complete by 10s', item('c', 'complete_sequence', 10)],
    ['find by 2s', item('f', 'find_skip_value', 2)],
  ])('no simpler chart on an item already the plainest: %s', (_, c) => {
    expect(practiceItem(c, { challenges: [c] })).toBeNull();
    expect(hundredsChartLevers(c, { challenges: [c] }, []).map(l => l.kind)).not.toContain('simplify');
  });
  it('by kind: five cells by 10s, a column with a far choice, four cells by 2s', () => {
    const h = item('h', 'highlight_sequence', 2), i = item('i', 'identify_pattern', 5), f = item('f', 'find_skip_value', 5);
    expect(practiceItem(h, { challenges: [h] })).toMatchObject({ correctCells: [10, 20, 30, 40, 50], givenCells: [] });
    expect(practiceItem(i, { challenges: [i] })).toMatchObject({ correctAnswer: PATTERN_DESCRIPTIONS[10].correct,
      options: [PATTERN_DESCRIPTIONS[10].correct, 'They are scattered randomly'] });
    expect(practiceItem(f, { challenges: [f] })).toMatchObject({ givenCells: [2, 4, 6, 8], options: ['2', '10'] });
  });
  it('identify and find never practise a later item\'s answer', () => {
    const i1 = item('a', 'identify_pattern', 2), i2 = item('b', 'identify_pattern', 10), i3 = item('c', 'identify_pattern', 5);
    expect(practiceItem(i1, { challenges: [i1, i2, i3] })).toBeNull();
    const f1 = item('a', 'find_skip_value', 5), f2 = item('b', 'find_skip_value', 2);
    expect(practiceItem(f1, { challenges: [f1, f2] })).toBeNull();
    expect(practiceItem(f2, { challenges: [f1, f2] })).toBeNull();
  });
});

describe('which lever comes next', () => {
  const h = item('h', 'highlight_sequence', 2), c = item('c', 'complete_sequence', 5), f = item('f', 'find_skip_value', 5);
  const i = item('i', 'identify_pattern', 5);
  const L = (x: HundredsChartChallenge, pulled: string[]) => hundredsChartLevers(x, { challenges: [x] }, pulled);
  it.each([
    [h, 'other_step', [], DOTS_LEVER], [h, 'stray_cells', [], DOTS_LEVER], [h, 'stopped_early', [], TALLY_LEVER],
    [h, 'gaps_left', [DOTS_LEVER], TALLY_LEVER], [h, 'gaps_left', [DOTS_LEVER, TALLY_LEVER], SIMPLER_LEVER],
    [c, 'extra_cells', [], DOTS_LEVER], [c, 'stopped_early', [TALLY_LEVER], SIMPLER_LEVER],
    [f, 'twice_the_step', [], DOTS_LEVER], [f, 'one_short', [DOTS_LEVER], SIMPLER_LEVER],
    [i, 'chose_rows', [], MODEL_LEVER], [i, 'chose_diagonal', [MODEL_LEVER], SIMPLER_LEVER],
  ] as const)('%#: %s -> %s', (x, miss, pulled, want) => {
    expect(nextLever(L(x, pulled as unknown as string[]), miss)).toBe(want);
  });
  it('easy starts the picture help shown, the tally and the simpler chart released', () => {
    expect(L({ ...h, supportTier: 'easy' }, []).map(l => [l.id, l.pulled]))
      .toEqual([[DOTS_LEVER, true], [TALLY_LEVER, false], [SIMPLER_LEVER, false]]);
    expect(L({ ...i, supportTier: 'easy' }, []).map(l => [l.id, l.pulled])).toEqual([[MODEL_LEVER, true], [SIMPLER_LEVER, false]]);
  });
});

describe('every catalog miss has a lever on every item of the saved payloads (J12)', () => {
  const misses = getComponentById('hundreds-chart')!.teachingWorkspace!.misses!;
  const payloads = [highlight, complete, identify, find].map(p => ((p as { data?: unknown }).data ?? p) as {
    challenges: HundredsChartChallenge[]; gridMax?: number });
  it.each(payloads.flatMap(d => d.challenges.map(c => [`${c.type} ${c.id} by ${c.skipValue}`, c, d] as const)))('%s', (_, c, d) => {
    const levers = hundredsChartLevers(c, d, []);
    for (const m of misses[c.type] ?? []) expect(levers.some(l => l.answers?.includes(m)), m).toBe(true);
  });
});
