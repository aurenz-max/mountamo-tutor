import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { buildMathFactItems, mathFactSpokenMisses, type DiMathFactsChallenge, type MathFactItem } from './diMathFactsDomain';
import type { DiMathFactsChallengeType } from './diMathFactsModes';
import { DECADE_LEVER, DIGIT_LEVER, DOTS_LEVER, MODEL_LEVER, PATH_LEVER, SMALLER_LEVER, TAKE_AWAY_LEVER, TAKE_ONE_LEVER,
  dotGroups, factItem, factParts, mathFactLeverFacts, mathFactLevers, modelFor, modelLeaks, numberPath, saysWords, simplerItem,
  startingLevers, takeAwayDots } from './diMathFactsLevers';
import answerFact from '../../../components/live-activity/runtime/testing/w1-payloads/di-math-facts.answer_fact.json';
import countingNext from '../../../components/live-activity/runtime/testing/w1-payloads/di-math-facts.counting_next.json';
import factReview from '../../../components/live-activity/runtime/testing/w1-payloads/di-math-facts.fact_review.json';
import nameNumeral from '../../../components/live-activity/runtime/testing/w1-payloads/di-math-facts.name_numeral.json';
import subtraction from '../../../components/live-activity/runtime/testing/w1-payloads/di-math-facts.subtraction_fact.json';

const fact = (type: DiMathFactsChallengeType, a: number, b = 0) => factItem(type, a, b, `${type}-${a}-${b}`)!;

const SAVED: MathFactItem[] = [answerFact, countingNext, factReview, nameNumeral, subtraction]
  .flatMap(p => buildMathFactItems(p.data.challenges as DiMathFactsChallenge[]));

/** Every item the pack can ask: addition and subtraction within twenty, counting to 120, numerals to 120. */
const ALL: MathFactItem[] = [
  ...Array.from({ length: 11 }, (_, a) => Array.from({ length: 11 }, (_, b) => [fact('answer_fact', a, b), fact('fact_review', a, b)])).flat(2),
  ...Array.from({ length: 21 }, (_, a) => Array.from({ length: a + 1 }, (_, b) => fact('subtraction_fact', a, b))).flat(),
  ...Array.from({ length: 120 }, (_, a) => fact('counting_next', a, 1)),
  ...Array.from({ length: 121 }, (_, a) => fact('name_numeral', a)),
];

/** Spoken containment: "twenty-nine" says "twenty". Stricter than a word boundary. */
const wordIn = (text: string, word: string) => saysWords(text, word);

describe('model_fact: a different fact of the same kind, never a route to this answer', () => {
  it.each([
    ['the item itself', fact('answer_fact', 3, 2), fact('answer_fact', 3, 2), true],
    ['its turnaround', fact('answer_fact', 2, 3), fact('answer_fact', 3, 2), true],
    ['one step from it (3 + 1 beside 3 + 2)', fact('answer_fact', 3, 1), fact('answer_fact', 3, 2), true],
    ['an answer one away', fact('answer_fact', 4, 2), fact('answer_fact', 3, 2), true],
    ['the item\'s answer printed in it', fact('answer_fact', 5, 3), fact('answer_fact', 3, 2), true],
    ['the partner take-away (5 - 3 beside 5 - 2)', fact('subtraction_fact', 5, 3), fact('subtraction_fact', 5, 2), true],
    ['the next number beside it', fact('counting_next', 8, 1), fact('counting_next', 7, 1), true],
    ['2 + 1 beside 3 + 2', fact('answer_fact', 2, 1), fact('answer_fact', 3, 2), false],
    ['29 → beside 39 →', fact('counting_next', 29, 1), fact('counting_next', 39, 1), false],
    ['102 beside 100 (says "one hundred")', fact('name_numeral', 102), fact('name_numeral', 100), true],
    ['29 → beside 19 → (says "twenty")', fact('counting_next', 29, 1), fact('counting_next', 19, 1), true],
  ])('%s leaks: %s', (_, model, item, leaks) => expect(modelLeaks(model, item)).toBe(leaks));

  it('every askable item has a model of its own mode that does not leak', () => {
    for (const item of ALL) {
      const model = modelFor(item);
      expect(model, item.display).not.toBeNull();
      expect(model!.challengeType).toBe(item.challengeType);
      expect(modelLeaks(model!, item), `${model!.display} beside ${item.display}`).toBe(false);
    }
  });

  it('keeps the item\'s shape: a double models a double, a teen models a teen, 39 → models a rollover, 6 models 9', () => {
    expect(factParts(modelFor(fact('answer_fact', 4, 4))!).nums).toSatisfy(([a, b]: number[]) => a === b);
    expect(modelFor(fact('answer_fact', 1, 1))!.display).not.toMatch(/\b0\b/);
    const teen = modelFor(fact('answer_fact', 8, 6))!;
    expect(teen.answerNumeral).toBeGreaterThan(10);
    expect(factParts(modelFor(fact('counting_next', 39, 1))!).nums[0] % 10).toBe(9);
    expect(modelFor(fact('name_numeral', 6))!.display).toBe('9');
    expect(modelFor(fact('name_numeral', 9))!.display).toBe('6');
  });

  it('starts on screen at easy only', () => {
    expect(startingLevers({ ...fact('answer_fact', 3, 2), supportTier: 'easy' })).toEqual([MODEL_LEVER]);
    expect(startingLevers({ ...fact('answer_fact', 3, 2), supportTier: 'medium' })).toEqual([]);
    expect(startingLevers({ ...fact('answer_fact', 3, 2), supportTier: 'hard' })).toEqual([]);
  });
});

