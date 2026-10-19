/**
 * solar-system-explorer's domain: what is this primitive's own pedagogy, kept from the judged-pack tests when the cue
 * protocol went with the move to the boss (2026-10-19). The boss guards (`boss.test.ts`) run the shared checks.
 *  - every mode speaks;
 *  - the asks: no ask says its answer (`askLeaks` with the key), a pair ask says both names as a menu;
 *  - the build gates (band gates, ties, defect-11 names, the false-law period table, answer-once dedupe, declared-key
 *    disagreement);
 *  - the signature errors, the key and the harness answers, the reveal and the catalog steering.
 */
import { describe, it, expect } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../../components/live-activity/spokenKey';
import {
  answerKindFor,
  responseClassFor,
  askFor,
  itemFromChallenge,
  itemsFromChallenges,
  revealTextFor,
  categoryMembers,
  solarHarnessAnswers,
  solarKey,
  type SolarBodyLike,
  type SolarBuildContext,
  type SolarChallengeLike,
  type SolarItem,
} from '../solarSystemDomain';
import { ASTRONOMY_CATALOG } from '../../../../service/manifest/catalog/astronomy';

// ---------------------------------------------------------------------------
// Fixtures — the canonical sky, real figures
// ---------------------------------------------------------------------------

const b = (
  id: string, name: string, radiusKm: number, distanceAu: number,
  orbitalPeriodDays: number, moons: number, temperatureC: number,
  type: SolarBodyLike['type'] = 'planet',
): SolarBodyLike => ({ id, name, type, radiusKm, distanceAu, orbitalPeriodDays, moons, temperatureC });

const SKY: SolarBodyLike[] = [
  b('sun', 'Sun', 696000, 0, 0, 0, 5500, 'star'),
  b('mercury', 'Mercury', 2440, 0.39, 88, 0, 167),
  b('venus', 'Venus', 6052, 0.72, 225, 0, 464),
  b('earth', 'Earth', 6371, 1.0, 365.25, 1, 15),
  b('mars', 'Mars', 3390, 1.52, 687, 2, -65),
  b('jupiter', 'Jupiter', 69911, 5.2, 4333, 95, -110),
  b('saturn', 'Saturn', 58232, 9.54, 10759, 146, -140),
  b('uranus', 'Uranus', 25362, 19.19, 30687, 28, -195),
  b('neptune', 'Neptune', 24622, 30.07, 60190, 16, -200),
];

const INNER_SKY: SolarBodyLike[] = SKY.slice(0, 5); // sun + inner four

const ch = (over: Partial<SolarChallengeLike> & { id: string; type: string }): SolarChallengeLike => ({ ...over });

const CTX5: SolarBuildContext = { bodies: SKY, rung: '5' };
const CTXK: SolarBuildContext = { bodies: INNER_SKY, rung: 'K' };

const build = (like: SolarChallengeLike, ctx: SolarBuildContext = CTX5): SolarItem | null => itemFromChallenge(like, ctx);

const mustBuild = (like: SolarChallengeLike, ctx: SolarBuildContext = CTX5): SolarItem => {
  const item = build(like, ctx);
  expect(item, `expected ${like.type}/${like.facet} to build`).not.toBeNull();
  return item!;
};

/** One item per kind, plus a pair. */
const FIXTURE_LIKES: SolarChallengeLike[] = [
  ch({ id: 'i1', type: 'identify', facet: 'name', answerBodyIds: ['mars'] }),
  ch({ id: 'o1', type: 'order_from_sun', facet: 'closest' }),
  ch({ id: 'c1', type: 'classify', facet: 'giant' }),
  ch({ id: 'p1', type: 'compare_attribute', facet: 'biggest' }),
  ch({ id: 'r1', type: 'orbital_reasoning', facet: 'longest_year' }),
  ch({ id: 'p2', type: 'compare_attribute', facet: 'pair_bigger', optionBodyIds: ['earth', 'saturn'] }),
];

const fixtureItems = itemsFromChallenges(FIXTURE_LIKES, CTX5).items;

describe('every mode speaks', () => {
  it('the fixture builds, every kind voice / short_spoken_word', () => {
    expect(fixtureItems).toHaveLength(6);
    for (const item of fixtureItems) {
      expect(answerKindFor(item.kind)).toBe('voice');
      expect(responseClassFor(item.kind)).toBe('short_spoken_word');
      expect(item.answerKind).toBe('voice');
    }
  });

  it('the tier is the lesson\'s, medium when it names none', () => {
    expect(fixtureItems.every((i) => i.tier === 'medium')).toBe(true);
    expect(mustBuild(ch({ id: 'o', type: 'order_from_sun', facet: 'closest' }), { ...CTX5, tier: 'easy' }).tier).toBe('easy');
  });
});

