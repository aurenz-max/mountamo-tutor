import { describe, expect, it } from 'vitest';
import { TIER_BANDS, getItemSpace, tierPick } from '../itemSpace';
import { clockText, durationText, elapsedEnd, elapsedItems } from '../itemSpace/time';
import { bandFittingTargets, bandForGrid, clockChallenges, clockGrid, elapsedChallenges, elapsedTextFits } from './analogClockItemSpace';

const tiers = Object.values(TIER_BANDS);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('analog-clock item-space adapter', () => {
  it('reads the grid from the objective, else the grade', () => {
    expect(clockGrid('2', 'Tell and write time to the nearest five minutes')).toBe(5);
    expect(clockGrid('1', 'Tell time in hours and half-hours')).toBe(30);
    expect(clockGrid('3', 'Tell time to the nearest minute')).toBe(1);
    expect(clockGrid('2', 'Telling time')).toBe(5);
    expect(bandForGrid(5, '2')).toBe('3-5');
    expect(bandFittingTargets('1-2', [{ type: 'set_time', targetMinute: 25 }])).toBe('3-5');
    expect(bandFittingTargets('1-2', [{ type: 'read', targetMinute: 25 }])).toBe('1-2');
  });

  for (const mode of ['read', 'match', 'set_time'] as const) {
    it(`${mode}: every tier fills five distinct times on the grid, options keyed to the dial; harder tiers read later minutes`, () => {
      const lateness: number[] = [];
      for (const band of tiers) {
        const cs = clockChallenges({ pick: tierPick(getItemSpace('clock-time')), band, count: 5, grid: 5, mode });
        expect(cs).toHaveLength(5);
        expect(new Set(cs.map((c) => `${c.targetHour}:${c.targetMinute}`)).size).toBe(5);
        for (const c of cs) {
          expect(c.targetMinute % 5).toBe(0);
          const answer = clockText(c.targetHour, c.targetMinute);
          if (mode === 'set_time') expect(c.instruction).toContain(answer);
          else {
            const opts = [c.option0, c.option1, c.option2, c.option3];
            expect(new Set(opts).size).toBe(4);
            expect(opts[c.correctOptionIndex!]).toBe(answer);
            expect(c.instruction).not.toContain(answer);
            expect(opts.every((o) => Number(o!.split(':')[1]) % 5 === 0)).toBe(true);
          }
        }
        lateness.push(mean(cs.map((c) => (c.targetMinute === 0 ? 0 : c.targetMinute === 30 ? 1 : c.targetMinute % 15 === 0 ? 2 : 3))));
      }
      expect(lateness[0]).toBeLessThan(lateness[2]);
    });
  }

  it('a half-hour lesson keeps every tier on :00 and :30 (thirds when the band is short)', () => {
    for (const band of tiers) {
      const cs = clockChallenges({ pick: tierPick(getItemSpace('clock-time'), undefined, (it) => it.m % 30 === 0), band, count: 5, grid: 30, mode: 'read' });
      if (cs.length) expect(cs.every((c) => c.targetMinute % 30 === 0)).toBe(true);
    }
  });

  it('elapsed: the instruction names the end time, never the duration; the key is the duration', () => {
    const cross: number[] = [];
    for (const band of tiers) {
      const cs = elapsedChallenges({ pick: tierPick(getItemSpace('elapsed-time')), band, count: 5, grid: 5, activities: ['Recess'] });
      expect(cs).toHaveLength(5);
      for (const c of cs) {
        const it = elapsedItems().find((x) => x.sh === c.startHour && x.sm === c.startMinute
          && clockText(elapsedEnd(x).h, elapsedEnd(x).m) === clockText(c.targetHour, c.targetMinute))!;
        expect(elapsedTextFits(c.instruction, it)).toBe(true);
        const opts = [c.option0, c.option1, c.option2, c.option3];
        expect(opts[c.correctOptionIndex!]).toBe(durationText(it.d));
        expect(new Set(opts).size).toBe(4);
      }
      cross.push(mean(cs.map((c) => c.itemSpace!.structure.startsWith('cross') ? 1 : 0)));
    }
    expect(cross[0]).toBeLessThanOrEqual(cross[2]);
    expect(cross[2]).toBeGreaterThan(0);
  });
});
