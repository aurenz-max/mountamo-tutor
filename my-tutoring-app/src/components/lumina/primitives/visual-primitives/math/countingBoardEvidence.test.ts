import { expect, it } from 'vitest';
import { countingBoardDiagnosisEvidence, countingObservation, countingTask } from './countingBoardEvidence';
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

it('no wrong attempt means no evidence', () => {
  const outcomes = ['a', 'b'].map(id => ({ id, solved: true, corrections: 0, score: 100, seconds: 3 }));
  expect(countingBoardDiagnosisEvidence({ outcomes, observations: [] }, ['take_away', 'take_away'])).toBeUndefined();
});

it('keeps at most 12 phases: every board\'s first wrong attempt before later ones, emitted in the order they happened', () => {
  // 8 boards, each corrected twice and then affirmed or capped: 16 wrong attempts.
  const boards = Array.from({ length: 8 }, (_, i) => item(`c${i + 1}`, 'take_away', 6 + (i % 3), 5 + (i % 3), { changeBy: 1 }));
  const observations = boards.flatMap(b => [1, 2].map(n => ({ ...countingObservation(b, 'K', { heard: `${b.id}-try${n}` }), itemId: b.id, phase: 'take-away',
    support: `Correction observation; ${n - 1} prior corrections on this item. Other assistance is not established.` })));
  observations[15] = { ...observations[15], judgeFeedback: 'My turn: count what is left.' } as typeof observations[number];
  const outcomes = boards.map((b, i) => ({ id: b.id, solved: i % 2 === 0, corrections: 2, score: i % 2 === 0 ? 33 : 0, seconds: 5 }));
  const evidence = countingBoardDiagnosisEvidence({ outcomes, observations }, boards.map(b => b.kind))!;
  expect(evidence.firstResponseScore).toBe(0);
  expect(evidence.phases).toHaveLength(12);
  const said = evidence.phases!.map(p => p.observed.replace(/^Said "|"\.$/g, ''));
  // All 8 first tries survive; the 4 earliest second tries fill the rest; order is the order they happened.
  expect(said).toEqual(['c1-try1', 'c1-try2', 'c2-try1', 'c2-try2', 'c3-try1', 'c3-try2', 'c4-try1', 'c4-try2', 'c5-try1', 'c6-try1', 'c7-try1', 'c8-try1']);
  expect(evidence.judgeFeedback).toBe('My turn: count what is left.');
  expect(evidence.challengeSummary).toContain('Counting board (take_away), 8 boards');
  expect(evidence.challengeSummary).toContain('0 of 8 boards were answered right the first time');
  expect(evidence.expected).toBe('The number left on the board: the start minus the number taken away.');
  expect(evidence.observed.length).toBeLessThanOrEqual(2000);
  expect(evidence.phases![0]).toMatchObject({ itemId: 'c1', phase: 'take-away', expected: 'five (5) left' });
});

it('first-response score counts boards affirmed with no correction', () => {
  const boards = ['a', 'b', 'c', 'd', 'e'].map(id => item(id, 'add_more', 4, 6, { changeBy: 2 }));
  const outcomes = boards.map((b, i) => ({ id: b.id, solved: true, corrections: i < 3 ? 1 : 0, score: i < 3 ? 67 : 100, seconds: 4 }));
  const observations = boards.slice(0, 3).map(b => ({ ...countingObservation(b, 'K', { heard: 'four' }), itemId: b.id, phase: 'add-more' }));
  expect(countingBoardDiagnosisEvidence({ outcomes, observations }, boards.map(b => b.kind))!.firstResponseScore).toBe(40);
});