describe('the asks and the key', () => {
  it('no ask says its answer, and none hands over with "Your turn"', () => {
    for (const item of fixtureItems) {
      expect(askLeaks(askFor(item), solarKey(item)), `${item.kind}/${item.facet}`).toEqual([]);
      expect(askFor(item)).not.toMatch(/your turn/i);
    }
  });

  it('a pair ask says both names, and the key is a menu of the two', () => {
    const pair = fixtureItems.find((i) => i.facet === 'pair_bigger')!;
    expect(solarKey(pair)).toMatchObject({ answer: 'Saturn', menu: [...pair.pairNames] });
    expect([...pair.pairNames].sort()).toEqual(['Earth', 'Saturn']);
    for (const name of pair.pairNames) expect(askFor(pair)).toContain(name);
  });

  it('classify accepts any one member, and the kind\'s name alone is not it', () => {
    const giant = fixtureItems.find((i) => i.facet === 'giant')!;
    const key = solarKey(giant);
    expect([key.answer, ...key.alsoAccept]).toEqual(['Jupiter', 'Saturn', 'Uranus', 'Neptune']);
    expect(spokenKeyText(key)).toBe('"Jupiter" (also accept "Saturn", "Uranus", "Neptune"). Any one of them counts, alone or inside a phrase. '
      + '"Earth" is not it. The kind\'s name with no planet name, or the Sun, is not it.');
  });

  it('a single answer: the name in a phrase counts; the signature planet, the Sun and a colour do not', () => {
    const closest = mustBuild(ch({ id: 'o', type: 'order_from_sun', facet: 'closest' }));
    expect(spokenKeyText(solarKey(closest))).toBe('"Mercury". The name alone or inside a phrase counts. "Neptune" is not it. '
      + 'The Sun, a colour or "that one" with no name is not it.');
  });

  it('the Sun as the signature is said once, as the Sun', () => {
    const biggest = mustBuild(ch({ id: 'p', type: 'compare_attribute', facet: 'biggest' }));
    expect(solarKey(biggest).signatureError).toBe('The Sun, a colour or "that one" with no name is not it.');
  });
});

describe('build gates — DROP, never repair', () => {
  it('ordinal counting is not a K-1 move', () => {
    expect(build(ch({ id: 'x', type: 'order_from_sun', facet: 'position', position: 3 }), CTXK)).toBeNull();
    expect(build(ch({ id: 'x', type: 'order_from_sun', facet: 'position', position: 3 }), { bodies: SKY, rung: '2' })).not.toBeNull();
  });

  it('most_moons and hottest need the stat cards K-1 never renders', () => {
    for (const facet of ['most_moons', 'hottest'] as const) {
      expect(build(ch({ id: 'x', type: 'compare_attribute', facet }), { bodies: SKY, rung: '1' })).toBeNull();
      expect(build(ch({ id: 'x', type: 'compare_attribute', facet }), CTX5)).not.toBeNull();
    }
  });

  it('a tie at the deciding extreme is a coin flip — dropped', () => {
    const tied = [SKY[0], b('a', 'Alpha', 5000, 1, 300, 3, 20), b('c', 'Gamma', 5000, 2, 600, 3, 20)];
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'biggest' }), { bodies: tied, rung: '5' })).toBeNull();
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'most_moons' }), { bodies: tied, rung: '5' })).toBeNull();
  });

  it('⭐ defect 11: a body NAME that carries the facet vocabulary poisons the item', () => {
    const poisoned = SKY.map((body) => (body.id === 'jupiter' ? { ...body, name: 'Giant Jupiter' } : body));
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'biggest' }), { bodies: poisoned, rung: '5' })).toBeNull();
    // …and the same sky still asks CLEAN facets: "Giant" says nothing about order.
    expect(build(ch({ id: 'x', type: 'order_from_sun', facet: 'closest' }), { bodies: poisoned, rung: '5' })).not.toBeNull();

    const speedy = SKY.map((body) => (body.id === 'mercury' ? { ...body, name: 'Speedy Mercury' } : body));
    expect(build(ch({ id: 'x', type: 'orbital_reasoning', facet: 'shortest_year' }), { bodies: speedy, rung: '5' })).toBeNull();
  });

  it('a period table that contradicts the distance law would teach a false law', () => {
    const brokenKepler = SKY.map((body) => (body.id === 'neptune' ? { ...body, orbitalPeriodDays: 100 } : body));
    expect(build(ch({ id: 'x', type: 'orbital_reasoning', facet: 'longest_year' }), { bodies: brokenKepler, rung: '5' })).toBeNull();
  });

  it('a declared key that disagrees with the computed one is dropped, never trusted', () => {
    expect(build(ch({ id: 'x', type: 'order_from_sun', facet: 'closest', answerBodyIds: ['mars'] }))).toBeNull();
  });

  it('a pair a young eye cannot honestly compare is dropped', () => {
    // Venus vs Earth: 6052 vs 6371 — a squint, not a comparison.
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'pair_bigger', optionBodyIds: ['venus', 'earth'] }))).toBeNull();
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'pair_bigger', optionBodyIds: ['mars', 'jupiter'] }))).not.toBeNull();
  });

  it('classify collapses when the category is everything on screen (K inner sky)', () => {
    expect(build(ch({ id: 'x', type: 'classify', facet: 'rocky' }), CTXK)).toBeNull();
    expect(categoryMembers(INNER_SKY, 'giant')).toHaveLength(0);
  });

  it('the Sun is never an identify target', () => {
    expect(build(ch({ id: 'x', type: 'identify', facet: 'name', answerBodyIds: ['sun'] }))).toBeNull();
  });

  it('⭐ defect 2: an answered body may not star twice — session-wide, not consecutive', () => {
    const { items, droppedChallenges } = itemsFromChallenges([
      ch({ id: 'a', type: 'order_from_sun', facet: 'closest' }), // answers Mercury
      ch({ id: 'b', type: 'compare_attribute', facet: 'biggest' }), // answers Jupiter
      ch({ id: 'c', type: 'identify', facet: 'name', answerBodyIds: ['mercury'] }), // recall of (a)
      ch({ id: 'd', type: 'compare_attribute', facet: 'smallest' }), // answers Mercury — recall again
    ], CTX5);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(droppedChallenges).toBe(2);
  });

  it('one facet asks once — duplicates drop', () => {
    const { items } = itemsFromChallenges([
      ch({ id: 'a', type: 'classify', facet: 'giant' }),
      ch({ id: 'b', type: 'classify', facet: 'giant' }),
    ], CTX5);
    expect(items).toHaveLength(1);
  });
});

