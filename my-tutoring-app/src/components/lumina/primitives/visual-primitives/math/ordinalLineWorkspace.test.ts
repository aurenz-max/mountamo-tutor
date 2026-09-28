import { expect, it } from 'vitest';
import { itemsFromChallenges } from './ordinalLineScript';
import { lineMiss } from './ordinalLineWorkspace';

const characters = ['Rabbit', 'Bear', 'Turtle', 'Fox', 'Owl'].map(name => ({ name, emoji: '' }));
const [build] = itemsFromChallenges([{ id: 'c1', type: 'build-sequence', characters,
  clues: [{ character: 'Owl', position: 1 }, { character: 'Turtle', position: 2 }, { character: 'Fox', position: 3 }] }],
{ band: 'K', context: 'race' }).items;

it.each([
  [['Fox', 'Turtle', 'Owl'], 'reversed'], [['Turtle', 'Owl', 'Fox'], 'two_swapped'], [['Turtle', 'Fox', 'Owl'], 'other_order'],
  [['Owl', '', 'Fox'], 'place_left_empty'], [['Owl', 'Turtle'], 'place_left_empty'], [['Owl', 'Turtle', 'Fox'], undefined],
])('placed %j -> %s', (placed, miss) => {
  expect(build.answerOrder).toEqual(['Owl', 'Turtle', 'Fox']);
  expect(lineMiss(build, placed)).toBe(miss);
});
