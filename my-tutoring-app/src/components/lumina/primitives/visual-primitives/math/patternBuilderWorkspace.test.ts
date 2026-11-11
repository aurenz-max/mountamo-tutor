import { describe, expect, it } from 'vitest';
import { patternBuilderMiss, repeatKey, shownRow, type PatternBuilderView } from './patternBuilderWorkspace';
import { buildRowChallenge, rowShapesFor } from '../../../service/math/gemini-pattern-builder';
import { groupsFact, practiceItem, practiceLeaks } from './patternBuilderLevers';
import { validatePatternBuilderData } from './patternBuilder.boss';
import type { PatternBuilderChallenge } from './PatternBuilder';

// Row A B C A B C | hidden A B C; core A B C.
const data = { sequence: { given: ['A', 'B', 'C', 'A', 'B', 'C'], hidden: ['A', 'B', 'C'], core: ['A', 'B', 'C'], rule: null },
  tokens: { available: ['A', 'B', 'C'], type: 'shapes' as const }, translationTarget: { mapping: { a: 'x', b: 'y', c: 'z' } } };
const ch = (type: PatternBuilderChallenge['type']): PatternBuilderChallenge => ({ id: type, type, instruction: '', answer: '', hint: '', narration: '' });
const view = (v: Partial<PatternBuilderView>): PatternBuilderView => ({ extension: [], coreIndices: [], created: [], translated: [], ...v });
const ext = (...t: string[]) => view({ extension: t });
const growing = { ...data, sequence: { given: ['2', '4', '6'], hidden: ['8', '10'], core: [], rule: null } };

it.each([
  [data, ch('extend'), ext('A', 'B', 'C'), undefined], [data, ch('extend'), ext('A', 'B'), 'blanks_left'],
  [data, ch('extend'), ext('C', 'C', 'C'), 'repeated_last'], [data, ch('extend'), ext('A', 'C', 'B'), 'two_swapped'],
  [data, ch('extend'), ext('A', 'B', 'B'), 'one_wrong'], [data, ch('extend'), ext('B', 'C', 'A'), 'several_wrong'],
  [growing, ch('find_rule'), ext('2', '4'), 'started_over'], [growing, ch('find_rule'), ext('8', '12'), 'one_wrong'],
  [data, ch('translate'), view({ translated: ['x', 'y', 'z', 'x', 'y', 'x'] }), 'one_wrong'],
  [data, ch('translate'), view({ translated: ['x', 'y', 'z', 'x', 'y', 'z', 'x'] }), 'extra_tokens'],
  [data, ch('identify_core'), view({ coreIndices: [0, 1, 2] }), undefined], [data, ch('identify_core'), view({ coreIndices: [0, 1, 2, 3, 4, 5] }), 'two_repeats'],
  [data, ch('identify_core'), view({ coreIndices: [0, 1, 2, 3] }), 'too_long'], [data, ch('identify_core'), view({ coreIndices: [0, 1] }), 'too_short'],
  [data, ch('identify_core'), view({ coreIndices: [1, 2, 3] }), 'other_part'],
  [data, ch('create'), view({ created: ['A', 'B', 'A'] }), 'too_short'], [data, ch('create'), view({ created: ['A', 'B', 'B', 'A'] }), 'no_repeat'],
  [data, ch('create'), view({ created: ['A', 'B', 'A', 'B'] }), undefined],
] as const)('row %#', (d, c, v, miss) => {
  expect(patternBuilderMiss(d, c, v)).toBe(miss);
});

it('the generator keys a repeating row from its shown tokens: AAB shown twice continues A A, not A B', () => {
  expect(repeatKey(['r', 'r', 'b', 'r', 'r', 'b'], 2)).toEqual({ core: ['r', 'r', 'b'], hidden: ['r', 'r'] });
  expect(repeatKey(['r', 'b', 'g', 'r', 'b', 'g', 'r'], 3)).toEqual({ core: ['r', 'b', 'g'], hidden: ['b', 'g', 'r'] });
  expect(repeatKey(['r', 'b', 'g', 'r', 'b'], 3)).toBeNull(); // under two whole repeats: the LLM key stands
  expect(repeatKey(['2', '4', '6', '8'], 2)).toBeNull();
  expect(repeatKey(['r', 'r', 'r', 'r'], 2)).toBeNull();
});