describe('signature errors, as data', () => {
  it('order reversal: closest\'s signature is the farthest planet, and back', () => {
    expect(mustBuild(ch({ id: 'a', type: 'order_from_sun', facet: 'closest' })).signatureName).toBe('Neptune');
    expect(mustBuild(ch({ id: 'b', type: 'order_from_sun', facet: 'farthest' })).signatureName).toBe('Mercury');
  });

  it('count-the-Sun: position 3 lands one planet short', () => {
    const third = mustBuild(ch({ id: 'a', type: 'order_from_sun', facet: 'position', position: 3 }));
    expect(third.answerNames).toEqual(['Earth']);
    expect(third.signatureName).toBe('Venus');
  });

  it('the Sun is the biggest-planet trap', () => {
    const biggest = mustBuild(ch({ id: 'a', type: 'compare_attribute', facet: 'biggest' }));
    expect(biggest.answerNames).toEqual(['Jupiter']);
    expect(biggest.signatureName).toBe('Sun');
  });

  it('closest-is-hottest: the trap is live on real data', () => {
    const hottest = mustBuild(ch({ id: 'a', type: 'compare_attribute', facet: 'hottest' }));
    expect(hottest.answerNames).toEqual(['Venus']);
    expect(hottest.signatureName).toBe('Mercury');
    expect(hottest.hottestTrap).toBe(true);
  });

  it('big-means-gas: classify giant\'s signature is the biggest rocky planet', () => {
    expect(mustBuild(ch({ id: 'a', type: 'classify', facet: 'giant' })).signatureName).toBe('Earth');
  });

  it('harness answers mirror the items: correct is the key, plainWrong another planet', () => {
    for (const item of fixtureItems) {
      const answers = solarHarnessAnswers(item);
      expect(answers.correct).toBe(solarKey(item).answer);
      expect(answers.plainWrong).not.toBe(answers.correct);
    }
  });
});

describe('reveal + catalog steering', () => {
  it('the reveal text is the answer name — or the CATEGORY for classify', () => {
    expect(revealTextFor(mustBuild(ch({ id: 'a', type: 'order_from_sun', facet: 'closest' })))).toBe('Mercury');
    expect(revealTextFor(mustBuild(ch({ id: 'b', type: 'classify', facet: 'giant' })))).toBe('Gas giant');
  });

  it('the catalog steers SPOKEN, not tapped', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'solar-system-explorer')!;
    expect(`${entry.description} ${entry.constraints}`).toMatch(/OUT LOUD|SPOKEN/i);
    expect(`${entry.description} ${entry.constraints}`).toMatch(/microphone/i);
    for (const mode of entry.evalModes ?? []) {
      expect(mode.description).toMatch(/say/i);
      expect(mode.description).not.toMatch(/\btap\b/i);
    }
  });
});
