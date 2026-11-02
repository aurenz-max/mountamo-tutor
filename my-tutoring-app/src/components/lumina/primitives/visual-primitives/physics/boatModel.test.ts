import { describe, expect, it } from 'vitest';
import {
  allBuilds, boatFeedback, boatMatches, boatMiss, capacity, describeBoat, draft, floatsWith, passingShare, pickBoatChallenges,
  type BoatBuild, type BoatChallenge,
} from './boatModel';
import { seeded } from './buoyancyModel';
import { buildBuoyancyHarbor } from '../../../service/physics/buoyancy-harbor-generator';
import { validateBuoyancyHarborData } from './buoyancyHarbor.boss';
import { boatScene } from './buoyancyWorkspace';

const b = (material: BoatBuild['material'], shape: BoatBuild['shape'], size: BoatBuild['size']): BoatBuild => ({ material, shape, size });
const item = (goal: number, materials: BoatChallenge['materials'] = ['foil', 'clay']): BoatChallenge =>
  ({ id: 'boat-1', type: 'build_boat', instruction: 'x', goal, materials });

describe('the boat model', () => {
  it('a lump of clay sinks; the same clay with sides floats and carries pennies', () => {
    expect(capacity(b('clay', 'ball', 'small'))).toBe(-1);
    expect(floatsWith(b('clay', 'ball', 'small'), 0)).toBe(false);
    expect(capacity(b('clay', 'tall_sides', 'small'))).toBeGreaterThan(0);
  });

  it('taller sides and a bigger floor carry more; no sides carries next to nothing', () => {
    for (const m of ['foil', 'clay', 'sticks'] as const) {
      expect(capacity(b(m, 'tall_sides', 'small'))).toBeGreaterThan(capacity(b(m, 'low_sides', 'small')));
      expect(capacity(b(m, 'tall_sides', 'big'))).toBeGreaterThan(capacity(b(m, 'tall_sides', 'small')));
      expect(capacity(b(m, 'low_sides', 'small'))).toBeGreaterThan(capacity(b(m, 'flat', 'small')));
    }
    expect(capacity(b('foil', 'ball', 'big'))).toBe(0);
  });

  it('floats up to its capacity and sinks with one more; the draft stays at or under 1 while it floats', () => {
    for (const build of allBuilds()) {
      const cap = capacity(build);
      if (cap < 0) continue;
      expect(floatsWith(build, cap)).toBe(true);
      if (cap < 30) expect(floatsWith(build, cap + 1)).toBe(false);
      expect(draft(build, cap)).toBeLessThanOrEqual(1);
    }
  });

  it('names the miss: sinks empty, no sides, too small', () => {
    expect(boatMiss(item(6), b('clay', 'ball', 'big'))).toBe('sinks_empty');
    expect(boatMiss(item(6), b('foil', 'flat', 'big'))).toBe('no_sides');
    expect(boatMiss(item(6), b('foil', 'low_sides', 'small'))).toBe('too_small');
    expect(boatMiss(item(6), b('foil', 'tall_sides', 'small'))).toBeUndefined();
    expect(boatMatches(item(6), b('foil', 'tall_sides', 'small'))).toBe(true);
  });

  it('the words describe the build, never what it carries', () => {
    expect(describeBoat(b('clay', 'tall_sides', 'big'))).toBe('built a big clay boat with tall sides');
    expect(boatFeedback(item(12), b('clay', 'low_sides', 'small'))).not.toMatch(/\b2\b/);
  });
});

describe('boat items', () => {
  it('every tier: distinct rising goals in range, each carried by some build and (above easy) by at most half', () => {
    const range = { easy: [2, 5], medium: [4, 9], hard: [9, 15] } as const;
    for (const tier of ['easy', 'medium', 'hard'] as const) for (let seed = 1; seed < 30; seed++) {
      const cs = pickBoatChallenges(4, tier, seeded(seed));
      const goals = cs.map(c => c.goal);
      expect(new Set(goals).size).toBe(Math.min(4, range[tier][1] - range[tier][0] + 1));
      expect([...goals].sort((x, y) => x - y)).toEqual(goals);
      for (const c of cs) {
        expect(c.goal).toBeGreaterThanOrEqual(range[tier][0]);
        expect(c.goal).toBeLessThanOrEqual(range[tier][1]);
        const share = passingShare(c.goal, c.materials);
        expect(share).toBeGreaterThan(0);
        if (tier !== 'easy') expect(share).toBeLessThanOrEqual(0.5);
        expect(c.instruction).toContain(`carries ${c.goal} pennies`);
      }
      if (tier === 'hard') expect(cs.every(c => !c.materials.includes('sticks'))).toBe(true);
    }
  });

  it('the generator builds boat-only and mixed sessions the boss accepts', () => {
    const boats = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: 'medium' }, 5, ['build_boat']);
    expect(boats.challenges.map(c => c.type)).toEqual(['build_boat', 'build_boat', 'build_boat', 'build_boat']);
    expect(boats.challengeType).toBe('build_boat');
    expect(() => validateBuoyancyHarborData(boats)).not.toThrow();
    const mixed = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: 'easy' }, 5, ['drop_test', 'build_boat']);
    expect(mixed.challenges.map(c => c.type)).toEqual(['drop_test', 'drop_test', 'drop_test', 'build_boat', 'build_boat']);
    expect(new Set(mixed.challenges.map(c => c.id)).size).toBe(5);
    expect(() => validateBuoyancyHarborData(mixed)).not.toThrow();
  });

  it('the boss rejects a goal no build can carry', () => {
    const d = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: 'hard' }, 5, ['build_boat']);
    const bad = { ...d, challenges: [{ ...d.challenges[0], goal: 29, materials: ['clay'] }] } as typeof d;
    expect(() => validateBuoyancyHarborData(bad)).toThrow();
  });

  it('the scene states the goal and the tests, never what an untested build carries', () => {
    const view = { draft: b('foil', 'tall_sides', 'small'), launched: false, pennies: 0, tests: [] };
    const facts = boatScene(item(6), view).facts;
    expect(facts.goal).toBe('build a boat that carries 6 pennies without sinking');
    expect(facts.boat).toBe('a small foil boat with tall sides');
    expect(JSON.stringify(facts)).not.toMatch(/\b11\b|capacity|holds up to/);
    const tested = boatScene(item(6), { ...view, launched: true, pennies: 3, tests: [{ name: 'a small flat sheet of foil', pennies: 1, sank: true }] }).facts;
    expect(tested.boatNow).toBe('floating in the tank');
    expect(tested.penniesInBoat).toBe(3);
    expect(tested.tests).toBe('a small flat sheet of foil sank with 1 penny in it');
  });
});
