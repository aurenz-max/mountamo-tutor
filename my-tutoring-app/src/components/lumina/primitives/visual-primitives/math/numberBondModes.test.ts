import { expect, it } from 'vitest';
import { bondMiss, expandNumberBondInteractions, type BondWork } from './numberBondModes';
import { buildBondItems, type NumberBondItem } from './numberBondScript';

const phases = (type: string, whole: number, part1?: number) => expandNumberBondInteractions(buildBondItems(
  [{ id: type, type, whole, part1, part2: part1 === undefined ? undefined : whole - part1 }], { band: '1', maxNumber: 19 }).items);
const phase = (items: NumberBondItem[], pred: (i: NumberBondItem) => boolean) => items.find(pred)!;
const teen = phase(phases('ten-and-ones', 14), i => i.splitPhase === 'build');
const split5 = phase(phases('decompose', 5), i => i.splitPhase === 'build');
const equation = phases('build-equation', 5, 2);
const [eqModel, eqBuild] = [phase(equation, i => i.interactionPhase === 'equation-model'), phase(equation, i => i.interactionPhase === 'equation-build')];
const familyBuild = phase(phases('fact-family', 5, 2), i => i.interactionPhase === 'family-build' && i.familyForm === 'add-left');

const split = (left: number, right: number, unplaced = 0, found: [number, number][] = []): BondWork =>
  ({ split: { left, right, unplaced }, found });
const tiles = (eq: string): BondWork => ({ tiles: eq.split(''), action: 'join' });

it.each([
  [teen, split(10, 4), undefined], [teen, split(4, 10), undefined], [teen, split(9, 5), 'ten_one_off'],
  [teen, split(11, 3), 'ten_one_off'], [teen, split(7, 7), 'no_full_ten'], [teen, split(8, 4, 2), 'not_all_placed'],
  [split5, split(2, 3), undefined], [split5, split(3, 2, 0, [[2, 3]]), 'same_way_again'], [split5, split(1, 3, 1), 'not_all_placed'],
  [eqModel, { move: 'swap', matched: false }, 'other_move'], [eqModel, { move: 'join', matched: true }, undefined],
  [eqBuild, tiles('2+3=5'), undefined], [eqBuild, tiles('3+2=5'), undefined], [eqBuild, tiles('5-2=3'), 'other_fact'],
  [eqBuild, tiles('2+3=6'), 'false_equation'], [eqBuild, tiles('1+4=5'), 'other_numbers'], [eqBuild, tiles('2+3'), 'unfinished_equation'],
  [familyBuild, tiles('2+3=5'), undefined], [familyBuild, tiles('3+2=5'), 'other_fact'],
] as const)('row %#', (item, work, miss) => {
  expect(bondMiss(item, work as BondWork)).toBe(miss);
});

it('a spoken phase names no miss', () => {
  const say = phase(phases('ten-and-ones', 14), i => i.splitPhase === 'say');
  expect(bondMiss(say, split(9, 5))).toBeUndefined();
});
