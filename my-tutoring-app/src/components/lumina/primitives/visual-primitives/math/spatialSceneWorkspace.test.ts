import { expect, it } from 'vitest';
import { spatialAssignment, spatialMiss, spatialSpokenMisses } from './spatialSceneWorkspace';
import type { SpatialSceneChallenge } from './SpatialScene';

const obj = (name: string, row: number, col: number) => ({ name, image: '', position: { row, col } });
const ch = (type: SpatialSceneChallenge['type'], extra: Partial<SpatialSceneChallenge>): SpatialSceneChallenge =>
  ({ id: type, type, instruction: '', sceneObjects: [], targetObject: obj('cat', 0, 0), correctPosition: 'above', ...extra }) as SpatialSceneChallenge;

// The cat two rows above the box; the cat beside the box; the cat two cells right of the box.
const above = ch('identify', { sceneObjects: [obj('cat', 0, 1), obj('box', 2, 1)], targetObject: obj('cat', 0, 1), referenceObjectName: 'box' });
const beside = ch('describe', { sceneObjects: [obj('cat', 1, 2), obj('box', 1, 1)], targetObject: obj('cat', 1, 2),
  referenceObjectName: 'box', correctPosition: 'beside' });
const farRight = ch('identify', { sceneObjects: [obj('cat', 1, 2), obj('box', 1, 0)], targetObject: obj('cat', 1, 2),
  referenceObjectName: 'box', correctPosition: 'right_of' });
const into = ch('place_in', { sceneObjects: [obj('box', 1, 1), obj('tree', 0, 0)], referenceObjectName: 'box', correctCell: { row: 1, col: 1 } });
const between = ch('place_between', { sceneObjects: [obj('box', 0, 0), obj('tree', 0, 2)], referenceObjectName: 'box',
  referenceObjectName2: 'tree', correctCell: { row: 0, col: 1 } });
const directions = ch('follow_directions', { steps: [
  { instruction: '', targetObject: obj('ball', 0, 0), correctCell: { row: 0, col: 0 } },
  { instruction: '', targetObject: obj('dog', 2, 2), correctCell: { row: 2, col: 2 } }] });
const cell = (row: number, col: number) => ({ row, col });

it.each([
  [above, { option: 'above' }, undefined], [above, { option: 'under' }, 'opposite_word'], [above, { option: 'below' }, 'opposite_word'],
  [above, { option: 'on' }, 'same_axis_word'], [above, { option: 'left_of' }, 'other_axis_word'],
  [beside, { option: 'left_of' }, 'opposite_word'], [beside, { option: 'above' }, 'other_axis_word'],
  [farRight, { option: 'beside' }, 'same_axis_word'], [farRight, { option: 'left_of' }, 'opposite_word'],
  [into, { cell: cell(1, 1) }, undefined], [into, { cell: cell(0, 0) }, 'other_object'],
  [into, { cell: cell(1, 2) }, 'next_to_container'], [into, { cell: cell(2, 2) }, 'away_from_container'],
  [between, { cell: cell(0, 1) }, undefined], [between, { cell: cell(1, 0) }, 'next_to_one'], [between, { cell: cell(1, 1) }, 'touches_neither'],
  [directions, { cell: cell(0, 0), step: 0 }, undefined], [directions, { cell: cell(2, 2), step: 0 }, 'later_step_cell'],
  [directions, { cell: cell(1, 1), step: 0 }, 'other_cell'], [directions, { cell: cell(1, 1), step: 1 }, 'other_cell'],
  [ch('place', { correctCell: cell(0, 1) }), { cell: cell(2, 2) }, undefined],
] as const)('row %#', (c, view, miss) => {
  expect(spatialMiss(c, view)).toBe(miss);
});

const scene = (correctPosition: SpatialSceneChallenge['correctPosition']) => ch('describe_scene',
  { sceneObjects: [obj('cat', 1, 0), obj('tree', 1, 2)], targetObject: obj('cat', 1, 0), referenceObjectName: 'tree', correctPosition });
it.each([
  [scene('left_of'), ['The cat is right of the tree.']], [scene('in_front_of'), ['The cat is behind the tree.']],
  [scene('next_to'), []], [above, []],
] as const)('spoken %#: only the reversed relation', (c, examples) => {
  const misses = spatialSpokenMisses(c);
  expect(misses.flatMap(m => m.examples ?? [])).toEqual(examples);
  expect(misses.every(m => m.id === 'opposite_word')).toBe(true);
  expect(spatialAssignment(c).misses).toEqual(misses.length ? misses : undefined);
});
