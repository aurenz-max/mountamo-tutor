import { expect, it } from 'vitest';
import { cvcMiss } from './cvcSpellerWorkspace';
import type { CvcSpellerChallenge } from './CvcSpeller';

const cat = { id: 'c', taskType: 'spell-word', targetWord: 'cat', targetLetters: ['c', 'a', 't'] } as unknown as CvcSpellerChallenge;
it.each([
  [['c', 'a', 't'], undefined], [['C', 'A', 'T'], undefined], [['k', 'a', 't'], 'first_letter'], [['c', 'o', 't'], 'middle_letter'],
  [['c', 'a', 'p'], 'last_letter'], [['t', 'a', 'c'], 'letters_out_of_order'], [['a', 'c', 't'], 'letters_out_of_order'],
  [['c', 'u', 'p'], 'two_or_more_letters'], [['c', 'a', null], 'last_letter'],
] as const)('%j', (placed, miss) => {
  expect(cvcMiss(cat, placed)).toBe(miss);
});
