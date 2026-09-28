import { expect, it } from 'vitest';
import { wordProblemMiss, type FamilyPlacements } from './diWordProblemWorkspace';

type Item = Parameters<typeof wordProblemMiss>[0];
// Big printed, the box a small amount; and big as the box.
const boxSmall = { kind: 'big_number', plan: { big: { id: 'big' }, unknown: { id: 's2' } } } as unknown as Item;
const boxBig = { kind: 'big_number', plan: { big: { id: 'big' }, unknown: { id: 'big' } } } as unknown as Item;
const board = (big: string | null): FamilyPlacements => ({ small1: null, small2: null, big });

it.each([
  [boxSmall, board('big'), undefined], [boxSmall, board('s2'), 'box_in_big'], [boxSmall, board('s1'), 'printed_small_in_big'],
  [boxBig, board('s1'), 'printed_small_in_big'], [boxSmall, board(null), undefined],
  [{ kind: 'family', plan: { big: { id: 'big' }, unknown: { id: 's2' } } } as unknown as Item, board('s2'), undefined],
] as const)('row %#', (item, placed, miss) => {
  expect(wordProblemMiss(item, placed)).toBe(miss);
});
