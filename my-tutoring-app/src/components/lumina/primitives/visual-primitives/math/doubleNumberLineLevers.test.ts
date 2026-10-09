/**
 * double-number-line levers: the leak rules per mode, the simplify builder over every item shape the generator
 * builds, and "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { DoubleNumberLineChallenge, DoubleNumberLineChallengeType, LinkedPoint } from './DoubleNumberLine';
import {
  GROW_MODEL_CAPTION, SMALLER_ASK_LEVER, SPLIT_GIVEN_LEVER, UNIT_JUMPS_LEVER, GROW_MODEL_LEVER,
  leverFacts, leverTextLeaks, practiceLeaks, ratioLineLevers, simplerLine,
} from './doubleNumberLineLevers';
import { RATIO_LINE_MISSES_BY_MODE, asksForRate, ratioLineMiss, valuesCorrect } from './doubleNumberLineWorkspace';

const LABELS = { topLabel: 'Hours', bottomLabel: 'Miles' };
const ORIGIN: LinkedPoint = { topValue: 0, bottomValue: 0, label: 'Start' };

/** The generator's builders (`gemini-double-number-line.ts`) over its rate, scale and ask ranges. */
function items(mode: DoubleNumberLineChallengeType): DoubleNumberLineChallenge[] {
  const out: DoubleNumberLineChallenge[] = [];
  for (const r of [0.5, 2, 3, 3.5, 4, 7, 12, 15, 45, 60]) for (const max of [5, 8, 10]) for (const g of [2, 3]) {
    const scales = { topScale: { min: 0, max, interval: 1 }, bottomScale: { min: 0, max: max * r, interval: r } };
    const given: LinkedPoint = { topValue: g, bottomValue: g * r, label: 'Given' };
    for (let t = 2; t <= max; t++) {
      if (t === g && mode !== 'equivalent_ratios') continue;
      const target = { topValue: t, bottomValue: t * r, label: `Find for ${t}` };
      const id = `${mode}-${r}-${max}-${g}-${t}`;
      if (mode === 'equivalent_ratios') {
        if (g !== 2) continue;
        out.push({ id, challengeType: mode, ...scales, hint: '', prompt: `The unit rate is 1 Hours = ${r} Miles. Use it to find Miles when Hours = ${t}.`,
          givenPoints: [ORIGIN, { topValue: 1, bottomValue: r, label: 'Unit Rate' }], targetPoints: [target] });
      } else {
        out.push({ id, challengeType: mode, ...scales, hint: '', prompt: `Given ${g} Hours = ${g * r} Miles, find Miles when Hours = ${t}.`,
          givenPoints: [ORIGIN, given], targetPoints: [target] });
      }
    }
    if (mode === 'unit_rate') out.push({ id: `rate-${r}-${max}-${g}`, challengeType: mode, ...scales, hint: '',
      prompt: `Given ${g} Hours = ${g * r} Miles, find the unit rate: when Hours = 1, what is Miles?`,
      givenPoints: [ORIGIN, given], targetPoints: [{ topValue: 1, bottomValue: r, label: 'Unit Rate' }] });
  }
  return out;
}
const MODES: DoubleNumberLineChallengeType[] = ['equivalent_ratios', 'find_missing', 'unit_rate'];

describe('simplify builder', () => {
  it.each(MODES)('%s: same mode, its own id and prompt, a different ask with its own answer, on the lines, solvable', mode => {
    let built = 0;
    for (const c of items(mode)) {
      const s = simplerLine(c, LABELS);
      if (!s) continue;
      built++;
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(s.challengeType).toBe(c.challengeType);
      expect(practiceLeaks(c, s)).toBe(false);
      const [p] = s.targetPoints;
      expect(p.topValue).toBeLessThanOrEqual(s.topScale.max);
      expect(valuesCorrect(s, [String(p.bottomValue)])).toBe(true);
      expect(valuesCorrect(c, [String(p.bottomValue)])).toBe(false);
      expect(s.prompt).toMatch(/^Practice first: /);
      expect(simplerLine(c, LABELS)).toEqual(s);
      expect(simplerLine(s, LABELS)).toBeNull();
    }
    expect(built).toBeGreaterThan(10);
  });

  it('none where the item is already the friendliest of its mode, or a find-the-rate item (same answer)', () => {
    for (const c of items('unit_rate').filter(asksForRate)) expect(simplerLine(c, LABELS)).toBeNull();
    for (const c of items('equivalent_ratios').filter(x => x.targetPoints[0].topValue === 2)) expect(simplerLine(c, LABELS)).toBeNull();
  });

  it('practiceLeaks catches the learner\'s own item, its answer, and a changed mode', () => {
    const [c] = items('find_missing');
    expect(practiceLeaks(c, { ...c })).toBe(true);
    expect(practiceLeaks(c, { ...c, id: 'x', prompt: 'other' })).toBe(true);
    expect(practiceLeaks(c, { ...c, id: 'x', prompt: 'other', challengeType: 'unit_rate', targetPoints: [{ topValue: 1, bottomValue: 0.5 }] })).toBe(true);
  });
});

