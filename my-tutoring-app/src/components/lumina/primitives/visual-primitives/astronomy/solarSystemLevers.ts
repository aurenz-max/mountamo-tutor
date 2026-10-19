/**
 * The in-item levers on a solar-system-explorer item, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/solar-system-explorer-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `solarSpokenMisses` names (the Sun, the facet's signature planet, any other planet). Pure: the component draws from
 * these, the tests hold each leak rule. Every answer is a planet's NAME, so no lever ever writes a name the item asks
 * for; the levers act on how the sky is drawn or on a model outside it.
 *
 * Help:
 * - `star_mark` (marks; every mode, a Sun on screen): a star outline on the Sun, the Sun dimmed. Answers `said_sun`.
 * - `close_up` (layout; identify): the glowing planet drawn big beside the sky in its own colours, no name.
 * - `near_far_model` (model; closest, farthest): a model sun with a near and a far ring, the asked end's dot glowing.
 *   Fixed per facet; none of the sky's planets.
 * - `first_ring` (marks; position): the first ring out from the Sun drawn bright. Never on closest, where it is the answer.
 * - `kind_model` (model; classify): model worlds that are not from this sky (a cratered rock and a striped gas world; a
 *   tiny world beside a full planet for dwarf).
 * - `size_row` (layout; biggest, smallest, pair_bigger): the planets (the pair on a pair item) drawn side by side at true
 *   size, in order from the Sun, no names.
 * - `fact_strip` (layout; hottest, most_moons): every planet's temperature or moon count side by side, in order from the
 *   Sun, none marked: the research cards laid flat.
 * - `trip_model` (model; orbital_reasoning): a model sun with a near and a far ring; in the same time the near dot has
 *   gone a long way round and the far dot a short way. None of the sky's planets.
 * Simplify (an ungraded easier item of the same mode, `<item>~simpler`, then the full item):
 * - `fewer_rings` (position n >= 3): position n-1 or nearer, its planet no session item's answer.
 * - `two_planets` (biggest, smallest, longest_year, shortest_year): a named pair far apart (size ratio >= 2, period
 *   ratio >= 3) of planets that are no session item's answer and no pair the session asks.
 * No simplify where the item is already the plainest shape (identify, closest, farthest, a pair) or where every easier
 * item is another item's answer in the session (classify asks every kind; see the report).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { solarSystemCard } from './solarSystem.card';
import {
  itemFromChallenge, isPairFacet, type SolarBand, type SolarBodyLike, type SolarChallengeLike, type SolarItem,
} from './solarSystemDomain';

export const STAR_LEVER = 'star_mark';
export const CLOSE_UP_LEVER = 'close_up';
export const NEAR_FAR_LEVER = 'near_far_model';
export const FIRST_RING_LEVER = 'first_ring';
export const KIND_MODEL_LEVER = 'kind_model';
export const SIZE_ROW_LEVER = 'size_row';
export const FACT_STRIP_LEVER = 'fact_strip';
export const TRIP_MODEL_LEVER = 'trip_model';
export const FEWER_RINGS_LEVER = 'fewer_rings';
export const TWO_PLANETS_LEVER = 'two_planets';
export const PRACTICE_SUFFIX = '~simpler';

export interface SolarLeverContext { bodies: readonly SolarBodyLike[]; rung: SolarBand; session: readonly SolarItem[] }

const planetsOf = (bodies: readonly SolarBodyLike[]) =>
  bodies.filter(b => b.type === 'planet').sort((a, b) => a.distanceAu - b.distanceAu);

/** Bodies the practice item may not star: every single-answer item's answer in the session, and this item's. */
const takenBodies = (item: SolarItem, session: readonly SolarItem[]) =>
  new Set([item, ...session].filter(i => i.kind !== 'classify' || i === item).flatMap(i => i.answerBodyIds));

const pairKey = (ids: readonly string[]) => [...ids].sort().join('+');

