import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { DiDiceRollChallenge, DiDiceRollChallengeType } from './diDiceRollScript';
import { diceChallengeValid, diceSpokenMisses } from './diDiceRollWorkspace';
import { saysWords } from './diMathFactsLevers';
import { compareModels, BRACKET_LEVER, FAR_LEVER, FEWER_LEVER, MODEL_LEVER, SMALLER_LEVER, TOUCH_LEVER, diceItem, diceLeverFacts,
  diceLevers, modelFor, modelLeaks, simplerRoll, startingLevers } from './diDiceRollLevers';
import compare from '../../../components/live-activity/runtime/testing/w1-payloads/di-dice-roll.compare_dice.json';
import count from '../../../components/live-activity/runtime/testing/w1-payloads/di-dice-roll.count_pips.json';
import sum from '../../../components/live-activity/runtime/testing/w1-payloads/di-dice-roll.sum_two_dice.json';

const roll = (type: DiDiceRollChallengeType, a: number, b = 0) => diceItem(type, a, b, `${type}-${a}-${b}`);
const FACES = [1, 2, 3, 4, 5, 6];
const SAVED = [compare, count, sum].flatMap(p => p.data.challenges as DiDiceRollChallenge[]);
/** Every roll the pack can ask. */
const ALL: DiDiceRollChallenge[] = [
  ...FACES.map(v => roll('count_pips', v)),
  ...FACES.flatMap(a => FACES.map(b => roll('compare_dice', a, b))),
  ...FACES.flatMap(a => FACES.map(b => roll('sum_two_dice', a, b))),
];
const faces = (c: DiDiceRollChallenge) => [c.value, ...('secondValue' in c ? [c.secondValue] : [])];

describe('model_roll: a different roll, never a route to this answer', () => {
  it.each([
    ['the same die', roll('count_pips', 3), roll('count_pips', 3), true],
    ['a die one dot away', roll('count_pips', 4), roll('count_pips', 3), true],
    ['the swapped pair', roll('sum_two_dice', 4, 2), roll('sum_two_dice', 2, 4), true],
    ['one step from the pair (2 + 3 beside 2 + 4)', roll('sum_two_dice', 2, 3), roll('sum_two_dice', 2, 4), true],
    ['the total printed on a face (6 + 1 beside 3 + 3)', roll('sum_two_dice', 6, 1), roll('sum_two_dice', 3, 3), true],
    // R1: the card carries every relation, so a pair's own relation is no longer a leak; a shared face still is.
    ['a comparison pair with the same word, no shared face', roll('compare_dice', 5, 1), roll('compare_dice', 4, 2), false],
    ['a face the child rolled (6 + 3 beside 3 + 4)', roll('sum_two_dice', 6, 3), roll('sum_two_dice', 3, 4), true],
    ['a comparison sharing a face', roll('compare_dice', 1, 4), roll('compare_dice', 4, 2), true],
    ['5 beside 3', roll('count_pips', 5), roll('count_pips', 3), false],
  ])('%s leaks: %s', (_, model, item, leaks) => expect(modelLeaks(model, item)).toBe(leaks));

  it('every roll the pack can ask has a model of its own mode that does not leak; a comparison model is never a tie', () => {
    for (const item of ALL) {
      const model = modelFor(item);
      expect(model, faces(item).join('/')).not.toBeNull();
      expect(model!.challengeType).toBe(item.challengeType);
      expect(modelLeaks(model!, item)).toBe(false);
      expect(diceChallengeValid(model!)).toBe(true);
      if (item.challengeType === 'compare_dice') expect(model!.spokenAnswer).not.toBe('same');
    }
  });

  it('starts on screen at easy, or with no tier; not at medium or hard', () => {
    expect(startingLevers(roll('count_pips', 3))).toEqual([MODEL_LEVER]);
    expect(startingLevers({ ...roll('count_pips', 3), supportTier: 'medium' })).toEqual([]);
    expect(startingLevers({ ...roll('count_pips', 3), supportTier: 'hard' })).toEqual([]);
  });
});

