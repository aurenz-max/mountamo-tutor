import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import {
  changeMatters, describeKitchen, fairB, foamHeight, higher, kitchenCandidates, kitchenMatches, kitchenMiss, makeKitchen,
  pickKitchens, type Tier,
} from './volcanoModel';
import { buildVolcanoIsland } from '../../../service/physics/volcano-island-generator';
import { validateVolcanoIslandData } from './volcanoIsland.boss';
import { kitchenScene } from './volcanoWorkspace';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];

describe('the volcano model', () => {
  it('the foam rises as high as the smaller amount allows', () => {
    expect(foamHeight({ soda: 1, vinegar: 3 })).toBe(1);
    expect(foamHeight({ soda: 3, vinegar: 3 })).toBe(3);
    expect(higher({ soda: 1, vinegar: 3 }, { soda: 2, vinegar: 3 })).toBe('b');
    expect(higher({ soda: 3, vinegar: 1 }, { soda: 4, vinegar: 1 })).toBe('same');
  });

  it('checks a fair B and the claim against the eruptions; names the miss', () => {
    const c = makeKitchen('k', { soda: 1, vinegar: 3 }, 'soda', false);
    expect(kitchenMatches(c, { b: { soda: 2, vinegar: 3 }, prediction: 'a', claim: 'b' })).toBe(true);
    expect(kitchenMiss(c, { b: { soda: 2, vinegar: 2 }, prediction: 'b', claim: 'b' })).toBe('changed_both');
    expect(kitchenMiss(c, { b: { soda: 1, vinegar: 3 }, prediction: 'same', claim: 'same' })).toBe('no_change');
    expect(kitchenMiss(c, { b: { soda: 2, vinegar: 3 }, prediction: 'a', claim: 'a' })).toBe('kept_prediction');
    expect(kitchenMiss(c, { b: { soda: 2, vinegar: 3 }, prediction: 'b', claim: 'same' })).toBe('misread_result');
    expect(describeKitchen(c, { b: { soda: 2, vinegar: 3 }, prediction: 'a', claim: null })).not.toMatch(/higher than|mark/);
  });
});

describe('kitchen items', () => {
  it('easy and medium change what runs out first (more makes it higher); hard changes what is already enough', () => {
    for (const t of TIERS) {
      expect(kitchenCandidates(t).length).toBeGreaterThan(1);
      for (const c of pickKitchens(4, t, seeded(3), 'x')) {
        expect(changeMatters(c.a, c.change)).toBe(t !== 'hard');
        expect(c.lockOther).toBe(t === 'easy');
        const more = { ...c.a, [c.change]: c.a[c.change] + 1 };
        expect(fairB(c, more)).toBe(true);
        expect(higher(c.a, more)).toBe(t === 'hard' ? 'same' : 'b');
      }
    }
  });

  it('the generator builds valid sessions; the validator rejects an unknown amount', () => {
    for (const t of TIERS) expect(() => validateVolcanoIslandData(buildVolcanoIsland({ gradeLevel: 'Grade 1', supportTier: t }, 5))).not.toThrow();
    const d = buildVolcanoIsland({ gradeLevel: 'Grade 1' }, 1);
    expect(() => validateVolcanoIslandData({ ...d, challenges: [{ ...d.challenges[0], a: { soda: 9, vinegar: 1 } }] })).toThrow();
  });

  it('the scene has no foam height before an eruption', () => {
    const c = makeKitchen('k', { soda: 1, vinegar: 3 }, 'soda', true);
    const facts = JSON.stringify(kitchenScene(c, { b: { soda: 2, vinegar: 3 }, prediction: null, eruptedA: false, eruptedB: false, claim: null }).facts);
    expect(facts).not.toContain('mark ');
    expect(facts).toContain('only the baking soda can change');
  });
});
