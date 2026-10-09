/**
 * two-way-table levers: the leak rules per mode, the simplify builder over many item shapes, and "this wrong answer,
 * then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { TwoWayTableChallenge, TwoWayTableChallengeType } from './TwoWayTable';
import {
  MODEL_LEVER, OUTLINE_LEVER, OUT_OF_LEVER, SIMPLER_LEVER, SUM_LEVER, leverFacts, leverTextLeaks, outOfFrame, outOfLeaks,
  practiceLeaks, simplerTable, sumFrames, tableModel, twoWayLevers,
} from './twoWayTableLevers';
import {
  TWO_WAY_MISSES_BY_MODE, formatProbability, locateTarget, matchesKey, probabilityOf, signatureValues, twoWayCorrect, twoWayMiss,
  type TableTarget,
} from './twoWayTableWorkspace';

/** The generator's 2x2, 2x3 and 3x3 shapes (pool tables), category names with digits included. */
const TABLES: Array<{ rows: string[]; cols: string[]; f: number[][] }> = [
  { rows: ['Male', 'Female'], cols: ['Dogs', 'Cats'], f: [[28, 12], [18, 22]] },
  { rows: ['Under 1 mile', 'Over 1 mile'], cols: ['Walks', 'Bus'], f: [[35, 5], [10, 50]] },
  { rows: ['Under 30', '30 and over'], cols: ['Brand A', 'Brand B'], f: [[42, 18], [15, 45]] },
  { rows: ['Grade 7', 'Grade 8'], cols: ['Fruit', 'Chips', 'Yogurt'], f: [[18, 14, 8], [12, 20, 10]] },
  { rows: ['Grade 6', 'Grade 7', 'Grade 8'], cols: ['Soccer', 'Tennis', 'Track'], f: [[18, 10, 14], [22, 16, 8], [12, 20, 24]] },
  { rows: ['Urban', 'Suburban', 'Rural'], cols: ['Walk', 'Bus', 'Car'], f: [[26, 20, 14], [10, 24, 32], [6, 12, 28]] },
];
const TIERS = [{ showTotals: true }, { showTotals: false },
  { showTotals: true, supportTier: 'easy' as const, showRowTotals: false, showColTotals: true, showGrandTotal: true },
  { showTotals: true, supportTier: 'medium' as const, showRowTotals: false, showColTotals: false, showGrandTotal: true },
  { showTotals: false, supportTier: 'hard' as const, showRowTotals: false, showColTotals: false, showGrandTotal: false }];

function items(type: TwoWayTableChallengeType): TwoWayTableChallenge[] {
  const out: TwoWayTableChallenge[] = [];
  TABLES.forEach(({ rows, cols, f }, ti) => {
    const targets: TableTarget[] = [];
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols.length; c++) {
      if (type === 'marginal_distribution') { if (c === 0) targets.push({ row: r }); if (r === 0) targets.push({ col: c }); }
      else if (type === 'conditional_probability') targets.push({ row: r, col: c, given: 'row' }, { row: r, col: c, given: 'col' });
      else targets.push({ row: r, col: c });
    }
    targets.forEach((target, k) => TIERS.forEach((flags, tier) => {
      out.push({ id: `${type}-${ti}-${k}-${tier}`, challengeType: type, scenario: 'Survey', rowLabel: 'Group', columnLabel: 'Choice',
        rowCategories: rows, columnCategories: cols, frequencies: f, question: `Question ${k} about ${rows[target.row ?? 0]}.`,
        expectedProbability: Math.round(probabilityOf(type, f, target)! * 10000) / 10000, tolerance: 0.02, hint: '', target, ...flags });
    }));
  });
  return out;
}
const MODES = Object.keys(TWO_WAY_MISSES_BY_MODE) as TwoWayTableChallengeType[];

