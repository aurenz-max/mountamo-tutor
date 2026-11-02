/**
 * buoyancy-harbor's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `buoyancyHarbor.boss.ts`.
 * Every mode is an experiment the learner runs in the harbor's water tank and the activity checks: one item at a time,
 * no key reaches the tutor. drop_test's guesses are said to the tutor and never graded; it ends in a tapped call and test; find_the_rule in tapped calls and a rule; build_boat
 * is a build; cargo_two_designs a build, two tests and a tapped claim; salt_water sets the water.
 */
import { TAP_ONE, defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from `dropTestMiss` in `buoyancyModel.ts`:
 * - drop_test: `judged_by_size` (the wrong call on a thing whose size fools the eye: a big floater, a small sinker),
 *   `wrong_call` (the wrong call otherwise), `other_thing` (the right call, but the test tapped as the one that tells is
 *   made of different stuff).
 * - find_the_rule, from `ruleMiss` in `ruleModel.ts`: `sorted_by_size` (a wrong call on a thing to sort whose size fools
 *   the eye), `sort_slip` (another wrong call), `wrong_rule` (every call right, but size or weight picked as what decides it).
 * - make_it_float, from `shapeMiss` in `shapeModel.ts`: `kept_a_lump` (left a ball), `flat_sinks` (pressed flat, still
 *   sinks), `sides_too_low` (floats, but low sides cannot carry the load).
 * - build_boat, from `boatMiss` in `boatModel.ts`: `sinks_empty` (a lump or flat piece of stuff that sinks with nothing
 *   in it), `no_sides` (it floats but has no sides, so it carries next to nothing), `too_small` (a boat with sides that
 *   cannot carry the goal yet).
 * - cargo_two_designs, from `cargoMiss` in `cargoModel.ts`: `changed_two` (boat B changes more than one thing, an
 *   unfair test), `wrong_change` (the one change is not what the question asks about), `kept_prediction` (the claim is the
 *   learner's guess, which the tests did not show), `misread_results` (another claim the tests did not show).
 * - salt_water, from `saltMiss` in `saltModel.ts`: `too_little_salt` (a food that should float is still on the bottom),
 *   `too_much_salt` (a food that should stay down floats).
 */
export const BUOYANCY_MISSES_BY_MODE = {
  drop_test: ['judged_by_size', 'wrong_call', 'other_thing'],
  find_the_rule: ['sorted_by_size', 'sort_slip', 'wrong_rule'],
  make_it_float: ['kept_a_lump', 'flat_sinks', 'sides_too_low'],
  build_boat: ['sinks_empty', 'no_sides', 'too_small'],
  cargo_two_designs: ['changed_two', 'wrong_change', 'kept_prediction', 'misread_results'],
  salt_water: ['too_little_salt', 'too_much_salt'],
} as const;
export type BuoyancyMiss = typeof BUOYANCY_MISSES_BY_MODE[keyof typeof BUOYANCY_MISSES_BY_MODE][number];

/** Every miss is answered by a lever (`buoyancyLevers.ts`). */
const mode = <K extends keyof typeof BUOYANCY_MISSES_BY_MODE>(k: K) => ({ misses: BUOYANCY_MISSES_BY_MODE[k] });

export const buoyancyHarborCard = defineCard<BuoyancyMiss>({
  id: 'buoyancy-harbor',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    drop_test: { ...TAP_ONE, ...mode('drop_test'),
      moves: 'says a guess aloud per test (never judged), taps it then the water, calls the mystery float or sink, is asked '
        + 'which test helped and taps it (the same stuff), and presses Check' },
    find_the_rule: { ...TAP_ONE, ...mode('find_the_rule'),
      moves: 'drops each test in after a guess, calls each untested thing on a yellow stand float or sink, picks what '
        + 'decides it (size, weight or stuff), and presses Check' },
    make_it_float: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', ...mode('make_it_float'),
      moves: 'reshapes a sinking clay ball (shape only), guesses, tests it, may add pennies, and presses "I\'m done!"' },
    build_boat: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', ...mode('build_boat'),
      moves: 'chooses the boat\'s stuff, shape and size, may test it with pennies one at a time, and presses "I\'m done!"' },
    cargo_two_designs: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', ...mode('cargo_two_designs'),
      moves: 'builds boat B (and A at hard), guesses which carries more, loads each with pennies until it sinks, taps which '
        + 'carried more, and presses Check; from medium boat B changes one thing' },
    salt_water: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', ...mode('salt_water'),
      moves: 'drops each food into fresh water after a guess, adds salt a spoon at a time or pours some out, and presses '
        + '"I\'m done!"' },
  },
  words: {
    job: 'test what floats or sinks and use the tests (the stuff decides, not the size), shape clay and build boats '
      + 'that carry pennies, and stir salt in until the right foods float',
    answer: 'the float or sink calls and the test or rule the learner picks, the boat the learner builds, or the salt in the water',
    question: 'the things on the pier, what each is made of and what the tests did, the cargo goal or two boats and their tests, or which '
      + 'foods must float or stay down',
  },
  levers: true,
});
