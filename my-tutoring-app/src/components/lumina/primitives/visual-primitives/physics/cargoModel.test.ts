import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { OFFER_GUIDANCE_MAX } from '../../../components/live-activity/adapters/adapterContract';
import { seeded, type Tier } from './buoyancyModel';
import { allBuilds, type BoatBuild } from './boatModel';
import {
  cargoFair, cargoFeedback, cargoInstruction, cargoMatches, cargoMiss, changedParts, describeCargo, held, oneChangeAway,
  pickCargoChallenges, winner, type CargoChallenge,
} from './cargoModel';
import { buildBuoyancyHarbor } from '../../../service/physics/buoyancy-harbor-generator';
import { validateBuoyancyHarborData } from './buoyancyHarbor.boss';
import { cargoScene } from './buoyancyWorkspace';
import { CHANGES_LEVER, EASIER_LEVER, HARBOR_LEVERS, PENNY_ROWS_LEVER, easierCargo, practiceLeaks } from './buoyancyLevers';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const items = (): CargoChallenge[] => TIERS.flatMap(t => Array.from({ length: 15 }, (_, s) => pickCargoChallenges(3, t, seeded(s + 1), `c${t}${s}`))).flat();
const boat = (material: BoatBuild['material'], shape: BoatBuild['shape'], size: BoatBuild['size']): BoatBuild => ({ material, shape, size });
const item = (over: Partial<CargoChallenge>): CargoChallenge => {
  const base = { id: 'c', type: 'cargo_two_designs' as const, materials: ['foil', 'clay'] as BoatBuild['material'][],
    given: boat('foil', 'low_sides', 'small'), oneChange: true, question: null, ...over };
  return { ...base, instruction: cargoInstruction(base) };
};

describe('the two-boat check', () => {
  // Small foil, low sides carries 5; tall sides carries 11; a big clay ball sinks empty.
  const A = boat('foil', 'low_sides', 'small'), tall = boat('foil', 'tall_sides', 'small'), lump = boat('clay', 'ball', 'big');
  it('the claim must match the tests; the guess is never graded', () => {
    expect([held(A), held(tall), held(lump)]).toEqual([5, 11, 0]);
    const c = item({});
    expect(cargoMatches(c, { a: A, b: tall, prediction: 'a', claim: 'b' })).toBe(true);
    expect(cargoMiss(c, { a: A, b: tall, prediction: 'a', claim: 'a' })).toBe('kept_prediction');
    expect(cargoMiss(c, { a: A, b: tall, prediction: 'b', claim: 'same' })).toBe('misread_results');
  });
  it('from medium the test must be fair; at hard it must change the asked part', () => {
    const twoChanges = boat('clay', 'tall_sides', 'small');
    expect(cargoMiss(item({}), { a: A, b: twoChanges, prediction: 'a', claim: winner(A, twoChanges) })).toBe('changed_two');
    expect(cargoMiss(item({ oneChange: false }), { a: A, b: twoChanges, prediction: 'a', claim: winner(A, twoChanges) })).toBeUndefined();
    const hard = item({ given: null, question: 'size' });
    expect(cargoMiss(hard, { a: A, b: tall, prediction: 'b', claim: 'b' })).toBe('wrong_change');
    const big = boat('foil', 'low_sides', 'big');
    expect(cargoMiss(hard, { a: A, b: big, prediction: 'b', claim: winner(A, big) })).toBeUndefined();
  });
  it('feedback names the counts only on a pass, from the learner\'s own tests', () => {
    const c = item({});
    expect(cargoFeedback(c, { a: A, b: tall, prediction: 'a', claim: 'b' })).toBe('Yes! Boat B carried 11 pennies and boat A carried 5 pennies. The only thing you changed was its shape, so that made the difference.');
    for (const claim of ['a', 'same'] as const) expect(cargoFeedback(c, { a: A, b: tall, prediction: 'a', claim })).not.toMatch(/\d/);
    expect(describeCargo({ a: A, b: tall, prediction: 'a', claim: 'b' })).not.toMatch(/\d/);
  });
});

