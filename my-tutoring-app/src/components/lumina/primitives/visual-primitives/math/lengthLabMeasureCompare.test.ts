/**
 * length-lab measure_compare: code builds both lengths and the key; the check reads both counts and the choice.
 */
import { describe, expect, it } from 'vitest';
import type { LengthLabChallenge } from './LengthLab';
import { measureCompareAnswer, measureCompareItems } from './lengthLabMeasureCompare';
import { lengthLabMatches, lengthMiss, lengthScene, type LengthView } from './lengthLabWorkspace';
import { LENGTH_LEVERS, leverTextLeaks, simplerLeaks, simplerLength } from './lengthLabLevers';
import { validateLengthLabData } from './lengthLab.boss';

const item = (it: ReturnType<typeof measureCompareItems>[number], i = 0): LengthLabChallenge => {
  const c = { id: `m${i}`, type: 'measure_compare' as const, instruction: 'Measure both.', hint: '', narration: '',
    objectName0: 'pencil', objectColor0: '#f00', objectName1: 'crayon', objectColor1: '#0f0', unitType: 'cubes',
    ...it, correctAnswer: '' };
  return { ...c, correctAnswer: measureCompareAnswer(c) };
};
const view = (over: Partial<LengthView>): LengthView => ({ answer: null, tiles: 0, estimate: null, countA: null, countB: null,
  unitA: 'cubes', unitB: 'cubes', order: [], ticksShown: false, fitShown: true, ...over });

describe('measure_compare items', () => {
  it('the key is the object the ask names, from the two lengths; the tier sets the gap', () => {
    for (const [tier, gap] of [['easy', 3], ['medium', 2], ['hard', 1], [null, 2]] as const) {
      for (let run = 0; run < 20; run++) {
        const items = measureCompareItems(tier, 4);
        for (const it of items) {
          expect(Math.abs(it.objectLength0 - it.objectLength1)).toBe(gap);
          for (const n of [it.objectLength0, it.objectLength1]) { expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(9); }
          const longFirst = it.objectLength0 > it.objectLength1;
          expect(it.answerIndex === 0).toBe(it.compareWord === 'longer' ? longFirst : !longFirst);
          expect(item(it).correctAnswer).toBe(it.answerIndex === 0 ? 'pencil' : 'crayon');
        }
        // Neither "always the first" nor "always the bigger count" wins a session of four.
        expect(new Set(items.map(it => it.answerIndex)).size).toBe(2);
        expect(new Set(items.map(it => it.compareWord)).size).toBe(2);
        expect(items.some(it => it.compareWord === 'shorter')).toBe(true);
      }
    }
  });

  it('the check needs both counts right and the named object; the miss says which part failed', () => {
    const c = item(measureCompareItems('medium', 1)[0]);
    const other = c.correctAnswer === 'pencil' ? 'crayon' : 'pencil';
    const counts = { countA: c.objectLength0, countB: c.objectLength1 };
    expect(lengthLabMatches(c, view({ ...counts, answer: c.correctAnswer }))).toBe(true);
    expect(lengthMiss(c, view({ ...counts, answer: other }))).toBe('picked_other');
    expect(lengthMiss(c, view({ countA: c.objectLength0 + 1, countB: c.objectLength1, answer: c.correctAnswer }))).toBe('miscounted');
    expect(lengthLabMatches(c, view({ countA: c.objectLength0 + 1, countB: c.objectLength1, answer: c.correctAnswer }))).toBe(false);
    expect(validateLengthLabData({ title: 't', challenges: [c] })).toBeTruthy();
    expect(() => validateLengthLabData({ title: 't', challenges: [{ ...c, correctAnswer: other }] })).toThrow();
  });

  it('the scene names no length, count or answer before the learner measures; the levers carry no digit or name', () => {
    for (const it of measureCompareItems('hard', 4)) {
      const c = item(it);
      const facts = JSON.stringify(lengthScene(c, view({})).facts);
      expect(facts).not.toMatch(/\d/);
      const levers = LENGTH_LEVERS.declare(c, { ticksShown: false, measuredBoth: true }, []);
      expect(levers.map(l => l.id).sort()).toEqual(['count_rows', 'object_outline', 'shorter_object']);
      for (const l of levers) expect(leverTextLeaks(c, `${l.when} ${l.does}`), l.id).toBe(false);
      expect(LENGTH_LEVERS.declare(c, { ticksShown: false }, []).some(l => l.id === 'count_rows')).toBe(false);
      const p = simplerLength(c)!;
      expect(p.type).toBe('measure_compare');
      expect(simplerLeaks(c, p)).toBe(false);
      expect(p.correctAnswer).toBe(measureCompareAnswer(p));
    }
  });
});
