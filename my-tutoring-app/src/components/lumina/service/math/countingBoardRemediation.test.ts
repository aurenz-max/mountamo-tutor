import { expect, it } from 'vitest';
import type { CountingBoardChallenge } from '../../primitives/visual-primitives/math/CountingBoard';
import { itemFromChallenge } from '../../primitives/visual-primitives/math/countingBoardScript';
import {
  compiledOneMoreCountOn, compiledSameStartContrast, countingBoardDeliveryEligible, countingBoardTeachingFor,
  eligibleCountingBoardTeaching, legalChanges, selectOneMoreCountOn, selectSameStartContrast,
} from './countingBoardRemediation';

const board = (id: string, type: CountingBoardChallenge['type'], count: number, patch: Partial<CountingBoardChallenge> = {}): CountingBoardChallenge => ({
  id, type, count, targetAnswer: count, arrangement: 'scattered', instruction: 'x', hint: 'h', narration: 'n', ...patch,
});
const away = (id: string, start: number, changeBy: number) => board(id, 'take_away', start, { changeBy, targetAnswer: start - changeBy });
const more = (id: string, start: number, changeBy: number) => board(id, 'add_more', start, { changeBy, targetAnswer: start + changeBy });
const on = (id: string, startFrom: number, total: number) => board(id, 'count_on', total, { startFrom });
const askable = (cs: readonly CountingBoardChallenge[]) => cs.every(c => itemFromChallenge(c, { objectWord: 'bears' }) !== null);
const cards = (cs: readonly CountingBoardChallenge[]) => new Set(cs.map(c => `${c.count}:${c.changeBy}:${c.startFrom}`)).size;

it('gates: take_away, add_more and count_on in Kindergarten or Grade 1', () => {
  for (const mode of ['take_away', 'add_more', 'count_on']) {
    expect(eligibleCountingBoardTeaching({ grade: 'K', mode })).toBe(true);
    expect(eligibleCountingBoardTeaching({ grade: '1', mode })).toBe(true);
    expect(countingBoardDeliveryEligible({ targetEvalMode: mode })).toBe(true);
  }
  for (const task of [{ grade: '2', mode: 'take_away' }, { grade: 'K', mode: 'count' }, { grade: 'K', mode: 'compare' }, { grade: 'K' }, { mode: 'add_more' }]) {
    expect(eligibleCountingBoardTeaching(task)).toBe(false);
  }
  for (const mode of ['count', 'give_me_n', 'recount_moved', 'subitize', 'group', undefined]) expect(countingBoardDeliveryEligible({ targetEvalMode: mode })).toBe(false);
  expect(countingBoardTeachingFor('take_away')?.moves[0].id).toBe('contrast_same_start_different_change');
  expect(countingBoardTeachingFor('add_more')?.moves[0].id).toBe('contrast_same_start_different_change');
  expect(countingBoardTeachingFor('count_on')?.moves[0].id).toBe('count_on_exactly_one_more');
  expect(countingBoardTeachingFor('count')).toBeNull();
});

it('legal changes: one to three, a result of at least one, never spoken as the answer, add_more total in bound', () => {
  expect(legalChanges('take_away', 6, 20)).toEqual([1, 2]); // 6 - 3 = 3 would recite the answer
  expect(legalChanges('take_away', 2, 20)).toEqual([]); // 2 - 1 = 1 recites; 2 - 2 = 0
  expect(legalChanges('add_more', 4, 20)).toEqual([1, 2, 3]);
  expect(legalChanges('add_more', 4, 6)).toEqual([1, 2]);
  expect(legalChanges('add_more', 1, 20)).toEqual([2, 3]); // a total below three is never drawn
});

it('compiled recheck reads start, change and key: neighbouring boards that start the same and change differently', () => {
  expect(compiledSameStartContrast([away('a', 7, 1), away('b', 7, 3)])).toEqual({ targets: ['a', 'b'], count: 2 });
  expect(compiledSameStartContrast([more('a', 4, 1), more('b', 4, 3)]).count).toBe(2);
  // Not neighbours, the same change, different starts, a desynced key, a change spoken as the answer, or mixed modes: none.
  expect(compiledSameStartContrast([away('a', 7, 1), away('x', 5, 2), away('b', 7, 3)]).count).toBe(0);
  expect(compiledSameStartContrast([away('a', 7, 2), away('b', 7, 2)]).count).toBe(0);
  expect(compiledSameStartContrast([away('a', 7, 1), away('b', 8, 3)]).count).toBe(0);
  expect(compiledSameStartContrast([away('a', 7, 1), { ...away('b', 7, 3), targetAnswer: 5 }]).count).toBe(0);
  expect(compiledSameStartContrast([away('a', 6, 1), { ...away('b', 6, 3) }]).count).toBe(0);
  expect(compiledSameStartContrast([away('a', 5, 1), more('b', 5, 2)]).count).toBe(0);
  expect(compiledOneMoreCountOn([on('a', 5, 6), on('b', 4, 7)])).toEqual({ targets: ['a'], count: 1 });
  expect(compiledOneMoreCountOn([on('a', 5, 7), { ...on('b', 4, 5), targetAnswer: 4 }, { ...on('c', 3, 4), startFrom: null }]).count).toBe(0);
});

const takeBaseline = [away('c1', 5, 1), away('c2', 6, 2), away('c3', 8, 3), away('c4', 9, 2), away('c5', 10, 1)];
const addBaseline = [more('c1', 3, 2), more('c2', 5, 1), more('c3', 4, 3), more('c4', 7, 2), more('c5', 6, 3)];

