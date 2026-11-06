/**
 * circuit-workbench's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `circuitWorkbench.boss.ts`.
 * light_it is a build on a 3D workbench the activity checks: one item at a time, no key reaches the tutor.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from `lightItMiss` in `circuitModel.ts`: `open_loop` (the path from
 * the battery does not go through the bulb and back: one wire, or a gap), `both_on_one_end` (both bulb clips on one
 * battery end), `short_circuit` (a wire joins the battery's two ends), `wrong_bulb` (the other bulb lit), `lit_both`
 * (both bulbs lit). find_the_break, from `breakMiss` in `breakModel.ts`: `still_dark` (something is still broken),
 * `wrong_part_named` (it lights, but the part named is not the one that was broken). conductor_test, from `conductorMiss`
 * in `conductorModel.ts`: `judged_by_shine` (a wrong call on a thing whose shine fools the eye), `sort_slip` (another).
 * add_a_switch, from `switchMiss` in `switchModel.ts`: `no_loop` (on, the bulb still does not light), `switch_does_nothing`
 * (the switch is not in the loop), `switch_backwards` (on only while the switch is off), `switch_shorts` (on makes a short).
 * two_bulbs, from `twoBulbMiss` in `twoBulbModel.ts`: `not_both_lit`, `made_a_row` (asked side by side),
 * `made_side_by_side` (asked in a row), `short_circuit`. build_device, from `deviceMiss` in `deviceModel.ts`: `missing_part`,
 * `extra_part`, `short_circuit`, `not_working` (a needed part does not run), `switch_does_nothing`. magnet_test, from
 * `magnetMiss` in `magnetModel.ts`: `all_metal_sticks` (a non-iron metal called pulled), `sort_slip` (another). magnet_poles,
 * from `polesMiss` in `poleModel.ts`: `like_ends_pull` (the same ends called a pull), `unlike_ends_push` (different ends
 * called a push), `mystery_backwards` (the wrong pole named for a magnet whose letters rubbed off). magnet_distance,
 * from `distanceMiss` in `distanceModel.ts`: `reach_too_far` / `reach_too_near` (the farthest mark named past or short of
 * it), `farther_pulled` / `nearer_not_pulled` (a call against closer-is-stronger), `judged_by_size` (the big magnet
 * picked when the small one is stronger), `picked_weaker`. electromagnet, from `electroMiss` in `electroModel.ts`:
 * `no_coil`, `switch_off`, `not_iron_core` (wood or aluminium inside), `too_few_clips`, `too_many_clips`.
 */
export const CIRCUIT_MISSES_BY_MODE = {
  light_it: ['open_loop', 'both_on_one_end', 'short_circuit', 'wrong_bulb', 'lit_both'],
  find_the_break: ['still_dark', 'wrong_part_named'],
  conductor_test: ['judged_by_shine', 'sort_slip'],
  add_a_switch: ['no_loop', 'switch_does_nothing', 'switch_backwards', 'switch_shorts'],
  two_bulbs: ['not_both_lit', 'made_a_row', 'made_side_by_side', 'short_circuit'],
  build_device: ['missing_part', 'extra_part', 'short_circuit', 'not_working', 'switch_does_nothing'],
  magnet_test: ['all_metal_sticks', 'sort_slip'],
  magnet_poles: ['like_ends_pull', 'unlike_ends_push', 'mystery_backwards'],
  magnet_distance: ['reach_too_far', 'reach_too_near', 'farther_pulled', 'nearer_not_pulled', 'judged_by_size', 'picked_weaker'],
  electromagnet: ['switch_off', 'no_coil', 'not_iron_core', 'too_few_clips', 'too_many_clips'],
} as const;
export type CircuitMissName = typeof CIRCUIT_MISSES_BY_MODE[keyof typeof CIRCUIT_MISSES_BY_MODE][number];

/** Every miss is answered by a lever (`circuitLevers.ts`). */
export const circuitWorkbenchCard = defineCard<CircuitMissName>({
  id: 'circuit-workbench',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    light_it: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.light_it,
      moves: 'guesses, adds or removes wires clip to clip, and presses "I\'m done!"' },
    find_the_break: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.find_the_break,
      moves: 'guesses, tries one fix at a time (battery, bulb, loose clip), taps what was broken, and presses Check' },
    conductor_test: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.conductor_test,
      moves: 'tests each thing in the gap after a guess, calls the untested things, and presses Check' },
    add_a_switch: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.add_a_switch,
      moves: 'wires a switch into the loop, may flip it to test, and presses "I\'m done!"' },
    two_bulbs: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.two_bulbs,
      moves: 'wires two bulbs, may take one out to test, and presses "I\'m done!"' },
    build_device: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.build_device,
      moves: 'picks parts from the tray, wires them, and presses "I\'m done!"' },
    magnet_test: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.magnet_test,
      moves: 'holds the magnet over each thing after a guess, calls the untested things, and presses Check' },
    magnet_poles: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.magnet_poles,
      moves: 'says a guess, turns and slides the right magnet both ways, calls the untested pairs (or names the striped '
        + 'end), and presses Check' },
    magnet_distance: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.magnet_distance,
      moves: 'says a guess, tries the ball near and far, names the farthest mark (or calls another magnet, or picks the '
        + 'stronger), and presses Check' },
    electromagnet: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.electromagnet,
      moves: 'wraps wire, switches on, dips in the clips to test, may add a battery or swap the core, and presses "I\'m done!"' },
  },
  words: {
    job: 'wire a loop that lights, build a device, find a broken part, test what conducts, what a magnet pulls, which ends '
      + 'push or pull, how far it pulls, or build an electromagnet',
    answer: 'the wires the learner clips on, the part named as broken, the calls on untested things, or the pole, mark or magnet named',
    question: 'the parts on the table, the wires on, what is lit, the tests so far, and what each thing is made of',
  },
  levers: true,
});
