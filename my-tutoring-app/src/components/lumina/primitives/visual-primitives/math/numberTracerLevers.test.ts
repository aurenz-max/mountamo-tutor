import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { NumberTracerChallenge } from './NumberTracer';
import { getDigitPaths } from './numberTracerPaths';
import {
  ARROWS_LEVER, COUNT_DOTS_LEVER, COUNT_ON_LEVER, DOTS_LEVER, FIRST_PART_LEVER, GHOST_LEVER, MODEL_STROKES_LEVER, ONE_DIGIT_LEVER,
  SEQUENCE_UNANSWERED, TRACE_PART_LEVER, countDots, countDotsLeak, countOnRun, firstPart, firstPartLeaks, leverFacts,
  leverIdsFor, numberTracerLevers, oneDigit, runLeaks, startingLevers, tracePart,
} from './numberTracerLevers';

const item = (type: NumberTracerChallenge['type'], digit: number, extra: Partial<NumberTracerChallenge> = {}): NumberTracerChallenge =>
  ({ id: 'c1', type, digit, instruction: `x ${digit}`, strokePaths: [], showModel: type === 'copy', showArrows: false, ...extra });
const seq = (run: number[], missingIndex: number) => item('sequence', run[missingIndex], { sequenceNumbers: run, missingIndex });
const MISSES = ['other_numeral', 'digits_swapped', 'not_readable', 'poorly_formed', 'part_left_out', 'shape_off'] as const;

describe('which levers an item declares', () => {
  it.each([
    [item('trace', 4), [GHOST_LEVER, DOTS_LEVER, ARROWS_LEVER, TRACE_PART_LEVER]],
    [item('copy', 3), [DOTS_LEVER, MODEL_STROKES_LEVER]],
    [item('copy', 14), [DOTS_LEVER, MODEL_STROKES_LEVER, ONE_DIGIT_LEVER]],
    [item('write', 5), [DOTS_LEVER, FIRST_PART_LEVER]],
    [item('write', 112), [DOTS_LEVER, FIRST_PART_LEVER, ONE_DIGIT_LEVER]],
    [seq([2, 3, 4, 5], 2), [COUNT_DOTS_LEVER, COUNT_ON_LEVER]],
    [seq([2, 3, 4, 5], 3), [COUNT_DOTS_LEVER]],
  ])('%#', (ch, ids) => { expect(leverIdsFor(ch)).toEqual(ids); });

  it('starts the tier\'s painted guides as pulled; never on write or sequence', () => {
    expect(startingLevers(item('trace', 2), { ghost: true, arrows: true, startDot: true })).toEqual([GHOST_LEVER, DOTS_LEVER, ARROWS_LEVER]);
    expect(startingLevers(item('copy', 2), { ghost: true, arrows: true, startDot: true })).toEqual([DOTS_LEVER]);
    expect(startingLevers(item('write', 2), { ghost: false, arrows: false, startDot: true })).toEqual([]);
    expect(startingLevers(seq([1, 2, 3], 1), { ghost: true, arrows: true, startDot: true })).toEqual([]);
  });
});

describe('every checked miss has a lever on every item (J12), except the sequence formation misses', () => {
  const items: NumberTracerChallenge[] = [
    ...Array.from({ length: 21 }, (_, d) => (['trace', 'copy', 'write'] as const).map(t => item(t, d))).flat(),
    item('write', 120), item('copy', 101),
    ...Array.from({ length: 17 }, (_, s) => [seq([s, s + 1, s + 2, s + 3], 1), seq([s, s + 1, s + 2, s + 3], 2)]).flat(),
  ];
  it.each(items.map(ch => [`${ch.type} ${ch.sequenceNumbers?.join(',') ?? ch.digit}`, ch] as const))('%s', (_n, ch) => {
    // Tier easy: every help guide the tier can start is already pulled.
    const pulled = startingLevers(ch, { ghost: true, arrows: true, startDot: true });
    const levers = numberTracerLevers(ch, pulled);
    for (const miss of MISSES) {
      if (ch.type === 'sequence' && SEQUENCE_UNANSWERED.includes(miss)) continue;
      expect(levers.some(l => l.answers?.includes(miss)), `${miss}`).toBe(true);
    }
  });
});

