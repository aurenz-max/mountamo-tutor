import { expect, it } from 'vitest';
import { countingBoardEvidenceSummary, countingObservation, countingTask } from './countingBoardEvidence';
import { itemFromChallenge, type CountingItem } from './countingBoardScript';

const item = (id: string, type: CountingItem['kind'], count: number, targetAnswer: number, patch: Record<string, number> = {}) =>
  itemFromChallenge({ id, type, count, targetAnswer, ...patch }, { objectWord: 'bears' })!;

it('states each board from its own fields: start and change, covered start, both groups', () => {
  expect(countingTask(item('a', 'take_away', 7, 4, { changeBy: 3 }), 'K')).toEqual({
    challenge: '7 bears on the board; the tutor said to take away 3. Say how many are left.', expected: 'four (4) left' });
  expect(countingTask(item('b', 'add_more', 4, 6, { changeBy: 2 }), 'K').challenge).toBe('4 bears on the board; the tutor said to put 2 more on. Say how many altogether.');
  expect(countingTask(item('c', 'count_on', 8, 8, { startFrom: 5 }), 'K').challenge).toContain('5 are already in the group (covered by a basket); 3 more bears');
  expect(countingTask(item('c', 'count_on', 8, 8, { startFrom: 5 }), '1').challenge).toContain('(visible and marked counted)');
  expect(countingTask(item('d', 'compare', 11, 7, { groupSize: 7 }), '1').challenge).toBe('Two groups of bears: 7 and 4. Say how many are in the group with more.');
  const drawn = (compareGroups: number[]) => itemFromChallenge({ id: 'e', type: 'compare', count: 11, targetAnswer: 7, groupSize: 7, compareGroups }, { objectWord: 'bears' });
  expect(countingTask(drawn([4, 7])!, '1').challenge).toBe('Two groups of bears: 4 on the left and 7 on the right. Say how many are in the group with more.');
  // Drawn groups that disagree with the key are not askable: wrong total, a tie, or a bigger group that is not the answer.
  expect([drawn([4, 6]), drawn([7, 7]), drawn([3, 8]), drawn([11])]).toEqual([null, null, null, null]);
  expect(countingObservation(item('a', 'take_away', 7, 4, { changeBy: 3 }), 'K', { heard: ' seven ' }).observed).toBe('Said "seven".');
  expect(countingObservation(item('a', 'take_away', 7, 4, { changeBy: 3 }), 'K', {}).observed).toBe('No transcript; the tutor judged the spoken answer wrong.');
  expect(countingObservation(item('g', 'give_me_n', 9, 4), 'K', { given: 5 }).observed).toBe('Handed over 5 bears.');
});

it('states the session and its key per mode; the runner adds the count, policy and first-time share', () => {
  const boards = Array.from({ length: 8 }, (_, i) => item(`c${i + 1}`, 'take_away', 6 + (i % 3), 5 + (i % 3), { changeBy: 1 }));
  expect(countingBoardEvidenceSummary(boards)).toEqual({
    task: 'Counting board (take_away), 8 boards: each board starts with some objects, the tutor says how many to take away, the learner removes them and says how many are left.',
    expected: 'The number left on the board: the start minus the number taken away.',
  });
  expect(countingBoardEvidenceSummary([item('a', 'count_all', 5, 5), item('b', 'subitize', 3, 3)])).toEqual({
    task: 'Counting board (count_all, subitize), 2 boards: boards of count_all, subitize.',
    expected: 'The number of objects the board shows.',
  });
  expect(countingBoardEvidenceSummary([item('a', 'count_all', 5, 5)]).task).toBe('Counting board (count_all), 1 boards: the learner counts the objects on each board and says how many.');
});
