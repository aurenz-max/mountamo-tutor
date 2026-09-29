import { expect, it } from 'vitest';
import { causeEffectSpokenMisses, chainMiss } from './causeEffectChainWorkspace';
import type { CauseEffectChainItem } from './causeEffectChainScript';
import type { BuildChainItem } from './causeEffectChainScript';

const chain = { id: 'c', kind: 'build_chain', correctOrder: ['a', 'b', 'c', 'd'] } as BuildChainItem;
it.each([
  [['a', 'b', 'c', 'd'], undefined], [['d', 'c', 'b', 'a'], 'reversed'], [['b', 'a', 'c', 'd'], 'two_swapped'],
  [['a', 'd', 'c', 'b'], 'two_swapped'], [['b', 'c', 'a', 'd'], 'other_order'], [['a', 'b', null, 'd'], 'other_order'],
] as const)('%j', (placed, miss) => {
  expect(chainMiss(chain, placed)).toBe(miss);
});

// identify_cause's known wrong verdict, by the event's role (handoff 20 Part B); never the right verdict.
const verdict = (isCause: boolean, role: string) => ({ id: 'v', kind: 'identify_cause', isCause, role,
  card: { id: 'e', text: 'The train came.' }, outcome: { id: 'o', text: 'Letters arrive in a day.' } }) as unknown as CauseEffectChainItem;
it.each([
  [verdict(true, 'cause'), ['cause_denied'], ['yes', 'it did', 'it helped']],
  [verdict(false, 'consequence'), ['consequence_as_cause'], ['no', 'it did not']],
  [verdict(false, 'background'), ['background_as_cause'], ['no', 'it did not']],
  [chain as unknown as CauseEffectChainItem, [], []],
] as const)('spoken %#', (item, ids, accepted) => {
  const misses = causeEffectSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});
