import { expect, it } from 'vitest';
import { spokenNumber } from '../../../components/live-activity/runtime/spokenMissContract';
import { equalityItems } from './balanceEqualityModel';
import { balanceSpokenMisses, equalityAssignment, workshopAssignment } from './balanceScaleWorkspace';
import { workshopItems, type WorkshopProblem } from './balanceWorkshopModel';

const OFF = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const problem = (mode: WorkshopProblem['mode'], target: number, known: number, parcels: number): WorkshopProblem =>
  ({ id: mode, mode, target, known, parcels, total: known + parcels * target, reverse: false });
const step = (p: WorkshopProblem, s: string) => workshopItems([p]).find(i => i.step === s)!;

it.each([
  ['one_step added', step(problem('one_step', 4, 3, 1), 'added'), 4, ['said_whole', 'said_given_part', 'added_both', ...OFF]],
  ['one_step relate', step(problem('one_step', 4, 3, 1), 'relate'), 4, ['said_whole', 'said_given_part', 'added_both', ...OFF]],
  ['one_step_hard each', step(problem('one_step_hard', 3, 0, 5), 'each'), 3, ['said_remaining', 'said_parcels', ...OFF]],
  ['two_step remaining', step(problem('two_step', 2, 3, 6), 'remaining'), 12, ['said_whole', 'said_change', 'said_one_parcel', ...OFF]],
  ['two_step infer', step(problem('two_step', 2, 3, 6), 'infer'), 2, ['said_remaining', 'said_parcels', 'said_whole', 'one_short', 'one_over', 'over_by_more']],
  ['equality_hard sum', step(problem('equality_hard', 5, 0, 1), 'sum'), 5, OFF],
] as const)('%s: known misses in order, none of them the answer', (_, item, answer, ids) => {
  expect(workshopAssignment(item).expectedAnswer).toBe(String(answer));
  const misses = balanceSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(misses.flatMap(m => m.examples ?? []).filter(e => e === spokenNumber(answer) || e === String(answer))).toEqual([]);
});

it('the equality steps list the off-by misses; hands steps and the explanation list none', () => {
  const [build, total] = equalityItems([{ id: 'e', target: 6, mode: 'equality' }]);
  expect(balanceSpokenMisses(total).map(m => m.id)).toEqual(OFF);
  expect(equalityAssignment(total).misses?.map(m => m.id)).toEqual(OFF);
  expect(balanceSpokenMisses(build)).toEqual([]);
  const two = problem('two_step', 2, 3, 6);
  expect(balanceSpokenMisses(step(two, 'share'))).toEqual([]);
  expect(workshopAssignment(step(two, 'explain')).misses).toBeUndefined();
});
