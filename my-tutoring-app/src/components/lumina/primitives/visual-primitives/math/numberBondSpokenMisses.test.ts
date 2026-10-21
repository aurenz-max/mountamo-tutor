import { expect, it } from 'vitest';
import { spokenNumber } from '../../../components/live-activity/runtime/spokenMissContract';
import { expandNumberBondInteractions } from './numberBondModes';
import { buildBondItems, type NumberBondItem } from './numberBondDomain';
import { numberBondSpokenMisses } from './numberBondWorkspace';
import { numberBondBoss } from './numberBond.boss';

const phases = (type: string, whole: number, part1?: number) => expandNumberBondInteractions(buildBondItems(
  [{ id: type, type, whole, part1, part2: part1 === undefined ? undefined : whole - part1 }], { band: '1', maxNumber: 19 }).items);
const phase = (items: NumberBondItem[], pred: (i: NumberBondItem) => boolean) => items.find(pred)!;
/** A say step as the component stamps it: the split on the board when the step opened. */
const asked = (item: NumberBondItem, left: number, right: number): NumberBondItem =>
  (item.splitPhase === 'say' ? { ...item, askedSplit: { left, right } } : item);

const teenSay = phase(phases('ten-and-ones', 14), i => i.splitPhase === 'say');
const splitSay = phase(phases('decompose', 5), i => i.splitPhase === 'say');
const missing = phase(phases('missing-part', 5, 2), i => i.interactionPhase === 'missing-infer');
const related = phases('related-fact', 7, 3);
const addend = phase(related, i => i.interactionPhase === 'related-say-addend');

it.each([
  ['ten and ones', asked(teenSay, 10, 4), '4', ['said_ten', 'said_whole', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['split and say', asked(splitSay, 1, 4), '4', ['said_given_part', 'said_whole', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['missing part', missing, '3', ['said_given_part', 'said_whole', 'added_both', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  ['related addend', addend, '4', ['said_given_part', 'said_whole', 'added_both', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
] as const)('%s: known misses in order, none of them the answer', (_, item, key, ids) => {
  const assignment = numberBondBoss.assignment(item);
  expect(assignment).toMatchObject({ response: 'speech' });
  expect(assignment.expectedAnswer!.startsWith(`"${spokenNumber(Number(key))}"`)).toBe(true);
  const misses = numberBondSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const accepted = [key, spokenNumber(Number(key))];
  expect(misses.flatMap(m => m.examples ?? []).filter(e => accepted.includes(e))).toEqual([]);
});

it('a hands phase lists none', () => {
  const build = phase(phases('ten-and-ones', 14), i => i.splitPhase === 'build');
  expect(numberBondSpokenMisses(build)).toEqual([]);
  expect(numberBondBoss.assignment(build)).toMatchObject({ response: 'gesture' });
  expect(numberBondBoss.assignment(build).misses).toBeUndefined();
});