/** The easier item a simplify lever opens, built through the family's own item gate; null when none fits. */
export function simplerSolar(item: SolarItem | null, ctx: SolarLeverContext): { item: SolarItem; challenge: SolarChallengeLike } | null {
  if (!item) return null;
  const id = `${item.id}${PRACTICE_SUFFIX}`;
  const taken = takenBodies(item, ctx.session);
  const build = (c: Omit<SolarChallengeLike, 'id'>) => {
    const challenge = { ...c, id };
    const built = itemFromChallenge(challenge, { bodies: ctx.bodies, rung: ctx.rung });
    return built && !built.answerBodyIds.some(b => taken.has(b)) ? { item: built, challenge } : null;
  };
  if (item.facet === 'position') {
    for (let n = item.position - 1; n >= 2; n--) {
      const easier = build({ type: 'order_from_sun', facet: 'position', position: n });
      if (easier) return easier;
    }
    return null;
  }
  const pairFacet = item.facet === 'biggest' || item.facet === 'smallest' ? 'pair_bigger'
    : item.facet === 'longest_year' || item.facet === 'shortest_year' ? 'pair_faster' : null;
  if (!pairFacet) return null;
  const asked = new Set(ctx.session.filter(i => isPairFacet(i.facet)).map(i => pairKey(i.pairBodyIds)));
  const free = planetsOf(ctx.bodies).filter(p => !taken.has(p.id));
  const value = (b: SolarBodyLike) => (pairFacet === 'pair_bigger' ? b.radiusKm : b.orbitalPeriodDays);
  const pairs: Array<{ ids: [string, string]; ratio: number }> = [];
  free.forEach((a, i) => free.slice(i + 1).forEach(b => {
    const [lo, hi] = [value(a), value(b)].sort((x, y) => x - y);
    if (lo > 0) pairs.push({ ids: [a.id, b.id], ratio: hi / lo });
  }));
  const minRatio = pairFacet === 'pair_bigger' ? 2 : 3;
  for (const { ids } of pairs.filter(p => p.ratio >= minRatio && !asked.has(pairKey(p.ids))).sort((a, b) => b.ratio - a.ratio)) {
    const easier = build({ type: item.kind, facet: pairFacet, optionBodyIds: ids });
    if (easier) return easier;
  }
  return null;
}

/** The ring `first_ring` brightens: always the first planet's, and only on a position item (n >= 2, never the answer). */
export function firstRingBodyId(item: SolarItem | null, bodies: readonly SolarBodyLike[]): string | null {
  return item?.facet === 'position' ? planetsOf(bodies)[0]?.id ?? null : null;
}

/** The planets `size_row` draws, in order from the Sun: the pair on a pair item, else every planet. */
export function sizeRowBodies(item: SolarItem | null, bodies: readonly SolarBodyLike[]): SolarBodyLike[] {
  if (!item) return [];
  const planets = planetsOf(bodies);
  return item.facet === 'pair_bigger' ? planets.filter(p => item.pairBodyIds.includes(p.id)) : planets;
}

