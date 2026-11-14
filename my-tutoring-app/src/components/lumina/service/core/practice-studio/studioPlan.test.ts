import { describe, expect, it, vi } from 'vitest';

vi.mock('../../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

import { fillPlan, planProblems } from './studioPlan';
import { STUDIO_PLANS } from './plans';

describe('studio plans (the gate every plan passes)', () => {
  for (const plan of STUDIO_PLANS) {
    it(`${plan.id}: every problem fills with no problem found`, () => {
      expect(planProblems(plan)).toEqual([]);
    });

    it(`${plan.id}: every step ships its help and simplify levers on every problem`, () => {
      plan.problems.forEach((_, n) => {
        for (const item of fillPlan(plan, n, 1).data.challenges) expect((item.levers ?? []).map(l => l.kind).sort()).toEqual(['help', 'simplify']);
      });
    });
  }

  it('lever-lift: the predict key is worked out from the model, and differs across problems', () => {
    const plan = STUDIO_PLANS.find(p => p.id === 'lever-lift')!;
    const keys = plan.problems.map((_, n) => {
      const predict = fillPlan(plan, n, 1).data.challenges[1];
      return predict.options.find(o => o.id === predict.key)?.label;
    });
    expect(keys).toEqual(['4 blocks out', '6 blocks out', '3 blocks out', '5 blocks out']);
  });

  it('stream-settle and truck-trips: the predict keys differ across problems', () => {
    const keysOf = (id: string) => {
      const plan = STUDIO_PLANS.find(p => p.id === id)!;
      return plan.problems.map((_, n) => {
        const predict = fillPlan(plan, n, 1).data.challenges[1];
        return predict.options.find(o => o.id === predict.key)?.label;
      });
    };
    expect(keysOf('stream-settle')).toEqual(['Speed 5', 'Speed 7', 'Speed 4', 'Speed 6']);
    expect(keysOf('truck-trips')).toEqual(['3 trips', '4 trips', '5 trips', '6 trips']);
  });
});
