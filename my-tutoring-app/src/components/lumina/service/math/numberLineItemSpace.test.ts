import { describe, expect, it } from 'vitest';
import { ADD_SUB_20, addSub20Items } from '../itemSpace/addSub20';
import { TIER_BANDS } from '../itemSpace';
import { K2_HOPS, itemAsJumps, pickSpaceJumps } from './numberLineItemSpace';

const LINE = { min: 0, max: 20 };
const pick = (band: [number, number], extra: Partial<Parameters<typeof pickSpaceJumps>[0]> = {}) =>
  pickSpaceJumps({ space: 'add-sub-20', pick: ADD_SUB_20.pick, band, count: 4, range: LINE, ...extra });
const land = (op: { type: string; startValue: number; changeValue: number }) =>
  op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue;

describe('number-line jumps from the add-sub-20 item space', () => {
  it('only result-unknown items with K-2 hops on the line, never a jump back to the start, become jumps (contract R4)', () => {
    let drawn = 0;
    for (const it of addSub20Items()) {
      const ops = itemAsJumps('add-sub-20', it, LINE);
      const undoes = it.steps.length === 2 && it.steps[1].b === it.steps[0].b;
      if (it.unknown !== 'result' || undoes || it.steps.some((s) => !K2_HOPS.includes(s.b))) { expect(ops).toBeNull(); continue; }
      expect(ops).not.toBeNull();
      drawn++;
      ops!.forEach((op, j) => {
        expect(K2_HOPS).toContain(op.changeValue);
        if (j > 0) expect(op.startValue).toBe(land(ops![j - 1])); // chained: second jump starts at the first landing
        expect(land(op)).toBeGreaterThanOrEqual(0);
        expect(land(op)).toBeLessThanOrEqual(20);
      });
    }
    expect(drawn).toBeGreaterThan(200);
  });

  it('every tier fills a session of distinct jumps inside its band, across more than one structure', () => {
    for (const band of Object.values(TIER_BANDS)) {
      for (let run = 0; run < 20; run++) {
        const jumps = pick(band);
        expect(jumps).toHaveLength(4);
        expect(jumps.every((j) => j.itemSpace.beta >= band[0] - 0.01 && j.itemSpace.beta <= band[1] + 0.01)).toBe(true);
        expect(new Set(jumps.map((j) => JSON.stringify(j.ops.map((o) => [o.type, o.startValue, o.changeValue])))).size).toBe(4);
        expect(new Set(jumps.map((j) => j.itemSpace.structure)).size).toBeGreaterThan(1);
      }
    }
  });

  it('harder tiers carry more structure: crossing ten, subtraction and two-step jumps', () => {
    const load = (band: [number, number]) => {
      let n = 0;
      for (let run = 0; run < 50; run++) for (const j of pick(band)) {
        n += j.ops.length - 1;
        n += j.ops.filter((o) => Math.floor(o.startValue / 10) !== Math.floor(land(o) / 10) && land(o) % 10 !== 0).length;
        n += j.ops.some((o) => o.type === 'subtract') ? 1 : 0;
      }
      return n;
    };
    const [easy, medium, hard] = [load(TIER_BANDS.easy), load(TIER_BANDS.medium), load(TIER_BANDS.hard)];
    expect(medium).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(medium);
  });

  it('keeps a requested direction and the focus window when the window holds a session', () => {
    for (const j of pick(TIER_BANDS.medium, { operation: 'subtract' })) expect(j.ops.every((o) => o.type === 'subtract')).toBe(true);
    const teens = pick(TIER_BANDS.hard, { focusRange: { min: 11, max: 20 } });
    expect(teens).toHaveLength(4);
    for (const j of teens) for (const o of j.ops) {
      expect(o.startValue).toBeGreaterThanOrEqual(11);
      expect(land(o)).toBeLessThanOrEqual(20);
    }
  });

  it('returns nothing when no window can fill a session (the generator keeps its own path)', () => {
    expect(pick(TIER_BANDS.hard, { range: { min: 0, max: 5 }, operation: 'add' })).toEqual([]);
  });
});
