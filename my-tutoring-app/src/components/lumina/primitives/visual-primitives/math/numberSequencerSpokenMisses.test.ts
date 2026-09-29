import { expect, it } from 'vitest';
import { spokenNumber } from '../../../components/live-activity/runtime/spokenMissContract';
import { numberSequencerSpokenMisses, sequencerItemsForChallenge, workspaceAssignment } from './numberSequencerDomain';
import { spokenIntegerWord } from './spokenNumberWords';

const first = (c: Record<string, unknown>) => sequencerItemsForChallenge({ id: String(c.type), ...c } as never)[0];

it.each([
  ['count on past a ten', first({ type: 'count-from', sequence: [], startNumber: 29, correctAnswers: [30], rangeMin: 29, rangeMax: 30,
    direction: 'forward' }), 30, ['said_start', 'wrong_direction', 'skipped_one', 'teen_ty_swap', 'decade_word']],
  ['before', first({ type: 'before-after', sequence: [null, 8], correctAnswers: [7], rangeMin: 7, rangeMax: 8 }), 7,
    ['said_shown', 'wrong_side', 'skipped_one']],
  ['a gap counting by fives', first({ type: 'fill-missing', sequence: [5, 10, null, 20], correctAnswers: [15], rangeMin: 5, rangeMax: 20 }), 15,
    ['said_neighbor', 'counted_by_one', 'teen_ty_swap', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['spot the error', first({ type: 'spot-error', sequence: [3, 9, 5, 6, 7], wrongIndex: 1, correctAnswers: [4], rangeMin: 3, rangeMax: 9 }), 9,
    ['said_repair', 'said_neighbor']],
] as const)('%s: known misses in order, none of them the answer', (_, item, answer, ids) => {
  expect(workspaceAssignment(item).expectedAnswer).toBe(String(answer));
  const misses = numberSequencerSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const accepted = [String(answer), spokenNumber(answer), spokenIntegerWord(answer)];
  expect(misses.flatMap(m => m.examples ?? []).filter(e => accepted.includes(e))).toEqual([]);
});

it('an arrangement lists none', () => {
  const order = first({ type: 'order-cards', sequence: [4, 2, 3], correctAnswers: [2, 3, 4], rangeMin: 2, rangeMax: 4 });
  expect(numberSequencerSpokenMisses(order)).toEqual([]);
  expect(workspaceAssignment(order).misses).toBeUndefined();
});
