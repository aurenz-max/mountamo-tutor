import { describe, expect, it } from 'vitest';
import type { FractionCirclesChallenge } from './FractionCircles';
import {
  COUNT_LEVER, OVERLAY_LEVER, PIECES_LEVER, SPLIT_LEVER, FRAME_LEVER,
  doubleSplit, farPair, fewerPieces, fractionLevers, fractionMiss, leverFacts, leverTextLeaks, simplerItem, splitFactor, startLevers, unitBuild,
} from './fractionCirclesLevers';
import { buildFractionTouchItems, touchLevers, touchMatches, touchMiss, twoPictureItem } from './fractionCirclesWorkspace';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

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

describe('what a wrong Check shows, and the lever that answers it (code, not a Live run)', () => {
  const ch = (type: FractionCirclesChallenge['type'], numerator: number, denominator: number, extra: Partial<FractionCirclesChallenge> = {}):
    FractionCirclesChallenge => ({ ...base, id: `${type}-${numerator}-${denominator}`, type, numerator, denominator, ...extra });
  const identify = ch('identify', 3, 8), build = ch('build', 2, 6), halfOfSix = ch('build', 3, 6);
  const equivalent = ch('equivalent', 2, 3, { equivalentDenominator: 6 });
  const compare = ch('compare', 1, 4, { compareFraction: { numerator: 1, denominator: 2 } });
  const equal = ch('compare', 2, 4, { compareFraction: { numerator: 1, denominator: 2 } });
  const work = (w: Partial<{ typed: string; shaded: number; choice: string }>) => ({ typed: '', shaded: 0, choice: '', ...w });
  it.each([
    [identify, { typed: '3/8' }, undefined], [identify, { typed: '6/16' }, undefined], [identify, { typed: 'three' }, 'not_a_fraction'],
    [identify, { typed: '8/3' }, 'swapped'], [identify, { typed: '3/7' }, 'bottom_not_pieces'], [identify, { typed: '5/8' }, 'top_is_unshaded'],
    [identify, { typed: '4/8' }, 'top_one_off'], [identify, { typed: '1/8' }, 'top_off_by_more'],
    [build, { shaded: 2 }, undefined], [build, { shaded: 6 }, 'shaded_all'], [build, { shaded: 4 }, 'shaded_the_rest'],
    [build, { shaded: 1 }, 'one_short'], [build, { shaded: 3 }, 'one_over'], [build, { shaded: 0 }, 'short_by_more'],
    [build, { shaded: 5 }, 'over_by_more'], [halfOfSix, { shaded: 4 }, 'one_over'],
    [equivalent, { shaded: 4 }, undefined], [equivalent, { shaded: 2 }, 'copied_the_count'], [equivalent, { shaded: 3 }, 'one_short'],
    [equivalent, { shaded: 5 }, 'one_over'], [equivalent, { shaded: 6 }, 'over_by_more'], [equivalent, { shaded: 0 }, 'short_by_more'],
    [compare, { choice: 'right' }, undefined], [compare, { choice: 'left' }, 'picked_more_slices'], [compare, { choice: 'equal' }, 'said_equal'],
    [ch('compare', 3, 4, { compareFraction: { numerator: 1, denominator: 4 } }), { choice: 'right' }, 'picked_smaller'],
    [equal, { choice: 'equal' }, undefined], [equal, { choice: 'left' }, 'missed_equal'],
  ] as const)('%#: %o -> %s', (item, w, miss) => {
    expect(fractionMiss(item, work(w))).toBe(miss);
  });

  it('touch_fraction names the kind of picture touched, never which one', () => {
    const [item] = buildFractionTouchItems([{ ...base, id: 't', type: 'touch_fraction', numerator: 1, denominator: 3 }], () => 0.5);
    for (const picture of item.choices) {
      const expected = picture.id === item.correctChoiceId ? undefined : picture.denominator === 3 ? 'same_parts_other_shading'
        : picture.numerator === 1 ? 'same_shading_other_parts' : 'other_fraction';
      expect(touchMiss(item, picture.id)).toBe(expected);
    }
    expect(nextLever(touchLevers(item, []), 'same_parts_other_shading')).toBe('two_pictures');
  });

  const levers = (item: FractionCirclesChallenge, pulled: string[] = []) => fractionLevers(item, pulled, '3-5');
  // Four times the slices, so both the reference split and the easier double split are offered.
  const eighths = ch('equivalent', 1, 2, { equivalentDenominator: 8 });
  it.each([
    [identify, [], 'top_one_off', 'mark_pieces'], [identify, [], 'bottom_not_pieces', 'mark_pieces'],
    [identify, [], 'swapped', 'part_whole'], [identify, [], 'top_is_unshaded', 'part_whole'], [identify, [], 'not_a_fraction', 'part_whole'],
    [identify, ['mark_pieces'], 'top_off_by_more', 'fewer_pieces'],
    [build, [], 'one_short', 'running_count'], [build, [], 'shaded_all', 'part_whole'], [build, [], 'shaded_the_rest', 'part_whole'],
    [build, ['running_count'], 'short_by_more', 'unit_build'], [build, ['running_count'], 'one_over', 'part_whole'],
    [eighths, [], 'one_over', 'running_count'], [eighths, [], 'copied_the_count', 'split_reference'],
    [eighths, [], 'over_by_more', 'split_reference'], [eighths, ['split_reference'], 'copied_the_count', 'double_split'],
    [compare, [], 'picked_more_slices', 'overlay'], [compare, ['overlay'], 'picked_more_slices', 'far_pair'],
    // No open lever lists it: help first, then simplify, as before misses were named.
    [compare, ['overlay'], 'missed_equal', 'far_pair'],
  ] as const)('%#: pulled %j, miss %s -> %s', (item, pulled, miss, lever) => {
    expect(nextLever(levers(item, [...pulled]), miss)).toBe(lever);
  });
});