describe('declarations', () => {
  it.each(MODES)('%s: every miss the check can name on an item is answered by a lever on that item', mode => {
    for (const c of items(mode)) {
      const levers = ratioLineLevers(c, [], LABELS);
      const answered = new Set(levers.flatMap(l => l.answers ?? []));
      const t = c.targetPoints[0], r = t.bottomValue / t.topValue;
      // Every number the check could see, from 0 to past the line: whichever miss it names is answered.
      for (let v = 0; v <= c.bottomScale.max * 1.5; v += Math.max(0.5, r / 2)) {
        const miss = ratioLineMiss(c, [String(v)]);
        if (miss) expect(answered.has(miss), `${c.id} typed ${v}: ${miss}`).toBe(true);
      }
      for (const m of Array.from(answered)) expect(RATIO_LINE_MISSES_BY_MODE[mode]).toContain(m);
    }
  });

  it.each(MODES)('%s: no lever text, caption or fact carries a digit', mode => {
    for (const c of items(mode)) {
      const levers = ratioLineLevers(c, [], LABELS);
      for (const l of levers) { expect(leverTextLeaks(l.does), l.id).toBe(false); expect(leverTextLeaks(l.when), l.id).toBe(false); }
      expect(leverTextLeaks(leverFacts(c, levers.map(l => l.id)))).toBe(false);
    }
    expect(leverTextLeaks(GROW_MODEL_CAPTION)).toBe(false);
  });

  it('which levers each item shape offers', () => {
    const ids = (c: DoubleNumberLineChallenge) => ratioLineLevers(c, [], LABELS).map(l => l.id);
    const eq = items('equivalent_ratios').find(c => c.targetPoints[0].topValue === 5)!;
    const fm = items('find_missing').find(c => c.targetPoints[0].topValue === 3 && c.topScale.max === 10)!;
    const rate = items('unit_rate').find(asksForRate)!;
    const later = items('unit_rate').find(c => !asksForRate(c))!;
    expect(ids(eq)).toEqual([UNIT_JUMPS_LEVER, GROW_MODEL_LEVER, SMALLER_ASK_LEVER]);
    expect(ids(fm)).toEqual([SPLIT_GIVEN_LEVER, UNIT_JUMPS_LEVER, GROW_MODEL_LEVER, SMALLER_ASK_LEVER]);
    expect(ids(rate)).toEqual([SPLIT_GIVEN_LEVER, GROW_MODEL_LEVER]);
    expect(ids(later)).toEqual([SPLIT_GIVEN_LEVER, UNIT_JUMPS_LEVER, GROW_MODEL_LEVER, SMALLER_ASK_LEVER]);
    expect(ratioLineLevers(simplerLine(eq, LABELS), [], LABELS)).toEqual([]);
  });

  it('the catalog declares levers on the workspace', () => {
    expect(getComponentById('double-number-line')!.teachingWorkspace!.levers).toBe(true);
  });
});

describe('this wrong answer, then this lever', () => {
  const eq = items('equivalent_ratios').find(c => c.targetPoints[0].topValue === 5 && c.bottomScale.interval === 3)!;
  const fm = items('find_missing').find(c => c.targetPoints[0].topValue === 5 && c.bottomScale.interval === 3 && c.givenPoints[1].topValue === 2)!;
  const rate = items('unit_rate').find(c => asksForRate(c) && c.bottomScale.interval === 3 && c.givenPoints[1].topValue === 2)!;
  it.each([
    ['equivalent_ratios', eq, '5', 'gave_top', UNIT_JUMPS_LEVER],
    ['equivalent_ratios', eq, '8', 'added_rate', UNIT_JUMPS_LEVER],
    ['equivalent_ratios', eq, '18', 'one_unit_off', UNIT_JUMPS_LEVER],
    ['find_missing', fm, '9', 'added_difference', SPLIT_GIVEN_LEVER],
    ['find_missing', fm, '3', 'stopped_at_rate', UNIT_JUMPS_LEVER],
    ['find_missing', fm, '6', 'gave_given', SPLIT_GIVEN_LEVER],
    ['unit_rate', rate, '6', 'gave_given', SPLIT_GIVEN_LEVER],
    ['unit_rate', rate, '12', 'multiplied_not_divided', SPLIT_GIVEN_LEVER],
    ['unit_rate', rate, '4', 'subtracted', SPLIT_GIVEN_LEVER],
  ] as const)('%s typed %s → %s → %s', (_mode, c, typed, miss, lever) => {
    expect(ratioLineMiss(c, [typed])).toBe(miss);
    expect(nextLever(ratioLineLevers(c, [], LABELS), miss)).toBe(lever);
  });
  it('a pulled lever is skipped: the next one that answers the miss, else help before simplify', () => {
    expect(nextLever(ratioLineLevers(eq, [UNIT_JUMPS_LEVER], LABELS), 'added_rate')).toBe(GROW_MODEL_LEVER);
    expect(nextLever(ratioLineLevers(eq, [UNIT_JUMPS_LEVER, GROW_MODEL_LEVER], LABELS), 'added_rate')).toBe(SMALLER_ASK_LEVER);
  });
});
