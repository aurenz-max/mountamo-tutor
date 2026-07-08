import { describe, expect, it } from 'vitest';
import { tapeDiagramOracle } from '../tape-diagram';

/**
 * Seeded-violation tests for the tape-diagram oracle. One clean fixture (trimmed
 * straight from a real /api/lumina/eval-test solve_part_whole generation) plus one
 * mutated fixture per implemented check class that MUST fire. Mirrors the
 * array-grid / comparison-builder blocks.
 */

// "within 100" topic → ceiling 100 on every magnitude; the real generation fits.
const ctx = { componentId: 'tape-diagram', evalMode: 'solve_part_whole', topic: 'Part-part-whole within 100', gradeLevel: 'grade 3' };
// Same data under a "within 20" ceiling → the Explore whole (12+15=27) breaks scope.
const scopeCtx = { componentId: 'tape-diagram', evalMode: 'solve_part_whole', topic: 'Part-part-whole within 20', gradeLevel: 'grade 3' };
const cmpCtx = { componentId: 'tape-diagram', evalMode: 'solve_comparison', topic: 'Comparison within 100', gradeLevel: 'grade 3' };

// ── Clean: trimmed from a real solve_part_whole grade-3 generation ──
const cleanPartWhole = {
  title: 'The Picnic Basket Challenge',
  description: 'Explore how smaller groups join to make a whole; add to find the total, subtract to find missing pieces.',
  challenges: [
    {
      id: 'td-1',
      challengeType: 'solve_part_whole',
      comparisonMode: false,
      showBrackets: true,
      bars: [{
        totalLabel: 'Total = 40',
        segments: [
          { value: 12, label: 'Red Apples' },
          { value: 15, label: 'Green Grapes' },
          { value: 8, label: 'Cheese Cubes', isUnknown: true },
          { value: 5, label: 'Juice Boxes', isUnknown: true },
        ],
      }],
    },
    {
      id: 'td-2',
      challengeType: 'solve_part_whole',
      comparisonMode: false,
      showBrackets: true,
      bars: [{
        totalLabel: 'Total = 20',
        segments: [
          { value: 8, label: 'Chocolate Chip Cookies' },
          { value: 5, label: 'Sugar Cookies' },
          { value: 4, label: 'Oatmeal Raisin Cookies', isUnknown: true },
          { value: 3, label: 'Peanut Butter Cookies', isUnknown: true },
        ],
      }],
    },
    {
      id: 'td-3',
      challengeType: 'solve_part_whole',
      comparisonMode: false,
      showBrackets: true,
      bars: [{
        totalLabel: 'Total = 40',
        segments: [
          { value: 12, label: 'Red Apples' },
          { value: 8, label: 'Green Apples' },
          { value: 15, label: 'Yellow Pears', isUnknown: true },
          { value: 5, label: 'Brown Pears', isUnknown: true },
        ],
      }],
    },
  ],
};

// ── Clean comparison fixture (real shape, distinct numbers per challenge) ──
const cleanComparison = {
  title: 'Beach Collections',
  description: 'Compare two collections and find the missing quantity.',
  challenges: [
    {
      id: 'td-1', challengeType: 'solve_comparison', comparisonMode: true, showBrackets: true,
      wordProblem: 'Liam collected 15 shells. Chloe collected 9. How many more did Liam collect?',
      bars: [
        { totalLabel: "Liam's shells", segments: [{ value: 9, label: "matching Chloe's shells" }, { value: 6, label: 'difference', isUnknown: true }] },
        { totalLabel: "Chloe's shells", segments: [{ value: 9, label: "Chloe's shells" }] },
      ],
      comparisonData: { quantity1: 15, quantity2: 9, difference: 6, comparisonWord: 'more', unknownPart: 'difference' },
    },
    {
      id: 'td-2', challengeType: 'solve_comparison', comparisonMode: true, showBrackets: true,
      wordProblem: 'Sam has 20 stickers, 8 more than Maya. How many does Maya have?',
      bars: [
        { totalLabel: "Sam's stickers", segments: [{ value: 20, label: "Sam's stickers" }] },
        { totalLabel: "Maya's stickers", segments: [{ value: 12, label: "Maya's stickers", isUnknown: true }] },
      ],
      comparisonData: { quantity1: 20, quantity2: 12, difference: 8, comparisonWord: 'more', unknownPart: 'quantity2' },
    },
    {
      id: 'td-3', challengeType: 'solve_comparison', comparisonMode: true, showBrackets: true,
      wordProblem: 'Ana read 11 more books than Ben, who read 7. How many did Ana read?',
      bars: [
        { totalLabel: "Ana's books", segments: [{ value: 18, label: "Ana's books", isUnknown: true }] },
        { totalLabel: "Ben's books", segments: [{ value: 7, label: "Ben's books" }] },
      ],
      comparisonData: { quantity1: 18, quantity2: 7, difference: 11, comparisonWord: 'more', unknownPart: 'quantity1' },
    },
  ],
};

