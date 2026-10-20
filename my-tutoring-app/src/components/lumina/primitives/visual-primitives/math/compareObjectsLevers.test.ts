/**
 * The compare-objects lever set (handoff 21 M2, handoff 23): which lever answers which miss, each lever's leak rule on
 * the saved payloads, and the easier items over many generated shapes. Merged from the order and spoken lever suites.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { compareObjectsCard } from './compareObjects.card';
import { ATTRIBUTE_CHILD_FORM, buildCompareItems, compareObjectsSpokenMisses, type CompareObjectsChallengeLike,
  type CompareObjectsItem, type ComparisonWord, type MeasurableAttribute } from './compareObjectsDomain';
import {
  COMPARE_LEVERS, FAR_LEVER, FAR_PAIR_LEVER, FEWER_CHOICES_LEVER, FIVE_MARKS_LEVER, GRID_LEVER, MENU_LEVER, SHORTER_LEVER,
  SLOTS_LEVER, STEPS_LEVER, TAP_BOXES_LEVER, WORD_MODEL_LEVER, droppedChoice, farPair, farThree, orderSteps, shorterMeasure,
  wordModel,
} from './compareObjectsLevers';

const obj = (name: string, visualSize: number, actualValue = visualSize) => ({ name, visualSize, actualValue });
const itemOf = (c: CompareObjectsChallengeLike) => buildCompareItems([c], { band: '1' }).items[0];
const declared = (item: CompareObjectsItem, pulled: string[] = [], session: readonly CompareObjectsItem[] = []) =>
  COMPARE_LEVERS.declare(item, session, pulled);
const ids = (item: CompareObjectsItem, pulled: string[] = []) => declared(item, pulled).map(l => l.id);

const order = (attribute: MeasurableAttribute, comparisonWord: ComparisonWord, objects: ReturnType<typeof obj>[]) => {
  const greater = ['longer', 'taller', 'heavier', 'holds_more'].includes(comparisonWord);
  const answer = [...objects].sort((a, b) => (greater ? b.actualValue - a.actualValue : a.actualValue - b.actualValue)).map(o => o.name);
  return { id: `o-${attribute}-${comparisonWord}`, type: 'order_three', attribute, comparisonWord, objects, correctAnswer: answer.join(',') };
};
const close = order('length', 'longer', [obj('pencil', 50), obj('ruler', 60), obj('crayon', 40)]);
const two = (word: ComparisonWord, attribute: MeasurableAttribute, a: number, b: number, names = ['pencil', 'crayon']) => {
  const greater = ['longer', 'taller', 'heavier', 'holds_more'].includes(word);
  return itemOf({ id: `c-${word}-${a}-${b}`, type: 'compare_two', attribute, comparisonWord: word,
    objects: [obj(names[0], a), obj(names[1], b)], correctAnswer: (greater ? a > b : a < b) ? names[0] : names[1] });
};
const measure = (unitCount: number, id = `n${unitCount}`) => itemOf({ id, type: 'non_standard', attribute: 'length',
  objects: [obj('shoe', unitCount * 10)], unitName: 'cube', unitCount });
const payload = (mode: string) => JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/compare-objects.${mode}.json`), 'utf8')).data;
const saved = (mode: string) => {
  const data = payload(mode);
  return buildCompareItems(data.challenges, { band: data.gradeBand ?? 'K' }).items;
};

describe('which lever comes next', () => {
  it.each([['reversed', STEPS_LEVER], ['not_all_placed', SLOTS_LEVER], ['two_swapped', GRID_LEVER], ['other_order', GRID_LEVER]])(
    'order_three after %s: %s', (miss, lever) => expect(nextLever(declared(itemOf(close)), miss)).toBe(lever));
  it('after the grid, a swap opens the easier order', () => {
    expect(nextLever(declared(itemOf(close), [GRID_LEVER]), 'two_swapped')).toBe(FAR_LEVER);
  });
  it.each([
    [two('longer', 'length', 60, 50), 'other_object', [], WORD_MODEL_LEVER],
    [two('longer', 'length', 60, 50), 'other_object', [WORD_MODEL_LEVER], FAR_PAIR_LEVER],
    [measure(8), 'one_over', [], TAP_BOXES_LEVER],
    [measure(8), 'short_by_more', [], FIVE_MARKS_LEVER],
    [measure(8), 'over_by_more', [FIVE_MARKS_LEVER], SHORTER_LEVER],
  ] as const)('spoken %#: after %s', (item, miss, pulled, lever) => expect(nextLever(declared(item, [...pulled]), miss)).toBe(lever));
  it('identify_attribute: pictures first, then one wrong choice greyed out', () => {
    const [item] = saved('identify_attribute');
    expect(nextLever(declared(item), 'other_attribute')).toBe(MENU_LEVER);
    expect(nextLever(declared(item, [MENU_LEVER]), 'other_attribute')).toBe(FEWER_CHOICES_LEVER);
  });
  it('weight gets no grid; far-apart sizes get no simplify; five boxes or fewer get no five_marks', () => {
    expect(ids(itemOf(order('weight', 'heavier', [obj('apple', 50), obj('melon', 60), obj('grape', 40)]))))
      .toEqual([STEPS_LEVER, SLOTS_LEVER, FAR_LEVER]);
    expect(ids(itemOf(order('length', 'longer', [obj('pencil', 50), obj('ruler', 90), obj('crayon', 20)])))).not.toContain(FAR_LEVER);
    expect(ids(two('longer', 'length', 90, 30))).toEqual([WORD_MODEL_LEVER]);
    expect(ids(measure(5))).not.toContain(FIVE_MARKS_LEVER);
  });
  it('on every saved payload, every miss of every mode is answered by a lever offered there', () => {
    for (const mode of Object.keys(compareObjectsCard.modes)) {
      const items = saved(mode);
      const answered = new Set(items.flatMap(item => declared(item, [], items)).flatMap(l => l.answers ?? []));
      expect(compareObjectsCard.modes[mode].misses.filter(m => !answered.has(m)), mode).toEqual([]);
    }
  });
  it('only compare_two states a support rule, naming its model lever', () => {
    expect(COMPARE_LEVERS.support(two('longer', 'length', 60, 50))).toMatch(/word_model/);
    expect(COMPARE_LEVERS.support(measure(8))).toBe('');
  });
});

describe('leak rules', () => {
  it('order_steps follows the asked direction and draws heights only', () => {
    expect(orderSteps(itemOf(order('length', 'longer', close.objects)))).toEqual([30, 20, 10]);
    expect(orderSteps(itemOf(order('length', 'shorter', close.objects)))).toEqual([10, 20, 30]);
  });
  it('word_model is fixed per word: the same model whichever object wins', () => {
    const a = two('longer', 'length', 60, 50), b = two('longer', 'length', 50, 60);
    expect(a.answerNames[0]).toBe('pencil');
    expect(b.answerNames[0]).toBe('crayon');
    expect(wordModel(a.comparisonWord)).toEqual(wordModel(b.comparisonWord));
    expect(wordModel('longer').glow).not.toBe(wordModel('shorter').glow);
  });
  it('no scene fact names an object, a count or a digit; identify names every choice left', () => {
    for (const mode of Object.keys(compareObjectsCard.modes)) for (const item of saved(mode)) {
      const all = declared(item, [], saved(mode)).map(l => l.id);
      const fact = COMPARE_LEVERS.onScreen(item, saved(mode), all);
      expect(fact, item.id).not.toMatch(/\d/);
      for (const name of item.objectNames) expect(fact, item.id).not.toContain(name);
      if (item.kind === 'identify_attribute') {
        const left = item.attributeOptions.filter(a => a !== droppedChoice(item));
        for (const a of left) expect(fact).toContain(ATTRIBUTE_CHILD_FORM[a]);
        expect(left).toContain(item.attribute);
      }
    }
  });
  it('fewer_choices never greys out the answer, and only on a menu of three or more', () => {
    for (const item of saved('identify_attribute')) {
      const dropped = droppedChoice(item);
      if (item.attributeOptions.length < 3) expect(dropped).toBeNull();
      else expect(dropped).not.toBe(item.attribute);
    }
  });
});

describe('the easier items', () => {
  const cases = (['longer', 'shorter'] as const).map(w => order('length', w, close.objects))
    .concat((['taller', 'shorter_height'] as const).map(w => order('height', w, [obj('pine', 50), obj('bush', 40), obj('flower', 55)])))
    .concat((['heavier', 'lighter'] as const).map(w => order('weight', w, [obj('apple', 50), obj('melon', 60), obj('grape', 40)])))
    .concat((['holds_more', 'holds_less'] as const).map(w => order('capacity', w, [obj('mug', 50), obj('pot', 60), obj('bowl', 40)])));

  it.each(cases)('far_three on $attribute $comparisonWord: an order item, its own id, no name of the item, far apart', c => {
    const item = itemOf(c);
    expect(item, 'the fixture passes the item gates').toBeTruthy();
    const easier = farThree(item)!;
    expect(easier).toMatchObject({ kind: 'order_three', attribute: c.attribute, comparisonWord: c.comparisonWord, id: `${c.id}~simpler` });
    expect(easier.objectNames.some(n => item.objectNames.includes(n))).toBe(false);
    const sizes = easier.objects.map(o => o.visualSize).sort((a, b) => a - b);
    expect(sizes[1] - sizes[0]).toBeGreaterThanOrEqual(25);
    expect(sizes[2] - sizes[1]).toBeGreaterThanOrEqual(25);
    expect(easier.objectNames).not.toEqual(easier.answerNames);
    expect(easier.objectNames).not.toEqual([...easier.answerNames].reverse());
  });

  it('far_pair: same kind, attribute and word, no name of the item, sizes far apart, answer recomputed', () => {
    let built = 0;
    for (const [word, attribute] of [['longer', 'length'], ['shorter', 'length'], ['taller', 'height'], ['shorter_height', 'height'],
      ['heavier', 'weight'], ['lighter', 'weight'], ['holds_more', 'capacity'], ['holds_less', 'capacity']] as const)
      for (let a = 20; a <= 90; a += 7) for (const d of [-20, -9, 5, 12, 24]) {
        const b = a + d;
        if (b < 10 || b > 100) continue;
        const source = two(word, attribute, a, b, ['blue ribbon', 'pink cup']);
        if (!source) continue;
        const p = farPair(source);
        expect(p, `${word} ${a}/${b}`).not.toBeNull();
        built++;
        expect([p!.kind, p!.attribute, p!.comparisonWord, p!.id]).toEqual(['compare_two', attribute, word, `${source.id}~simpler`]);
        expect(p!.objectNames.filter(n => source.objectNames.includes(n))).toEqual([]);
        expect(Math.abs(p!.objects[0].visualSize - p!.objects[1].visualSize)).toBeGreaterThanOrEqual(50);
        expect(compareObjectsSpokenMisses(p!).map(m => m.id)).toEqual(['other_object']);
      }
    expect(built).toBeGreaterThan(100);
  });

  it('shorter_measure: same unit, at most half the boxes and two or more, a count no session item has when one is free', () => {
    let built = 0;
    for (let n = 2; n <= 20; n++) {
      const source = measure(n);
      const other = measure(Math.ceil(n / 2), 'other');
      const p = shorterMeasure(source, [other]);
      if (n < 3) { expect(p).toBeNull(); continue; }
      expect(p, String(n)).not.toBeNull();
      built++;
      expect([p!.kind, p!.unitName, p!.id]).toEqual(['non_standard', 'cube', `${source.id}~simpler`]);
      expect(p!.unitCount).toBeGreaterThanOrEqual(2);
      expect(p!.unitCount).toBeLessThanOrEqual(Math.ceil(n / 2));
      expect(p!.objectNames[0]).not.toBe(source.objectNames[0]);
      if (n >= 6) expect(p!.unitCount).not.toBe(other.unitCount);
    }
    expect(built).toBe(18);
  });
});
