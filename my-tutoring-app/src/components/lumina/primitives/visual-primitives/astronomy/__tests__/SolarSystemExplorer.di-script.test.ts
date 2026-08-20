/**
 * solar-system-explorer di-script suite — the pack's structural gates plus the
 * pedagogy pins that make this port THIS port (first science port; all five
 * modes spoken, every answer a planet's name).
 *
 * The plumbing is one import (`checkPackGates` / `checkDiCatalogEntry`); the
 * hand-written pins are the point:
 *   - the answer-material fork, both directions (all voice, all
 *     short_spoken_word — the costume test cleared the whole board);
 *   - the leak asserts: no spoken ask names its answer, except inside a pair
 *     item's menu clause, which is the one span the ask cannot avoid;
 *   - build-gate drops (band gates, ties, defect-11 names, the false-law
 *     period table, answer-once dedupe, declared-key disagreement);
 *   - correction/affirm shape (standing gate 3), the Sun-is-a-star signature,
 *     and VERDICT_ENDS_THE_TURN riding every contract-carrying cue.
 *
 * ⚠️ The REAL-SESSION-SHAPE pack (several same-action items back to back) is
 * here because a one-item-per-mode fixture is the one shape that can never
 * trigger `findRepeatedConsecutiveAsks` — the gate would be on and asleep.
 */
import { describe, it, expect } from 'vitest';
import {
  checkPackGates,
  checkDiCatalogEntry,
} from '../../../../hooks/judgedScriptContract.testkit';
import { spokenSpansOf } from '../../../../hooks/judgedScriptContract';
import {
  answerKindFor,
  responseClassFor,
  askFor,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  leakExemptSpanFor,
  pronounceCue,
  solarHarnessAnswers,
  solarSystemPackBase,
  stimulusFor,
  revealTextFor,
  categoryMembers,
  type SolarBodyLike,
  type SolarBuildContext,
  type SolarChallengeLike,
  type SolarItem,
} from '../solarSystemScript';
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

const ch = (over: Partial<SolarChallengeLike> & { id: string; type: string }): SolarChallengeLike =>
  ({ ...over });

const CTX5: SolarBuildContext = { bodies: SKY, rung: '5' };
const CTXK: SolarBuildContext = { bodies: INNER_SKY, rung: 'K' };

const build = (like: SolarChallengeLike, ctx: SolarBuildContext = CTX5): SolarItem | null =>
  itemFromChallenge(like, ctx);

const mustBuild = (like: SolarChallengeLike, ctx: SolarBuildContext = CTX5): SolarItem => {
  const item = build(like, ctx);
  expect(item, `expected ${like.type}/${like.facet} to build`).not.toBeNull();
  return item!;
};

/** One item per kind — the fork-coverage pack. */
const FIXTURE_LIKES: SolarChallengeLike[] = [
  ch({ id: 'i1', type: 'identify', facet: 'name', answerBodyIds: ['mars'] }),
  ch({ id: 'o1', type: 'order_from_sun', facet: 'closest' }),
  ch({ id: 'c1', type: 'classify', facet: 'giant' }),
  ch({ id: 'p1', type: 'compare_attribute', facet: 'biggest' }),
  ch({ id: 'r1', type: 'orbital_reasoning', facet: 'longest_year' }),
  ch({ id: 'p2', type: 'compare_attribute', facet: 'pair_bigger', optionBodyIds: ['earth', 'saturn'] }),
];

const fixtureItems = itemsFromChallenges(FIXTURE_LIKES, CTX5).items;
const fixturePack = solarSystemPackBase(fixtureItems);

