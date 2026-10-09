/**
 * array-grid levers on the given-array modes (build_array, count_array, multiply_array): leak rules, the smaller-array
 * builder over every array the component draws, and "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ArrayGridChallenge, ArrayGridChallengeType } from './ArrayGrid';
import {
  NUMBER_LABELS_LEVER, ROW_STRIPS_LEVER, SMALLER_LEVER, arrayGridLevers, labelsOffered, leverFacts, smallerArray, smallerLeaks,
} from './arrayGridLevers';
import { arrayMiss, type ArrayGridView } from './arrayGridWorkspace';

const GIVEN: ArrayGridChallengeType[] = ['build_array', 'count_array', 'multiply_array'];
const ALL: ArrayGridChallenge[] = [];
for (let r = 2; r <= 6; r++) for (let c = 2; c <= 8; c++) ALL.push({ id: `a${r}x${c}`, targetRows: r, targetColumns: c });
const ids = (c: ArrayGridChallenge, mode: ArrayGridChallengeType, labelsShown: boolean, pulled: string[] = []) =>
  arrayGridLevers(c, pulled, { mode, labelsShown }).map(l => l.id);

describe('smallerArray on a given array', () => {
  it.each(ALL)('$targetRows × $targetColumns: one step smaller, same mode, never the learner\'s array or its total', c => {
    const s = smallerArray(c);
    if (c.targetRows === 2 && c.targetColumns === 2) { expect(s).toBeNull(); return; }
    expect(s).not.toBeNull();
    expect(s!.id).toBe(`${c.id}~smaller`);
    expect(s!.total).toBeUndefined();
    expect(s!.targetRows).toBeGreaterThanOrEqual(2);
    expect(s!.targetColumns).toBeGreaterThanOrEqual(2);
    expect(s!.targetRows).toBeLessThanOrEqual(c.targetRows);
    expect(s!.targetColumns).toBeLessThanOrEqual(c.targetColumns);
    expect(s!.targetRows * s!.targetColumns).toBeLessThan(c.targetRows * c.targetColumns);
    expect(smallerLeaks(c, s!)).toBe(false);
    expect(smallerArray(s!)).toBeNull();
  });
  it('the leak rule refuses the same array, the turned array, the same total and a one-row array', () => {
    const p: ArrayGridChallenge = { id: 'p', targetRows: 3, targetColumns: 4 };
    expect(smallerLeaks(p, { id: 'p~smaller', targetRows: 3, targetColumns: 4 })).toBe(true);
    expect(smallerLeaks(p, { id: 'p~smaller', targetRows: 4, targetColumns: 3 })).toBe(true);
    expect(smallerLeaks(p, { id: 'p~smaller', targetRows: 2, targetColumns: 6 })).toBe(true);
    expect(smallerLeaks(p, { id: 'p~smaller', targetRows: 1, targetColumns: 4 })).toBe(true);
    expect(smallerLeaks(p, { id: 'p~smaller', targetRows: 2, targetColumns: 4 })).toBe(false);
  });
});

describe('leak rules', () => {
  it('number_labels: never on multiply, never where the session already numbers rows and columns', () => {
    expect(labelsOffered({ mode: 'multiply_array', labelsShown: false })).toBe(false);
    expect(labelsOffered({ mode: 'count_array', labelsShown: true })).toBe(false);
    expect(labelsOffered({ mode: 'build_array', labelsShown: true })).toBe(false);
    expect(labelsOffered({ mode: 'count_array', labelsShown: false })).toBe(true);
    expect(labelsOffered({ mode: 'build_array', labelsShown: false })).toBe(true);
  });
  it.each(GIVEN)('%s: no lever text or scene fact carries a number', mode => {
    for (const c of ALL) for (const shown of [true, false]) {
      const levers = arrayGridLevers(c, [], { mode, labelsShown: shown });
      for (const l of levers) expect(`${l.when} ${l.does}`, l.id).not.toMatch(/\d/);
      expect(leverFacts(c, levers.map(l => l.id))).not.toMatch(/\d/);
    }
  });
  it('declares the levers per item: strips always, labels only where hidden (not multiply), smaller except on 2 × 2', () => {
    const big = ALL.find(c => c.id === 'a4x6')!, plain = ALL.find(c => c.id === 'a2x2')!;
    expect(ids(big, 'count_array', true)).toEqual([ROW_STRIPS_LEVER, SMALLER_LEVER]);
    expect(ids(big, 'count_array', false)).toEqual([ROW_STRIPS_LEVER, NUMBER_LABELS_LEVER, SMALLER_LEVER]);
    expect(ids(big, 'multiply_array', false)).toEqual([ROW_STRIPS_LEVER, SMALLER_LEVER]);
    // The plainest array keeps a help lever on every mode.
    for (const mode of GIVEN) expect(ids(plain, mode, true)).toEqual([ROW_STRIPS_LEVER]);
    // No context (and make_array's context) declares no given-array lever.
    expect(arrayGridLevers(big, [])).toEqual([]);
    expect(arrayGridLevers(big, [], { mode: 'make_array', labelsShown: true })).toEqual([]);
  });
});

describe('this wrong answer, then this lever', () => {
  const C: ArrayGridChallenge = { id: 'c', targetRows: 3, targetColumns: 4 };
  const view = (mode: ArrayGridChallengeType, over: Partial<ArrayGridView>): ArrayGridView => ({ mode, icon: 'star', rows: 3, columns: 4,
    totalAnswer: '', rowsAnswer: '3', columnsAnswer: '4', labelsShown: false, cells: [], firstWay: null, ...over });
  it.each([
    ['count_array', { totalAnswer: '7' }, 'added_sides', ROW_STRIPS_LEVER, SMALLER_LEVER],
    ['count_array', { totalAnswer: '8' }, 'one_row_off', ROW_STRIPS_LEVER, NUMBER_LABELS_LEVER],
    ['count_array', { totalAnswer: '9' }, 'one_column_off', ROW_STRIPS_LEVER, NUMBER_LABELS_LEVER],
    ['count_array', { totalAnswer: '13' }, 'off_by_one', ROW_STRIPS_LEVER, NUMBER_LABELS_LEVER],
    ['count_array', { totalAnswer: '20' }, 'other_total', ROW_STRIPS_LEVER, SMALLER_LEVER],
    ['build_array', { totalAnswer: '7' }, 'added_sides', ROW_STRIPS_LEVER, SMALLER_LEVER],
    ['multiply_array', { rowsAnswer: '4', columnsAnswer: '3', totalAnswer: '12' }, 'swapped_sides', ROW_STRIPS_LEVER, SMALLER_LEVER],
    ['multiply_array', { rowsAnswer: '5', totalAnswer: '12' }, 'wrong_side', ROW_STRIPS_LEVER, SMALLER_LEVER],
    ['multiply_array', { totalAnswer: '8' }, 'one_row_off', ROW_STRIPS_LEVER, SMALLER_LEVER],
  ] as const)('%s %o → %s → %s, then %s', (mode, over, miss, first, second) => {
    expect(arrayMiss(C, view(mode, over))).toBe(miss);
    expect(nextLever(arrayGridLevers(C, [], { mode, labelsShown: false }), miss)).toBe(first);
    expect(nextLever(arrayGridLevers(C, [first], { mode, labelsShown: false }), miss)).toBe(second);
  });
  it('every catalog miss of the given-array modes is answered by a lever on every item (J9)', () => {
    const tw = getComponentById('array-grid')!.teachingWorkspace!;
    for (const mode of GIVEN) for (const c of ALL) for (const shown of [true, false]) {
      const levers = arrayGridLevers(c, [], { mode, labelsShown: shown });
      for (const m of tw.misses![mode]) expect(levers.some(l => l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
    }
    expect(tw.unanswered?.count_array ?? []).toEqual([]);
  });
});
