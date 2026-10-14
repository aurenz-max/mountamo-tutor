import { describe, expect, it } from 'vitest';
import { addSub20Items, ADD_SUB_20 } from '../itemSpace/addSub20';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { itemAsOperate, operateChallenge, pairTotals, pickOperate } from './tenFrameItemSpace';

const BOTH = { add: true, subtract: true };

describe('ten-frame operate from add-sub-20', () => {
  it('maps every one-step result-unknown item in scope, and nothing else', () => {
    for (const max of [10, 20]) for (const it of addSub20Items()) {
      const o = itemAsOperate(it, max, BOTH);
      const s = it.steps[0];
      const drawable = it.steps.length === 1 && it.unknown === 'result'
        && (s.op === '+' ? s.a + s.b <= max : s.a <= max && s.a - s.b >= 1);
      expect(o !== null).toBe(drawable);
      if (o?.type === 'add') expect(o.addend1 + o.addend2).toBe(o.targetCount);
      if (o?.type === 'subtract') expect(o.targetCount).toBeGreaterThanOrEqual(1);
    }
    expect(addSub20Items().filter((it) => itemAsOperate(it, 20, { add: true, subtract: false })?.type === 'subtract')).toHaveLength(0);
  });

  it('every tier fills a session of distinct problems, and the mean beta rises with the tier', () => {
    for (const max of [10, 20]) {
      const scope = (it: any) => itemAsOperate(it, max, BOTH) !== null;
      const means: number[] = [];
      for (const band of Object.values(TIER_BANDS)) {
        const ops = pickOperate({ pick: tierPick(ADD_SUB_20, undefined, scope), band, count: 5, maxNumber: max, ops: BOTH });
        expect(ops).toHaveLength(5);
        expect(new Set(ops.map((o) => JSON.stringify(o.op))).size).toBe(5);
        // One structure is allowed: within 20 the hard band of one-step result-unknown problems is
        // subtraction across ten only (15 of them), and within 10 nothing bridges.
        means.push(ops.reduce((s, o) => s + o.itemSpace.beta, 0) / 5);
      }
      expect(means[0]).toBeLessThan(means[1]);
      expect(means[1]).toBeLessThan(means[2]);
    }
  });

  it('hint and narration never state the result', () => {
    for (const band of Object.values(TIER_BANDS)) {
      for (const o of pickOperate({ pick: ADD_SUB_20.pick, band, count: 5, maxNumber: 20, ops: BOTH })) {
        const ch = operateChallenge(o, 'c1');
        const said = `${ch.hint} ${ch.narration}`.match(/\d+/g)?.map(Number) ?? [];
        const given = ch.type === 'add' ? [ch.addend1, ch.addend2] : [ch.startCount, (ch.startCount ?? 0) - ch.targetCount];
        if (!given.includes(ch.targetCount)) expect(said).not.toContain(ch.targetCount);
      }
    }
  });

  it('pairTotals: each total twice, inside the bound; with a tier, larger totals at hard', () => {
    for (let r = 0; r < 20; r++) {
      const easy = pairTotals(6, 10, Math.random, 'easy');
      const hard = pairTotals(6, 10, Math.random, 'hard');
      expect(Math.max(...easy)).toBeLessThan(Math.min(...hard) + 2);
      expect(easy.reduce((s, t) => s + t, 0)).toBeLessThan(hard.reduce((s, t) => s + t, 0));
      for (const t of [...easy, ...hard]) expect(t >= 3 && t <= 10).toBe(true);
      expect(new Set(hard).size).toBe(3);
    }
    expect(new Set(pairTotals(6, 5, Math.random, 'hard')).size).toBe(3);
  });
});
