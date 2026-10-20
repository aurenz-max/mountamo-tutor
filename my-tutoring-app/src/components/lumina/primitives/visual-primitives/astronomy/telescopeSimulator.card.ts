/**
 * telescope-simulator's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `telescopeSimulator.boss.ts`.
 * Find by look and brightest are one tap on an unnamed object in the view and Check Answer, judged by the activity
 * against the key code computes from the item (TAP_ONE). Object type and pick the instrument are closed choices with a
 * code-held key: the learner says it (the tutor judges the words against the key) or taps it and presses Check Answer
 * (the activity judges the tap), so they are SAY_OR_SHOW.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

export type FindMiss = 'near_match' | 'shares_clue' | 'other_object';
export type BrightMiss = 'picked_biggest' | 'picked_dimmer';
export type TypeMiss = 'sharp_mixup' | 'fuzzy_mixup' | 'other_family';
export type InstrumentMiss = 'too_weak' | 'too_strong';
export type TelescopeMiss = FindMiss | BrightMiss | TypeMiss | InstrumentMiss;

/**
 * What a wrong answer shows (`telescopeMiss`), by mode; the same ids name each spoken item's known misses.
 * - find_by_look: `near_match` (shows every clue but one), `shares_clue` (some clues), `other_object` (none);
 * - brightest: `picked_biggest` (drawn bigger than the brightest), `picked_dimmer`;
 * - object_type: `sharp_mixup` / `fuzzy_mixup` (a look-alike kind of the same family), `other_family`;
 * - pick_instrument: `too_weak` (cannot show the detail), `too_strong` (shows it, not the least powerful).
 */
export const TELESCOPE_MISSES = {
  find_by_look: ['near_match', 'shares_clue', 'other_object'],
  brightest: ['picked_biggest', 'picked_dimmer'],
  object_type: ['sharp_mixup', 'fuzzy_mixup', 'other_family'],
  pick_instrument: ['too_weak', 'too_strong'],
} as const satisfies Record<string, readonly TelescopeMiss[]>;

const TAP_OBJECT = 'taps one object in the telescope view, then presses Check Answer';
const OR_TAP = 'may instead tap a choice, then press Check Answer';

export const telescopeSimulatorCard = defineCard<TelescopeMiss>({
  id: 'telescope-simulator',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    find_by_look: { ...TAP_ONE, moves: TAP_OBJECT, misses: TELESCOPE_MISSES.find_by_look },
    brightest: { ...TAP_ONE, moves: TAP_OBJECT, misses: TELESCOPE_MISSES.brightest },
    object_type: { ...SAY_OR_SHOW, moves: OR_TAP, misses: TELESCOPE_MISSES.object_type },
    pick_instrument: { ...SAY_OR_SHOW, moves: OR_TAP, misses: TELESCOPE_MISSES.pick_instrument },
  },
  words: {
    job: 'look at unnamed sky objects through a telescope: find one from its look, find the brightest, name what kind '
      + 'one is, or pick the least powerful instrument that shows a detail',
    answer: 'the object or choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