describe('levers per mode, and what they say', () => {
  const ids = (item: DiDiceRollChallenge) => diceLevers(item, []).map(l => l.id);
  it('compare gets no in-item help; count and sum do', () => {
    expect(ids(roll('compare_dice', 4, 3))).toEqual([MODEL_LEVER, FAR_LEVER]);
    expect(ids(roll('compare_dice', 3, 3))).toEqual([MODEL_LEVER]);
    expect(ids(roll('count_pips', 5))).toEqual([MODEL_LEVER, TOUCH_LEVER, FEWER_LEVER]);
    expect(ids(roll('sum_two_dice', 4, 3))).toEqual([MODEL_LEVER, TOUCH_LEVER, BRACKET_LEVER, SMALLER_LEVER]);
  });

  it('R1: a comparison model is three pairs, one per answer, in a fixed order, sharing no face with the child\'s dice', () => {
    for (const item of ALL.filter(i => i.challengeType === 'compare_dice')) {
      const models = compareModels(item)!;
      expect(models.map(m => m.spokenAnswer), faces(item).join('/')).toEqual(['left', 'right', 'same']);
      for (const m of models) {
        expect(diceChallengeValid(m)).toBe(true);
        expect(faces(m).some(v => faces(item).includes(v)), `${faces(m)} beside ${faces(item)}`).toBe(false);
      }
      // The card and its fact say all three words, so neither points at the child's answer.
      expect(diceLeverFacts(item, [MODEL_LEVER])).toMatch(/left die has more.*right die has more.*same/);
      expect(diceLevers(item, []).find(l => l.id === MODEL_LEVER)!.does).toMatch(/all three/);
    }
  });

  it('the scene fact never says the child\'s answer', () => {
    // A comparison card says all three words by design (R1, tested above); count and sum never say the answer.
    for (const item of [...SAVED, ...ALL].filter(i => i.challengeType !== 'compare_dice')) {
      const facts = diceLeverFacts(item, diceLevers(item, []).map(l => l.id));
      expect(saysWords(facts, item.spokenAnswer), `${faces(item).join('/')}: ${facts}`).toBe(false);
      const n = item.challengeType === 'sum_two_dice' ? item.total : item.challengeType === 'count_pips' ? item.value : null;
      if (n !== null) expect(saysWords(facts, String(n))).toBe(false);
    }
  });
});

describe('simplify: same mode, easier, never the child\'s roll or answer', () => {
  it.each([
    ['5 dots → 3', roll('count_pips', 5), FEWER_LEVER, [3]],
    ['4 dots → 2', roll('count_pips', 4), FEWER_LEVER, [2]],
    ['3 dots: already few', roll('count_pips', 3), FEWER_LEVER, null],
    ['4 vs 3 (left) → right, three apart', roll('compare_dice', 4, 3), FAR_LEVER, [2, 5]],
    ['2 vs 3 (right) → left, three apart', roll('compare_dice', 2, 3), FAR_LEVER, [5, 2]],
    ['6 vs 1: already far', roll('compare_dice', 6, 1), FAR_LEVER, null],
    ['a tie: none', roll('compare_dice', 3, 3), FAR_LEVER, null],
    ['3 + 5 → 5 + 1', roll('sum_two_dice', 3, 5), SMALLER_LEVER, [5, 1]],
    ['4 + 1 → 1 + 1', roll('sum_two_dice', 4, 1), SMALLER_LEVER, [1, 1]],
    ['1 + 1: already simplest', roll('sum_two_dice', 1, 1), SMALLER_LEVER, null],
  ])('%s', (_, item, lever, expected) => {
    const easier = simplerRoll(item, lever);
    expect(easier ? faces(easier) : null).toEqual(expected);
  });

  it('every easier roll keeps the mode, is valid, has its own id, and never repeats the roll, its swap or its answer', () => {
    for (const item of ALL) for (const lever of [FEWER_LEVER, FAR_LEVER, SMALLER_LEVER]) {
      const easier = simplerRoll(item, lever);
      if (!easier) continue;
      expect(easier.challengeType).toBe(item.challengeType);
      expect(diceChallengeValid(easier)).toBe(true);
      expect(easier.id).toBe(`${item.id}~simpler`);
      expect(easier.spokenAnswer).not.toBe(item.spokenAnswer);
      expect(faces(easier).join()).not.toBe(faces(item).join());
      expect(faces(easier).join()).not.toBe([...faces(item)].reverse().join());
    }
  });
});

describe('this wrong answer, then this lever', () => {
  const afterModel = (item: DiDiceRollChallenge) => diceLevers(item, [MODEL_LEVER]);
  it.each([
    ['skipped_a_number', roll('count_pips', 5), TOUCH_LEVER],
    ['one_over', roll('count_pips', 5), TOUCH_LEVER],
    ['short_by_more', roll('count_pips', 5), FEWER_LEVER],
    ['said_addend', roll('sum_two_dice', 4, 3), BRACKET_LEVER],
    ['one_short', roll('sum_two_dice', 4, 3), TOUCH_LEVER],
    ['other_die', roll('compare_dice', 4, 3), FAR_LEVER],
    ['said_same', roll('compare_dice', 4, 3), FAR_LEVER],
  ])('%s on %s: the model first, then %s', (miss, item, second) => {
    expect(nextLever(diceLevers(item, []), miss)).toBe(MODEL_LEVER);
    expect(nextLever(afterModel(item), miss)).toBe(second);
  });

  it('every miss the pack names on a roll is answered by one of its levers', () => {
    for (const item of [...SAVED, ...ALL]) {
      const levers = diceLevers(item, []);
      for (const miss of diceSpokenMisses(item))
        expect(levers.some(l => l.answers?.includes(miss.id)), `${faces(item).join('/')}: ${miss.id}`).toBe(true);
    }
  });
});