describe('pack gates (structural)', () => {
  it('the fork-coverage pack passes every shared gate', () => {
    expect(fixtureItems).toHaveLength(6);
    expect(checkPackGates(fixturePack)).toEqual([]);
  });

  it('a REAL session shape — consecutive same-action items — passes the repeat-ask gate', () => {
    // identify's ask is deliberately invariant; it must stay under the
    // recitation limit or every identify session recites.
    const identifyRun = itemsFromChallenges([
      ch({ id: 'a', type: 'identify', facet: 'name', answerBodyIds: ['mercury'] }),
      ch({ id: 'b', type: 'identify', facet: 'name', answerBodyIds: ['jupiter'] }),
      ch({ id: 'c', type: 'identify', facet: 'name', answerBodyIds: ['neptune'] }),
    ], CTX5).items;
    expect(identifyRun).toHaveLength(3);
    expect(checkPackGates(solarSystemPackBase(identifyRun))).toEqual([]);

    const orderRun = itemsFromChallenges([
      ch({ id: 'a', type: 'order_from_sun', facet: 'closest' }),
      ch({ id: 'b', type: 'order_from_sun', facet: 'farthest' }),
      ch({ id: 'c', type: 'order_from_sun', facet: 'position', position: 3 }),
    ], CTX5).items;
    expect(orderRun).toHaveLength(3);
    expect(checkPackGates(solarSystemPackBase(orderRun))).toEqual([]);
  });

  it('the catalog entry honours the family contract', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'solar-system-explorer')!;
    expect(entry).toBeDefined();
    expect(checkDiCatalogEntry(entry, fixturePack, fixtureItems[0])).toEqual([]);
  });
});

describe('the answer-material fork — all five modes SPEAK', () => {
  it('every kind is voice / short_spoken_word, both directions', () => {
    for (const item of fixtureItems) {
      expect(answerKindFor(item.kind)).toBe('voice');
      expect(responseClassFor(item.kind)).toBe('short_spoken_word');
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('short_spoken_word');
    }
  });

  it('no item in this pack is a gesture — there is no button to press', () => {
    expect(fixtureItems.every((i) => i.answerKind === 'voice')).toBe(true);
  });
});

describe('leak discipline — the ask never names its answer', () => {
  it('non-pair asks carry NO answer name anywhere', () => {
    for (const item of fixtureItems.filter((i) => i.pairNames.length === 0)) {
      const ask = askFor(item).toLowerCase();
      for (const name of item.answerNames) {
        expect(ask, `${item.kind}/${item.facet} leaks "${name}"`)
          .not.toContain(name.toLowerCase());
      }
    }
  });

  it('a pair ask names the answer ONLY inside its menu clause', () => {
    const pair = fixtureItems.find((i) => i.facet === 'pair_bigger')!;
    const exempt = leakExemptSpanFor(pair)!;
    expect(exempt).toBeTruthy();
    const outside = askFor(pair).replace(exempt, '').toLowerCase();
    for (const name of pair.answerNames) {
      expect(outside).not.toContain(name.toLowerCase());
    }
  });

  it('the identify stimulus line never says WHICH planet glows', () => {
    const identify = fixtureItems.find((i) => i.kind === 'identify')!;
    expect(stimulusFor(identify).toLowerCase()).not.toContain(identify.answerNames[0].toLowerCase());
  });

  it('tap-to-hear re-speaks the QUESTION, never the answer', () => {
    for (const item of fixtureItems.filter((i) => i.pairNames.length === 0)) {
      const heard = pronounceCue(item).toLowerCase();
      for (const name of item.answerNames) {
        expect(heard).not.toContain(name.toLowerCase());
      }
    }
  });
});