describe('next lever after a miss', () => {
  it.each([
    [item('trace', 4), 'shape_off', GHOST_LEVER, []],
    [item('trace', 4), 'poorly_formed', DOTS_LEVER, [GHOST_LEVER]],
    [item('trace', 4), 'part_left_out', ARROWS_LEVER, [GHOST_LEVER]],
    [item('trace', 4), 'not_readable', TRACE_PART_LEVER, [GHOST_LEVER, DOTS_LEVER, ARROWS_LEVER]],
    [item('copy', 3), 'part_left_out', MODEL_STROKES_LEVER, []],
    [item('copy', 13), 'digits_swapped', DOTS_LEVER, []],
    [item('write', 5), 'part_left_out', FIRST_PART_LEVER, []],
    [item('write', 5), 'other_numeral', DOTS_LEVER, []],
    [seq([2, 3, 4, 5], 2), 'other_numeral', COUNT_DOTS_LEVER, []],
    [seq([12, 13, 14, 15], 2), 'digits_swapped', COUNT_ON_LEVER, []],
  ] as const)('%#: %s', (ch, miss, lever, pulled) => {
    expect(nextLever(numberTracerLevers(ch, pulled), miss)).toBe(lever);
  });
});

describe('leak rules', () => {
  it('first_part draws only the opening of the first stroke, never a third of the numeral', () => {
    for (let d = 0; d <= 120; d++) {
      const paths = getDigitPaths(d), part = firstPart(paths);
      expect(part.length, `${d}`).toBeGreaterThanOrEqual(2);
      expect(firstPartLeaks(paths, part), `${d}`).toBe(false);
    }
    const one = getDigitPaths(1);
    expect(firstPartLeaks(one, one[0])).toBe(true);
    expect(firstPartLeaks(one, one[1].slice(0, 2))).toBe(true);
  });

  it('count_dots puts dots under the shown numbers only, and only for runs up to 20', () => {
    for (let s = 0; s <= 17; s++) for (let gap = 0; gap < 4; gap++) {
      const ch = seq([s, s + 1, s + 2, s + 3], gap), rows = countDots(ch)!;
      expect(rows[gap]).toBeNull();
      expect(countDotsLeak(ch, rows)).toBe(false);
    }
    expect(countDotsLeak(seq([1, 2, 3], 1), [1, 2, 3])).toBe(true);
    expect(countDots(seq([19, 20, 21], 1))).toBeNull();
  });

  it('a sequence lever never names a number: facts and does carry no digit', () => {
    const ch = seq([5, 6, 7, 8], 2);
    expect(leverFacts(ch, [COUNT_DOTS_LEVER])).not.toMatch(/\d/);
    numberTracerLevers(ch, []).forEach(l => expect(`${l.when} ${l.does}`).not.toMatch(/\d/));
  });
});

describe('simplify builders', () => {
  it('trace_part: one stroke, or the first half of a one-stroke numeral; checked by geometry alone', () => {
    for (let d = 0; d <= 20; d++) {
      const ch = item('trace', d), part = tracePart(ch)!, full = getDigitPaths(d);
      expect(part.id).toBe('c1~simpler');
      expect(part).toMatchObject({ type: 'trace', strokePart: true });
      expect(part.strokePaths).toHaveLength(1);
      expect(part.strokePaths[0].length).toBeLessThan(full.flat().length);
      expect(part.strokePaths[0][0]).toEqual(full[0][0]);
    }
    expect(tracePart(item('copy', 3))).toBeNull();
  });

  it('one_digit: the first digit alone of a two- or three-digit number, never the number itself', () => {
    for (let d = 0; d <= 9; d++) expect(oneDigit(item('write', d))).toBeNull();
    for (let d = 10; d <= 120; d++) for (const t of ['copy', 'write'] as const) {
      const p = oneDigit(item(t, d))!;
      expect(p).toMatchObject({ id: 'c1~simpler', type: t, digit: Number(String(d)[0]), showModel: t === 'copy' });
      expect(p.digit).not.toBe(d);
      expect(p.instruction).toContain(String(p.digit));
    }
  });

  it('count_on_run: same length, gap last, never shows or asks the source answer, in band', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let n = 0; n < 400; n++) {
      const len = 3 + Math.floor(rnd() * 3), ceiling = rnd() < 0.5 ? 9 : 20;
      const start = Math.floor(rnd() * (ceiling - len + 2)), gap = 1 + Math.floor(rnd() * (len - 2));
      const run = Array.from({ length: len }, (_, k) => start + k), src = seq(run, gap);
      const p = countOnRun(src)!;
      expect(p, run.join(',')).toBeTruthy();
      expect(p.sequenceNumbers).toHaveLength(len);
      expect(p.missingIndex).toBe(len - 1);
      expect(p.digit).toBe(p.sequenceNumbers![len - 1]);
      p.sequenceNumbers!.slice(1).forEach((x, k) => expect(x).toBe(p.sequenceNumbers![k] + 1));
      expect(Math.max(...p.sequenceNumbers!)).toBeLessThanOrEqual(Math.max(9, ...run));
      expect(runLeaks(src, p)).toBe(false);
    }
    expect(countOnRun(seq([3, 4, 5], 2))).toBeNull();
  });
});
