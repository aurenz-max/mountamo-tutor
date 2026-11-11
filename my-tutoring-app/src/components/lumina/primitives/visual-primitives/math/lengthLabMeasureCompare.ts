/**
 * length-lab measure_compare items, built in code (MEAS001-01-D, MEAS001-05-F).
 *
 * The child measures two objects with the same unit, one at a time, then says which is longer (or shorter) by the
 * two counts. Code owns both lengths and the key; the model writes only the object names. Two tells are defeated by
 * alternation: which object is the longer one flips every item, and whether the ask is "longer" or "shorter" flips
 * every two, so "always the first" and "always the bigger count" both fail.
 *
 * The tier sets the gap between the two lengths (easy 3, medium 2, hard 1). A gap of one unit is hard to see by eye,
 * so the counts carry the comparison. Lengths stay in 2-9 so a Kindergartner counts each.
 */
type Tier = 'easy' | 'medium' | 'hard';

export interface MeasureCompareItem {
  objectLength0: number;
  objectLength1: number;
  correctUnitCount: number;
  correctUnitCountB: number;
  compareWord: 'longer' | 'shorter';
  /** 0 or 1: which object the ask's word picks. */
  answerIndex: 0 | 1;
}

const GAP: Record<Tier, number> = { easy: 3, medium: 2, hard: 1 };
const MIN = 2;
const MAX = 9;

/** `count` items for a session. Each pair of lengths is distinct within the session while the space allows. */
export function measureCompareItems(tier: Tier | null, count: number, rand: () => number = Math.random): MeasureCompareItem[] {
  const gap = GAP[tier ?? 'medium'];
  const shorts = Array.from({ length: MAX - gap - MIN + 1 }, (_, i) => MIN + i).sort(() => rand() - 0.5);
  return Array.from({ length: count }, (_, i) => {
    const short = shorts[i % shorts.length];
    const long = short + gap;
    const firstLong = i % 2 === 0;
    const compareWord: 'longer' | 'shorter' = Math.floor(i / 2) % 2 === 0 ? 'longer' : 'shorter';
    const [l0, l1] = firstLong ? [long, short] : [short, long];
    const longIndex: 0 | 1 = firstLong ? 0 : 1;
    const answerIndex: 0 | 1 = compareWord === 'longer' ? longIndex : (longIndex === 0 ? 1 : 0);
    return { objectLength0: l0, objectLength1: l1, correctUnitCount: l0, correctUnitCountB: l1, compareWord, answerIndex };
  });
}

/** The object a measure_compare ask picks, re-derived from the two lengths and the ask's word. */
export function measureCompareAnswer(c: { objectName0: string; objectName1: string; objectLength0: number;
  objectLength1: number; compareWord?: 'longer' | 'shorter' }): string {
  const firstLonger = c.objectLength0 > c.objectLength1;
  const wantFirst = (c.compareWord ?? 'longer') === 'longer' ? firstLonger : !firstLonger;
  return wantFirst ? c.objectName0 : c.objectName1;
}