describe('verdict lines — DISTAR shape', () => {
  it('every cue carries ask, then a "Yes," affirm, then a "My turn:" correction that re-elicits', () => {
    for (const item of fixtureItems) {
      const spans = spokenSpansOf(itemCue(item, { opening: false, howToPlay: false }));
      expect(spans.length).toBeGreaterThanOrEqual(3);
      expect(spans[0]).toBe(askFor(item));
      expect(spans[1].startsWith('Yes,')).toBe(true);
      expect(spans[2].startsWith('My turn:')).toBe(true);
      expect(spans[2]).toContain('Your turn.');
    }
  });

  it('the correction NAMES the answer (model–lead–test), the affirm teaches the why', () => {
    const closest = mustBuild(ch({ id: 'o', type: 'order_from_sun', facet: 'closest' }));
    const spans = spokenSpansOf(itemCue(closest));
    expect(spans[1]).toContain('Mercury');
    expect(spans[1]).toContain('smallest ring');
    expect(spans[2]).toContain('Mercury');
  });

  it('the classify affirm names the CATEGORY, never a member the child may not have said', () => {
    const giant = mustBuild(ch({ id: 'c', type: 'classify', facet: 'giant' }));
    const affirm = spokenSpansOf(itemCue(giant))[1];
    expect(affirm).toContain('gas giant');
    for (const member of giant.answerNames) {
      expect(affirm).not.toContain(member);
    }
  });

  it('VERDICT_ENDS_THE_TURN rides every contract-carrying cue', () => {
    for (const item of fixtureItems) {
      const cue = itemCue(item);
      expect(cue).toContain('never carry on into another question');
      expect(cue).toContain('the next question always arrives as its own cue');
    }
  });

  it('LOOKING is named as research, never an answer', () => {
    for (const item of fixtureItems) {
      expect(itemCue(item)).toContain('research, never an answer');
    }
  });
});

