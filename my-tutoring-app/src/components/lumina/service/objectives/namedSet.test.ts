import { describe, expect, it } from 'vitest';
import { namedSetFromObjective } from './namedSet';

/**
 * The named-set extractor is CODE, so its vocabulary is pinned here. Every
 * case below is an objective text a real package on disk carried (KC-1,
 * DSP-1, items 20–24) or a near neighbour.
 */
describe('namedSetFromObjective', () => {
  it('finds both symbols in the KC-1 objective, in text order', () => {
    const set = namedSetFromObjective('Identify the minus sign and the equals sign in a simple take-away sentence');
    expect(set).toEqual(expect.objectContaining({ kind: 'symbol', elements: ['−', '='] }));
  });

  it('reads bare glyphs when a sign/symbol word is present ("+ and = as math symbols")', () => {
    const set = namedSetFromObjective('Recognize + and = as math symbols');
    expect(set?.kind).toBe('symbol');
    expect(set?.elements).toEqual(['+', '=']);
  });

  it('does not read a bare glyph without a sign/symbol word', () => {
    expect(namedSetFromObjective('Solve 3 + 1 within five')).toBeNull();
  });

  it('enumerates letters ("letters s, a, t, p, i, n" and "the letter m")', () => {
    expect(namedSetFromObjective('Review letters p, n, i and their sounds')?.elements).toEqual(['p', 'n', 'i']);
    expect(namedSetFromObjective('Identify the letter m in print')).toEqual(
      expect.objectContaining({ kind: 'letter', elements: ['m'] }),
    );
  });

  it('does not mistake "letter sounds" for a letter set', () => {
    expect(namedSetFromObjective('Match letter sounds to pictures')).toBeNull();
  });

  it('enumerates shapes, singular, deduplicated', () => {
    const set = namedSetFromObjective('Find circles, squares and triangles in the classroom; name each triangle');
    expect(set).toEqual(expect.objectContaining({ kind: 'shape', elements: ['circle', 'square', 'triangle'] }));
  });

  it('expands a numeral range up to ten elements and refuses a scope-sized one', () => {
    expect(namedSetFromObjective('Recognize and name the written numbers 1 through 10 in order')?.elements)
      .toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(namedSetFromObjective('Count forward from any number 1 to 100')).toBeNull();
  });

  it('returns null for an objective that names nothing enumerable', () => {
    expect(namedSetFromObjective('Demonstrate taking away objects from a small group to see what remains')).toBeNull();
    expect(namedSetFromObjective('')).toBeNull();
  });
});
