/**
 * The compare-objects order_three levers (handoff 21 M2): which lever answers which miss, and each lever's leak rule.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { CompareObjectsChallenge } from './CompareObjects';
import { buildCompareItems } from './compareObjectsScript';
import { FAR_LEVER, GRID_LEVER, SLOTS_LEVER, STEPS_LEVER, compareObjectsLevers, farThree, leverFacts, orderSteps }
  from './compareObjectsLevers';

const obj = (name: string, visualSize: number, actualValue = visualSize) => ({ name, visualSize, actualValue });
const order = (attribute: CompareObjectsChallenge['attribute'], comparisonWord: CompareObjectsChallenge['comparisonWord'],
  objects: ReturnType<typeof obj>[]): CompareObjectsChallenge => {
  const greater = ['longer', 'taller', 'heavier', 'holds_more'].includes(comparisonWord);
  const answer = [...objects].sort((a, b) => greater ? b.actualValue - a.actualValue : a.actualValue - b.actualValue).map(o => o.name);
  return { id: `o-${attribute}-${comparisonWord}`, type: 'order_three', instruction: 'Order them.', hint: '', attribute, comparisonWord,
    objects, correctAnswer: answer.join(',') };
};
const itemOf = (c: CompareObjectsChallenge) => buildCompareItems([c], { band: '1' }).items[0];
const close = order('length', 'longer', [obj('pencil', 50), obj('ruler', 60), obj('crayon', 40)]);

describe('which lever comes next', () => {
  it.each([['reversed', STEPS_LEVER], ['not_all_placed', SLOTS_LEVER], ['two_swapped', GRID_LEVER], ['other_order', GRID_LEVER]])(
    'after %s: %s', (miss, lever) => {
      expect(nextLever(compareObjectsLevers(itemOf(close), close, []), miss)).toBe(lever);
    });
  it('after the grid, a swap opens the easier order; every order miss is answered', () => {
    const levers = compareObjectsLevers(itemOf(close), close, [GRID_LEVER]);
    expect(nextLever(levers, 'two_swapped')).toBe(FAR_LEVER);
    const answered = levers.flatMap(l => l.answers ?? []);
    for (const m of ['not_all_placed', 'reversed', 'two_swapped', 'other_order']) expect(answered).toContain(m);
  });
  it('weight gets no grid (the scales are the tool); far-apart sizes get no simplify; spoken kinds get no levers', () => {
    const weight = order('weight', 'heavier', [obj('apple', 50), obj('melon', 60), obj('grape', 40)]);
    const ids = compareObjectsLevers(itemOf(weight), weight, []).map(l => l.id);
    expect(ids).toEqual([STEPS_LEVER, SLOTS_LEVER, FAR_LEVER]);
    expect(compareObjectsLevers(itemOf(weight), weight, []).flatMap(l => l.answers ?? [])).toContain('two_swapped');
    const far = order('length', 'longer', [obj('pencil', 50), obj('ruler', 90), obj('crayon', 20)]);
    expect(compareObjectsLevers(itemOf(far), far, []).map(l => l.id)).not.toContain(FAR_LEVER);
    const two = buildCompareItems([{ id: 'c', type: 'compare_two', attribute: 'length', comparisonWord: 'longer', correctAnswer: 'pencil',
      objects: [obj('pencil', 80), obj('crayon', 40)] }], { band: '1' }).items[0];
    expect(compareObjectsLevers(two, null, [])).toEqual([]);
  });
});

describe('leak rules', () => {
  const cases: CompareObjectsChallenge[] = (['longer', 'shorter'] as const).map(w => order('length', w, close.objects))
    .concat((['taller', 'shorter_height'] as const).map(w => order('height', w, [obj('pine', 50), obj('bush', 40), obj('flower', 55)])))
    .concat((['heavier', 'lighter'] as const).map(w => order('weight', w, [obj('apple', 50), obj('melon', 60), obj('grape', 40)])))
    .concat((['holds_more', 'holds_less'] as const).map(w => order('capacity', w, [obj('mug', 50), obj('pot', 60), obj('bowl', 40)])));

  it.each(cases)('far_three on $attribute $comparisonWord: a real order item, its own id, no name of the item, far apart, same direction', c => {
    const item = itemOf(c);
    expect(item, 'the fixture passes the item gates').toBeTruthy();
    const easier = farThree(item, c)!;
    expect(easier).not.toBeNull();
    expect(easier.item).toMatchObject({ kind: 'order_three', attribute: c.attribute, comparisonWord: c.comparisonWord, id: `${c.id}~simpler` });
    expect(easier.item.objectNames.some(n => item.objectNames.includes(n))).toBe(false);
    const sizes = easier.challenge.objects.map(o => o.visualSize).sort((a, b) => a - b);
    expect(sizes[1] - sizes[0]).toBeGreaterThanOrEqual(25);
    expect(sizes[2] - sizes[1]).toBeGreaterThanOrEqual(25);
    // The drawing is never already in the answer order, either way round.
    expect(easier.item.objectNames).not.toEqual(easier.item.answerNames);
    expect(easier.item.objectNames).not.toEqual([...easier.item.answerNames].reverse());
  });

  it('order_steps follows the asked direction and draws heights only', () => {
    expect(orderSteps(itemOf(order('length', 'longer', close.objects)))).toEqual([30, 20, 10]);
    expect(orderSteps(itemOf(order('length', 'shorter', close.objects)))).toEqual([10, 20, 30]);
  });

  it('the scene facts never name an object', () => {
    const item = itemOf(close);
    const facts = leverFacts(item, [STEPS_LEVER, SLOTS_LEVER, GRID_LEVER], 2);
    expect(facts).toMatch(/2 of 3 filled/);
    for (const n of item.objectNames) expect(facts).not.toContain(n);
  });
});
