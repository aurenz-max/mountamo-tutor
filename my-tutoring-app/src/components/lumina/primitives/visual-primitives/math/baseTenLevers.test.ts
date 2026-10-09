/**
 * The base-ten-blocks build_number levers (handoff 21 M1): which lever answers which miss, and each lever's leak rule,
 * on the saved generated payload and on every number the build mode can ask.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { BRACKET_LEVER, COUNTS_LEVER, PLAINER_LEVER, PLAINER_READ_LEVER, PRACTICE_SUFFIX, SIMPLER_OP_LEVER, SMALLER_LEVER, TEN_MODEL_LEVER,
  TOTAL_LEVER, TRADE_MARK_LEVER, baseTenLevers, bracketColumns, leverFacts, operateShape, plainerNumber, practiceFromId, practiceItem,
  simplerOperation, startLevers, tradeColumns } from './baseTenLevers';
import { buildAdditionOperands, buildSubtractionOperands } from './baseTenOperands';

const build = (targetNumber: number) => ({ type: 'build_number', targetNumber });
const reversed = (n: number) => Number(String(n).split('').reverse().join(''));

describe('which lever answers which miss', () => {
  it.each([
    ['one_short', COUNTS_LEVER], ['one_over', COUNTS_LEVER], ['one_ten_off', COUNTS_LEVER], ['digits_swapped', COUNTS_LEVER],
    ['short_by_more', TOTAL_LEVER], ['over_by_more', TOTAL_LEVER], ['not_traded_up', BRACKET_LEVER],
  ])('nothing pulled, fourteen ones on the mat, after %s: %s', (miss, lever) => {
    expect(nextLever(baseTenLevers(build(24), [], { tens: 1, ones: 14 }), miss)).toBe(lever);
  });
  it("ten_bracket is offered only while a column of the learner's holds ten or more", () => {
    expect(baseTenLevers(build(24), [], { tens: 2, ones: 5 }).map(l => l.id)).not.toContain(BRACKET_LEVER);
    expect(baseTenLevers(build(24), [], { tens: 1, ones: 14 }).map(l => l.id)).toContain(BRACKET_LEVER);
  });
  it('the untiered start (counts and total on): far off gets the plainer build', () => {
    const start = startLevers('build_number', {});
    expect(start).toEqual([COUNTS_LEVER, TOTAL_LEVER]);
    expect(nextLever(baseTenLevers(build(24), start), 'short_by_more')).toBe(PLAINER_LEVER);
    expect(nextLever(baseTenLevers(build(24), start, { tens: 1, ones: 14 }), 'not_traded_up', 'help')).toBe(BRACKET_LEVER);
    // No full column and both counting aids on: help has nothing open, so the ladder's help rung pulls nothing.
    expect(nextLever(baseTenLevers(build(24), start, { tens: 2, ones: 5 }), 'one_over', 'help')).toBeNull();
  });
  it.each([
    ['read_blocks', 'one_ten_off', TEN_MODEL_LEVER], ['read_blocks', 'digits_swapped', TEN_MODEL_LEVER],
    ['read_blocks', 'one_short', PLAINER_READ_LEVER], ['read_blocks', 'over_by_more', PLAINER_READ_LEVER],
    ['regroup', 'no_trade', TEN_MODEL_LEVER], ['regroup', 'value_changed', TEN_MODEL_LEVER],
  ])("the click mat's %s (a mixed payload), after %s: %s", (type, miss, lever) => {
    expect(nextLever(baseTenLevers({ type, targetNumber: 215 }, startLevers(type, {})), miss)).toBe(lever);
  });
  it('click-mat read_blocks and regroup start bare; regroup has no simplify (one trade is the smallest)', () => {
    expect(startLevers('read_blocks', {})).toEqual([]);
    expect(startLevers('regroup', {})).toEqual([]);
    expect(baseTenLevers({ type: 'regroup', targetNumber: 321 }, []).map(l => [l.id, l.kind])).toEqual([[TEN_MODEL_LEVER, 'help']]);
  });
  it('on the saved mixed payload every checked miss of the read and trade items has a lever on that item (J12)', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(),
      'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/base-ten-blocks.mixed.json'), 'utf-8')).data;
    const misses: Record<string, string[]> = { read_blocks: ['one_short', 'one_over', 'one_ten_off', 'digits_swapped', 'short_by_more', 'over_by_more'],
      regroup: ['no_trade', 'value_changed'] };
    for (const ch of data.challenges.filter((c: any) => misses[c.type])) {
      const levers = baseTenLevers(ch, startLevers(ch.type, ch));
      for (const miss of misses[ch.type]) expect(levers.some(l => l.answers?.includes(miss)), `${ch.type} ${miss}`).toBe(true);
    }
  });
});

describe('operate: which lever answers which miss', () => {
  const add = (first: number, second: number) => ({ type: 'add_with_blocks', targetNumber: first + second, secondNumber: second });
  const sub = (first: number, second: number) => ({ type: 'subtract_with_blocks', targetNumber: first - second, secondNumber: second });
  it('the total is never a lever, and the counts start where the tier puts them', () => {
    expect(startLevers('add_with_blocks', {})).toEqual([COUNTS_LEVER]);
    expect(startLevers('subtract_with_blocks', { showColumnCounts: false, showBlocksTotal: true })).toEqual([]);
    expect(baseTenLevers(add(148, 76), []).map(l => l.id)).not.toContain(TOTAL_LEVER);
  });
  it.each([
    ['one_short', COUNTS_LEVER], ['one_over', COUNTS_LEVER], ['one_ten_off', BRACKET_LEVER],
    ['short_by_more', SIMPLER_OP_LEVER], ['over_by_more', SIMPLER_OP_LEVER],
  ])('148 + 76 modelled untraded (a column of fourteen), nothing pulled, after %s: %s', (miss, lever) => {
    expect(nextLever(baseTenLevers(add(148, 76), [], { hundreds: 1, tens: 11, ones: 14 }), miss)).toBe(lever);
  });
  it('a lost carry with no full column on the mat gets the trade marks, then the simpler operation', () => {
    const start = startLevers('add_with_blocks', {});
    expect(nextLever(baseTenLevers(add(148, 76), start), 'one_ten_off')).toBe(TRADE_MARK_LEVER);
    expect(nextLever(baseTenLevers(add(148, 76), [...start, TRADE_MARK_LEVER]), 'one_ten_off')).toBe(SIMPLER_OP_LEVER);
  });
  it('a lost borrow on a one-trade subtraction, nothing modelled, gets the trade marks', () => {
    expect(nextLever(baseTenLevers(sub(73, 28), startLevers('subtract_with_blocks', {})), 'one_ten_off')).toBe(TRADE_MARK_LEVER);
  });
  it.each([
    [add(37, 25), ['ones']], [add(148, 76), ['ones', 'tens']], [sub(73, 28), ['ones']], [sub(412, 145), ['ones', 'tens']],
    [sub(400, 145), ['ones', 'tens']], [add(123, 456), []],
  ])('tradeColumns(%o) marks %o', (item, columns) => {
    expect(tradeColumns(item)).toEqual(columns);
  });
  it('an item with one trade offers no simpler operation (floor one)', () => {
    expect(simplerOperation(add(37, 25))).toBeNull();
    expect(simplerOperation(sub(73, 28))).toBeNull();
    expect(baseTenLevers(add(37, 25), []).map(l => l.id)).toEqual([COUNTS_LEVER, TRADE_MARK_LEVER]);
  });
});

describe('operate leak rules', () => {
  const cases = Array.from({ length: 400 }, (_, i) => {
    const places = 2 + (i % 3);
    const regroups = 2 + (i % Math.max(1, places - 1));
    const add = i % 2 === 0;
    const [first, second] = add ? buildAdditionOperands(places, Math.min(regroups, places - 1), false)
      : buildSubtractionOperands(places, Math.min(regroups, places - 1), false);
    return { type: add ? 'add_with_blocks' : 'subtract_with_blocks', targetNumber: add ? first + second : first - second, secondNumber: second };
  });
  it("single_regroup: one trade fewer, same places, M > S, never the item's operands or result, the same on every call", () => {
    let built = 0;
    for (const item of cases) {
      const shape = operateShape(item)!;
      const simpler = simplerOperation(item);
      if (shape.regroups < 2) { expect(simpler).toBeNull(); continue; }
      expect(simpler, JSON.stringify(item)).not.toBeNull();
      built++;
      const again = operateShape({ type: item.type, targetNumber: simpler!.targetNumber, secondNumber: simpler!.second })!;
      expect(again.regroups).toBe(Math.min(shape.regroups - 1, shape.places - 1));
      expect(again.regroups).toBeGreaterThanOrEqual(1);
      expect(again.places).toBe(shape.places);
      expect([simpler!.first, simpler!.second].sort()).not.toEqual([shape.first, shape.second].sort());
      expect(simpler!.targetNumber).not.toBe(item.targetNumber);
      if (item.type === 'subtract_with_blocks') expect(simpler!.first).toBeGreaterThan(simpler!.second);
      expect(simplerOperation(item)).toEqual(simpler);
    }
    expect(built).toBeGreaterThan(100);
  });
  it('trade_mark marks exactly one column per carry or borrow, by place name only (400 built items)', () => {
    for (const item of cases) {
      const marked = tradeColumns(item);
      expect(marked.length, JSON.stringify(item)).toBe(operateShape(item)!.regroups);
      for (const place of marked) expect(['ones', 'tens', 'hundreds', 'thousands']).toContain(place);
    }
  });
  it('on the saved operate payload every item, nothing modelled, has a lever for a lost carry or borrow (J12)', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(),
      'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/base-ten-blocks.operate.json'), 'utf-8')).data;
    for (const ch of data.challenges)
      expect(baseTenLevers(ch, startLevers(ch.type, ch)).some(l => !l.pulled && l.answers?.includes('one_ten_off')), ch.instruction).toBe(true);
  });
  it('no operate lever text carries a number', () => {
    for (const l of baseTenLevers({ type: 'add_with_blocks', targetNumber: 224, secondNumber: 76 }, [], { ones: 14 }))
      expect(`${l.when} ${l.does}`).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine)\b/i);
  });
  it('on the saved operate payload: the two-trade items offer the simpler operation', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(),
      'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/base-ten-blocks.operate.json'), 'utf-8')).data;
    const offers = data.challenges.map((ch: any) => baseTenLevers(ch, startLevers(ch.type, ch)).some(l => l.id === SIMPLER_OP_LEVER));
    expect(offers).toEqual(data.challenges.map((ch: any) => operateShape(ch)!.regroups >= 2));
    expect(offers.some(Boolean)).toBe(true);
  });
});

describe('leak rules', () => {
  const targets = Array.from({ length: 998 }, (_, i) => i + 2);
  it('plainer_build over every number to 999: same places, never the number or its reversal, no zero', () => {
    for (const t of targets) {
      const plain = plainerNumber(t);
      if (plain === null) continue;
      expect(String(plain).length, `${t}`).toBe(String(t).length);
      expect(plain, `${t}`).not.toBe(t);
      expect(plain, `${t}`).not.toBe(reversed(t));
      expect(String(plain), `${t}`).not.toContain('0');
    }
    expect(targets.filter(t => plainerNumber(t) === null).length).toBeLessThan(10);
  });

  it('ten_bracket draws only the learner\'s own columns holding ten or more', () => {
    expect(bracketColumns({ tens: 2, ones: 12 })).toEqual(['ones']);
    expect(bracketColumns({ hundreds: 1, tens: 3, ones: 4 })).toEqual([]);
  });

  it('no lever text or scene fact carries a number', () => {
    for (const l of baseTenLevers(build(87), [], { ones: 12 })) expect(`${l.when} ${l.does}`).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine)\b/i);
    for (const type of ['read_blocks', 'regroup']) for (const l of baseTenLevers({ type, targetNumber: 215 }, []))
      expect(`${l.when} ${l.does}`).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine)\b/i);
    const facts = leverFacts([COUNTS_LEVER, TOTAL_LEVER, BRACKET_LEVER, TEN_MODEL_LEVER, TRADE_MARK_LEVER], []);
    expect(facts).not.toMatch(/\d/);
    expect(leverFacts([COUNTS_LEVER, TOTAL_LEVER], [COUNTS_LEVER, TOTAL_LEVER])).toBe('');
  });

  it('on the saved build_number payload every item offers the plainer build, and a help lever once a ten is left untraded', () => {
    const data = JSON.parse(readFileSync(join(process.cwd(),
      'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/base-ten-blocks.build_number.json'), 'utf-8')).data;
    for (const ch of data.challenges) {
      const levers = baseTenLevers(ch, startLevers(ch.type, ch), { tens: 0, ones: 12 });
      expect(levers.some(l => l.id === PLAINER_LEVER), String(ch.targetNumber)).toBe(true);
      expect(levers.some(l => l.kind === 'help' && !l.pulled)).toBe(true);
    }
  });
});

describe('practice items', () => {
  const targets = Array.from({ length: 990 }, (_, i) => i + 10);
  it('plainer_read over every number 10-999: a read item of the same places, never the number or its reversal, same instruction', () => {
    let built = 0;
    for (const t of targets) {
      const item = { id: 'read_blocks-1', type: 'read_blocks', targetNumber: t, instruction: 'Count the blocks on the mat to find the total value.' };
      const p = practiceItem(item, PLAINER_READ_LEVER);
      if (!p) continue;
      built++;
      expect(p).toMatchObject({ id: 'read_blocks-1~plainer', type: 'read_blocks', instruction: item.instruction });
      expect(String(p.targetNumber).length, `${t}`).toBe(String(t).length);
      expect([t, reversed(t)], `${t}`).not.toContain(p.targetNumber);
    }
    expect(built).toBeGreaterThan(980);
  });
  it('each simplify lever builds only on its own type, and practiceFromId rebuilds the same item from the id', () => {
    const items = [
      { id: 'b-0', type: 'build_number', targetNumber: 87, instruction: 'Build the number 87 with blocks.' },
      { id: 'r-1', type: 'read_blocks', targetNumber: 215, instruction: 'Count the blocks.' },
      { id: 'o-2', type: 'add_with_blocks', targetNumber: 224, secondNumber: 76, instruction: 'Add 148 + 76 using blocks.' },
      { id: 'w-3', type: 'build_two_ways', targetNumber: 34, instruction: 'Show 34 with blocks.' },
    ];
    const built = items.map(ch => Object.keys(PRACTICE_SUFFIX).map(l => practiceItem(ch, l)).filter(Boolean));
    expect(built.map(b => b.length)).toEqual([1, 1, 1, 1]);
    expect(built.map(b => b[0]!.id)).toEqual(['b-0~plainer', 'r-1~plainer', 'o-2~simpler', 'w-3~smaller']);
    items.forEach((ch, i) => expect(practiceFromId(ch, built[i][0]!.id)).toEqual(built[i][0]));
    expect(practiceItem(items[1], PLAINER_LEVER)).toBeNull();
    expect(practiceItem(items[0], SMALLER_LEVER)).toBeNull();
  });
});