describe('help levers draw only what is printed', () => {
  it('dot_model draws exactly the printed numbers, never a total', () => {
    for (const item of ALL.filter(i => i.challengeType === 'answer_fact')) expect(dotGroups(item)).toEqual(factParts(item).nums);
    expect(dotGroups(fact('subtraction_fact', 5, 2))).toBeNull();
  });
  it('take_away_dots draws the start and crosses out the amount taken away', () => {
    expect(takeAwayDots(fact('subtraction_fact', 5, 2))).toEqual({ total: 5, crossed: 2 });
    expect(takeAwayDots(fact('answer_fact', 5, 2))).toBeNull();
  });
  it('number_path never prints a number above the printed one', () => {
    for (const item of ALL.filter(i => i.challengeType === 'counting_next')) {
      const path = numberPath(item)!;
      expect(Math.max(...path)).toBe(factParts(item).nums[0]);
      expect(path).not.toContain(item.answerNumeral);
    }
  });
  it('the scene fact never names this item\'s answer', () => {
    for (const item of [...SAVED, ...ALL]) {
      const facts = mathFactLeverFacts(item, mathFactLevers(item, []).map(l => l.id));
      expect(wordIn(facts, item.answerWord), `${item.display}: ${facts}`).toBe(false);
      expect(wordIn(facts, String(item.answerNumeral)), `${item.display}: ${facts}`).toBe(false);
    }
  });
});

describe('simplify levers: same mode, one step simpler, never this item', () => {
  it.each([
    ['3 + 4 → 4 + 1', fact('answer_fact', 3, 4), SMALLER_LEVER, '4 + 1'],
    ['3 + 1 → 1 + 1', fact('answer_fact', 3, 1), SMALLER_LEVER, '1 + 1'],
    ['1 + 1: already simplest', fact('answer_fact', 1, 1), SMALLER_LEVER, null],
    ['4 + 0: adds zero', fact('answer_fact', 4, 0), SMALLER_LEVER, null],
    ['5 - 3 → 5 - 1', fact('subtraction_fact', 5, 3), TAKE_ONE_LEVER, '5 - 1'],
    ['5 - 1: already one', fact('subtraction_fact', 5, 1), TAKE_ONE_LEVER, null],
    ['39 → becomes 35 →', fact('counting_next', 39, 1), DECADE_LEVER, '35 →'],
    ['37 →: no rollover', fact('counting_next', 37, 1), DECADE_LEVER, null],
    ['14 → a digit not in it', fact('name_numeral', 14), DIGIT_LEVER, '3'],
    ['7: already one digit', fact('name_numeral', 7), DIGIT_LEVER, null],
  ])('%s', (_, item, lever, display) => expect(simplerItem(item, lever)?.display ?? null).toBe(display));

  it('every simpler item keeps the mode, has its own id, and is not the item, its turnaround or its answer', () => {
    for (const item of ALL) for (const lever of [SMALLER_LEVER, TAKE_ONE_LEVER, DECADE_LEVER, DIGIT_LEVER]) {
      const easier = simplerItem(item, lever);
      if (!easier) continue;
      expect(easier.challengeType).toBe(item.challengeType);
      expect(easier.id).toBe(`${item.id}~simpler`);
      expect(easier.display).not.toBe(item.display);
      expect(easier.answerNumeral).not.toBe(item.answerNumeral);
      const [a, b] = factParts(item).nums;
      if (item.challengeType !== 'subtraction_fact' && b !== undefined) expect(easier.display).not.toBe(`${b} + ${a}`);
    }
  });
});

describe('this wrong answer, then this lever', () => {
  const open = (item: MathFactItem) => mathFactLevers(item, []);
  const afterModel = (item: MathFactItem) => mathFactLevers(item, [MODEL_LEVER]);
  it.each([
    ['said_addend', fact('answer_fact', 3, 2), MODEL_LEVER, DOTS_LEVER],
    ['one_short', fact('fact_review', 3, 2), MODEL_LEVER, DOTS_LEVER],
    ['said_start', fact('subtraction_fact', 5, 2), MODEL_LEVER, TAKE_AWAY_LEVER],
    ['added_instead', fact('subtraction_fact', 5, 2), MODEL_LEVER, TAKE_AWAY_LEVER],
    ['said_printed', fact('counting_next', 7, 1), MODEL_LEVER, PATH_LEVER],
    ['decade_rollover', fact('counting_next', 39, 1), MODEL_LEVER, DECADE_LEVER],
    ['teen_decade_swap', fact('name_numeral', 14), MODEL_LEVER, DIGIT_LEVER],
    ['look_alike_numeral', fact('name_numeral', 6), MODEL_LEVER, null],
  ])('%s on %s: the model first, then %s', (miss, item, first, second) => {
    expect(nextLever(open(item), miss)).toBe(first);
    const after = nextLever(afterModel(item), miss);
    expect(after === null ? null : afterModel(item).find(l => l.id === after)?.answers?.includes(miss) ? after : null).toBe(second);
  });

  it('every miss the pack names on an item is answered by one of its levers', () => {
    for (const item of [...SAVED, ...ALL]) {
      const levers = mathFactLevers(item, []);
      for (const miss of mathFactSpokenMisses(item))
        expect(levers.some(l => l.answers?.includes(miss.id)), `${item.display}: ${miss.id}`).toBe(true);
    }
  });
});
