/**
 * The in-item levers on gear-train-builder's open builds (/add-eval-modes references/build-mode.md), designed from
 * why learners fail a gear train. Working out how the last gear turns IS the task, so every item starts bare and the
 * levers come on a miss, never from the tier.
 * - `direction_arrows` (help): an arrow on every gear showing which way it turns when the crank turns. Children who
 *   expect every gear to turn the crank's way cannot see that each mesh reverses it.
 * - `try_spin` (help): a "Turn the crank" button that turns the train without checking it, with a count of how many
 *   times the first and the last gear go round. Children who think the bigger gear is the faster one (or that the
 *   gears in the middle change the speed) can watch and count.
 * - `simpler_train` (simplify): the same kind of train with one demand fewer (no way asked, a 2-times ratio, or two
 *   fewer gears), ungraded, then the full item.
 * `too_few_gears` has no lever: the ask on screen states the number of gears.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { gearAsk, type GearChallenge, type GearMiss } from './gearWorkspace';

export const ARROWS_LEVER = 'direction_arrows';
export const SPIN_LEVER = 'try_spin';
export const SIMPLER_LEVER = 'simpler_train';

const SIMPLER = '~simpler';
export const isPracticeTrain = (c: Pick<GearChallenge, 'id'>) => c.id.endsWith(SIMPLER);

/** The easier ask, or null when the item is already as simple as its mode gets. */
export function simplerTrain(c: GearChallenge): GearChallenge | null {
  if (isPracticeTrain(c)) return null;
  let t: Omit<GearChallenge, 'id' | 'instruction'> | null = null;
  if (c.type === 'build_direction') {
    const min = c.minGears - 2;
    if (min >= (c.way === 'same' ? 3 : 2)) t = { ...c, minGears: min };
  } else if (c.way) {
    t = { ...c, way: undefined, minGears: 2 };
  } else if (c.type === 'build_ratio' && c.ratio !== 2 && c.ratio !== 1 / 2) {
    t = { ...c, ratio: (c.ratio ?? 2) >= 1 ? 2 : 1 / 2, minGears: 2 };
  }
  if (!t) return null;
  const { way, ...rest } = t;
  const target = way ? { ...rest, way } : rest;
  return { ...target, id: `${c.id}${SIMPLER}`, instruction: gearAsk(target) };
}

export function gearLevers(c: GearChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly GearMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const speedMisses: GearMiss[] = c.type === 'build_speed' ? ['not_faster', 'not_slower'] : c.type === 'build_ratio' ? ['too_fast', 'too_slow'] : [];
  const simpler = simplerTrain(c);
  return [
    lever(ARROWS_LEVER, 'help', ['wrong_direction'],
      'The learner\'s last gear turns the wrong way and they cannot see why.',
      'Puts an arrow on every gear in the learner\'s train showing which way it turns when the crank turns. It adds, removes or moves no gear.'),
    lever(SPIN_LEVER, 'help', [...speedMisses, 'wrong_direction'],
      c.type === 'build_direction' ? 'The learner needs to watch the train turn before handing it in.'
        : 'The learner is unsure how fast the last gear turns compared with the first.',
      'Adds a "Turn the crank" button that turns the learner\'s train without checking it, and counts how many times the first and '
        + 'the last gear go round. It changes no gear.'),
    ...(simpler ? [lever(SIMPLER_LEVER, 'simplify', c.type === 'build_direction' ? ['wrong_direction'] : [...speedMisses, ...(c.way ? ['wrong_direction' as const] : [])],
      'The learner cannot build this train yet.',
      'Opens an easier ask first, the same kind of gear train with one demand fewer, on an empty track. It is not graded; the full '
        + 'item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. */
export function leverFacts(c: GearChallenge | null, pulled: readonly string[]): string {
  if (!c) return '';
  return [
    pulled.includes(ARROWS_LEVER) && 'Every gear in the train shows an arrow for the way it turns.',
    pulled.includes(SPIN_LEVER) && 'A "Turn the crank" button turns the train without checking it and counts the first and last gear\'s turns.',
  ].filter((s): s is string => !!s).join(' ');
}