/** A lever text leaks when it names any of the item's answers. The tests run every lever's `when`, `does` and fact through it. */
export function solarLeverLeaks(item: SolarItem, text: string): boolean {
  return item.answerNames.some(n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
}

/** The journey's practice item: rebuilt from its parent with the same builder the component uses. */
export function solarPracticeItem(itemId: string | undefined, items: readonly SolarItem[], ctx: Omit<SolarLeverContext, 'session'>): SolarItem | null {
  if (!itemId?.endsWith(PRACTICE_SUFFIX)) return null;
  const parent = items.find(i => `${i.id}${PRACTICE_SUFFIX}` === itemId);
  return simplerSolar(parent ?? null, { ...ctx, session: items })?.item ?? null;
}

// ── the lever set ──────────────────────────────────────────────────────────

const PLANET_SIGNATURE = ['signature_planet', 'other_planet'] as const;
const FENCE = 'It is a model, not the planets in this sky: never say which planet or ring in the sky it matches, never '
  + 'tell the learner where in the sky to look, and never name the answer.';
const PRACTICE = 'Opens an easier one of the same kind first. It is not graded; the full item comes back after it.';
const SIZE_FACETS: ReadonlySet<string> = new Set(['biggest', 'smallest', 'pair_bigger']);
const FACT_FACETS: ReadonlySet<string> = new Set(['hottest', 'most_moons']);

/** What each kind's model lever shows, for the support fact. */
const MODEL_OF: Partial<Record<SolarItem['kind'], string>> = {
  order_from_sun: 'a model sun with a near and a far ring',
  classify: 'model worlds that are not from this sky',
  orbital_reasoning: 'a near and a far trip around a model sun',
};

const nearFarModel = (glow: 'near' | 'far') => `a small sun with a near ring and a far ring, the ${glow} dot glowing`;
const TRIP = 'a small sun with a near ring and a far ring; in the same time the near dot has gone a long way round and '
  + 'the far dot a short way';
const factWord = (item: SolarItem) => (item.facet === 'hottest' ? 'temperature' : 'moon count');

type Mode = keyof typeof solarSystemCard.modes;

/** Every lever of the family, by type, in the order the tutor sees them. */
export const SOLAR_LEVERS = leverSet<SolarItem, SolarLeverContext>({
  modeOf: item => item.kind,
  missesOf: mode => solarSystemCard.modes[mode as Mode]?.misses ?? [],
  support: { tier: item => item.tier, different: item => MODEL_OF[item.kind] ?? 'a model', own: 'this item\'s planet' },
  specs: [
    { id: STAR_LEVER, type: 'marks', answers: ['said_sun'],
      when: 'The learner names the Sun.',
      does: 'Draws a star outline on the Sun and dims it. The planets are unchanged. Say only that the Sun is marked as a '
        + 'star; never point to a ring or a planet.',
      content: (_item, ctx) => (ctx.bodies.some(b => b.type === 'star') ? true : null),
      fact: 'The Sun wears a star outline and is dimmed.' },
    { id: CLOSE_UP_LEVER, type: 'layout', modes: ['identify'], answers: ['neighbour_planet', 'other_planet'],
      when: 'The learner names a different planet.',
      does: 'Draws the glowing planet big beside the sky, in its own colours, with no name. Never say its name or describe it.',
      fact: 'Beside the sky, the glowing planet is drawn big in its own colours, with no name.' },
    { id: NEAR_FAR_LEVER, type: 'model', modes: ['order_from_sun'], answers: PLANET_SIGNATURE,
      content: item => (item.facet === 'closest' ? 'near' : item.facet === 'farthest' ? 'far' : null),
      when: item => `The learner names a planet at the other end, or not at the ${item.facet === 'closest' ? 'near' : 'far'} end.`,
      does: item => `Shows a model beside the sky: ${nearFarModel(item.facet === 'closest' ? 'near' : 'far')}. ${FENCE}`,
      fact: (glow: 'near' | 'far') => `Beside the sky, a model: ${nearFarModel(glow)}. It is not this sky.` },
    { id: FIRST_RING_LEVER, type: 'marks', modes: ['order_from_sun'], answers: PLANET_SIGNATURE,
      content: (item, ctx) => firstRingBodyId(item, ctx.bodies),
      when: 'The learner counts the Sun as one, or loses count.',
      does: 'Draws the first ring out from the Sun bright. Never count the rings for them or say which planet rides one.',
      fact: 'The first ring out from the Sun is drawn bright.' },
    { id: KIND_MODEL_LEVER, type: 'model', modes: ['classify'], answers: PLANET_SIGNATURE,
      when: 'The learner names a planet that is not that kind.',
      does: item => (item.facet === 'dwarf'
        ? `Shows a model beside the sky: a tiny world next to a full-size planet. ${FENCE}`
        : `Shows two model worlds beside the sky: a small grey one with craters and a big one with stripes. ${FENCE}`),
      fact: (_content, item) => (item.facet === 'dwarf'
        ? 'Beside the sky, a model: a tiny world next to a full-size planet. Neither is from this sky.'
        : 'Beside the sky, two model worlds that are not from this sky: a small grey one with craters and a big one with stripes.') },
    { id: FACT_STRIP_LEVER, type: 'layout', modes: ['compare_attribute'], answers: PLANET_SIGNATURE,
      content: item => (FACT_FACETS.has(item.facet) ? true : null),
      when: 'The learner guesses instead of checking every planet.',
      does: item => `Lays every planet's ${factWord(item)} side by side below the sky, in order from the Sun, none marked. `
        + `Never say which is ${item.facet === 'hottest' ? 'hottest' : 'most'}.`,
      fact: (_content, item) => `Below the sky, a strip shows every planet's ${factWord(item)} side by side, in order from the `
        + 'Sun, none marked.' },
    { id: SIZE_ROW_LEVER, type: 'layout', modes: ['compare_attribute'], answers: PLANET_SIGNATURE,
      content: (item, ctx) => (SIZE_FACETS.has(item.facet) ? sizeRowBodies(item, ctx.bodies) : null),
      when: 'The learner names a planet that is not the one asked for.',
      does: item => `Draws ${item.facet === 'pair_bigger' ? 'the two glowing planets' : 'the planets'} side by side below the `
        + 'sky at their true sizes, in order from the Sun, with no names. '
        + `Never say which is ${item.facet === 'smallest' ? 'smallest' : 'biggest'}.`,
      fact: (_content, item) => (item.facet === 'pair_bigger'
        ? 'Below the sky, the two glowing planets are drawn side by side at their true sizes, with no names.'
        : 'Below the sky, the planets are drawn side by side at their true sizes, in order from the Sun, with no names.') },
    { id: TRIP_MODEL_LEVER, type: 'model', modes: ['orbital_reasoning'], answers: PLANET_SIGNATURE,
      when: 'The learner turns the trip around: names the quick one for the slow one.',
      does: `Shows a model beside the sky: ${TRIP}. ${FENCE}`,
      fact: `Beside the sky, a model: ${TRIP}. It is not this sky.` },
    { id: FEWER_RINGS_LEVER, type: 'easier', modes: ['order_from_sun'], answers: PLANET_SIGNATURE,
      content: (item, ctx) => (item.facet === 'position' ? simplerSolar(item, ctx)?.item ?? null : null),
      when: 'The learner loses count this far out from the Sun.',
      does: PRACTICE },
    { id: TWO_PLANETS_LEVER, type: 'easier', modes: ['compare_attribute', 'orbital_reasoning'], answers: PLANET_SIGNATURE,
      content: (item, ctx) => simplerSolar(item, ctx)?.item ?? null,
      when: 'Comparing every planet at once is too much yet.',
      does: PRACTICE },
  ],
});