// deep clone so mutations don't leak between tests
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

describe('tape-diagram oracle', () => {
  it('passes clean solve_part_whole data', () => {
    expect(tapeDiagramOracle.verify(clone(cleanPartWhole), ctx).violations).toEqual([]);
  });

  it('passes clean solve_comparison data', () => {
    expect(tapeDiagramOracle.verify(clone(cleanComparison), cmpCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — stored totalLabel disagrees with parts-sum-to-whole', () => {
    const data = clone(cleanPartWhole);
    data.challenges[0].bars[0].totalLabel = 'Total = 99'; // segments sum to 40
    const v = tapeDiagramOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'td-1.bar0')).toBe(true);
  });

  it('flags answer-key-desync — comparison difference ≠ quantity1 − quantity2', () => {
    const data = clone(cleanComparison);
    data.challenges[0].comparisonData.difference = 5; // should be 15 − 9 = 6
    const v = tapeDiagramOracle.verify(data, cmpCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'td-1')).toBe(true);
  });

  it('flags answer-key-desync — unknown segment value disagrees with comparisonData', () => {
    const data = clone(cleanComparison);
    data.challenges[0].bars[0].segments[1].value = 99; // unknown "difference" should be 6
    const v = tapeDiagramOracle.verify(data, cmpCtx).violations;
    // both the totalLabel-sum path and the unknownPart path can fire; require the desync class
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'td-1')).toBe(true);
  });

  it('flags answer-key-desync — a challenge with no unknown segment (nothing to grade)', () => {
    const data = clone(cleanPartWhole);
    data.challenges[0].bars[0].segments.forEach((s: { isUnknown?: boolean }) => { delete s.isUnknown; });
    const v = tapeDiagramOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'td-1' && /no unknown/.test(x.detail))).toBe(true);
  });

  it('flags answer-key-desync — an unknown segment missing its value (unreachable correct state)', () => {
    const data = clone(cleanPartWhole);
    delete (data.challenges[0].bars[0].segments[2] as { value?: number }).value;
    const v = tapeDiagramOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'td-1.bar0.seg2')).toBe(true);
  });

  it('flags scope — a magnitude exceeds the topic ceiling (the "within 20" whole is 27)', () => {
    const v = tapeDiagramOracle.verify(clone(cleanPartWhole), scopeCtx).violations;
    expect(v.some((x) => x.check === 'scope')).toBe(true);
  });

  it('flags clustering — an exact-duplicate diagram card', () => {
    const data = clone(cleanPartWhole);
    data.challenges.push(clone(cleanPartWhole.challenges[0])); // byte-identical to td-1
    const v = tapeDiagramOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('flags clustering — every challenge shares the same whole (4+ set)', () => {
    // 4 distinct partitions that all total 40 → whole never spreads, but no dup card.
    const mk = (id: string, a: number, b: number, u1: number, u2: number) => ({
      id, challengeType: 'solve_part_whole', comparisonMode: false, showBrackets: true,
      bars: [{ totalLabel: `Total = ${a + b + u1 + u2}`, segments: [
        { value: a, label: 'p1' }, { value: b, label: 'p2' },
        { value: u1, label: 'u1', isUnknown: true }, { value: u2, label: 'u2', isUnknown: true },
      ] }],
    });
    const data = { title: 't', description: 'd', challenges: [
      mk('a', 10, 10, 15, 5), mk('b', 12, 8, 14, 6), mk('c', 11, 9, 13, 7), mk('d', 13, 7, 12, 8),
    ] };
    const v = tapeDiagramOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'clustering' && /cluster/.test(x.detail))).toBe(true);
  });

  it('flags schema — a demo-sized set (fewer than 3 challenges)', () => {
    const data = clone(cleanPartWhole);
    data.challenges = [data.challenges[0]];
    const v = tapeDiagramOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });

  it('flags schema — a single-segment bar in a partition mode', () => {
    const data = clone(cleanPartWhole);
    data.challenges[0].bars[0].segments = [{ value: 40, label: 'only one', isUnknown: true }];
    const v = tapeDiagramOracle.verify(data, ctx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'td-1')).toBe(true);
  });
});
