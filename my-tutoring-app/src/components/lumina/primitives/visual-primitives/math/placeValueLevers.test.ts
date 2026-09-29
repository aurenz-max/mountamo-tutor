/**
 * The place-value-chart build levers (handoff 21 M1): which lever answers which miss, and each lever's leak rule.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemsFromChallenges, type PlaceValueItem } from './placeValueScript';
import { BLOCKS_LEVER, MODEL_LEVER, PLAIN_LEVER, READBACK_LEVER, TEEN_LEVER, VALUE_MODEL_LEVER, WORTH_LEVER, askedValues, leverFacts,
  placeValueLevers, plainItem, plainNumber, startLevers, teenDigit, valueModel } from './placeValueLevers';

const build = (targetNumber: number): PlaceValueItem => itemsFromChallenges([{ id: `b${targetNumber}`, targetNumber, highlightedDigitPlace: 0,
  minPlace: 0, maxPlace: String(targetNumber).length - 1 } as never], { mode: 'build', tier: 'medium' }).items.find(i => i.kind === 'build_number')!;
/** The say_value item on `targetNumber` with the digit at `place` glowing. */
const say = (targetNumber: number, place: number): PlaceValueItem => itemsFromChallenges([{ id: `s${targetNumber}`, targetNumber,
  highlightedDigitPlace: place, minPlace: 0, maxPlace: String(targetNumber).length - 1 } as never], { mode: 'identify', tier: 'medium' })
  .items.find(i => i.kind === 'say_value')!;
const digitAt = (n: number, p: number) => Math.floor(n / 10 ** p) % 10;
const none = new Set<number>();

describe('which lever answers which miss', () => {
  it.each([
    ['zero_left_empty', MODEL_LEVER], ['column_empty', MODEL_LEVER], ['digits_swapped', WORTH_LEVER], ['one_ten_off', WORTH_LEVER],
    ['one_short', READBACK_LEVER], ['over_by_more', READBACK_LEVER], ['teen_ty_swap', TEEN_LEVER],
  ])('406, nothing pulled, after %s: %s', (miss, lever) => {
    expect(nextLever(placeValueLevers(build(406), [], none, 'medium'), miss)).toBe(lever);
  });
  it('untiered start (worth row and read-back on): a zero left empty gets the model chart, then the plainer number', () => {
    const start = startLevers(build(406), {});
    expect(start).toEqual([WORTH_LEVER, READBACK_LEVER]);
    expect(nextLever(placeValueLevers(build(406), start, none, 'medium'), 'zero_left_empty')).toBe(MODEL_LEVER);
    expect(nextLever(placeValueLevers(build(406), [...start, MODEL_LEVER], none, 'medium'), 'zero_left_empty')).toBe(PLAIN_LEVER);
  });
  it('find_place declares no lever; say_value declares the model and the block picture', () => {
    const printed = itemsFromChallenges([{ id: 'p', targetNumber: 45, highlightedDigitPlace: 1, minPlace: 0, maxPlace: 1 } as never],
      { mode: 'compare', tier: 'medium' }).items;
    expect(placeValueLevers(printed.find(i => i.kind === 'find_place')!, [], none, 'medium')).toEqual([]);
    expect(placeValueLevers(printed.find(i => i.kind === 'say_value')!, [], none, 'medium').map(l => l.id)).toEqual([VALUE_MODEL_LEVER, BLOCKS_LEVER]);
  });
  it.each([
    ['said_number', VALUE_MODEL_LEVER], ['said_place', VALUE_MODEL_LEVER], ['shifted_place', VALUE_MODEL_LEVER],
    ['said_digit', BLOCKS_LEVER], ['next_digit_value', BLOCKS_LEVER],
  ])('say_value 415 (the 4), after %s: %s', (miss, lever) => {
    expect(nextLever(placeValueLevers(say(415, 2), [], none, 'medium'), miss)).toBe(lever);
  });
});