describe('simplify builder', () => {
  it.each(MODES)('%s: same mode, its own id and ask, a different table and answer, solvable, deterministic', (type) => {
    let built = 0;
    for (const c of items(type)) {
      const s = simplerTable(c);
      expect(s, c.id).not.toBeNull();
      built++;
      expect(s!.id).toBe(`${c.id}~simpler`);
      expect(s!.challengeType).toBe(type);
      expect(practiceLeaks(c, s!)).toBe(false);
      expect(s!.frequencies).toHaveLength(2);
      expect(locateTarget(s!)).toEqual(s!.target);
      expect(twoWayCorrect(s!, formatProbability(s!.expectedProbability))).toBe(true);
      expect(simplerTable(c)).toEqual(s);
      expect(simplerTable(s!)).toBeNull();
    }
    expect(built).toBeGreaterThan(50);
  });
});

describe('leak rules', () => {
  it.each(MODES)('%s: no lever text carries a digit, no frame writes a sum, the model never answers the item', (type) => {
    for (const c of items(type)) {
      const levers = twoWayLevers(c, []);
      for (const l of levers) expect(leverTextLeaks(l.when + l.does), `${c.id} ${l.id}`).toBe(false);
      expect(leverTextLeaks(leverFacts(c, levers.map(l => l.id)))).toBe(false);
      const frame = outOfFrame(c)!;
      expect(outOfLeaks(c, frame), frame).toBe(false);
      for (const fr of sumFrames(c)) expect(fr.addends.length).toBeGreaterThan(1);
      const model = tableModel(c)!;
      expect(matchesKey(c, model.answer)).toBe(false);
      expect(model.line).not.toContain(formatProbability(c.expectedProbability));
      // Every miss the check names is answered by a lever on this item.
      for (const [miss] of signatureValues(c)) expect(levers.some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
      for (const miss of TWO_WAY_MISSES_BY_MODE[type]) expect(nextLever(levers, miss)).not.toBeNull();
    }
  });

  it('the sum frame is offered only where a total the question needs is hidden', () => {
    const [shown] = items('joint_probability');
    expect(twoWayLevers(shown, []).map(l => l.id)).toEqual([OUTLINE_LEVER, OUT_OF_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    const hard = items('marginal_distribution').find(c => c.supportTier === 'hard')!;
    expect(twoWayLevers(hard, []).map(l => l.id)).toEqual([OUTLINE_LEVER, SUM_LEVER, OUT_OF_LEVER, MODEL_LEVER, SIMPLER_LEVER]);
    expect(sumFrames(hard).map(f => f.label)).toEqual(['Male row', 'Everyone']);
  });
});

describe('this wrong answer, then this lever', () => {
  const pet = (type: TwoWayTableChallengeType) => items(type).find(c => c.id.endsWith('-0-1-0') || c.id.endsWith('-0-2-0'))!;
  it.each([
    ['joint_probability', 'row_denominator', OUT_OF_LEVER],
    ['joint_probability', 'wrong_cell', OUTLINE_LEVER],
    ['marginal_distribution', 'one_cell', OUTLINE_LEVER],
    ['conditional_probability', 'joint_instead', OUT_OF_LEVER],
    ['conditional_probability', 'reversed_condition', OUTLINE_LEVER],
    ['independence_test', 'added_factors', OUT_OF_LEVER],
    ['independence_test', 'observed_joint', OUTLINE_LEVER],
  ] as const)('%s %s -> %s', (type, miss, lever) => {
    expect(nextLever(twoWayLevers(pet(type), []), miss)).toBe(lever);
  });

  it('a signature value is named as its miss', () => {
    for (const type of MODES) for (const c of items(type)) {
      for (const [miss, v] of signatureValues(c)) {
        if (matchesKey(c, Number(formatProbability(v))) || v <= 0 || v > 1) continue;
        const named = twoWayMiss(c, formatProbability(v));
        expect(named, `${c.id} ${miss}`).toBeTruthy();
        expect(TWO_WAY_MISSES_BY_MODE[type]).toContain(named);
      }
    }
  });
});
