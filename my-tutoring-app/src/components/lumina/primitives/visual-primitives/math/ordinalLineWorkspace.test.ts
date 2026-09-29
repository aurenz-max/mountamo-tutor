import { expect, it } from 'vitest';
import { itemsFromChallenges, type OrdinalLineItem } from './ordinalLineScript';
import { lineMiss, ordinalSpokenMisses, workspaceAssignment } from './ordinalLineWorkspace';

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

const spoken = (kind: OrdinalLineItem['kind'], askPosition: number, extra: Partial<OrdinalLineItem>) =>
  ({ id: kind, kind, answerKind: 'voice', context: 'race', direction: 'name_position', relativeQuery: 'before', askPosition,
    lineNames: ['Rabbit', 'Bear', 'Turtle', 'Fox', 'Owl'], clues: [], symbol: '', storyText: '', storyName: '', ...extra }) as OrdinalLineItem;

it.each([
  [spoken('identify', 2, { direction: 'name_character', answerText: 'Bear' }), ['wrong_end', 'next_to_place']],
  [spoken('identify', 2, { answerText: 'second' }), ['cardinal_for_ordinal', 'wrong_end', 'next_to_place']],
  [spoken('identify', 3, { answerText: 'third' }), ['cardinal_for_ordinal', 'next_to_place']],
  [spoken('match', 1, { symbol: '1st', answerText: 'first' }), ['cardinal_for_ordinal', 'next_to_place']],
  [spoken('relative_position', 3, { answerText: 'Bear' }), ['said_anchor', 'wrong_side']],
  [spoken('relative_position', 5, { answerText: 'Fox' }), ['said_anchor']],
] as const)('spoken %#: known misses in order, none of them the answer', (item, ids) => {
  expect(workspaceAssignment(item).expectedAnswer).toBe(item.answerText);
  const misses = ordinalSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(misses.flatMap(m => m.examples ?? []).filter(e => e === item.answerText)).toEqual([]);
});