describe('leak rules', () => {
  const targets = Array.from({ length: 4000 }, (_, i) => 10 + i * 25).filter(n => n < 100000);

  it('plain_number: same places, no zero, no teen, no shared column digit, no session number; only when there is a trap', () => {
    for (const t of targets) {
      const item = build(t);
      if (!item) continue;
      const n = plainNumber(item, new Set([t, 364]));
      const trap = String(t).includes('0') || (digitAt(t, 1) === 1 && digitAt(t, 0) > 0);
      if (!trap) { expect(n, `${t}`).toBeNull(); continue; }
      expect(n, `${t}`).not.toBeNull();
      expect(String(n)).toHaveLength(String(t).length);
      expect(String(n)).not.toContain('0');
      expect(digitAt(n!, 1) === 1 && digitAt(n!, 0) > 0).toBe(false);
      expect(n).not.toBe(364);
      for (let p = 0; p < String(t).length; p++) expect(digitAt(n!, p), `${t} place ${p}`).not.toBe(digitAt(t, p));
    }
  });

  it('the plainer dictation is a new build item whose answer is its own number', () => {
    const easier = plainItem(build(406), none, 'medium')!;
    expect(easier).toMatchObject({ kind: 'build_number', answerKind: 'gesture' });
    expect(easier.id).not.toBe(build(406).id);
    expect(Number(easier.expectedDigits.join(''))).toBe(easier.targetNumber);
  });

  it('model_teen uses a digit the item does not use in its last two places', () => {
    for (const t of [14, 40, 413, 3580, 72614]) {
      const d = teenDigit(t);
      expect([digitAt(t, 0), digitAt(t, 1)]).not.toContain(d);
      expect(d).toBeGreaterThanOrEqual(2);
    }
  });

  it('the scene facts never name the target; the model chart is never the target', () => {
    for (const t of [406, 44, 501, 3580, 72603]) {
      const item = build(t);
      const facts = leverFacts(item, [MODEL_LEVER, TEEN_LEVER, WORTH_LEVER, READBACK_LEVER], []);
      expect(facts).not.toContain(String(t));
      expect(item.modelNumber).not.toBe(t);
    }
  });
});

describe('say_value leak rules', () => {
  const sessions = Array.from({ length: 400 }, (_, i) => {
    const n = 10 + ((i * 7919) % 9990);
    return itemsFromChallenges([0, 1, 2].map(k => ({ id: `c${k}`, targetNumber: n + k * 37, highlightedDigitPlace: k % String(n).length,
      minPlace: 0, maxPlace: String(n + k * 37).length - 1 })) as never, { mode: 'identify', tier: 'medium' }).items;
  });
  it("the model digit is not the item's, its worth is no session answer, and nothing on it names a place", () => {
    let seen = 0;
    for (const items of sessions) {
      const asked = askedValues(items);
      const answers = items.filter(i => i.kind === 'say_value').map(i => i.digit * 10 ** i.place);
      for (const item of items.filter(i => i.kind === 'say_value')) {
        const model = valueModel(item, asked);
        if (!model) continue;
        seen++;
        expect(model.digit).not.toBe(item.digit);
        expect(answers).not.toContain(model.worth);
        expect(String(model.number)).toHaveLength(String(item.targetNumber).length);
        expect(model.number).not.toBe(item.targetNumber);
        const fact = leverFacts(item, [VALUE_MODEL_LEVER, BLOCKS_LEVER], [], asked);
        expect(fact).not.toMatch(/ones|tens|hundreds|thousands|place value/i);
        expect(fact.toLowerCase()).not.toContain(item.answerText.toLowerCase());
        expect(fact).not.toMatch(new RegExp(`(?<![0-9])${item.digit * 10 ** item.place}(?![0-9])`));
      }
    }
    expect(seen).toBeGreaterThan(300);
  });
  it('the block picture is offered only from the tens place', () => {
    expect(placeValueLevers(say(47, 0), [], none, 'medium').map(l => l.id)).toEqual([VALUE_MODEL_LEVER]);
  });
});
