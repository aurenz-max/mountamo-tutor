import { expect, it } from 'vitest';
import { tenFrameEvidenceSummary, tenFrameObservation, tenFrameTask } from './tenFrameEvidence';
import { itemFromChallenge, itemsFromChallenges, type TenFrameChallengeLike, type TenFrameBand } from './tenFrameScript';

const item = (ch: Omit<TenFrameChallengeLike, 'id'> & { id?: string }, capacity = 10, band: TenFrameBand = 'K') =>
  itemFromChallenge({ id: 'c1', ...ch }, { capacity, band })!;

it('states each item from its own fields and what was on screen', () => {
  expect(tenFrameTask(item({ type: 'subtract', startCount: 7, targetCount: 4 }), { equationShown: true })).toEqual({
    challenge: '7 counters on a frame of 10; the tutor said to take away 3; the learner may take counters off, then says how many are left. "7 − 3 = ?" was printed on screen.',
    expected: 'four (4) left' });
  expect(tenFrameTask(item({ type: 'add', addend1: 8, addend2: 5, targetCount: 13 }, 20, '1-2'))).toEqual({
    challenge: 'An empty double frame of 20; the tutor said 8 plus 5; the learner may place counters, then says how many altogether.',
    expected: 'thirteen (13) altogether' });
  expect(tenFrameTask(item({ type: 'make_ten', targetCount: 7 }, 10, '1-2'), { countShown: true })).toEqual({
    challenge: '7 counters on a frame of 10; say how many more counters fill the frame. A running count of the counters on the frame was on screen.',
    expected: 'three (3) more' });
  expect(tenFrameTask(item({ type: 'subitize', targetCount: 6 }, 10, '1-2'), { reshows: 2 }).challenge)
    .toBe('6 counters filled in frame order on a frame of 10, shown briefly and then hidden; say how many without counting one by one. The learner asked to see them again 2 times.');
  expect(tenFrameTask(item({ type: 'build_teen', targetCount: 14 }, 20)).expected).toBe('4 more placed beside the ten (14 on the frames).');
  expect(tenFrameTask(item({ type: 'decompose_teen', targetCount: 14 }, 20)).expected).toBe('Ten yellow and 4 left red.');
  const [first, second] = itemsFromChallenges([{ id: 'a', type: 'split', targetCount: 5 }, { id: 'b', type: 'split', targetCount: 5 }], { capacity: 10, band: 'K' });
  expect(tenFrameTask(first).challenge).toBe('5 red counters on a frame of 10; turn some yellow to make two groups.');
  expect(tenFrameTask(second).challenge).toBe('5 red counters on a frame of 10; turn some yellow to make two groups, a pair not yet shown for 5 this session.');
});

it('observes what was said, placed or turned yellow', () => {
  const subtract = item({ type: 'subtract', startCount: 7, targetCount: 4 });
  expect(tenFrameObservation(subtract, { heard: ' seven ', onFrame: 4 }).observed).toBe('Said "seven".');
  expect(tenFrameObservation(subtract, {}).observed).toBe('No transcript; the tutor judged the spoken answer wrong.');
  const split = item({ type: 'split', targetCount: 5 });
  expect(tenFrameObservation(split, { onFrame: 5, splitVerdict: 'empty_part' }).observed).toBe('Left 0 red and turned 5 yellow, leaving one colour with no counters.');
  expect(tenFrameObservation(split, { onFrame: 2, splitVerdict: 'repeat' }).observed).toBe('Left 3 red and turned 2 yellow, a pair already shown for 5 this session.');
  expect(tenFrameObservation(split, { onFrame: 2, splitVerdict: 'correct' }).observed).toBe('Left 3 red and turned 2 yellow.');
  expect(tenFrameObservation(item({ type: 'make_ten', targetCount: 6 }), { onFrame: 9 }).observed).toBe('Placed 3 more and stopped with 1 box empty.');
  expect(tenFrameObservation(item({ type: 'build_teen', targetCount: 13 }, 20), { onFrame: 20 }).observed).toBe('Placed 10 more beside the ten (20 on the frames).');
  expect(tenFrameObservation(item({ type: 'decompose_teen', targetCount: 13 }, 20), { onFrame: 3 }).observed).toBe('Turned 3 yellow and left 10 red.');
  expect(tenFrameObservation(item({ type: 'build', targetCount: 6 }), { onFrame: 5 }).observed).toBe('Placed 5 counters.');
});

it('states the session and its key per kind; the runner adds the count, policy and first-time share', () => {
  const items = Array.from({ length: 8 }, (_, i) => item({ id: `c${i + 1}`, type: 'subtract', startCount: 6 + (i % 3), targetCount: 4 }));
  expect(tenFrameEvidenceSummary(items)).toEqual({
    task: 'Ten frame (subtract), 8 items: the tutor says a take-away and the learner says how many are left.',
    expected: 'The number left: the start minus the number taken away.',
  });
  expect(tenFrameEvidenceSummary([item({ type: 'add', addend1: 3, addend2: 2, targetCount: 5 }), item({ type: 'split', targetCount: 5 })])).toEqual({
    task: 'Ten frame (add, split), 2 items: the tutor says an addition and the learner says how many altogether; a group of red counters is on the frame and the learner turns some yellow to make two groups, a different way each time.',
    expected: 'The number altogether: the first number plus the second. Two non-empty colour groups, a different pair each time the same total is asked again.',
  });
});
