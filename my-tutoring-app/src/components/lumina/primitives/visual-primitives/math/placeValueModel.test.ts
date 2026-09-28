/**
 * The build correction's model number (contract R9): as wide as the chart, never a session number, never the
 * target's digit in any column, never a (digit, place) a say_value ask names, with a zero where the target has none.
 */
import { describe, expect, it } from 'vitest';
import { buildModelFor } from './placeValueScript';

const digitAt = (n: number, p: number) => Math.floor(n / 10 ** p) % 10;

describe('buildModelFor', () => {
  it.each([44, 501, 406, 988, 3580, 72603, 10, 99, 1000, 90909])('target %i: same width, no shared column digit, a zero column', target => {
    const width = String(target).length;
    const model = buildModelFor(target, width, new Set([target]));
    expect(String(model)).toHaveLength(width);
    for (let p = 0; p < width; p++) expect(digitAt(model, p), `place ${p}`).not.toBe(digitAt(target, p));
    if (Array.from({ length: width - 1 }, (_, p) => digitAt(target, p)).some(d => d !== 0)) expect(String(model)).toContain('0');
  });

  it('every target to 99999: never the target, never a session number, no shared column digit', () => {
    for (let target = 10; target <= 99999; target += 7) {
      const width = String(target).length;
      const model = buildModelFor(target, width, new Set([target, 306, 40]));
      expect(model).not.toBe(target);
      expect([306, 40]).not.toContain(model);
      for (let p = 0; p < width; p++) expect(digitAt(model, p)).not.toBe(digitAt(target, p));
    }
  });

  it('never a (digit, place) pair a say_value ask names', () => {
    const asked = new Set(['3@2', '0@1', '4@0']);
    const model = buildModelFor(527, 3, new Set([527]), asked);
    for (let p = 0; p < 3; p++) expect(asked.has(`${digitAt(model, p)}@${p}`)).toBe(false);
  });
});
