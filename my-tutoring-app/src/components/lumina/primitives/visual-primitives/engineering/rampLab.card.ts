/**
 * ramp-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `rampLab.boss.ts`.
 * The lab checks four modes itself: a compare pick, a push or an angle set on the controls, and a fair-test plan built
 * in setup B's settings. explain_from_trials is spoken: after a prediction and both trials the learner says what
 * changing the condition did to the push, and the tutor judges the meaning against the comparison the trials support.
 */
import type { RampChallengeMode } from './rampChallenges';
import { defineCard, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a checked wrong answer shows (`rampMiss`), from the learner's work alone:
 *   - compare_conditions: `harder_setup` (picked the setup that needs more push), `same_for_different` (picked "same"
 *     when the pushes differ), `one_for_same` (picked one setup when both need the same push);
 *   - find_threshold: `load_did_not_move` (the push is below the threshold), `more_than_minimum` (it moves the load, but
 *     a smaller step would too);
 *   - design_with_budget: `over_budget` (too steep for the force budget), `not_steepest` (it works, but a steeper ramp
 *     would too);
 *   - plan_fair_test: `nothing_changed` (setup B equals A), `other_condition` (the requested condition is unchanged,
 *     another one changed), `extra_condition` (the requested condition and another one changed).
 */
export type RampMiss = 'harder_setup' | 'same_for_different' | 'one_for_same' | 'load_did_not_move' | 'more_than_minimum'
  | 'over_budget' | 'not_steepest' | 'nothing_changed' | 'other_condition' | 'extra_condition';

/**
 * What a not-credited spoken explanation shows (`rampSpokenMisses`): `reversed_comparison` (says the setup that needed
 * more push needed less), `said_same` (says both needed the same push when the trials differ), `one_setup` (talks about
 * one trial only). Slogans, echoes and off-task talk are not a pattern of the comparison.
 */
export type RampSpokenMiss = 'reversed_comparison' | 'said_same' | 'one_setup';

export type RampLabMiss = RampMiss | RampSpokenMiss;

export const RAMP_MISSES_BY_MODE: Record<RampChallengeMode, readonly RampLabMiss[]> = {
  compare_conditions: ['harder_setup', 'same_for_different', 'one_for_same'],
  find_threshold: ['load_did_not_move', 'more_than_minimum'],
  design_with_budget: ['over_budget', 'not_steepest'],
  plan_fair_test: ['nothing_changed', 'other_condition', 'extra_condition'],
  explain_from_trials: ['reversed_comparison', 'said_same', 'one_setup'],
};

const SET = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time' } as const;

export const rampLabCard = defineCard<RampLabMiss>({
  id: 'ramp-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    compare_conditions: { ...TAP_ONE, moves: 'taps Setup A or Setup B, the one they predict needs less push, then presses '
      + 'Reveal Force Evidence', misses: RAMP_MISSES_BY_MODE.compare_conditions },
    find_threshold: { ...SET, moves: 'sets the push with the slider or Less push and More push, then presses Test This Force',
      misses: RAMP_MISSES_BY_MODE.find_threshold },
    design_with_budget: { ...SET, moves: 'sets the ramp angle with the slider or Gentler and Steeper, then presses Check '
      + 'This Design', misses: RAMP_MISSES_BY_MODE.design_with_budget },
    plan_fair_test: { ...SET,
      moves: 'changes setup B\'s settings and presses Commit my plan; once the plan is fair, picks a prediction, presses '
        + 'Record prediction, runs trial A and trial B, and presses Record investigation',
      misses: RAMP_MISSES_BY_MODE.plan_fair_test },
    explain_from_trials: { ...SPOKEN, moves: 'picks a prediction, presses Record prediction, runs trial A and trial B and '
      + 'presses Explain my results before there is anything to explain', misses: RAMP_MISSES_BY_MODE.explain_from_trials },
  },
  words: {
    job: 'investigate how a ramp\'s angle, surface and load change the push needed to move a load up it: which of two '
      + 'setups needs less push, the smallest push that moves it, the steepest ramp a push budget can climb, a fair test '
      + 'of one condition, or what two trials show',
    answer: 'their answer',
    question: 'the challenge and the setups on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