describe('build gates — DROP, never repair', () => {
  it('ordinal counting is not a K-1 move', () => {
    expect(build(ch({ id: 'x', type: 'order_from_sun', facet: 'position', position: 3 }), CTXK)).toBeNull();
    expect(build(ch({ id: 'x', type: 'order_from_sun', facet: 'position', position: 3 },
    ), { bodies: SKY, rung: '2' })).not.toBeNull();
  });

  it('most_moons and hottest need the stat cards K-1 never renders', () => {
    for (const facet of ['most_moons', 'hottest'] as const) {
      expect(build(ch({ id: 'x', type: 'compare_attribute', facet }), { bodies: SKY, rung: '1' })).toBeNull();
      expect(build(ch({ id: 'x', type: 'compare_attribute', facet }), CTX5)).not.toBeNull();
    }
  });

  it('a tie at the deciding extreme is a coin flip — dropped', () => {
    const tied = [
      SKY[0],
      b('a', 'Alpha', 5000, 1, 300, 3, 20),
      b('c', 'Gamma', 5000, 2, 600, 3, 20),
    ];
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'biggest' }), { bodies: tied, rung: '5' })).toBeNull();
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'most_moons' }), { bodies: tied, rung: '5' })).toBeNull();
  });

  it('⭐ defect 11: a body NAME that carries the facet vocabulary poisons the item', () => {
    const poisoned = SKY.map((body) =>
      body.id === 'jupiter' ? { ...body, name: 'Giant Jupiter' } : body);
    expect(build(ch({ id: 'x', type: 'compare_attribute', facet: 'biggest' }), { bodies: poisoned, rung: '5' })).toBeNull();
    // …and the same sky still asks CLEAN facets: "Giant" says nothing about order.
    expect(build(ch({ id: 'x', type: 'order_from_sun', facet: 'closest' }), { bodies: poisoned, rung: '5' })).not.toBeNull();

    const speedy = SKY.map((body) =>
      body.id === 'mercury' ? { ...body, name: 'Speedy Mercury' } : body);
    expect(build(ch({ id: 'x', type: 'orbital_reasoning', facet: 'shortest_year' }), { bodies: speedy, rung: '5' })).toBeNull();
  });

  it('a period table that contradicts the distance law would put a false law in the tutor\'s mouth', () => {
    const brokenKepler = SKY.map((body) =>
      body.id === 'neptune' ? { ...body, orbitalPeriodDays: 100 } : body);
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
      ch({ id: 'a', type: 'order_from_sun', facet: 'closest' }),          // answers Mercury
      ch({ id: 'b', type: 'compare_attribute', facet: 'biggest' }),        // answers Jupiter
      ch({ id: 'c', type: 'identify', facet: 'name', answerBodyIds: ['mercury'] }), // recall of (a)
      ch({ id: 'd', type: 'compare_attribute', facet: 'smallest' }),       // answers Mercury — recall again
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

describe('signature errors — the claims the contract makes, as data', () => {
  it('order reversal: closest\'s signature is the farthest planet, and back', () => {
    const closest = mustBuild(ch({ id: 'a', type: 'order_from_sun', facet: 'closest' }));
    expect(closest.signatureName).toBe('Neptune');
    const farthest = mustBuild(ch({ id: 'b', type: 'order_from_sun', facet: 'farthest' }));
    expect(farthest.signatureName).toBe('Mercury');
  });

  it('count-the-Sun: position 3 lands one planet short', () => {
    const third = mustBuild(ch({ id: 'a', type: 'order_from_sun', facet: 'position', position: 3 }));
    expect(third.answerNames).toEqual(['Earth']);
    expect(third.signatureName).toBe('Venus');
  });

  it('the Sun is the biggest-planet trap, and the contract draws the star/planet line', () => {
    const biggest = mustBuild(ch({ id: 'a', type: 'compare_attribute', facet: 'biggest' }));
    expect(biggest.answerNames).toEqual(['Jupiter']);
    expect(biggest.signatureName).toBe('Sun');
    expect(itemCue(biggest)).toContain('a star, not a planet');
  });

  it('closest-is-hottest: the trap is live on real data and the affirm names it', () => {
    const hottest = mustBuild(ch({ id: 'a', type: 'compare_attribute', facet: 'hottest' }));
    expect(hottest.answerNames).toEqual(['Venus']);
    expect(hottest.signatureName).toBe('Mercury');
    expect(hottest.hottestTrap).toBe(true);
    expect(spokenSpansOf(itemCue(hottest))[1]).toContain('even though it is not the closest');
  });

  it('big-means-gas: classify giant\'s signature is the biggest rocky planet', () => {
    const giant = mustBuild(ch({ id: 'a', type: 'classify', facet: 'giant' }));
    expect(giant.signatureName).toBe('Earth');
  });

  it('harness answers mirror the items: correct ≠ plainWrong, signature carried', () => {
    for (const item of fixtureItems) {
      const answers = solarHarnessAnswers(item);
      expect(answers.correct).toBe(item.answerNames[0]);
      expect(answers.plainWrong).not.toBe(answers.correct);
      expect(answers.signatureWrong?.text).toBe(item.signatureName);
      expect(answers.leakTokens).toEqual(item.answerNames);
    }
  });
});

describe('reveal + catalog steering', () => {
  it('the reveal text is the answer name — or the CATEGORY for classify', () => {
    const closest = mustBuild(ch({ id: 'a', type: 'order_from_sun', facet: 'closest' }));
    expect(revealTextFor(closest)).toBe('Mercury');
    const giant = mustBuild(ch({ id: 'b', type: 'classify', facet: 'giant' }));
    expect(revealTextFor(giant)).toBe('Gas giant');
  });

  it('the catalog steers SPOKEN, not tapped', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'solar-system-explorer')!;
    expect(`${entry.description} ${entry.constraints}`).toMatch(/OUT LOUD|SPOKEN/i);
    expect(`${entry.description} ${entry.constraints}`).toMatch(/microphone/i);
    expect(`${entry.description} ${entry.constraints}`).not.toMatch(/confirm button.*answers|answers.*by tapping the body/i);
    for (const mode of entry.evalModes ?? []) {
      expect(mode.description).toMatch(/say/i);
      expect(mode.description).not.toMatch(/\btap\b/i);
    }
  });
});
