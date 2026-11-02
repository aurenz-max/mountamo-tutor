import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { OFFER_GUIDANCE_MAX } from '../../../components/live-activity/adapters/adapterContract';
import { result, seeded, sizeSurprise, thingByKey, type Call, type Tier } from './buoyancyModel';
import {
  describeRule, partnerOf, pickRuleChallenges, ruleFair, ruleFeedback, ruleInstruction, ruleMatches, ruleMiss, type RuleChallenge,
} from './ruleModel';
import { buildBuoyancyHarbor } from '../../../service/physics/buoyancy-harbor-generator';
import { validateBuoyancyHarborData } from './buoyancyHarbor.boss';
import { ruleScene } from './buoyancyWorkspace';
import {
  EASIER_LEVER, HARBOR_LEVERS, SIDE_BY_SIDE_LEVER, TAGS_LEVER, XRAY_LEVER, easierRule, pairLeaks, practiceLeaks, sameStuffPair,
} from './buoyancyLevers';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const thing = (k: string) => thingByKey(k)!;
const items = (): RuleChallenge[] => TIERS.flatMap(t => Array.from({ length: 15 }, (_, s) => pickRuleChallenges(4, t, seeded(s + 1), `r${t}${s}`))).flat();
const rule = (tested: string[], toSort: string[]): RuleChallenge => ({
  id: 'r', type: 'find_the_rule', tested: tested.map(thing), toSort: toSort.map(thing), instruction: ruleInstruction(tested.map(thing), toSort.map(thing)),
});
const keyOf = (c: RuleChallenge): Call[] => c.toSort.map(result);
const flip = (x: Call): Call => (x === 'floats' ? 'sinks' : 'floats');

describe('the rule check', () => {
  // A twig floats and a key sinks; sort a big log and a big wrench. The log fools a sort by size, the wrench does not.
  const c = rule(['twig', 'key'], ['log', 'wrench']);
  it('passes the right sort with "what it is made of", and names each miss', () => {
    expect(ruleMatches(c, { calls: ['floats', 'sinks'], rule: 'material' })).toBe(true);
    expect(ruleMiss(c, { calls: ['sinks', 'sinks'], rule: 'material' })).toBe('sorted_by_size');
    expect(ruleMiss(c, { calls: ['floats', 'floats'], rule: 'material' })).toBe('sort_slip');
    expect(ruleMiss(c, { calls: ['floats', 'sinks'], rule: 'size' })).toBe('wrong_rule');
    expect(ruleMiss(c, { calls: ['floats', 'sinks'], rule: 'weight' })).toBe('wrong_rule');
  });
  it('says the answer only on a pass', () => {
    expect(ruleFeedback(c, { calls: ['floats', 'sinks'], rule: 'material' })).toContain('big log is wood like the twig, so it floats');
    for (const calls of [['sinks', 'sinks'], ['floats', 'floats']] as Call[][]) {
      expect(ruleFeedback(c, { calls, rule: 'material' })).not.toMatch(/floats|sinks/);
    }
    expect(ruleFeedback(c, { calls: ['floats', 'sinks'], rule: 'size' })).toContain('Your sorting is right');
    expect(describeRule(c, { calls: ['floats', null], rule: null })).toBe('said the big log will float and nothing for the big wrench, and picked nothing as what decides it');
  });
});

