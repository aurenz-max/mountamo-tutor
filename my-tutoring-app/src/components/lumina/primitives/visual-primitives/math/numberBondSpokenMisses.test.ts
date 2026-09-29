import { expect, it } from 'vitest';
import { spokenNumber } from '../../../components/live-activity/runtime/spokenMissContract';
import { expandNumberBondInteractions } from './numberBondModes';
import { buildBondItems, type NumberBondItem } from './numberBondScript';
import type { BondCounters } from './numberBondSplit';
import { numberBondSpokenMisses, workspaceAssignment } from './numberBondWorkspace';

const phases = (type: string, whole: number, part1?: number) => expandNumberBondInteractions(buildBondItems(
  [{ id: type, type, whole, part1, part2: part1 === undefined ? undefined : whole - part1 }], { band: '1', maxNumber: 19 }).items);
const phase = (items: NumberBondItem[], pred: (i: NumberBondItem) => boolean) => items.find(pred)!;
const board = (left: number, right: number): BondCounters => [...Array(left).fill('left'), ...Array(right).fill('right')];
const view = (counters: BondCounters) => ({ counters, found: [], tiles: [] });

const teenSay = phase(phases('ten-and-ones', 14), i => i.splitPhase === 'say');
const splitSay = phase(phases('decompose', 5), i => i.splitPhase === 'say');
const missing = phase(phases('missing-part', 5, 2), i => i.interactionPhase === 'missing-infer');
const related = phases('related-fact', 7, 3);
const addend = phase(related, i => i.interactionPhase === 'related-say-addend');

it.each([
  ['ten and ones', teenSay, board(10, 4), '4', ['said_ten', 'said_whole', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['split and say', splitSay, board(1, 4), '4', ['said_given_part', 'said_whole', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['missing part', missing, board(0, 0), '3', ['said_given_part', 'said_whole', 'added_both', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['related addend', addend, board(3, 4), '4', ['said_given_part', 'said_whole', 'added_both', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
] as const)('%s: known misses in order, none of them the answer', (_, item, counters, key, ids) => {
  const assignment = workspaceAssignment(item, view(counters));
  expect(assignment.expectedAnswer).toBe(key);
  const misses = numberBondSpokenMisses(item, view(counters));
  expect(misses.map(m => m.id)).toEqual(ids);
  const accepted = [key, spokenNumber(Number(key))];
  expect(misses.flatMap(m => m.examples ?? []).filter(e => accepted.includes(e))).toEqual([]);
});

it('a hands phase lists none', () => {
  const build = phase(phases('ten-and-ones', 14), i => i.splitPhase === 'build');
  expect(numberBondSpokenMisses(build, view(board(10, 4)))).toEqual([]);
  expect(workspaceAssignment(build, view(board(10, 4))).misses).toBeUndefined();
});
