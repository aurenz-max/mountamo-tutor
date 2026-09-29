import { expect, it } from 'vitest';
import { itemFromChallenge } from './tenFrameScript';
import { tenFrameSpokenMisses, workspaceAssignment } from './tenFrameWorkspace';

const item = (ch: Record<string, unknown>, band: 'K' | 'G1' = 'G1') =>
  itemFromChallenge({ id: 'i', ...ch } as never, { capacity: 10, band: band as never })!;

// The spoken items' known wrong answers (handoff 20 Part B): the frame's own numbers first, then the off-by misses.
it.each([
  [item({ type: 'subitize', targetCount: 4 }), ['empty_count', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  // Five shown leaves five empty: the empty count is the key, so it is not a miss.
  [item({ type: 'subitize', targetCount: 5 }), ['one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [item({ type: 'make_ten', targetCount: 6 }), ['said_shown', 'said_capacity', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [item({ type: 'add', addend1: 3, addend2: 4 }), ['said_addend', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [item({ type: 'subtract', startCount: 8, targetCount: 5 }), ['said_start', 'said_change', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [item({ type: 'build', targetCount: 4 }), []],
] as const)('%#: spoken misses', (it_, ids) => {
  const misses = tenFrameSpokenMisses(it_);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(workspaceAssignment(it_).misses?.map(m => m.id) ?? []).toEqual(ids);
});
