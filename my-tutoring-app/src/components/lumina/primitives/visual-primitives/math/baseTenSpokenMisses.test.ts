import { expect, it } from 'vitest';
import { spokenNumber } from '../../../components/live-activity/runtime/spokenMissContract';
import type { BaseTenItem } from './baseTenScript';
import { baseTenSpokenMisses, diWorkspaceAssignment } from './baseTenWorkspace';
import { spokenIntegerWord } from './spokenNumberWords';

const item = (step: BaseTenItem['step'], mode: 'read_blocks' | 'regroup', target: number, place: number, start: number[]) =>
  ({ id: `${mode}-${step}`, step, answerKind: step === 'trade' ? 'gesture' : 'voice', actionContract: { instruction: 'ask' },
    problem: { id: 'p', mode, target, place, start } }) as unknown as BaseTenItem;

it.each([
  ['count', item('count', 'read_blocks', 347, 1, [7, 4, 3]), 4,
    ['said_value', 'said_total', 'other_block_count', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['worth', item('worth', 'read_blocks', 347, 1, [7, 4, 3]), 40, ['said_count', 'said_total', 'other_block_count', 'one_block_off']],
  ['predict', item('predict', 'regroup', 342, 1, [2, 4, 3]), 12,
    ['said_ten', 'said_start', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
] as const)('%s: known misses in order, none of them the answer', (_, it_, answer, ids) => {
  expect(diWorkspaceAssignment(it_).expectedAnswer).toBe(String(answer));
  const misses = baseTenSpokenMisses(it_);
  expect(misses.map(m => m.id)).toEqual(ids);
  const accepted = [String(answer), spokenNumber(answer), spokenIntegerWord(answer)];
  expect(misses.flatMap(m => m.examples ?? []).filter(e => accepted.includes(e))).toEqual([]);
});

it('a trade lists none', () => {
  const trade = item('trade', 'regroup', 342, 1, [2, 4, 3]);
  expect(baseTenSpokenMisses(trade)).toEqual([]);
  expect(diWorkspaceAssignment(trade).misses).toBeUndefined();
});
