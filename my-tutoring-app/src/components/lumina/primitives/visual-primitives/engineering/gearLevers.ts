/**
 * The in-item levers on gear-train-builder's open builds (/add-eval-modes references/build-mode.md), designed from
 * why learners fail a gear train, declared once as a lever set (`GEAR_LEVERS`, `bossLevers.ts`). Working out how the
 * last gear turns IS the task, so every item starts bare and the levers come on a miss, never from the tier.
 * - `direction_arrows` (marks): an arrow on every gear showing which way it turns when the crank turns. Children who
 *   expect every gear to turn the crank's way cannot see that each mesh reverses it.
 * - `try_spin` (custom): a "Turn the crank" button that turns the train without checking it, with a count of how many
 *   times the first and the last gear go round. Children who think the bigger gear is the faster one (or that the
 *   gears in the middle change the speed) can watch and count.
 * - `simpler_train` (easier): the same kind of train with one demand fewer (no way asked, a 2-times ratio, or two
 *   fewer gears), ungraded, then the full item.
 * `too_few_gears` has no lever: the ask on screen states the number of gears (the card lists it as unanswered).
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { GEAR_MISSES } from './gearTrainBuilder.card';
import { gearAsk, type GearChallenge, type GearMiss, type GearMode } from './gearWorkspace';

export const ARROWS_LEVER = 'direction_arrows';
export const SPIN_LEVER = 'try_spin';
export const SIMPLER_LEVER = 'simpler_train';

const SIMPLER = '~simpler';
export const isPracticeTrain = (c: Pick<GearChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => (id.endsWith(SIMPLER) ? id.slice(0, -SIMPLER.length) : null);

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

type Spec = LeverSpec<GearChallenge, null>;

/** The speed misses of a mode: none on build_direction. */
const SPEED: Record<GearMode, readonly GearMiss[]> = {
  build_direction: [], build_speed: ['not_faster', 'not_slower'], build_ratio: ['too_fast', 'too_slow'],
};
const MODES = Object.keys(GEAR_MISSES) as GearMode[];

const spin = (mode: GearMode): Spec => ({
  id: SPIN_LEVER, type: 'custom', carrier: 'shown', modes: [mode], answers: [...SPEED[mode], 'wrong_direction'],
  why: 'It adds a trial the learner runs on their own train (the crank turned, ungraded, with a count of turns): a tool, '
    + 'not a mark, a layout or a different item.',
  when: mode === 'build_direction' ? 'The learner needs to watch the train turn before handing it in.'
    : 'The learner is unsure how fast the last gear turns compared with the first.',
  does: 'Adds a "Turn the crank" button that turns the learner\'s train without checking it, and counts how many times the '
    + 'first and the last gear go round. It changes no gear.',
  fact: 'A "Turn the crank" button turns the train without checking it and counts the first and last gear\'s turns.',
});

// On build_direction the easier train only drops gears; elsewhere it drops the way (when one is asked) or eases the ratio.
const simpler = (mode: GearMode): Spec => ({
  id: SIMPLER_LEVER, type: 'easier', modes: [mode],
  answers: mode === 'build_direction' ? ['wrong_direction'] : [...SPEED[mode], 'wrong_direction'],
  ...(mode === 'build_direction' ? {} : { answersOn: (c: GearChallenge) => [...SPEED[mode], ...(c.way ? ['wrong_direction'] : [])] }),
  when: 'The learner cannot build this train yet.',
  does: 'Opens an easier ask first, the same kind of gear train with one demand fewer, on an empty track. It is not graded; '
    + 'the full item comes back after it.',
  content: c => simplerTrain(c),
});

/**
 * Every lever, in the order the observer offers them: the help levers before simpler_train. A practice train offers
 * none (the component declares nothing while one is on screen).
 */
export const GEAR_LEVERS = leverSet<GearChallenge, null>({
  modeOf: c => c.type,
  missesOf: mode => GEAR_MISSES[mode as GearMode] ?? [],
  specs: [
    { id: ARROWS_LEVER, type: 'marks', answers: ['wrong_direction'],
      when: 'The learner\'s last gear turns the wrong way and they cannot see why.',
      does: 'Puts an arrow on every gear in the learner\'s train showing which way it turns when the crank turns. It adds, '
        + 'removes or moves no gear.',
      fact: 'Every gear in the train shows an arrow for the way it turns.' },
    ...MODES.map(spin),
    ...MODES.map(simpler),
  ],
});
