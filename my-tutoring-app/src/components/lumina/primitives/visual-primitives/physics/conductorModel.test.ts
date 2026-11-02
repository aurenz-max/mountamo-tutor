import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import {
  buildConductor, callFor, condByKey, conducts, conductorFair, conductorMatches, conductorMiss, describeConductor, looksFool,
  makeConductor, pickConductors,
} from './conductorModel';
import type { Tier } from './circuitModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { conductorScene } from './circuitWorkspace';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const t = (k: string) => condByKey(k)!;

describe('the conductor model', () => {
  it('metal conducts whatever it looks like; pencil lead conducts; the rest do not', () => {
    expect(conducts(t('rusty-nail'))).toBe(true);
    expect(conducts(t('button'))).toBe(false);
    expect(conducts(t('pencil-lead'))).toBe(true);
    expect(conducts(t('eraser'))).toBe(false);
    expect(looksFool(t('rusty-nail')) && looksFool(t('button'))).toBe(true);
  });

  it('checks every call and names the miss by what fooled the eye', () => {
    const c = makeConductor('c', [t('spoon'), t('straw'), t('eraser')], [t('rusty-nail'), t('button')]);
    expect(conductorFair(c)).toBe(true);
    expect(conductorMatches(c, ['lights', 'stays_off'])).toBe(true);
    expect(conductorMiss(c, ['stays_off', 'stays_off'])).toBe('judged_by_shine');
    const plain = makeConductor('p', [t('spoon'), t('eraser')], [t('key')]);
    expect(conductorMiss(plain, ['stays_off'])).toBe('sort_slip');
    expect(describeConductor(c, ['lights', null])).toBe('said the rusty nail lights the bulb and the shiny plastic button no call');
  });
});

describe('conductor items', () => {
  it('every tier builds fair items: easy 2 + 1, medium 3 + 2, hard things to sort that fool the eye', () => {
    for (const tier of TIERS) for (let s = 1; s <= 20; s++) {
      const c = buildConductor(tier, seeded(s), 'x');
      expect(c).not.toBeNull();
      expect(conductorFair(c!)).toBe(true);
      expect(c!.tested).toHaveLength(tier === 'easy' ? 2 : 3);
      expect(c!.toSort).toHaveLength(tier === 'easy' ? 1 : 2);
      if (tier === 'hard') expect(c!.toSort.every(looksFool)).toBe(true);
      else expect(c!.toSort.some(looksFool)).toBe(false);
      if (c!.toSort.length === 2) expect(callFor(c!.toSort[0])).not.toBe(callFor(c!.toSort[1]));
    }
  });

  it('a session is full and valid; the generator builds conductor sessions', () => {
    for (const tier of TIERS) {
      expect(pickConductors(4, tier, seeded(3), 'c')).toHaveLength(4);
      const d = buildCircuitWorkbench({ gradeLevel: 'Grade 3', supportTier: tier }, 7, ['conductor_test']);
      expect(() => validateCircuitWorkbenchData(d)).not.toThrow();
    }
  });

  it('the validator rejects an unfair item (all tests conduct)', () => {
    const base = buildCircuitWorkbench({ gradeLevel: 'Grade 3', supportTier: 'easy' }, 1, ['conductor_test']);
    const unfair = { ...base, challenges: [makeConductor('u', [t('spoon'), t('coin')], [t('key')])] };
    expect(() => validateCircuitWorkbenchData(unfair)).toThrow();
  });
});

describe('what the tutor sees', () => {
  it('a thing to sort has no result in the scene before a right check', () => {
    for (const c of pickConductors(4, 'hard', seeded(5), 'h')) {
      const facts = JSON.stringify(conductorScene(c, { guesses: [], tested: c.tested.map(() => true), inGap: null, calls: [null, null], revealed: false }).facts);
      for (const s of c.toSort) expect(facts).toContain(`the ${s.name} (made of`);
      expect(facts).not.toMatch(/tested after the check/);
    }
  });
});
