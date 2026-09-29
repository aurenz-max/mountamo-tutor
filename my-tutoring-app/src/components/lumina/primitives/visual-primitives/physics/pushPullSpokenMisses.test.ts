import { expect, it } from 'vitest';
import { pushPullSpokenMisses } from './pushPullArenaWorkspace';
import type { ArenaItem } from './pushPullArenaScript';

// push-pull-arena's known wrong answers (handoff 20 Part B): the other word of the pair; no example is accepted.
const arena = (kind: ArenaItem['kind'], spokenAnswer: string, alternates: string[], extra: Partial<ArenaItem> = {}) =>
  ({ id: 'a', kind, spokenAnswer, alternates, objectName: 'Rock', surfaceSpoken: 'the grass', ...extra }) as ArenaItem;

it.each([
  [arena('observe', 'push', ['a push', 'pushing']), ['opposite_force', 'described_motion']],
  [arena('predict', 'stays', ['stay', 'stay still', 'it stays', 'no']), ['opposite_outcome']],
  [arena('compare', 'ball', ['the ball'], { objectName: 'Ball', object2Name: 'Box' }), ['other_object']],
  [arena('design', 'big', ['a big push']), ['opposite_size']],
] as const)('row %#', (item, ids) => {
  const misses = pushPullSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = [item.spokenAnswer, ...item.alternates].map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});
