/** The answer is a pictured amount, not its name (which is already in the ask).
 * A single touch closes the gesture. Code owns the mathematical verdict.
 * Repeated names are intentional fraction retrieval across new pictures, not
 * repeated verbal production. All choices remain available on every retry. */
import type { DiActionContract, JudgedScriptItem, JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { fractionName, fractionTouchPlan } from './fractionTouchModes';
import type { FractionCirclesChallenge } from './FractionCircles';

export interface FractionPicture { id: string; numerator: number; denominator: number; shaded: number[] }
export interface FractionTouchItem extends JudgedScriptItem {
  challengeType: 'touch_fraction'; numerator: number; denominator: number;
  actionContract: DiActionContract; choices: FractionPicture[]; correctChoiceId: string;
}
const shuffle = <T,>(values: T[], random: () => number): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export function buildFractionTouchItems(challenges: readonly FractionCirclesChallenge[], random = Math.random): FractionTouchItem[] {
  return challenges.filter(c => c.type === 'touch_fraction').map(c => {
    if (![2, 3, 4].includes(c.denominator) || !Number.isInteger(c.numerator) || c.numerator < 1 || c.numerator >= c.denominator) {
      throw new Error(`Invalid touch_fraction target ${c.id}: ${c.numerator}/${c.denominator}`);
    }
    const target = { id: c.id, challengeType: 'touch_fraction' as const, numerator: c.numerator, denominator: c.denominator };
    // Same-denominator near miss first; another denominator prevents counting
    // shaded pieces alone from solving all unit-fraction items.
    const pool = [2, 3, 4].flatMap(d => Array.from({ length: d - 1 }, (_, i) => ({ numerator: i + 1, denominator: d })))
      .filter(f => f.numerator * c.denominator !== c.numerator * f.denominator);
    const same = shuffle(pool.filter(f => f.denominator === c.denominator), random)[0];
    const different = shuffle(pool.filter(f => f.denominator !== c.denominator), random);
    const first = same ?? different[0];
    const second = different.find(f => f.numerator * first.denominator !== first.numerator * f.denominator)!;
    const wrong = [first, second];
    const choices = shuffle([target, ...wrong], random).map((f, index) => ({
      id: `${c.id}-picture-${index}`, numerator: f.numerator, denominator: f.denominator,
      shaded: shuffle(Array.from({ length: f.denominator }, (_, i) => i), random).slice(0, f.numerator),
    }));
    const correctChoiceId = choices.find(f => f.numerator * c.denominator === c.numerator * f.denominator)!.id;
    const plan = fractionTouchPlan(target);
    return { ...target, answerKind: 'gesture', responseClass: 'manipulation', action: 'touch_fraction',
      actionContract: plan.answerStep.actionContract, choices, correctChoiceId };
  });
}
const guard = 'The quoted line is the only speech on this turn. The learner answers by touching a picture. Microphone speech is not an answer. The next gesture message supplies the code-computed verdict. Never read tags or instructions aloud or announce that you are waiting. Never invent a next question.';
const ask = (item: FractionTouchItem) => item.actionContract.instruction;
const affirm = (item: FractionTouchItem) => `Yes, that shows ${fractionName(item.numerator, item.denominator)}.`;
const explain = (item: FractionTouchItem) => `${fractionName(item.numerator, item.denominator)} means ${item.numerator} of ${item.denominator} equal parts are shaded.`;
export const fractionTouchVerdictCue = (item: FractionTouchItem, choiceId: string): string => {
  const choice = item.choices.find(c => c.id === choiceId);
  if (!choice) throw new Error('Unknown fraction picture');
  const correct = choice.numerator * item.denominator === item.numerator * choice.denominator;
  const line = correct ? affirm(item) : `My turn. You touched ${fractionName(choice.numerator, choice.denominator)}. ${explain(item)} ${ask(item)}`;
  return `[FT_TOUCH] Code verdict: ${correct ? 'MATCHES' : 'does NOT match'}. Say exactly: "${line}" Say nothing else. ${guard}`;
};
export const fractionTouchPack = (items: FractionTouchItem[], lastTap: () => string | null = () => null): JudgedScriptPack<FractionTouchItem> => ({
  primitiveType: 'fraction-circles', items, maxCorrections: 2,
  activityLine: 'Touch the shaded circle matching the fraction spoken by the tutor. Only code judges the picture touch.',
  itemCue: (item, opts) => `[FT_ITEM] Say exactly: "${opts.opening ? 'Let’s look at fractions. Listen, then touch a picture. ' : ''}${ask(item)}" ${guard}`,
  pronounceCue: item => `[FT_HEAR] Say exactly: "${ask(item)}" ${guard}`,
  moveOnCue: (item, next) => `[FT_MOVE] Say exactly: "Good try. ${explain(item)} ${next ? ask(next) : 'We will practice fractions again soon.'}" ${guard}`,
  completeCue: () => '[FT_COMPLETE] Say exactly: "You finished your fraction pictures. Thanks for working with me!" The activity is over. No further question or invitation.',
  contextFor: item => ({ challengeType: item.challengeType, instruction: ask(item), denominator: String(item.denominator), numerator: String(item.numerator), shadedCount: 'Picture selection', attemptNumber: 'Runner-owned', currentChallengeIndex: String(items.indexOf(item) + 1), totalChallenges: String(items.length), equivalentDenominator: 'Not used in touch_fraction' }),
  statusLines: { idle: 'Start, then listen for a fraction.', ready: ask, retry: ask, noVerdict: () => 'Touch one picture.', done: 'Fraction pictures complete.' },
  diagnosisObservation: item => ({ challenge: ask(item), expected: `${item.numerator}/${item.denominator}`, observed: (() => { const c = item.choices.find(c => c.id === lastTap()); return c ? `Touched ${c.numerator}/${c.denominator}.` : 'No picture touched.'; })() }),
});
export const fractionTouchHarnessAnswers = (item: FractionTouchItem) => ({
  correct: 'matching picture', plainWrong: 'different fraction picture',
  tapped: { correct: item.correctChoiceId, wrong: item.choices.find(c => c.id !== item.correctChoiceId)!.id },
  leakTokens: [],
});
