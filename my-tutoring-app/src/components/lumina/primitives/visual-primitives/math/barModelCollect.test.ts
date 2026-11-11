/**
 * bar-model predict_then_collect: code draws the survey (one row ahead by the tier's lead) and the order the answers
 * arrive in; the check reads the record and the verdict against the learner's own chart; the levers never show an
 * answer still to come.
 */
import { describe, expect, it } from 'vitest';
import type { BarModelChallenge } from './BarModel';
import { collectArrivals, collectCorrect, collectCounts, collectVerdict, mostRow } from './barModelCollect';
import { barModelMiss } from './barModelWorkspace';
import { ANSWERS_SO_FAR, BAR_LEVERS, MARK_GUESS, SIMPLER, answersSoFar, simplerGraph, simplerLeaks } from './barModelLevers';
import { validateBarModelData } from './barModel.boss';

const LABELS = ['Apples', 'Pears', 'Plums'];
const survey = (counts: number[]): BarModelChallenge => ({
  id: 's1', evalMode: 'predict_then_collect', graphStyle: 'picture', prompt: 'Which fruit do you like best?',
  scale: { step: 1, max: Math.max(...counts) + 2, iconValue: 1 },
  values: counts.map((_, i) => ({ label: LABELS[i], value: 0, emoji: ['🍎', '🍐', '🟣'][i] })),
  expectedCounts: counts, sourceItems: collectArrivals(counts).map(i => ({ emoji: ['🍎', '🍐', '🟣'][i], categoryIndex: i })),
});
const rows = (c: BarModelChallenge, built: number[]) => c.values.map((v, i) => ({ label: v.label, value: built[i] }));

describe('predict_then_collect', () => {
  it('the survey has one winner, ahead by the tier\'s lead, in 1-6; every row can win; every answer arrives once', () => {
    const wins = new Set<number>();
    for (const [tier, rowsN, lead] of [['easy', 2, 3], ['medium', 3, 2], ['hard', 3, 1], [null, 3, 2]] as const) {
      for (let run = 0; run < 60; run++) {
        const counts = collectCounts(tier);
        expect(counts).toHaveLength(rowsN);
        const w = mostRow(counts);
        expect(w).toBeGreaterThanOrEqual(0);
        wins.add(w);
        const sorted = [...counts].sort((a, b) => b - a);
        expect(sorted[0] - sorted[1]).toBe(lead);
        counts.forEach(n => { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(6); });
        const arrivals = collectArrivals(counts);
        counts.forEach((n, i) => expect(arrivals.filter(a => a === i)).toHaveLength(n));
        expect(validateBarModelData({ title: 't', challenges: [survey(counts)] })).toBeTruthy();
      }
    }
    expect(wins).toEqual(new Set([0, 1, 2]));
  });

  it('the check needs the whole record and the verdict its own chart supports; the guess itself is never graded', () => {
    const c = survey([2, 5, 3]);
    expect(collectCorrect(c, [2, 5, 3], 1, 'yes')).toBe(true);
    expect(collectCorrect(c, [2, 5, 3], 0, 'no')).toBe(true);
    expect(collectCorrect(c, [2, 5, 3], 0, 'yes')).toBe(false);
    expect(collectCorrect(c, [3, 4, 3], 1, 'yes')).toBe(false);
    expect(collectVerdict([2, 5, 3], 2)).toBe('no');
    const v = (built: number[], prediction: number, verdict: 'yes' | 'no') =>
      barModelMiss(c, { built: rows(c, built), selectedOption: null, selectedRow: null, chosenStep: null, prediction, verdict });
    expect(v([2, 5, 3], 0, 'yes')).toBe('wrong_verdict');
    expect(v([2, 5, 3], 1, 'yes')).toBeUndefined();
    expect(v([5, 2, 3], 1, 'no')).toBe('rows_swapped');
    expect(v([2, 4, 3], 1, 'yes')).toBe('one_short');
    expect(() => validateBarModelData({ title: 't', challenges: [survey([3, 3, 1])] })).toThrow();
  });

  it('the levers: answers so far never shows one still to come; the guess mark only after a guess; an easier survey', () => {
    const c = survey([2, 5, 3]);
    const recorded = [1, 0, 0];
    const so = answersSoFar(c, rows(c, recorded));
    expect(so.reduce((a, b) => a + b, 0)).toBe(1);
    expect(so[c.sourceItems![0].categoryIndex]).toBe(1);
    const before = BAR_LEVERS.declare(c, { built: rows(c, [0, 0, 0]) }, []).map(l => l.id);
    expect(before).toEqual(expect.arrayContaining([ANSWERS_SO_FAR, SIMPLER]));
    expect(before).not.toContain(MARK_GUESS);
    const after = BAR_LEVERS.declare(c, { built: rows(c, [2, 5, 3]), prediction: 0 }, []);
    expect(after.map(l => l.id)).toContain(MARK_GUESS);
    for (const m of ['rows_swapped', 'several_rows_off', 'one_short', 'one_over', 'short_by_more', 'over_by_more', 'wrong_verdict'])
      expect(after.some(l => l.answers?.includes(m)), m).toBe(true);
    for (const l of after) expect(`${l.when} ${l.does}`).not.toMatch(/\d/);
    const p = simplerGraph(c)!;
    expect(p.evalMode).toBe('predict_then_collect');
    expect(simplerLeaks(p, c)).toBe(false);
    expect(p.values).toHaveLength(2);
    expect(mostRow(p.expectedCounts!)).toBeGreaterThanOrEqual(0);
    expect(validateBarModelData({ title: 't', challenges: [p] })).toBeTruthy();
  });
});
