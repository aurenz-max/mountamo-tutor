import { describe, expect, it } from 'vitest';
import type { EquationBuilderChallenge } from './EquationBuilder';
import { equationBuilderHarnessInputs, makeNMiss, referenceWays, sameWay, sentenceValue } from './equationBuilderWorkspace';
import { DOTS_LEVER, FRAME_LEVER, SMALLER_LEVER, makeNLevers, smallerMakeN } from './equationBuilderLevers';

const bank = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), '+', '-'];
const make = (target: number, ways = 1): EquationBuilderChallenge => ({ id: `m${target}`, type: 'make-n', target, ways,
  availableTiles: bank, instruction: `Make a number sentence that equals ${target}.` });
const row = (s: string) => s.split(' ');

describe('make-n check', () => {
  it('reads number (sign number)+ left to right, and nothing else', () => {
    expect(sentenceValue(row('4 + 6'))).toBe(10);
    expect(sentenceValue(row('12 - 2'))).toBe(10);
    expect(sentenceValue(row('2 + 3 + 5'))).toBe(10);
    expect(sentenceValue(row('12 − 2'))).toBe(10);
    for (const bad of ['10', '4 +', '+ 4', '4 6', '4 + + 6', '4 = 6']) expect(sentenceValue(row(bad)), bad).toBeNull();
  });

  it('names the miss: one off, far off, malformed, the total alone, the same way again', () => {
    expect(makeNMiss(10, row('4 + 6'))).toBeUndefined();
    expect(makeNMiss(10, row('5 + 5'))).toBeUndefined();
    expect(makeNMiss(10, row('4 + 5'))).toBe('one_short');
    expect(makeNMiss(10, row('4 + 7'))).toBe('one_over');
    expect(makeNMiss(10, row('2 + 3'))).toBe('short_by_more');
    expect(makeNMiss(10, row('9 + 9'))).toBe('over_by_more');
    expect(makeNMiss(10, row('4 +'))).toBe('unfinished_sentence');
    expect(makeNMiss(10, row('10'))).toBe('bare_number');
    expect(makeNMiss(10, row('7'))).toBe('bare_number');
    expect(makeNMiss(10, row('6 + 4'), [row('4 + 6')])).toBe('same_way');
    expect(makeNMiss(10, row('12 - 2'), [row('4 + 6')])).toBeUndefined();
    expect(sameWay(row('1 + 2 + 7'), row('7 + 1 + 2'))).toBe(true);
    expect(sameWay(row('12 - 2'), row('11 - 1'))).toBe(false);
  });

  it('the harness and the adapter reach the total through the bank, as many ways as asked', () => {
    expect(referenceWays(make(10, 2))).toEqual([row('1 + 9'), row('1 + 1 + 8')]);
    expect(referenceWays({ ...make(10), availableTiles: ['10', '+'] })).toBeNull();
    expect(equationBuilderHarnessInputs(make(6), true).map(i => 'label' in i && i.label)).toEqual(['Tile 6', "I'm done!"]);
    expect(equationBuilderHarnessInputs(make(3, 2), false).map(i => 'label' in i && i.label)).toEqual(['Clear',
      'Tile 1', 'Tile +', 'Tile 2', "I'm done!", 'Tile 1', 'Tile +', 'Tile 1', 'Tile +', 'Tile 1', "I'm done!"]);
  });
});

describe('make-n levers', () => {
  it('help on a miss, simplify to about half with + only; each lever names the build and never a total', () => {
    const levers = makeNLevers(make(10), []);
    expect(levers.map(l => [l.id, l.kind])).toEqual([[DOTS_LEVER, 'help'], [FRAME_LEVER, 'help'], [SMALLER_LEVER, 'simplify']]);
    const answered = new Set(levers.flatMap(l => l.answers ?? []));
    for (const miss of ['bare_number', 'unfinished_sentence', 'one_short', 'one_over', 'short_by_more', 'over_by_more']) {
      expect(answered.has(miss), miss).toBe(true);
    }
    for (const l of levers) {
      expect(`${l.when} ${l.does}`, l.id).not.toMatch(/\d/);
      expect(l.does, l.id).not.toMatch(/hands? over|choose|pick/i);
    }
    expect(levers[0].does).toMatch(/Never the amount the sentence makes/);
    expect(makeNLevers(make(10), [DOTS_LEVER]).find(l => l.id === DOTS_LEVER)?.pulled).toBe(true);
    expect(makeNLevers({ ...make(10), type: 'build' }, [])).toEqual([]);
  });

  it('the easier item is half the total, one way, with only + and the numbers up to it', () => {
    expect(smallerMakeN(make(10, 2))).toEqual({ id: 'm10~smaller', type: 'make-n', target: 5, ways: 1,
      availableTiles: ['1', '2', '3', '4', '5', '+'], instruction: 'Make a number sentence that equals 5.' });
    expect(smallerMakeN(make(3))).toMatchObject({ target: 2, availableTiles: ['1', '2', '+'] });
    expect(smallerMakeN(make(2))).toBeNull();
    // No simplify lever where there is no smaller item.
    expect(makeNLevers(make(2), []).map(l => l.id)).not.toContain(SMALLER_LEVER);
  });
});
