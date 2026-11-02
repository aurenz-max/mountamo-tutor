import { describe, expect, it } from 'vitest';
import {
  THINGS, dropTestMatches, dropTestMiss, evidenceIndex, floats, mysteryPool, pickDropTests, seeded, sizeSurprise, thingByKey,
  buildDropTest, describeDropTest, type DropTestChallenge, type Tier,
} from './buoyancyModel';
import { buildBuoyancyHarbor } from '../../../service/physics/buoyancy-harbor-generator';
import { validateBuoyancyHarborData } from './buoyancyHarbor.boss';
import { buoyancyScene } from './buoyancyWorkspace';

const thing = (k: string) => thingByKey(k)!;

describe('the world model', () => {
  it('decides by material: a big log floats, a paper clip sinks', () => {
    expect(floats(thing('log'))).toBe(true);
    expect(floats(thing('paper-clip'))).toBe(false);
    expect(sizeSurprise(thing('log'))).toBe(true);
    expect(sizeSurprise(thing('boulder'))).toBe(false);
  });

  it('every material has a second thing, so a mystery always has a test of the same stuff', () => {
    for (const t of THINGS) expect(THINGS.filter(o => o.material === t.material && o.key !== t.key).length).toBeGreaterThan(0);
  });

  it('every tier has floaters and sinkers to draw', () => {
    for (const tier of ['easy', 'medium', 'hard'] as Tier[]) {
      expect(mysteryPool(tier, true).length).toBeGreaterThan(2);
      expect(mysteryPool(tier, false).length).toBeGreaterThan(2);
    }
  });
});

describe('drop tests', () => {
  it('an item has one floater and one sinker tested, exactly one of the mystery stuff', () => {
    for (let s = 1; s <= 200; s++) {
      for (const tier of ['easy', 'medium', 'hard'] as Tier[]) {
        const [c] = pickDropTests(1, tier, seeded(s));
        expect(floats(c.tested[0])).not.toBe(floats(c.tested[1]));
        const same = c.tested.filter(t => t.material === c.mystery.material);
        expect(same).toHaveLength(1);
        expect(c.tested.map(t => t.key)).not.toContain(c.mystery.key);
        expect(c.instruction).not.toMatch(/floats|sinks|floated|sank/);
      }
    }
  });

  it('hard items: the size fools the eye, and the other test is the mystery\'s size when one exists', () => {
    for (let s = 1; s <= 200; s++) {
      for (const c of pickDropTests(5, 'hard', seeded(s))) {
        expect(sizeSurprise(c.mystery)).toBe(true);
        const ev = c.tested[evidenceIndex(c)];
        expect(ev.size).not.toBe(c.mystery.size);
      }
    }
  });

  it('easy items never trick by size', () => {
    for (let s = 1; s <= 100; s++) for (const c of pickDropTests(5, 'easy', seeded(s))) expect(sizeSurprise(c.mystery)).toBe(false);
  });

  it('a session mixes floaters and sinkers, no mystery twice, ids by index, and varies by seed', () => {
    const keys = new Set<string>();
    for (let s = 1; s <= 30; s++) {
      const items = pickDropTests(5, 'medium', seeded(s));
      const f = items.filter(c => floats(c.mystery)).length;
      expect(f).toBeGreaterThanOrEqual(2);
      expect(f).toBeLessThanOrEqual(3);
      expect(new Set(items.map(c => c.mystery.key)).size).toBe(5);
      expect(items.map(c => c.id)).toEqual(['drop-1', 'drop-2', 'drop-3', 'drop-4', 'drop-5']);
      keys.add(items.map(c => c.mystery.key).join(','));
    }
    expect(keys.size).toBeGreaterThan(20);
  });
});

describe('the check', () => {
  const c = buildDropTest(thing('log'), 'hard', () => 0, 'd1'); // tested: [twig, ...] with rng 0
  const ev = evidenceIndex(c);
  const other = (1 - ev) as 0 | 1;

  it('needs the right call and the test of the same stuff', () => {
    expect(dropTestMatches(c, { call: 'floats', evidence: ev })).toBe(true);
    expect(dropTestMatches(c, { call: 'floats', evidence: other })).toBe(false);
    expect(dropTestMatches(c, { call: 'sinks', evidence: ev })).toBe(false);
  });

  it('names the miss: by size on a big floater, then the wrong test', () => {
    expect(dropTestMiss(c, { call: 'sinks', evidence: ev })).toBe('judged_by_size');
    expect(dropTestMiss(c, { call: 'floats', evidence: other })).toBe('other_thing');
    expect(dropTestMiss(c, { call: 'floats', evidence: ev })).toBeUndefined();
    const plain = buildDropTest(thing('foam-ball'), 'easy', () => 0.5, 'd2');
    expect(dropTestMiss(plain, { call: 'sinks', evidence: evidenceIndex(plain) })).toBe('wrong_call');
  });

  it('describes the work without the key', () => {
    expect(describeDropTest(c, { call: 'sinks', evidence: ev })).toBe(`said the big log will sink, and picked the ${c.tested[ev].name} as the test that tells`);
  });
});

describe('generator, boss and scene', () => {
  it('builds 5 valid items the boss accepts, at every tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const d = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: tier }, 7);
      expect(d.challenges).toHaveLength(5);
      expect(() => validateBuoyancyHarborData(d)).not.toThrow();
      expect(d.gradeBand).toBe('K-2');
    }
    expect(buildBuoyancyHarbor({ gradeLevel: 'Grade 4', supportTier: undefined }, 7).gradeBand).toBe('3-5');
  });

  it('the boss rejects an item whose mystery shares stuff with both tests', () => {
    const d = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: 'medium' }, 3);
    const c = d.challenges[0] as DropTestChallenge;
    const bad = { ...d, challenges: [{ ...c, tested: [c.tested[evidenceIndex(c)], c.tested[evidenceIndex(c)]] as typeof c.tested }] };
    expect(() => validateBuoyancyHarborData(bad)).toThrow();
  });

  it('the scene never tells the mystery\'s result before it is dropped', () => {
    const c = buildDropTest(thing('paper-clip'), 'hard', seeded(4), 'd1');
    const view = { step: 'decide' as const, settled: [true, true] as [boolean, boolean], dropped: [true, true] as [boolean, boolean],
      call: null, evidence: null, mysteryDropped: false };
    const facts = JSON.stringify(buoyancyScene(c, view).facts);
    expect(facts).toContain('paper clip (made of metal, small): on the yellow stand on the pier, not tested');
    expect(facts).not.toMatch(/paper clip[^"]*(sank|floated)/);
    expect(JSON.stringify(buoyancyScene(c, { ...view, mysteryDropped: true }).facts)).toMatch(/paper clip[^"]*sank to the bottom/);
  });
});
