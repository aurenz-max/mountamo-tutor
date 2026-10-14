import { describe, expect, it } from 'vitest';
import { ADD_SUB_100, ADD_SUB_1000 } from '../itemSpace/multiDigit';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { itemFitsMode, rwChallenge, type RwMode } from './regroupingWorkbenchItemSpace';

const MODES: RwMode[] = ['add_no_regroup', 'subtract_no_regroup', 'add_regroup', 'subtract_regroup'];

describe('regrouping-workbench from add-sub-100 / add-sub-1000', () => {
  for (const space of [ADD_SUB_100, ADD_SUB_1000]) {
    it(`${space.id}: every mode fills every tier with its own operation and regroup kind, mean beta rising`, () => {
      for (const mode of MODES) {
        const scope = (it: any) => itemFitsMode(it, mode);
        const means = Object.values(TIER_BANDS).map((band) => {
          const picks = tierPick(space, undefined, scope)(4, band[0], band[1], Math.random, scope);
          expect(picks).toHaveLength(4);
          for (const p of picks) {
            expect(p.op).toBe(mode.startsWith('add') ? '+' : '-');
            expect(p.features.regroups > 0).toBe(!mode.includes('no_regroup'));
          }
          expect(new Set(picks.map((p) => `${p.a}${p.op}${p.b}`)).size).toBe(4);
          return picks.reduce((s, p) => s + p.beta, 0) / 4;
        });
        expect(means[0]).toBeLessThanOrEqual(means[1]);
        expect(means[1]).toBeLessThanOrEqual(means[2]);
        expect(means[0]).toBeLessThan(means[2]);
      }
    });
  }

  it('the challenge states the problem and its regroup count; hint and narration never state the answer', () => {
    for (const it of ADD_SUB_1000.pick(30, -3, 4)) {
      const ch = rwChallenge(it, it.op === '+' ? 'add_regroup' : 'subtract_regroup', 'add-sub-1000', 'c1');
      expect(ch.problem).toBe(`${it.a} ${it.op} ${it.b}`);
      expect(ch.regroupCount).toBe(it.features.regroups);
      const answer = String(it.op === '+' ? it.a + it.b : it.a - it.b);
      expect(`${ch.hint} ${ch.narration}`).not.toContain(answer);
    }
  });
});
