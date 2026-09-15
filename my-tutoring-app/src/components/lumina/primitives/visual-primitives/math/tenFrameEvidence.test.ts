import { expect, it } from 'vitest';
import { tenFrameDiagnosisEvidence, tenFrameObservation, tenFrameTask } from './tenFrameEvidence';
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

it('no wrong attempt means no evidence', () => {
  const outcomes = ['a', 'b'].map(id => ({ id, solved: true, corrections: 0, score: 100, seconds: 3 }));
  expect(tenFrameDiagnosisEvidence({ outcomes, observations: [] }, [{ kind: 'subtract' }, { kind: 'subtract' }])).toBeUndefined();
});

it('keeps at most 12 phases: every item\'s first wrong attempt before later ones, emitted in the order they happened', () => {
  // 8 items, each corrected twice: 16 wrong attempts.
  const items = Array.from({ length: 8 }, (_, i) => item({ id: `c${i + 1}`, type: 'subtract', startCount: 6 + (i % 3), targetCount: 4 }));
  const observations = items.flatMap(it => [1, 2].map(k => ({ ...tenFrameObservation(it, { heard: `${it.id}-try${k}` }), itemId: it.id, phase: 'operate',
    support: `Correction observation; ${k - 1} prior corrections on this item. Other assistance is not established.` })));
  observations[15] = { ...observations[15], judgeFeedback: 'My turn: seven take away three leaves four.' } as typeof observations[number];
  const outcomes = items.map((it, i) => ({ id: it.id, solved: i % 2 === 0, corrections: 2, score: i % 2 === 0 ? 33 : 0, seconds: 5 }));
  const evidence = tenFrameDiagnosisEvidence({ outcomes, observations }, items)!;
  expect(evidence.firstResponseScore).toBe(0);
  expect(evidence.phases).toHaveLength(12);
  expect(evidence.phases!.map(p => p.observed.replace(/^Said "|"\.$/g, ''))).toEqual(
    ['c1-try1', 'c1-try2', 'c2-try1', 'c2-try2', 'c3-try1', 'c3-try2', 'c4-try1', 'c4-try2', 'c5-try1', 'c6-try1', 'c7-try1', 'c8-try1']);
  expect(evidence.judgeFeedback).toBe('My turn: seven take away three leaves four.');
  expect(evidence.challengeSummary).toContain('Ten frame (subtract), 8 items: the tutor says a take-away');
  expect(evidence.challengeSummary).toContain('0 of 8 items were answered right the first time');
  expect(evidence.expected).toBe('The number left: the start minus the number taken away.');
  expect(evidence.observed.length).toBeLessThanOrEqual(2000);
  expect(evidence.phases![0]).toMatchObject({ itemId: 'c1', phase: 'operate', expected: 'four (4) left' });
});

it('first-response score counts items affirmed with no correction', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map(id => item({ id, type: 'add', addend1: 3, addend2: 2, targetCount: 5 }));
  const outcomes = items.map((it, i) => ({ id: it.id, solved: true, corrections: i < 3 ? 1 : 0, score: i < 3 ? 67 : 100, seconds: 4 }));
  const observations = items.slice(0, 3).map(it => ({ ...tenFrameObservation(it, { heard: 'three' }), itemId: it.id, phase: 'operate' }));
  expect(tenFrameDiagnosisEvidence({ outcomes, observations }, items)!.firstResponseScore).toBe(40);
});
