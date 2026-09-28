import { expect, it } from 'vitest';
import { chainMiss } from './causeEffectChainWorkspace';
import type { BuildChainItem } from './causeEffectChainScript';

const chain = { id: 'c', kind: 'build_chain', correctOrder: ['a', 'b', 'c', 'd'] } as BuildChainItem;
it.each([
  [['a', 'b', 'c', 'd'], undefined], [['d', 'c', 'b', 'a'], 'reversed'], [['b', 'a', 'c', 'd'], 'two_swapped'],
  [['a', 'd', 'c', 'b'], 'two_swapped'], [['b', 'c', 'a', 'd'], 'other_order'], [['a', 'b', null, 'd'], 'other_order'],
] as const)('%j', (placed, miss) => {
  expect(chainMiss(chain, placed)).toBe(miss);
});
