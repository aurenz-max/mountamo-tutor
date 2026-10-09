/**
 * The in-item levers on a solar-system-explorer item (`/add-support-tiers`, report
 * qa/eval-reports/solar-system-explorer-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `solarSpokenMisses` names (the Sun, the facet's signature planet, any other planet). Pure: the component draws from
 * these, the workspace publishes them, the tests hold each leak rule. Every answer is a planet's NAME, so no lever ever
 * writes a name the item asks for; the levers act on how the sky is drawn or on a model outside it.
 *
 * Help:
 * - `star_mark` (every mode, a Sun on screen): a star outline on the Sun, the Sun dimmed. Answers `said_sun`.
 * - `close_up` (identify): the glowing planet drawn big beside the sky in its own colours, no name.
 * - `near_far_model` (closest, farthest): a model sun with a near and a far ring, the asked end's dot glowing. Fixed
 *   per facet; none of the sky's planets.
 * - `first_ring` (position): the first ring out from the Sun drawn bright. Never on closest, where it is the answer.
 * - `kind_model` (classify): model worlds that are not from this sky (a cratered rock and a striped gas world; a tiny
 *   world beside a full planet for dwarf).
 * - `size_row` (biggest, smallest, pair_bigger): the planets (the pair on a pair item) drawn side by side at true size,
 *   in order from the Sun, no names.
 * - `fact_strip` (hottest, most_moons): every planet's temperature or moon count side by side, in order from the Sun,
 *   none marked: the research cards laid flat.
 * - `trip_model` (orbital_reasoning): a model sun with a near and a far ring; in the same time the near dot has gone a
 *   long way round and the far dot a short way. None of the sky's planets.
 * Simplify (an ungraded easier item of the same mode, `<item>~simpler`, then the full item):
 * - `fewer_rings` (position n >= 3): position n-1 or nearer, its planet no session item's answer.
 * - `two_planets` (biggest, smallest, longest_year, shortest_year): a named pair far apart (size ratio >= 2, period
 *   ratio >= 3) of planets that are no session item's answer and no pair the session asks.
 * No simplify where the item is already the plainest shape (identify, closest, farthest, a pair) or where every easier
 * item is another item's answer in the session (classify asks every kind; see the report).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemFromChallenge, isPairFacet, type SolarBand, type SolarBodyLike, type SolarChallengeLike, type SolarItem }
  from './solarSystemScript';

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

const SIGNATURE = ['signature_planet', 'other_planet'];
const FENCE = 'It is a model, not the planets in this sky: never say which planet or ring in the sky it matches, never tell the learner where in the sky to look, and never name the answer.';

export function solarLevers(item: SolarItem | null, pulled: readonly string[], ctx: SolarLeverContext): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const star = ctx.bodies.some(b => b.type === 'star') ? [lever(STAR_LEVER, 'help', ['said_sun'],
    'The learner names the Sun.', 'Draws a star outline on the Sun and dims it. The planets are unchanged. Say only that the Sun is marked as a star; never point to a ring or a planet.')] : [];
  const simpler = simplerSolar(item, ctx) ? [lever(item.facet === 'position' ? FEWER_RINGS_LEVER : TWO_PLANETS_LEVER, 'simplify', SIGNATURE,
    item.facet === 'position' ? 'The learner loses count this far out from the Sun.' : 'Comparing every planet at once is too much yet.',
    'Opens an easier one of the same kind first. It is not graded; the full item comes back after it.')] : [];
  switch (item.kind) {
    case 'identify': return [...star, lever(CLOSE_UP_LEVER, 'help', ['neighbour_planet', 'other_planet'],
      'The learner names a different planet.',
      'Draws the glowing planet big beside the sky, in its own colours, with no name. Never say its name or describe it.')];
    case 'order_from_sun': return item.facet === 'position'
      ? [...star, lever(FIRST_RING_LEVER, 'help', SIGNATURE, 'The learner counts the Sun as one, or loses count.',
        'Draws the first ring out from the Sun bright. Never count the rings for them or say which planet rides one.'), ...simpler]
      : [...star, lever(NEAR_FAR_LEVER, 'help', SIGNATURE, `The learner names a planet at the other end, or not at the ${item.facet === 'closest' ? 'near' : 'far'} end.`,
        `Shows a model beside the sky: a small sun with a near ring and a far ring, the ${item.facet === 'closest' ? 'near' : 'far'} dot glowing. ${FENCE}`)];
    case 'classify': return [...star, lever(KIND_MODEL_LEVER, 'help', SIGNATURE, 'The learner names a planet that is not that kind.',
      item.facet === 'dwarf'
        ? `Shows a model beside the sky: a tiny world next to a full-size planet. ${FENCE}`
        : `Shows two model worlds beside the sky: a small grey one with craters and a big one with stripes. ${FENCE}`)];
    case 'compare_attribute': return item.facet === 'hottest' || item.facet === 'most_moons'
      ? [...star, lever(FACT_STRIP_LEVER, 'help', SIGNATURE, 'The learner guesses instead of checking every planet.',
        `Lays every planet's ${item.facet === 'hottest' ? 'temperature' : 'moon count'} side by side below the sky, in order from the Sun, none marked. Never say which is ${item.facet === 'hottest' ? 'hottest' : 'most'}.`)]
      : [...star, lever(SIZE_ROW_LEVER, 'help', SIGNATURE, 'The learner names a planet that is not the one asked for.',
        `Draws ${item.facet === 'pair_bigger' ? 'the two glowing planets' : 'the planets'} side by side below the sky at their true sizes, in order from the Sun, with no names. Never say which is ${item.facet === 'smallest' ? 'smallest' : 'biggest'}.`),
        ...simpler];
    case 'orbital_reasoning': return [...star, lever(TRIP_MODEL_LEVER, 'help', SIGNATURE, 'The learner turns the trip around: names the quick one for the slow one.',
      `Shows a model beside the sky: a small sun with a near ring and a far ring; in the same time the near dot has gone a long way round and the far dot a short way. ${FENCE}`),
      ...simpler];
  }
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

/** What the pulled levers put on screen, as a scene fact. Says what is drawn; never a planet name or the answer. */
export function solarLeverFacts(item: SolarItem | null, pulled: readonly string[]): string {
  if (!item) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(STAR_LEVER) && 'The Sun wears a star outline and is dimmed.',
    on(CLOSE_UP_LEVER) && 'Beside the sky, the glowing planet is drawn big in its own colours, with no name.',
    on(NEAR_FAR_LEVER) && `Beside the sky, a model: a small sun with a near ring and a far ring, the ${item.facet === 'closest' ? 'near' : 'far'} dot glowing. It is not this sky.`,
    on(FIRST_RING_LEVER) && 'The first ring out from the Sun is drawn bright.',
    on(KIND_MODEL_LEVER) && (item.facet === 'dwarf'
      ? 'Beside the sky, a model: a tiny world next to a full-size planet. Neither is from this sky.'
      : 'Beside the sky, two model worlds that are not from this sky: a small grey one with craters and a big one with stripes.'),
    on(SIZE_ROW_LEVER) && (item.facet === 'pair_bigger'
      ? 'Below the sky, the two glowing planets are drawn side by side at their true sizes, with no names.'
      : 'Below the sky, the planets are drawn side by side at their true sizes, in order from the Sun, with no names.'),
    on(FACT_STRIP_LEVER) && `Below the sky, a strip shows every planet's ${item.facet === 'hottest' ? 'temperature' : 'moon count'} side by side, in order from the Sun, none marked.`,
    on(TRIP_MODEL_LEVER) && 'Beside the sky, a model: a small sun with a near ring and a far ring; in the same time the near dot has gone a long way round and the far dot a short way. It is not this sky.',
  ].filter((s): s is string => !!s).join(' ');
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
