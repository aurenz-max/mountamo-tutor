import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { buildDropTest, pickDropTests, seeded, thingByKey, type DropTestChallenge, type Tier } from './buoyancyModel';
import { allBuilds, capacity, pickBoatChallenges, type BoatChallenge } from './boatModel';
import {
  EASIER_LEVER, HARBOR_LEVERS, SIDE_BY_SIDE_LEVER, SOLVED_BOAT_LEVER, TAGS_LEVER, XRAY_LEVER, easierBoat, easierDropTest,
  modelBoatLeaks, pairLeaks, practiceItem, practiceLeaks, sameStuffPair, solvedBoats,
} from './buoyancyLevers';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const drops = (): DropTestChallenge[] => TIERS.flatMap(t => Array.from({ length: 12 }, (_, s) => pickDropTests(5, t, seeded(s + 1), `d${t}${s}`))).flat();
const boats = (): BoatChallenge[] => TIERS.flatMap(t => Array.from({ length: 12 }, (_, s) => pickBoatChallenges(4, t, seeded(s + 1), `b${t}${s}`))).flat();
const tested = { settledTests: 2, boatLaunched: true };
const ids = (c: Parameters<typeof HARBOR_LEVERS.declare>[0], ctx = tested, pulled: string[] = []) =>
  HARBOR_LEVERS.declare(c, ctx, pulled).map(l => l.id);

describe('which levers each mode offers', () => {
  it('drop test: x-ray only once a test is in the water; tags, the pair and the easier test', () => {
    const c = buildDropTest(thingByKey('log')!, 'hard', seeded(2), 'd1');
    expect(ids(c, { settledTests: 0, boatLaunched: false })).toEqual([TAGS_LEVER, SIDE_BY_SIDE_LEVER, EASIER_LEVER]);
    expect(ids(c)).toEqual([XRAY_LEVER, TAGS_LEVER, SIDE_BY_SIDE_LEVER, EASIER_LEVER]);
  });

  it('boat: x-ray only while the boat is in the water; the model boats and the easier boat', () => {
    const c: BoatChallenge = { id: 'b1', type: 'build_boat', instruction: 'x', goal: 9, materials: ['foil', 'clay'] };
    expect(ids(c, { settledTests: 0, boatLaunched: false })).toEqual([SOLVED_BOAT_LEVER, EASIER_LEVER]);
    expect(ids(c)).toEqual([XRAY_LEVER, SOLVED_BOAT_LEVER, EASIER_LEVER]);
  });

  it('a practice item offers nothing', () => {
    for (const c of [...drops().slice(0, 10), ...boats().slice(0, 10)]) {
      const p = practiceItem(c);
      if (p) expect(ids(p)).toEqual([]);
    }
  });
});

describe('this miss, then this lever', () => {
  const drop = buildDropTest(thingByKey('paper-clip')!, 'hard', seeded(5), 'd2');
  const boat: BoatChallenge = { id: 'b2', type: 'build_boat', instruction: 'x', goal: 9, materials: ['foil', 'clay'] };
  it.each([
    ['judged_by_size', XRAY_LEVER, SIDE_BY_SIDE_LEVER],
    ['wrong_call', XRAY_LEVER, SIDE_BY_SIDE_LEVER],
    ['other_thing', TAGS_LEVER, EASIER_LEVER],
  ])('drop test %s -> %s, then %s', (miss, first, second) => {
    expect(nextLever(HARBOR_LEVERS.declare(drop, tested, []), miss)).toBe(first);
    expect(nextLever(HARBOR_LEVERS.declare(drop, tested, [first]), miss)).toBe(second);
  });
  it.each([
    ['sinks_empty', XRAY_LEVER, SOLVED_BOAT_LEVER],
    ['no_sides', XRAY_LEVER, SOLVED_BOAT_LEVER],
    ['too_small', XRAY_LEVER, EASIER_LEVER],
  ])('boat %s -> %s, then %s', (miss, first, second) => {
    expect(nextLever(HARBOR_LEVERS.declare(boat, tested, []), miss)).toBe(first);
    expect(nextLever(HARBOR_LEVERS.declare(boat, tested, [first]), miss)).toBe(second);
  });
  it('with the boat out of the water, a boat without sides gets the model boats first', () => {
    expect(nextLever(HARBOR_LEVERS.declare(boat, { settledTests: 0, boatLaunched: false }, []), 'no_sides')).toBe(SOLVED_BOAT_LEVER);
  });
});

describe('leak rules', () => {
  it('the same-stuff pair is one stuff, two sizes, never the item\'s stuff, over every generated item', () => {
    for (const c of drops()) {
      const pair = sameStuffPair(c);
      expect(pair).not.toBeNull();
      expect(pairLeaks(c, pair!)).toBe(false);
    }
  });

  it('the model boat never carries the goal from the item\'s stuff; the lump is the same stuff', () => {
    for (const c of boats()) {
      const m = solvedBoats(c);
      // Only a tiny goal from clay and foil leaves no model boat that would not carry it.
      if (!m) { expect(c.goal).toBeLessThanOrEqual(3); continue; }
      const [lump, boat] = m.boats;
      expect(modelBoatLeaks(c, boat.build)).toBe(false);
      expect(lump.build.material).toBe(boat.build.material);
      expect(lump.build.shape).toBe('ball');
      expect(boat.pennies).toBeLessThanOrEqual(capacity(boat.build));
      expect(boat.pennies).toBeGreaterThan(0);
    }
  });

  it('every hard and medium boat gets a model boat', () => {
    for (const c of boats().filter(b => b.goal >= 4)) expect(solvedBoats(c)).not.toBeNull();
  });

  it('easier drop tests: same mode, its own id, none of the item\'s stuff, a size that matches the eye', () => {
    for (const c of drops()) {
      const p = easierDropTest(c)!;
      expect(p).not.toBeNull();
      expect(p.id).toBe(`${c.id}~easier`);
      expect(practiceLeaks(c, p)).toBe(false);
    }
  });

  it('easier boats: half the pennies, the same stuff, solvable', () => {
    for (const c of boats()) {
      const p = easierBoat(c)!;
      expect(p).not.toBeNull();
      expect(p.goal).toBe(Math.max(1, Math.floor(c.goal / 2)));
      expect(practiceLeaks(c, p)).toBe(false);
      expect(allBuilds(p.materials).some(b => capacity(b) >= p.goal)).toBe(true);
    }
  });

  it('no lever fact names the mystery\'s result before it is dropped', () => {
    const c = buildDropTest(thingByKey('log')!, 'hard', seeded(3), 'd3');
    const facts = HARBOR_LEVERS.onScreen(c, tested, [XRAY_LEVER, TAGS_LEVER, SIDE_BY_SIDE_LEVER]);
    expect(facts).not.toMatch(/big log[^.]*(float|sink)/);
    expect(facts).toContain('both made of');
  });
});
