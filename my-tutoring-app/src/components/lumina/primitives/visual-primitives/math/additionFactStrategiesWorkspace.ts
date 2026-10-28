/**
 * Addition fact strategies on the shared tutor/JEV teaching workspace. Every fact's answer is one number, so the
 * learner may say it or tap it on the 0-18 pad: the boss (`additionFactStrategies.boss.ts`) asks the fact with a
 * spoken key (`additionFactKey`) and the assignment also takes the tap, which the activity's own check judges.
 * Response time stays a silent metric: nothing here advances or grades on a clock, and nothing shows a timer.
 *
 * Pure: the component, the boss, the levers and the tests read the same ask, key, checks, misses and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { AdditionFactChallenge, AdditionFactStrategy } from './AdditionFactStrategies';
import { ADDITION_FACT_MISSES, type AdditionFactMiss } from './additionFactStrategies.card';
import { spokenIntegerWord } from './spokenNumberWords';

export { ADDITION_FACT_MISSES, type AdditionFactMiss };

export const STRATEGY_NAMES: Record<AdditionFactStrategy, string> = {
  plus_zero: 'Adding Zero', plus_one: 'Adding One', doubles: 'Doubles', near_doubles: 'Near Doubles', turnaround: 'Turn-Around Facts',
  plus_two: 'Adding Two', facts_3_4: 'The 3s and 4s', facts_5_6: 'The 5s and 6s', facts_7_8: 'The 7s and 8s',
  facts_mixed: 'Mixed Big Facts',
};

/** The big-fact bands share one eval mode. */
const BIG: readonly AdditionFactStrategy[] = ['facts_3_4', 'facts_5_6', 'facts_7_8', 'facts_mixed'];
export const additionFactMode = (strategy: AdditionFactStrategy): string => (BIG.includes(strategy) ? 'big_facts' : strategy);

/** The fact as the ask and the screen print it. */
export const factText = (c: Pick<AdditionFactChallenge, 'a' | 'b'>) => `${c.a} + ${c.b}`;

/** What the learner is asked. The fact's own numbers are said by design (`given`); the total never is. */
export const additionFactAsk = (c: AdditionFactChallenge) => `What is ${factText(c)}?`;

/** The key the tutor judges a spoken total against: the number word, its digits, and the miss that sounds right. */
export function additionFactKey(c: AdditionFactChallenge): SpokenKey {
  const echo = c.a !== c.sum && c.b !== c.sum
    ? ` Saying ${c.a} or ${c.b} alone, as if nothing was added, is wrong.` : '';
  return { answer: spokenIntegerWord(c.sum), alsoAccept: [String(c.sum)],
    acceptRule: 'Counting on out loud and ending on the total is that answer.',
    signatureError: `A different number is not the answer, however close it is.${echo}` };
}

/**
 * A spoken answer's known wrong answers, with the tap's ids (`additionFactMiss`), most specific first. One `addend`
 * entry names both printed numbers: a miss id appears once per item (journey J8).
 */
export function additionFactSpokenMisses(c: AdditionFactChallenge): KnownMiss[] {
  const fact = factText(c);
  const addends = numberMisses(c.sum, [c.a, c.b].map(value => ({ id: 'addend', value, pattern: (n: number) => String(n) })));
  const named = addends.map(m => m.pattern);
  return [
    ...(addends.length ? [{ id: 'addend', examples: addends.flatMap(m => m.examples ?? []),
      pattern: `The learner's answer is ${named.join(' or ')}, ${named.length > 1 ? 'one of the two numbers' : 'a number'} `
        + `printed in ${fact}, as if nothing was added.` }] : []),
    ...offByMisses(c.sum, `the total of ${fact}`),
  ];
}

/** The activity's own check. */
export const additionFactMatches = (c: AdditionFactChallenge, value: number) => value === c.sum;

export function additionFactMiss(c: AdditionFactChallenge | null, value: number): AdditionFactMiss | undefined {
  if (!c || value === c.sum) return undefined;
  if (value === c.a || value === c.b) return 'addend';
  return value === c.sum - 1 ? 'one_short' : value === c.sum + 1 ? 'one_over' : value < c.sum ? 'short_by_more' : 'over_by_more';
}

/** The learner's checked work in their terms, never the key. */
export const describeAdditionFactCheck = (value: number) => `Tapped ${value}`;

/** What the tutor reads about the fact on screen. The lever set adds what pulled levers drew (`leverScene`). */
export function additionFactScene(
  c: AdditionFactChallenge,
  view: { strategy: AdditionFactStrategy; example?: { a: number; b: number } },
): SceneOf {
  return { objects: [], facts: {
    strategy: STRATEGY_NAMES[view.strategy] ?? view.strategy,
    problem: `${factText(c)} = ?`,
    // The worked example is a different fact; its total is printed on the card but never named here.
    ...(view.example ? { example: `A worked example of the strategy is on screen: ${factText(view.example)}, not one of this session's facts.` } : {}),
    timing: 'No timer and no time limit. Never mention speed or hurry the learner.',
    constraints: 'Teach the strategy on screen, not counting all from one. Before the learner answers, never count the '
      + 'objects aloud to the end, never say a number that narrows the total ("it is more than ten"), and never say the '
      + 'total of a nearby fact or double that gives it away.',
    ...(view.strategy === 'near_doubles' && c.a !== c.b ? { nearDouble: 'The strategy is the double inside the fact and '
      + 'one more. One short of the total is the double alone (the extra one forgotten); one over is the larger number '
      + 'doubled. Name which double is inside it, never its total.' } : {}),
  } };
}

/** The journey's tap for one fact, through the real pad. `wrong` taps one more than the sum (one less at 18). */
export function additionFactHarnessInputs(c: AdditionFactChallenge, wrong: boolean): Array<{ type: 'choose'; label: string }> {
  const value = !wrong ? c.sum : c.sum < 18 ? c.sum + 1 : c.sum - 1;
  return [{ type: 'choose', label: `Answer ${value}` }];
}

/** The journey's spoken answers: the total's word, or a plainly different number (the off-by-one belongs to the probes). */
export function additionFactHarnessWords(c: AdditionFactChallenge): { correct: string; plainWrong: string } {
  return { correct: spokenIntegerWord(c.sum), plainWrong: spokenIntegerWord(c.sum >= 4 ? c.sum - 3 : c.sum + 4) };
}
