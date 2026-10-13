/**
 * Addition fact strategies on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape:
 * `useWorkspaceProgress` in place of `useChallengeProgress`. Every fact's answer is one number, so the learner may say
 * it or tap it on the 0-18 pad: the item is spoken, judged by JEV from the tutor's feedback against `expectedAnswer`,
 * and still takes the tap, which the activity's own check judges (as math-fact-fluency, 2026-10-13).
 * Response time stays a silent metric: nothing here advances or grades on a clock.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberMisses, offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { AdditionFactChallenge, AdditionFactStrategy } from './AdditionFactStrategies';

export const STRATEGY_NAMES: Record<AdditionFactStrategy, string> = {
  plus_zero: 'Adding Zero', plus_one: 'Adding One', doubles: 'Doubles', turnaround: 'Turn-Around Facts',
  plus_two: 'Adding Two', facts_3_4: 'The 3s and 4s', facts_5_6: 'The 5s and 6s', facts_7_8: 'The 7s and 8s',
  facts_mixed: 'Mixed Big Facts',
};

/** A spoken answer's known wrong answers, with the tap's ids (`additionFactMiss`), most specific first. */
export function additionFactSpokenMisses(c: AdditionFactChallenge): KnownMiss[] {
  const fact = `${c.a} + ${c.b}`;
  return [
    ...numberMisses(c.sum, [c.a, c.b].map(value => ({ id: 'addend', value,
      pattern: (n: number) => `The learner's answer is ${n}, one of the two numbers printed in ${fact}, as if nothing was added.` }))),
    ...offByMisses(c.sum, `the total of ${fact}`),
  ];
}

export function additionFactAssignment(c: AdditionFactChallenge): TeachingAssignment {
  return { id: c.id, task: `What is ${c.a} + ${c.b}? The learner answers by saying the number, or tapping it on the number pad.`,
    response: 'speech', acceptsGesture: true,
    expectedAnswer: `${c.sum} (${c.a} + ${c.b} = ${c.sum}), said as a number, digits or words`,
    misses: additionFactSpokenMisses(c) };
}

/** The activity's own check. */
export const additionFactMatches = (c: AdditionFactChallenge, value: number) => value === c.sum;

/**
 * What a wrong tap shows (`TeachingAttempt.miss`): `addend` (tapped one of the two printed numbers, as if
 * nothing was added), then how far off the tap is: `one_short` / `one_over` / `short_by_more` / `over_by_more`.
 */
export type AdditionFactMiss = 'addend' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';
export const ADDITION_FACT_MISSES: AdditionFactMiss[] = ['addend', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];

export function additionFactMiss(c: AdditionFactChallenge | null, value: number): AdditionFactMiss | undefined {
  if (!c || value === c.sum) return undefined;
  if (value === c.a || value === c.b) return 'addend';
  return value === c.sum - 1 ? 'one_short' : value === c.sum + 1 ? 'one_over' : value < c.sum ? 'short_by_more' : 'over_by_more';
}

/** The learner's checked work in their terms, never the key. */
export const describeAdditionFactCheck = (value: number) => `Tapped ${value}`;

export function additionFactScene(
  c: AdditionFactChallenge,
  view: { strategy: AdditionFactStrategy; onScreen?: string; example?: { a: number; b: number } },
): WorkspaceScene {
  return { objects: [], facts: {
    strategy: STRATEGY_NAMES[view.strategy] ?? view.strategy,
    problem: `${c.a} + ${c.b} = ?`,
    // The worked example is a different fact; its total is printed on the card but never named here.
    ...(view.example ? { example: `A worked example of the strategy is on screen: ${view.example.a} + ${view.example.b}, not one of this session's facts.` } : {}),
    // What the pulled levers drew (`leverFacts`), never this fact's total.
    ...(view.onScreen ? { onScreen: view.onScreen } : {}),
    timing: 'No timer and no time limit. Never mention speed or hurry the learner.',
    constraints: 'The learner says the total or taps it on a 0 to 18 number pad; a tap is checked by the activity. Before '
      + 'the learner answers, never say the total, never count the objects aloud to the end, and never say a number that narrows it.',
  } };
}

type HarnessInput = { type: 'choose'; label: string };

/** The journey's input for one fact, through the real pad. `wrong` taps one more than the sum (one less at 18). */
export function additionFactHarnessInputs(c: AdditionFactChallenge, wrong: boolean): HarnessInput[] {
  const value = !wrong ? c.sum : c.sum < 18 ? c.sum + 1 : c.sum - 1;
  return [{ type: 'choose', label: `Answer ${value}` }];
}
