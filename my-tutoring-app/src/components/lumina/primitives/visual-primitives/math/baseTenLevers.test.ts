/**
 * The base-ten-blocks build_number levers (handoff 21 M1): which lever answers which miss, and each lever's leak rule,
 * on the saved generated payload and on every number the build mode can ask.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { BRACKET_LEVER, COUNTS_LEVER, PLAINER_LEVER, TOTAL_LEVER, baseTenLevers, bracketColumns, leverFacts, plainerNumber,
  startLevers } from './baseTenLevers';

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
  it('only build_number declares levers', () => {
    for (const type of ['add_with_blocks', 'subtract_with_blocks', 'read_blocks', 'regroup'])
      expect(baseTenLevers({ type, targetNumber: 24 }, [])).toEqual([]);
    expect(startLevers('add_with_blocks', {})).toEqual([]);
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
    const facts = leverFacts([COUNTS_LEVER, TOTAL_LEVER, BRACKET_LEVER], []);
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
