import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { floats, seeded, type Tier } from './buoyancyModel';
import {
  FOODS, MAX_SPOONS, describeSalt, floatsAt, foodByKey, makeSaltChallenge, pickSaltChallenges, saltFeedback, saltMatches, saltMiss,
  saltWindow, spoonsToFloat, type SaltChallenge,
} from './saltModel';
import { buildBuoyancyHarbor } from '../../../service/physics/buoyancy-harbor-generator';
import { validateBuoyancyHarborData } from './buoyancyHarbor.boss';
import { saltScene } from './buoyancyWorkspace';
import { EASIER_LEVER, HARBOR_LEVERS, XRAY_LEVER, easierSalt, practiceLeaks } from './buoyancyLevers';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const food = (k: string) => foodByKey(k)!;
const items = (): SaltChallenge[] => TIERS.flatMap(t => Array.from({ length: 12 }, (_, s) => pickSaltChallenges(4, t, seeded(s + 1), `s${t}${s}`))).flat();

describe('the salt model', () => {
  it('every food sinks in fresh water and floats before the jar is empty', () => {
    for (const f of FOODS) {
      expect(floats(f)).toBe(false);
      expect(floatsAt(f, 0)).toBe(false);
      expect(spoonsToFloat(f)).toBeLessThanOrEqual(MAX_SPOONS);
      expect(floatsAt(f, spoonsToFloat(f))).toBe(true);
      expect(floatsAt(f, spoonsToFloat(f) - 1)).toBe(false);
    }
  });

  it('each food needs a different amount, and the big sweet potato floats before the small grape', () => {
    expect(new Set(FOODS.map(spoonsToFloat)).size).toBe(FOODS.length);
    expect(spoonsToFloat(food('sweet-potato'))).toBeLessThan(spoonsToFloat(food('grape')));
  });

  it('checks both sides of the goal and names the miss', () => {
    const c = makeSaltChallenge('s', [food('egg'), food('potato')], ['egg'], ['potato']);
    const [lo, hi] = saltWindow(c);
    expect(saltMiss(c, lo - 1)).toBe('too_little_salt');
    expect(saltMatches(c, lo)).toBe(true);
    expect(saltMatches(c, hi)).toBe(true);
    expect(saltMiss(c, hi + 1)).toBe('too_much_salt');
    expect(saltFeedback(c, hi + 1)).toContain('potato chunk floats too');
    expect(describeSalt(c, 0)).toBe('put no salt in the water: the egg and the potato chunk are on the bottom');
  });
});

describe('salt items by tier', () => {
  it('easy floats one food; medium floats one and keeps one down with room; hard is three foods and one spoon', () => {
    for (const t of TIERS) for (let s = 1; s <= 20; s++) for (const c of pickSaltChallenges(4, t, seeded(s), 'x')) {
      const [lo, hi] = saltWindow(c);
      expect(lo).toBeLessThanOrEqual(hi);
      if (t === 'easy') { expect(c.things).toHaveLength(1); expect(c.sinkGoal).toEqual([]); }
      if (t === 'medium') { expect(c.things).toHaveLength(2); expect(hi - lo).toBeGreaterThanOrEqual(1); }
      if (t === 'hard') { expect(c.things).toHaveLength(3); expect(hi).toBe(lo); }
    }
  });

  it('a session never repeats a set of foods', () => {
    for (const t of TIERS) {
      const sets = pickSaltChallenges(4, t, seeded(7), 'x').map(c => [...c.floatGoal, '|', ...c.sinkGoal].join());
      expect(new Set(sets).size).toBe(4);
    }
  });

  it('the generator builds valid salt sessions, alone and mixed', () => {
    for (const t of TIERS) {
      const d = buildBuoyancyHarbor({ gradeLevel: 'Grade 4', supportTier: t }, 11, ['salt_water']);
      expect(d.challenges.every(c => c.type === 'salt_water')).toBe(true);
      expect(() => validateBuoyancyHarborData(d)).not.toThrow();
    }
    const mixed = buildBuoyancyHarbor({ gradeLevel: 'Grade 4', supportTier: 'medium' }, 3, ['drop_test', 'build_boat', 'salt_water']);
    expect(new Set(mixed.challenges.map(c => c.type))).toEqual(new Set(['drop_test', 'build_boat', 'salt_water']));
    expect(() => validateBuoyancyHarborData(mixed)).not.toThrow();
  });

  it('the validator rejects an impossible goal and a food with a made-up density', () => {
    const base = buildBuoyancyHarbor({ gradeLevel: 'Grade 4', supportTier: 'medium' }, 1, ['salt_water']);
    const flipped = { ...base, challenges: [makeSaltChallenge('s', [food('egg'), food('potato')], ['potato'], ['egg'])] };
    expect(() => validateBuoyancyHarborData(flipped)).toThrow();
    const fake = { ...base, challenges: [makeSaltChallenge('s', [{ ...food('egg'), density: 0.9 }], ['egg'], [])] };
    expect(() => validateBuoyancyHarborData(fake)).toThrow();
  });
});

describe('what the tutor sees', () => {
  it('the scene names the goal and the salt, never how many spoons a food needs', () => {
    for (const c of items()) {
      const facts = JSON.stringify(saltScene(c, { settled: [true, true, true], guesses: [null, null, null], spoons: 0, log: [] }).facts);
      expect(facts).toContain('no salt');
      const [lo] = saltWindow(c);
      expect(facts).not.toMatch(new RegExp(`\\b${lo} spoons?\\b`));
    }
  });
});

describe('salt levers', () => {
  const c = makeSaltChallenge('s1', [food('egg'), food('potato'), food('grape')], ['egg'], ['potato', 'grape']);
  const inWater = { settledTests: 3, boatLaunched: false };
  it('x-ray once the foods are in the water, and the easier item', () => {
    const ids = (ctx: typeof inWater) => HARBOR_LEVERS.declare(c, ctx, []).map(l => l.id);
    expect(ids({ settledTests: 0, boatLaunched: false })).toEqual([EASIER_LEVER]);
    expect(ids(inWater)).toEqual([XRAY_LEVER, EASIER_LEVER]);
  });
  it.each(['too_little_salt', 'too_much_salt'])('%s -> x-ray, then the easier item', miss => {
    expect(nextLever(HARBOR_LEVERS.declare(c, inWater, []), miss)).toBe(XRAY_LEVER);
    expect(nextLever(HARBOR_LEVERS.declare(c, inWater, [XRAY_LEVER]), miss)).toBe(EASIER_LEVER);
  });
  it('the easier item is one food to float, and simpler, for every generated item', () => {
    for (const item of items()) {
      const p = easierSalt(item);
      if (!p) { expect(item.things).toHaveLength(1); expect(spoonsToFloat(item.things[0])).toBe(Math.min(...FOODS.map(spoonsToFloat))); continue; }
      expect(practiceLeaks(item, p)).toBe(false);
      expect(easierSalt(p)).toBeNull();
    }
  });
});
