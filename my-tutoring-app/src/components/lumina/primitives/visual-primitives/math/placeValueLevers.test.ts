/**
 * The place-value-chart build levers (handoff 21 M1): which lever answers which miss, and each lever's leak rule.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemsFromChallenges, type PlaceValueItem } from './placeValueScript';
import { MODEL_LEVER, PLAIN_LEVER, READBACK_LEVER, TEEN_LEVER, WORTH_LEVER, leverFacts, placeValueLevers, plainItem, plainNumber,
  startLevers, teenDigit } from './placeValueLevers';

const build = (targetNumber: number): PlaceValueItem => itemsFromChallenges([{ id: `b${targetNumber}`, targetNumber, highlightedDigitPlace: 0,
  minPlace: 0, maxPlace: String(targetNumber).length - 1 } as never], { mode: 'build', tier: 'medium' }).items.find(i => i.kind === 'build_number')!;
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
  it('only a dictated build item declares levers', () => {
    const printed = itemsFromChallenges([{ id: 'p', targetNumber: 45, highlightedDigitPlace: 1, minPlace: 0, maxPlace: 1 } as never],
      { mode: 'compare', tier: 'medium' }).items;
    for (const item of printed.filter(i => i.kind !== 'build_number')) expect(placeValueLevers(item, [], none, 'medium')).toEqual([]);
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
