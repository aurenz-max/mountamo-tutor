/**
 * length-lab two_unit_compare items, built in code (8.1i).
 *
 * The answer (the unit needed more of) was the first unit on every item, because the first unit was
 * always the small one, and the lengths were 6/8/10 at every tier. Code now picks which unit comes
 * first per item, and the tier sets the units' sizes in small-cube widths:
 *   - easy 1 and 3: the counts are far apart (9 against 3);
 *   - medium 1 and 2 (8 against 4);
 *   - hard 2 and 3: neither unit is one cube wide and the counts are close (6 against 4).
 * The object's length is a whole number of both units, so neither measurement ends mid-unit.
 */
type Tier = 'easy' | 'medium' | 'hard';

export interface TwoUnitItem {
  objectLength0: number;
  unitType: string;
  correctUnitCount: number;
  unitTypeB: string;
  correctUnitCountB: number;
  correctAnswer: string;
}

const SPANS: Record<Tier, [number, number]> = { easy: [1, 3], medium: [1, 2], hard: [2, 3] };
/** Units drawn wider than a cube, smallest first. */
const WIDE_UNITS = ['erasers', 'bears', 'hands', 'feet'];

/** `count` distinct items for a session, inside lengths 1-12. `smallUnit` is the session's unit (span 1). */
export function twoUnitItems(tier: Tier | null, count: number, smallUnit: string, rand: () => number = Math.random): TwoUnitItem[] {
  const [s1, s2] = SPANS[tier ?? 'medium'];
  const lcm = s1 === 1 ? s2 : s1 * s2;
  const lengths = Array.from({ length: Math.floor(12 / lcm) }, (_, i) => (i + 1) * lcm).filter((l) => l / s2 >= 2);
  const names: [string, string] = s1 === 1
    ? [smallUnit, WIDE_UNITS.find((u) => u !== smallUnit)!]
    : [WIDE_UNITS[0], WIDE_UNITS[2]];
  const combos = lengths.flatMap((l) => [false, true].map((bigFirst) => ({ l, bigFirst })));
  const shuffled = combos.sort(() => rand() - 0.5);
  // Both orders appear in a session of two or more.
  if (count >= 2 && shuffled.slice(0, count).every((c) => c.bigFirst === shuffled[0].bigFirst)) {
    const other = shuffled.findIndex((c) => c.bigFirst !== shuffled[0].bigFirst);
    if (other >= 0) [shuffled[count - 1], shuffled[other]] = [shuffled[other], shuffled[count - 1]];
  }
  return Array.from({ length: count }, (_, i) => {
    const { l, bigFirst } = shuffled[i % shuffled.length];
    const small = { unit: names[0], count: l / s1 };
    const big = { unit: names[1], count: l / s2 };
    const [a, b] = bigFirst ? [big, small] : [small, big];
    return {
      objectLength0: l, unitType: a.unit, correctUnitCount: a.count, unitTypeB: b.unit, correctUnitCountB: b.count,
      correctAnswer: small.unit, // the smaller unit is needed more
    };
  });
}
