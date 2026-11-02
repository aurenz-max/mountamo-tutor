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
 * `magnetMiss` in `magnetModel.ts`: `all_metal_sticks` (a non-iron metal called pulled), `sort_slip` (another).
 */
export const CIRCUIT_MISSES_BY_MODE = {
  light_it: ['open_loop', 'both_on_one_end', 'short_circuit', 'wrong_bulb', 'lit_both'],
  find_the_break: ['still_dark', 'wrong_part_named'],
  conductor_test: ['judged_by_shine', 'sort_slip'],
  add_a_switch: ['no_loop', 'switch_does_nothing', 'switch_backwards', 'switch_shorts'],
  two_bulbs: ['not_both_lit', 'made_a_row', 'made_side_by_side', 'short_circuit'],
  build_device: ['missing_part', 'extra_part', 'short_circuit', 'not_working', 'switch_does_nothing'],
  magnet_test: ['all_metal_sticks', 'sort_slip'],
} as const;
export type CircuitMissName = typeof CIRCUIT_MISSES_BY_MODE[keyof typeof CIRCUIT_MISSES_BY_MODE][number];

/** Every miss is answered by a lever (`circuitLevers.ts`). */
export const circuitWorkbenchCard = defineCard<CircuitMissName>({
  id: 'circuit-workbench',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    light_it: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.light_it,
      moves: 'guesses if it lights as it is, then taps one clip and another to add a wire (or removes one), watches what '
        + 'lights, and presses "I\'m done!"' },
    find_the_break: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.find_the_break,
      moves: 'guesses which part is broken, tries a new battery, a new bulb or clipping a loose wire back on, one at a time, '
        + 'taps what was broken, and presses Check' },
    conductor_test: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.conductor_test,
      moves: 'puts each test thing in the gap after a guess, then, untested, calls whether each other thing would light the '
        + 'bulb, and presses Check; a right check tests them' },
    add_a_switch: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.add_a_switch,
      moves: 'wires as in light_it with a switch on the table, may flip the switch to test, and presses "I\'m done!"' },
    two_bulbs: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.two_bulbs,
      moves: 'wires two bulbs as in light_it, may take a bulb out to test, and presses "I\'m done!"' },
    build_device: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.build_device,
      moves: 'chooses parts from the tray, wires them as in light_it, flips any switch to test, and presses "I\'m done!"' },
    magnet_test: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time', misses: CIRCUIT_MISSES_BY_MODE.magnet_test,
      moves: 'holds the magnet over each test thing after a guess, then, untested, calls whether the magnet pulls each other '
        + 'thing, and presses Check' },
  },
  words: {
    job: 'wire a battery and a bulb into a closed loop on a workbench so the bulb lights (with two bulbs, only the named one, or with a switch that turns it on and off), build a device that works, test what a magnet pulls, '
      + 'find and fix the broken part of a dark circuit, or test which things let electricity through',
    answer: 'the wires the learner clips on, the part named as broken, or the calls on untested things',
    question: 'the parts on the table, the wires on, what is lit, the fixes or tests so far, and what each thing is made of',
  },
  levers: true,
});