describe('copy and fill_gap rows are code-built (PTRN001-01-B, -E)', () => {
  const pool = ['red', 'blue', 'green', 'yellow'];
  it('copy: the shape repeated, the palette its tokens and one more, the key the whole row', () => {
    expect(rowShapesFor(5)).toEqual(['AB', 'AB', 'ABB', 'AAB', 'ABC']);
    const c = buildRowChallenge('copy', 'AB', pool, 0)!;
    expect(c.sequence!.given).toEqual(['red', 'blue', 'red', 'blue', 'red', 'blue']);
    expect([...c.availableTokens!].sort()).toEqual(['blue', 'green', 'red']);
    const d = { ...data, title: "Patterns", challenges: [c] };
    expect(patternBuilderMiss(d, c, view({ copied: c.sequence!.given }))).toBeUndefined();
    expect(patternBuilderMiss(d, c, view({ copied: ['red', 'blue', 'red', 'blue'] }))).toBe('blanks_left');
    expect(() => validatePatternBuilderData(d)).not.toThrow();
  });
  it('fill_gap: over 300 rows, the gap is inside (after the first repeat, before the last token), every token of the pattern is offered in a varied order, and copying a neighbour is wrong where the shape allows', () => {
    const at = new Set<number>(), firsts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const shape = rowShapesFor(5)[i % 5];
      const c = buildRowChallenge('fill_gap', shape, pool, i)!;
      const g = c.gapIndex!, given = c.sequence!.given, key = c.sequence!.hidden[0];
      expect(g).toBeGreaterThanOrEqual(shape.length);
      expect(g).toBeLessThan(given.length - 1);
      expect(given[g]).toBe(key);
      for (const t of Array.from(new Set(given))) expect(c.availableTokens).toContain(t);
      expect(c.availableTokens!.length).toBe(new Set(given).size + 1);
      // A, B, C shapes always have a place whose neighbours are both other tokens; AAB and ABB put the gap on the odd one.
      expect([given[g - 1], given[g + 1]]).not.toContain(key);
      if (shape === 'AB') at.add(g);
      firsts.add(c.availableTokens![0]);
      const d = { ...data, title: "Patterns", challenges: [c] };
      expect(() => validatePatternBuilderData(d)).not.toThrow();
      expect(patternBuilderMiss(d, c, ext(given[g - 1]))).toBe('copied_neighbour');
      expect(patternBuilderMiss(d, c, ext(key))).toBeUndefined();
      // The tutor's row and the lever's groups never carry the gap's token at the gap.
      expect(shownRow(d, c)[g]).toBe('?');
      expect(groupsFact(d, c, shape.length)).not.toContain(given.join(', '));
    }
    expect(at.size).toBeGreaterThan(1);
    expect(firsts.size).toBeGreaterThan(1);
  });
  it('the simpler rows: A B in other tokens for copy, one gap in the middle for fill_gap; none on an item already plainest', () => {
    const c = buildRowChallenge('copy', 'ABC', pool, 0)!;
    const g = buildRowChallenge('fill_gap', 'ABB', pool, 0)!;
    const d = { ...data, challenges: [c, g] };
    const pc = practiceItem(c, d)!, pg = practiceItem(g, d)!;
    expect(pc.sequence!.given).toHaveLength(4);
    expect(pg).toMatchObject({ type: 'fill_gap', gapIndex: 3 });
    expect(practiceLeaks(pc, c, d) || practiceLeaks(pg, g, d)).toBe(false);
    expect(practiceItem(pc, d)).toBeNull();
  });
});