describe('two-boat items by tier', () => {
  it('every item is fair: a given boat A floats, and some boat B carries more and some less', () => {
    for (const c of items()) expect(cargoFair(c)).toBe(true);
  });
  it('easy gives boat A, medium gives it and asks for one change, hard asks a different question each item', () => {
    for (let s = 1; s <= 20; s++) {
      for (const c of pickCargoChallenges(3, 'easy', seeded(s))) expect([!!c.given, c.oneChange, c.question]).toEqual([true, false, null]);
      for (const c of pickCargoChallenges(3, 'medium', seeded(s))) expect([!!c.given, c.oneChange, c.question]).toEqual([true, true, null]);
      const hard = pickCargoChallenges(3, 'hard', seeded(s));
      expect(hard.every(c => !c.given && c.oneChange)).toBe(true);
      expect(new Set(hard.map(c => c.question)).size).toBe(3);
    }
  });
  it('a session fills its count with a different boat A each time', () => {
    for (const t of ['easy', 'medium'] as const) for (let s = 1; s <= 10; s++) {
      const cs = pickCargoChallenges(3, t, seeded(s));
      expect(cs).toHaveLength(3);
      expect(new Set(cs.map(c => JSON.stringify(c.given))).size).toBe(3);
    }
  });
  it('a one-change boat B can beat boat A or lose to it: "the new one wins" is never the rule', () => {
    for (const c of items().filter(x => x.given && x.oneChange)) {
      const bs = oneChangeAway(c.given!, c.materials);
      expect(bs.some(b => held(b) > held(c.given!)) && bs.some(b => held(b) < held(c.given!))).toBe(true);
    }
  });
  it('the generator builds valid sessions, alone and mixed; the validator rejects an unfair item', () => {
    for (const t of TIERS) {
      const d = buildBuoyancyHarbor({ gradeLevel: 'Grade 2', supportTier: t }, 7, ['cargo_two_designs']);
      expect(d.challenges.every(c => c.type === 'cargo_two_designs')).toBe(true);
      expect(d.challenges).toHaveLength(1); // one long build-and-test item per session (user 2026-11-01)
      expect(() => validateBuoyancyHarborData(d)).not.toThrow();
    }
    const mixed = buildBuoyancyHarbor({ gradeLevel: 'Grade 2', supportTier: 'medium' }, 3,
      ['drop_test', 'find_the_rule', 'build_boat', 'cargo_two_designs', 'salt_water']);
    expect(new Set(mixed.challenges.map(c => c.type)).size).toBe(5);
    expect(() => validateBuoyancyHarborData(mixed)).not.toThrow();
    // A boat A that sinks empty, and a material question with one material.
    for (const bad of [item({ given: boat('clay', 'ball', 'big') }), item({ given: null, question: 'material', materials: ['foil'] })]) {
      expect(() => validateBuoyancyHarborData({ ...mixed, challenges: [bad] })).toThrow();
    }
  });
});

describe('what the tutor sees', () => {
  it('a boat\'s pennies reach the scene only from its test', () => {
    const empty = { material: null, shape: null, size: null };
    for (const c of items()) {
      const a = c.given ?? allBuilds(c.materials)[0];
      const view = { a, b: empty, active: 'b' as const, prediction: null, launched: false, pennies: 0, tests: [], claim: null };
      expect(JSON.stringify(cargoScene(c, view).facts)).not.toMatch(/carried|\d+ penn/);
    }
    const c = item({});
    const a = c.given!, b = boat('foil', 'tall_sides', 'small');
    const f = cargoScene(c, { a, b, active: 'b', prediction: 'a', launched: false, pennies: 0, claim: null,
      tests: [{ boat: 'a', name: 'x', held: held(a) }] }).facts;
    expect(f.tests).toBe('boat A (x) carried 5 pennies and sank with the next one');
    expect(f.changed).toBe('its shape');
  });
  it('the harbor guidance still fits the offer', () => {
    expect(LIVE_ADAPTERS['buoyancy-harbor'].guidance.length).toBeLessThanOrEqual(OFFER_GUIDANCE_MAX);
  });
});

describe('two-boat levers', () => {
  const c = item({});
  const tested = { settledTests: 1, boatLaunched: false };
  it('the penny rows once a boat is tested; the change marks and the easier comparison always', () => {
    const ids = (ctx: typeof tested) => HARBOR_LEVERS.declare(c, ctx, []).map(l => l.id);
    expect(ids({ settledTests: 0, boatLaunched: false })).toEqual([CHANGES_LEVER, EASIER_LEVER]);
    expect(ids(tested)).toEqual([PENNY_ROWS_LEVER, CHANGES_LEVER, EASIER_LEVER]);
  });
  it.each([
    ['kept_prediction', PENNY_ROWS_LEVER], ['misread_results', PENNY_ROWS_LEVER],
    ['changed_two', CHANGES_LEVER], ['wrong_change', CHANGES_LEVER],
  ])('%s -> %s, then the easier comparison', (miss, first) => {
    expect(nextLever(HARBOR_LEVERS.declare(c, tested, []), miss)).toBe(first);
    expect(nextLever(HARBOR_LEVERS.declare(c, tested, [first]), miss)).toBe(EASIER_LEVER);
  });
  it('the easier comparison builds both boats, one change apart, never the item\'s boat A', () => {
    for (const x of items()) {
      const p = easierCargo(x);
      expect(p).not.toBeNull();
      expect(practiceLeaks(x, p!)).toBe(false);
      expect(changedParts(p!.given!, p!.givenB!)).toHaveLength(1);
      expect(easierCargo(p!)).toBeNull();
    }
  });
});