it('change selector rewrites one later board to its neighbour\'s start; count, ids, other boards, largest board and askability hold', () => {
  for (const [baseline, type] of [[takeBaseline, 'take_away'], [addBaseline, 'add_more']] as const) {
    expect(compiledSameStartContrast(baseline).count).toBe(0);
    for (let r = 0; r < 1; r += 0.05) {
      const selected = selectSameStartContrast(baseline, 'contrast_same_start_different_change', 20, () => r);
      expect(selected.status).toBe('targeted');
      expect(selected.challenges.map(c => c.id)).toEqual(baseline.map(c => c.id));
      const changed = selected.challenges.map((c, i) => (c === baseline[i] ? -1 : i)).filter(i => i >= 0);
      expect(changed).toHaveLength(1);
      expect(changed[0]).toBeGreaterThanOrEqual(2);
      const c = selected.challenges[changed[0]];
      expect({ ...c, count: 0, changeBy: 0, targetAnswer: 0 }).toEqual({ ...baseline[changed[0]], count: 0, changeBy: 0, targetAnswer: 0 });
      expect(c.count).toBe(baseline[changed[0] - 1].count);
      expect(c.changeBy).not.toBe(baseline[changed[0] - 1].changeBy);
      expect(c.changeBy).toBeLessThanOrEqual(3);
      expect(c.targetAnswer).toBe(type === 'take_away' ? c.count - c.changeBy! : c.count + c.changeBy!);
      expect(Math.max(...selected.challenges.map(x => x.targetAnswer))).toBeLessThanOrEqual(Math.max(...baseline.map(x => x.targetAnswer)));
      expect(askable(selected.challenges)).toBe(true);
      expect(cards(selected.challenges)).toBe(5);
      expect(compiledSameStartContrast(selected.challenges).targets).toContain(c.id);
    }
  }
});

it('add_more never passes the lesson bound', () => {
  const bounded = [more('c1', 3, 2), more('c2', 4, 1), more('c3', 3, 1), more('c4', 2, 3), more('c5', 4, 2)]; // totals 5, 5, 4, 5, 6
  for (let r = 0; r < 1; r += 0.1) {
    const selected = selectSameStartContrast(bounded, 'contrast_same_start_different_change', 5, () => r);
    expect(selected.challenges.every(c => c.targetAnswer <= 6)).toBe(true);
    if (selected.challenges !== bounded) expect(selected.challenges.every((c, i) => c === bounded[i] || c.targetAnswer <= 5)).toBe(true);
  }
});

it('change selector reports already-targeted, no-focus and capacity misses without changing the baseline', () => {
  const present = [away('c1', 5, 1), away('c2', 7, 1), away('c3', 7, 2)];
  expect(selectSameStartContrast(present, 'contrast_same_start_different_change', 20)).toMatchObject({ status: 'already-targeted', challenges: present, count: 2 });
  expect(selectSameStartContrast(takeBaseline, null, 20)).toMatchObject({ status: 'no-focus', challenges: takeBaseline, count: 0 });
  // add_more 5 + 1 is the largest board (6): the only other change from a start of 5 would pass it.
  const capped = [more('c1', 5, 1), more('c2', 2, 3)];
  expect(selectSameStartContrast(capped, 'contrast_same_start_different_change', 20)).toMatchObject({ status: 'insufficient-capacity', challenges: capped });
  for (const bad of [[away('c1', 5, 1)], [away('c1', 5, 1), more('c2', 5, 2)], [away('c1', 5, 1), { ...away('c2', 6, 2), targetAnswer: 3 }]]) {
    expect(selectSameStartContrast(bad, 'contrast_same_start_different_change', 20)).toMatchObject({ status: 'insufficient-capacity', challenges: bad });
  }
});

it('count-on selector shrinks one later board to one more; its spoken start, other boards and askability hold', () => {
  const baseline = [on('c1', 4, 7), on('c2', 6, 9), on('c3', 3, 5), on('c4', 7, 10), on('c5', 5, 8)];
  expect(compiledOneMoreCountOn(baseline).count).toBe(0);
  for (let r = 0; r < 1; r += 0.05) {
    const selected = selectOneMoreCountOn(baseline, 'count_on_exactly_one_more', () => r);
    expect(selected.status).toBe('targeted');
    const changed = selected.challenges.map((c, i) => (c === baseline[i] ? -1 : i)).filter(i => i >= 0);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toBeGreaterThanOrEqual(1);
    const c = selected.challenges[changed[0]];
    expect({ ...c, count: 0, targetAnswer: 0 }).toEqual({ ...baseline[changed[0]], count: 0, targetAnswer: 0 });
    expect([c.count, c.targetAnswer]).toEqual([c.startFrom! + 1, c.startFrom! + 1]);
    expect(askable(selected.challenges)).toBe(true);
    expect(compiledOneMoreCountOn(selected.challenges)).toEqual({ targets: [c.id], count: 1 });
  }
  expect(selectOneMoreCountOn([on('c1', 4, 7), on('c2', 6, 7)], 'count_on_exactly_one_more')).toMatchObject({ status: 'already-targeted', count: 1 });
  expect(selectOneMoreCountOn(baseline, null)).toMatchObject({ status: 'no-focus', challenges: baseline });
  for (const bad of [[on('c1', 4, 7)], [on('c1', 4, 7), { ...on('c2', 5, 8), startFrom: null }]]) {
    expect(selectOneMoreCountOn(bad, 'count_on_exactly_one_more')).toMatchObject({ status: 'insufficient-capacity', challenges: bad });
  }
});
