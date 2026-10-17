import { describe, expect, it } from 'vitest';
import {
  DAY_DONE, SUN_TEST_PAIRS, buildSunTest, describeRead, pickSunTests, readFeedback, readMatches, readMiss,
  sunTestInstruction, thermoFill, thermoMarks, thingOn, warmthAt,
} from './ecosystemModel';

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('the sun test is a fair test the thermometers can settle', () => {
  it('every pair differs in exactly one way, and the variable names that way', () => {
    for (const p of SUN_TEST_PAIRS) {
      const diffs = (['kind', 'colour', 'place'] as const).filter(k => p.a[k] !== p.b[k]);
      expect(diffs, p.key).toHaveLength(1);
      expect({ kind: 'material', colour: 'colour', place: 'place' }[diffs[0]], p.key).toBe(p.variable);
    }
  });

  it('when the sun has crossed the sky, the warmer one reads at least one whole mark higher', () => {
    for (const p of SUN_TEST_PAIRS) {
      const fa = thermoFill(warmthAt(p.a, DAY_DONE)), fb = thermoFill(warmthAt(p.b, DAY_DONE));
      expect(Math.abs(fa - fb), p.key).toBeGreaterThanOrEqual(0.2);
      expect(thermoMarks(fa), p.key).not.toBe(thermoMarks(fb));
    }
  });

  it('the science holds: dark over light, sun over shade, sand over water', () => {
    for (const p of SUN_TEST_PAIRS) expect(warmthAt(p.a, 1), p.key).toBeGreaterThan(warmthAt(p.b, 1));
  });

  it('both thermometers start level, below the first mark, before the sun moves', () => {
    for (const p of SUN_TEST_PAIRS) {
      expect(thermoMarks(thermoFill(warmthAt(p.a, 0)))).toBe(0);
      expect(thermoMarks(thermoFill(warmthAt(p.b, 0)))).toBe(0);
    }
  });

  it('the red line climbs as the sun moves (it never visibly drops back)', () => {
    for (const p of SUN_TEST_PAIRS) for (const t of [p.a, p.b]) {
      let prev = 0;
      for (let i = 0; i <= 40; i++) {
        const f = thermoFill(warmthAt(t, i / 40));
        expect(f, `${t.name} at ${i / 40}`).toBeGreaterThanOrEqual(prev - 0.01);
        prev = Math.max(prev, f);
      }
    }
  });
});

describe('a session', () => {
  it('covers colour, place and material before repeating, never repeats a pair, and puts the warmer one on both sides', () => {
    for (let s = 1; s <= 40; s++) {
      const tests = pickSunTests(5, seeded(s));
      expect(tests).toHaveLength(5);
      expect(new Set(tests.slice(0, 3).map(t => t.variable)).size).toBe(3);
      expect(new Set(tests.map(t => `${t.left.name}|${t.right.name}`)).size).toBe(5);
      expect(new Set(tests.map(t => t.warmer)).size).toBe(2);
      expect(new Set(tests.map(t => t.id)).size).toBe(5);
    }
  });

  it('a shade thing stands in the hut and a sun thing on open sand on its own side', () => {
    const t = buildSunTest(SUN_TEST_PAIRS.find(p => p.key === 'sand-place')!, true, 'x');
    expect(t.left).toMatchObject({ place: 'shade', spot: 'hut' });
    expect(t.right).toMatchObject({ place: 'sun', spot: 'sunRight' });
    expect(t.warmer).toBe('right');
  });

  it('the ask names both things and the one difference, never the result', () => {
    for (const p of SUN_TEST_PAIRS) {
      const t = buildSunTest(p, false, 'x');
      expect(t.instruction).toBe(sunTestInstruction(t.left, t.right, t.variable));
      expect(t.instruction).not.toMatch(/warmer one is|gets? hotter|will be warmer/i);
    }
  });
});

describe('the check', () => {
  const t = buildSunTest(SUN_TEST_PAIRS[0], false, 'x'); // black paper left, white paper right

  it('reading the warmer one is correct; the cooler one is a named miss', () => {
    expect(readMatches(t, 'left')).toBe(true);
    expect(readMiss(t, 'left')).toBeUndefined();
    expect(readMiss(t, 'right')).toBe('picked_cooler');
  });

  it('the work in words carries the guess and the reading, and a miss never names the warmer one', () => {
    expect(describeRead(t, 'right', 'left')).toBe('Guessed the white paper would get warmer. After the sun crossed the sky, tapped the black paper as the one that got warmer');
    expect(readFeedback(t, 'right')).not.toContain(thingOn(t, 'left').name);
    expect(readFeedback(t, 'left')).toMatch(/^Yes! The red line by the black paper went up higher\./);
  });
});
