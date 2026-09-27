import { describe, expect, it } from 'vitest';
import type { FractionCirclesChallenge } from './FractionCircles';
import {
  COUNT_LEVER, OVERLAY_LEVER, PIECES_LEVER, SPLIT_LEVER, FRAME_LEVER,
  doubleSplit, farPair, fewerPieces, fractionLevers, leverFacts, leverTextLeaks, simplerItem, splitFactor, startLevers, unitBuild,
} from './fractionCirclesLevers';
import { buildFractionTouchItems, touchLevers, touchMatches, twoPictureItem } from './fractionCirclesWorkspace';

const BANDS = { 'K-2': [2, 3, 4], '3-5': [2, 3, 4, 5, 6, 8, 10, 12] } as const;
const base = { instruction: 'x', hint: 'h', narration: '' };
const same = (a: number, b: number, c: number, d: number) => a * d === b * c;
/** Every proper fraction a band can draw. */
const fractions = (band: keyof typeof BANDS) => BANDS[band].flatMap(d => Array.from({ length: d - 1 }, (_, i) => [i + 1, d] as const));

describe('help levers state no answer', () => {
  it.each(['identify', 'build', 'compare', 'equivalent'] as const)('%s: no lever text or scene fact carries a digit', type => {
    const ch: FractionCirclesChallenge = { ...base, id: 'c', type, numerator: 3, denominator: 4,
      compareFraction: { numerator: 2, denominator: 3 }, equivalentDenominator: 8 };
    const levers = fractionLevers(ch, [], '3-5');
    expect(levers.length).toBeGreaterThan(0);
    for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`), l.id).toBe(false);
    const facts = leverFacts(ch, levers.map(l => l.id)).join(' ');
    expect(leverTextLeaks(facts)).toBe(false);
  });
  it('split_reference is offered only when each reference slice splits into a whole number', () => {
    const eq = (d: number, e: number): FractionCirclesChallenge => ({ ...base, id: 'e', type: 'equivalent', numerator: 1, denominator: d, equivalentDenominator: e });
    expect(splitFactor(eq(2, 6))).toBe(3);
    expect(splitFactor(eq(4, 6))).toBeNull();
    expect(fractionLevers(eq(4, 6), []).map(l => l.id)).not.toContain(SPLIT_LEVER);
  });
  it('the running count starts from the tier and mark_pieces only from easy identify', () => {
    const build: FractionCirclesChallenge = { ...base, id: 'b', type: 'build', numerator: 2, denominator: 4 };
    expect(startLevers(build)).toEqual([COUNT_LEVER]);
    expect(startLevers({ ...build, showWorkingCount: false })).toEqual([]);
    const identify: FractionCirclesChallenge = { ...base, id: 'i', type: 'identify', numerator: 2, denominator: 4 };
    expect(startLevers(identify)).toEqual([]);
    expect(startLevers({ ...identify, startLevers: [PIECES_LEVER, 'anything'] })).toEqual([PIECES_LEVER]);
  });
  it('identify and build share the part-whole frame; compare offers the overlay', () => {
    const at = (type: FractionCirclesChallenge['type']) => fractionLevers({ ...base, id: 'x', type, numerator: 1, denominator: 3,
      compareFraction: { numerator: 1, denominator: 2 } }, []).map(l => l.id);
    expect(at('identify')).toContain(FRAME_LEVER);
    expect(at('build')).toContain(FRAME_LEVER);
    expect(at('compare')).toContain(OVERLAY_LEVER);
  });
});

describe('simplify builders: same mode, in band, solvable, never the learner item', () => {
  for (const band of ['K-2', '3-5'] as const) {
    it(`identify fewer_pieces (${band})`, () => {
      for (const [n, d] of fractions(band)) {
        const easier = fewerPieces({ ...base, id: 'i', type: 'identify', numerator: n, denominator: d });
        if (d <= 2) { expect(easier).toBeNull(); continue; }
        expect(easier!.type).toBe('identify');
        expect(easier!.denominator).toBeLessThan(d);
        expect(easier!.denominator).toBeLessThanOrEqual(4);
        expect(easier!.numerator).toBeGreaterThan(0);
        expect(easier!.numerator).toBeLessThan(easier!.denominator);
        expect(same(easier!.numerator, easier!.denominator, n, d)).toBe(false);
        expect(easier!.id).toBe('i~fewer');
      }
    });
    it(`build unit_build (${band})`, () => {
      for (const [n, d] of fractions(band)) {
        const easier = unitBuild({ ...base, id: 'b', type: 'build', numerator: n, denominator: d });
        if (n === 1) { expect(easier).toBeNull(); continue; }
        expect(easier).toMatchObject({ type: 'build', numerator: 1, denominator: d, id: 'b~unit' });
        expect(easier!.instruction).toBe(`Shade the circle to show 1/${d}.`);
      }
    });
    it(`equivalent double_split (${band})`, () => {
      const ceiling = Math.max(...BANDS[band]);
      for (const [n, d] of fractions(band)) for (const k of [2, 3, 4]) {
        if (d * k > ceiling) continue;
        const easier = doubleSplit({ ...base, id: 'e', type: 'equivalent', numerator: n, denominator: d, equivalentDenominator: d * k }, band);
        if (k === 2) { expect(easier).toBeNull(); continue; }
        if (!easier) continue;
        expect(easier.type).toBe('equivalent');
        expect(easier.equivalentDenominator).toBe(2 * easier.denominator);
        expect(easier.equivalentDenominator!).toBeLessThanOrEqual(ceiling);
        expect(same(easier.numerator, easier.denominator, n, d)).toBe(false);
        expect((easier.numerator * easier.equivalentDenominator!) % easier.denominator).toBe(0);
      }
    });
    it(`compare far_pair (${band})`, () => {
      const all = fractions(band);
      for (const [a, b] of all) for (const [c, d] of all) {
        if (same(a, b, c, d)) continue;
        const ch: FractionCirclesChallenge = { ...base, id: 'c', type: 'compare', numerator: a, denominator: b, compareFraction: { numerator: c, denominator: d } };
        const easier = farPair(ch, band);
        if (Math.abs(a / b - c / d) >= 0.4) { expect(easier).toBeNull(); continue; }
        expect(easier, `${a}/${b} vs ${c}/${d}`).not.toBeNull();
        const cf = easier!.compareFraction!;
        expect(Math.abs(easier!.numerator / easier!.denominator - cf.numerator / cf.denominator)).toBeGreaterThanOrEqual(0.4);
        expect((BANDS[band] as readonly number[]).includes(easier!.denominator) && (BANDS[band] as readonly number[]).includes(cf.denominator)).toBe(true);
        const repeats = same(easier!.numerator, easier!.denominator, a, b) && same(cf.numerator, cf.denominator, c, d)
          || same(easier!.numerator, easier!.denominator, c, d) && same(cf.numerator, cf.denominator, a, b);
        expect(repeats).toBe(false);
      }
    });
  }
  it('the builders are deterministic, so the journey can rebuild the easier item', () => {
    const ch: FractionCirclesChallenge = { ...base, id: 'b', type: 'build', numerator: 3, denominator: 8 };
    expect(simplerItem(ch, '3-5')).toEqual(simplerItem(ch, '3-5'));
  });
});

describe('touch_fraction two_pictures', () => {
  it('another fraction, two pictures, exactly one match, never the learner fraction', () => {
    for (const [n, d] of fractions('K-2')) {
      const [item] = buildFractionTouchItems([{ ...base, id: 't', type: 'touch_fraction', numerator: n, denominator: d }]);
      const easier = twoPictureItem(item)!;
      expect(easier.choices).toHaveLength(2);
      expect(easier.choices.filter(c => touchMatches(easier, c.id))).toHaveLength(1);
      expect(same(easier.numerator, easier.denominator, n, d)).toBe(false);
      expect(easier.choices[0].denominator).not.toBe(easier.choices[1].denominator);
      expect(twoPictureItem(item)).toEqual(easier);
      expect(touchLevers(item, []).map(l => l.id)).toEqual(['two_pictures']);
      expect(touchLevers(easier, [])).toEqual([]);
    }
  });
});