describe('rule items by tier', () => {
  it('every item is fair: each thing to sort has one test of its stuff in another size, and a test fools the eye', () => {
    for (const c of items()) {
      expect(ruleFair(c)).toBe(true);
      for (const s of c.toSort) expect(partnerOf(c, s)!.size).not.toBe(s.size);
    }
  });
  it('easy sorts a floater and a sinker sized as the eye expects; medium adds a third test and a surprise; hard sorts only surprises', () => {
    for (const t of TIERS) for (let s = 1; s <= 20; s++) for (const c of pickRuleChallenges(4, t, seeded(s), 'x')) {
      expect(new Set(c.toSort.map(result))).toEqual(new Set(['floats', 'sinks']));
      if (t === 'easy') { expect(c.tested).toHaveLength(2); expect(c.toSort.some(sizeSurprise)).toBe(false); }
      if (t === 'medium') { expect(c.tested).toHaveLength(3); expect(c.toSort.some(sizeSurprise)).toBe(true); }
      if (t === 'hard') {
        expect(c.tested).toHaveLength(3);
        expect(c.toSort.every(sizeSurprise)).toBe(true);
        expect(c.tested.filter(sizeSurprise)).toHaveLength(1);
      }
    }
  });
  it('a session fills its count and repeats no thing to sort', () => {
    for (const t of TIERS) for (let s = 1; s <= 10; s++) {
      const cs = pickRuleChallenges(4, t, seeded(s), 'x');
      expect(cs).toHaveLength(4);
      const sorted = cs.flatMap(c => c.toSort.map(x => x.key));
      expect(new Set(sorted).size).toBe(sorted.length);
    }
  });
  it('the generator builds valid rule sessions, alone and mixed; the validator rejects an unfair item', () => {
    for (const t of TIERS) {
      const d = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: t }, 5, ['find_the_rule']);
      expect(d.challenges.every(c => c.type === 'find_the_rule')).toBe(true);
      expect(d.title).not.toBe('Sink or Float?');
      expect(() => validateBuoyancyHarborData(d)).not.toThrow();
    }
    const mixed = buildBuoyancyHarbor({ gradeLevel: 'Grade 2', supportTier: 'medium' }, 3, ['drop_test', 'find_the_rule', 'build_boat', 'salt_water']);
    expect(new Set(mixed.challenges.map(c => c.type)).size).toBe(4);
    expect(() => validateBuoyancyHarborData(mixed)).not.toThrow();
    // No test fools the eye (a size rule would fit every test), or a thing to sort has no test of its stuff.
    for (const bad of [rule(['twig', 'boulder'], ['log', 'pebble']), rule(['twig', 'key'], ['log', 'pebble'])]) {
      expect(() => validateBuoyancyHarborData({ ...mixed, challenges: [bad] })).toThrow();
    }
  });
});

describe('what the tutor sees', () => {
  it('the scene never tells a thing to sort\'s result before a right check', () => {
    for (const c of items()) {
      const view = { settled: c.tested.map(() => true), guesses: c.tested.map(() => null), calls: c.toSort.map(() => null), rule: null };
      const facts = ruleScene(c, { ...view, revealed: false }).facts;
      expect(String(facts.toSort)).not.toMatch(/floated|sank|dropped/);
      expect(String(ruleScene(c, { ...view, revealed: true }).facts.toSort)).toMatch(/dropped in the tank/);
    }
  });
  it('the harbor guidance still fits the offer', () => {
    expect(LIVE_ADAPTERS['buoyancy-harbor'].guidance.length).toBeLessThanOrEqual(OFFER_GUIDANCE_MAX);
  });
});

describe('rule levers', () => {
  const c = rule(['twig', 'key', 'boulder'], ['log', 'pebble']);
  const inWater = { settledTests: 3, boatLaunched: false };
  it('x-ray once a test is in the water; tags, the pair and the easier sort', () => {
    const ids = (ctx: typeof inWater) => HARBOR_LEVERS.declare(c, ctx, []).map(l => l.id);
    expect(ids({ settledTests: 0, boatLaunched: false })).toEqual([TAGS_LEVER, SIDE_BY_SIDE_LEVER, EASIER_LEVER]);
    expect(ids(inWater)).toEqual([XRAY_LEVER, TAGS_LEVER, SIDE_BY_SIDE_LEVER, EASIER_LEVER]);
  });
  it.each([
    ['sorted_by_size', XRAY_LEVER, SIDE_BY_SIDE_LEVER],
    ['sort_slip', TAGS_LEVER, EASIER_LEVER],
    ['wrong_rule', SIDE_BY_SIDE_LEVER, EASIER_LEVER],
  ])('%s -> %s, then %s', (miss, first, second) => {
    expect(nextLever(HARBOR_LEVERS.declare(c, inWater, []), miss)).toBe(first);
    expect(nextLever(HARBOR_LEVERS.declare(c, inWater, [first]), miss)).toBe(second);
  });
  it('the pair shares no stuff with the item, and the easier sort is simpler with none of its stuff', () => {
    for (const item of items()) {
      const pair = sameStuffPair(item);
      if (pair) expect(pairLeaks(item, pair)).toBe(false);
      const p = easierRule(item);
      expect(p).not.toBeNull();
      expect(practiceLeaks(item, p!)).toBe(false);
      expect(ruleFair(p!)).toBe(true);
      expect(p!.toSort).toHaveLength(1);
      expect(easierRule(p!)).toBeNull();
    }
  });
  it('a wrong call never flips into a pass', () => {
    for (const item of items().slice(0, 30)) {
      const key = keyOf(item);
      expect(ruleMatches(item, { calls: [flip(key[0]), ...key.slice(1)], rule: 'material' })).toBe(false);
    }
  });
});
