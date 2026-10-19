/**
 * Solar system explorer's domain: the bodies, the items and their code-computed answers, the ask, the spoken key, the
 * known misses and the scene. Pure; the boss (`solarSystem.boss.ts`), the levers, the component and the generator
 * read it. It was the judged DI script (the first science port); the cue protocol went with the move to the boss
 * (2026-10-19).
 *
 * ── EVERY MODE SPEAKS ───────────────────────────────────────────────────────
 *
 *   identify           → the name of the planet the model spotlights
 *   order_from_sun     → the planet closest, farthest, or Nth from the Sun
 *   classify           → any one planet of a named kind (rocky, gas giant, dwarf)
 *   compare_attribute  → the planet that wins an attribute, or the bigger of a named pair
 *   orbital_reasoning  → the planet picked by its trip around the Sun, or the faster of a named pair
 *
 * Every answer is a planet's NAME: short, closed-set and sayable. Tapping, zooming and panning are LOOKING (research
 * on the model, the compare modes' own instrument); they never answer.
 *
 * ── WHAT THE SCREEN AND THE ASK MAY SAY ──────────────────────────────────────
 *
 * identify flips the click-era direction: the model spotlights a planet and the learner names it. While an identify
 * item is open the body LABELS are withheld (a printed name under the spotlit planet is the answer in pixels), and the
 * research card does not open. The ask states its whole problem aloud (a pre-reader cannot read the labels); it names
 * no planet except a pair item's two, which are the menu of a menu key.
 *
 * ── SIGNATURE ERRORS, per facet (the fluent, confident miss) ────────────────
 *   - order closest/farthest: the direction reversal (the other end).
 *   - order position n: the count-the-Sun error, one planet short.
 *   - compare biggest: "the Sun", the biggest thing on screen and a star, not a planet.
 *   - compare hottest: the closest planet (closest-is-hottest).
 *   - classify giant: the biggest rocky planet (big is not made of gas).
 *   - orbital longest year: the quickest planet (the reversal).
 *   - identify: the neighbour planet.
 *
 * ── BUILD GATES (drop, never repair) ────────────────────────────────────────
 * A body name that carries the facet's answer vocabulary ("Giant Jupiter", "Speedy Mercury") drops the item; a tie at
 * the deciding extreme drops it; a period table that contradicts the distance law drops the orbital items; moons and
 * temperature live on stat cards a K-1 screen does not render, so those facets drop at K-1; and one body answers at
 * most one single-answer item per session.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import {
  isSayableName,
  namesEarSeparable,
  nameCarriesAny,
  MEASURE_ADJECTIVES,
  ORDINAL_TOKENS,
} from '../math/spokenNameGates';

// ============================================================================
// Domain vocabulary
// ============================================================================

export type SolarChallengeType =
  | 'identify'
  | 'order_from_sun'
  | 'classify'
  | 'compare_attribute'
  | 'orbital_reasoning';

export type SolarFacet =
  | 'name'
  | 'closest' | 'farthest' | 'position'
  | 'rocky' | 'giant' | 'dwarf'
  | 'biggest' | 'smallest' | 'most_moons' | 'hottest' | 'pair_bigger'
  | 'longest_year' | 'shortest_year' | 'pair_faster';

export type SolarBand = 'K' | '1' | '2' | '3' | '4' | '5';

const FACETS_OF_KIND: Record<SolarChallengeType, readonly SolarFacet[]> = {
  identify: ['name'],
  order_from_sun: ['closest', 'farthest', 'position'],
  classify: ['rocky', 'giant', 'dwarf'],
  compare_attribute: ['biggest', 'smallest', 'most_moons', 'hottest', 'pair_bigger'],
  orbital_reasoning: ['longest_year', 'shortest_year', 'pair_faster'],
};

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'] as const;

/** Category rules, COMPUTED from body data — one definition, imported by the
 *  generator, so the two sides of the wire cannot disagree on what a gas giant
 *  is. */
export interface SolarBodyLike {
  id: string;
  name: string;
  type: 'star' | 'planet' | 'dwarf-planet';
  radiusKm: number;
  distanceAu: number;
  orbitalPeriodDays: number;
  moons: number;
  temperatureC: number;
}

export const isRockyPlanet = (b: SolarBodyLike): boolean =>
  b.type === 'planet' && b.radiusKm < 20000 && b.distanceAu < 3;
export const isGasGiant = (b: SolarBodyLike): boolean =>
  b.type === 'planet' && b.radiusKm >= 20000;
export const isDwarf = (b: SolarBodyLike): boolean => b.type === 'dwarf-planet';

export const categoryMembers = (
  bodies: readonly SolarBodyLike[],
  facet: 'rocky' | 'giant' | 'dwarf',
): SolarBodyLike[] =>
  bodies.filter(facet === 'rocky' ? isRockyPlanet : facet === 'giant' ? isGasGiant : isDwarf);

const CATEGORY_LABEL: Record<'rocky' | 'giant' | 'dwarf', string> = {
  rocky: 'rocky planet',
  giant: 'gas giant',
  dwarf: 'dwarf planet',
};

// ============================================================================
// ⭐ Defect-11 refuse lists — a generated NAME that answers the ask out loud
// ============================================================================

/** Facet → the vocabulary its answer lives in. A body name carrying any of
 *  these words answers (or poisons) the ask from the label, so the ITEM drops.
 *  Real solar names ("Mars", "Neptune") never hit; hallucinated ones do. */
const REFUSED_NAME_TOKENS: Partial<Record<SolarFacet, readonly string[]>> = {
  closest: [...ORDINAL_TOKENS, 'closest', 'close', 'nearest', 'near', 'inner', 'innermost'],
  farthest: [...ORDINAL_TOKENS, 'farthest', 'far', 'outer', 'outermost', 'edge'],
  position: [...ORDINAL_TOKENS, 'inner', 'outer'],
  rocky: ['rocky', 'rock', 'stone', 'stony', 'gas', 'gassy', 'giant', 'dwarf'],
  giant: ['rocky', 'rock', 'gas', 'gassy', 'giant', 'dwarf', ...MEASURE_ADJECTIVES],
  dwarf: ['rocky', 'gas', 'giant', 'dwarf', ...MEASURE_ADJECTIVES],
  biggest: MEASURE_ADJECTIVES,
  smallest: MEASURE_ADJECTIVES,
  pair_bigger: MEASURE_ADJECTIVES,
  most_moons: ['moon', 'moons', 'moony'],
  hottest: ['hot', 'hotter', 'hottest', 'warm', 'burning', 'fiery', 'cold', 'coldest', 'icy', 'frozen'],
  longest_year: ['fast', 'faster', 'fastest', 'slow', 'slower', 'slowest', 'quick', 'quickest', 'speedy', 'year', 'years', 'lazy'],
  shortest_year: ['fast', 'faster', 'fastest', 'slow', 'slower', 'slowest', 'quick', 'quickest', 'speedy', 'year', 'years', 'racer'],
  pair_faster: ['fast', 'faster', 'fastest', 'slow', 'slower', 'slowest', 'quick', 'quickest', 'speedy'],
};

// ============================================================================
// Answer material — the fork, as code
// ============================================================================

/** Every mode speaks: there is deliberately no gesture branch to reach. */
export const answerKindFor = (_kind: SolarChallengeType): 'voice' => 'voice';

export const responseClassFor = (_kind: SolarChallengeType): ResponseClassId =>
  'short_spoken_word';

/** Task identity per kind. */
export const actionFor = (kind: SolarChallengeType): string => {
  switch (kind) {
    case 'identify': return 'name-planet';
    case 'order_from_sun': return 'count-rings';
    case 'classify': return 'name-kind';
    case 'compare_attribute': return 'compare-planets';
    case 'orbital_reasoning': return 'watch-orbits';
  }
};

export const isPairFacet = (facet: SolarFacet): boolean =>
  facet === 'pair_bigger' || facet === 'pair_faster';

export interface SolarItem extends JudgedScriptItem {
  kind: SolarChallengeType;
  facet: SolarFacet;
  band: SolarBand;
  /** Display NAMES of every right answer — one for most facets, the whole
   *  member set for classify. Everything spoken reads from names, never ids. */
  answerNames: string[];
  /** Body ids behind `answerNames`, for the on-screen reveal ring. */
  answerBodyIds: string[];
  /** identify: the body the model spotlights. '' elsewhere. */
  targetBodyId: string;
  /** Pair facets: the two compared names in ASK order (hash-decided), and
   *  their ids for the pair spotlight. Empty elsewhere. */
  pairNames: string[];
  pairBodyIds: string[];
  /** order position facet: 1-based position among the planets. 0 elsewhere. */
  position: number;
  /** Planet count on screen — the count-walk in the position correction. */
  planetCount: number;
  /** A confidently-wrong on-screen name for the harness (never spoken). */
  wrongName: string;
  /** The facet's SIGNATURE error: the fluent miss the key refuses. */
  signatureName: string;
  /** hottest only: is the closest-is-hottest trap live in this data? */
  hottestTrap: boolean;
  /** The lesson's support tier: when the model lever comes (`solarSystemLevers.ts`). */
  tier: SupportTier;
}

// ============================================================================
// Build gates — DROP an unaskable item, never repair it into one
// ============================================================================

/** The challenge as the generator emits it (duck-typed so this module never
 *  imports the component — the component imports us). `facet` is the
 *  structured identity; prose `prompt` is legacy and never parsed. */
export interface SolarChallengeLike {
  id: string;
  type: string;
  facet?: string;
  position?: number;
  optionBodyIds?: string[];
  answerBodyIds?: string[];
}

export interface SolarBuildContext {
  bodies: readonly SolarBodyLike[];
  rung: SolarBand;
  /** The lesson's support tier; medium when the lesson names none. */
  tier?: SupportTier;
}

/** Session length ceiling: a spoken session is minutes of speech per item. */
const MAX_SESSION_ITEMS = 8;

/** Size pairs must be VISIBLY unequal, or a K "which is bigger" is a squint. */
const PAIR_SIZE_RATIO = 1.4;
/** Speed pairs must move visibly differently. */
const PAIR_PERIOD_RATIO = 1.5;

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Deterministic, stable across renders and across the wire. */
const hashOf = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const planetsOf = (bodies: readonly SolarBodyLike[]): SolarBodyLike[] =>
  bodies
    .filter((b) => b.type === 'planet')
    .sort((a, b) => a.distanceAu - b.distanceAu);

/** The single winner on `value`, or null when the top two TIE — a tie makes
 *  the item a coin flip with one side scored wrong, so it drops. */
const strictWinner = (
  pool: readonly SolarBodyLike[],
  value: (b: SolarBodyLike) => number,
  dir: 'max' | 'min',
): SolarBodyLike | null => {
  if (pool.length < 2) return null;
  const sorted = [...pool].sort((a, b) => (dir === 'max' ? value(b) - value(a) : value(a) - value(b)));
  if (value(sorted[0]) === value(sorted[1])) return null;
  return sorted[0];
};

/** Orbital pedagogy gate: the orbital items teach "farther = longer year", so
 *  the generated table must actually obey it or the lesson teaches a false
 *  law. Strictly monotonic — equal periods are a tie somewhere too. */
const periodsMonotonicWithDistance = (planets: readonly SolarBodyLike[]): boolean =>
  planets.every((p, i) =>
    i === 0
    || (p.orbitalPeriodDays > planets[i - 1].orbitalPeriodDays && p.orbitalPeriodDays > 0));

/** The defect-11 scan for one item: EVERY on-screen name is checked, because a
 *  poisoned non-answer name misleads exactly as a poisoned answer name leaks. */
const namesCleanFor = (facet: SolarFacet, bodies: readonly SolarBodyLike[]): boolean => {
  const refused = REFUSED_NAME_TOKENS[facet];
  if (!refused) return true;
  return bodies.every((b) => !nameCarriesAny(b.name, refused));
};

const byId = (bodies: readonly SolarBodyLike[], id: unknown): SolarBodyLike | null =>
  typeof id === 'string' ? bodies.find((b) => b.id === id) ?? null : null;

/**
 * One generated challenge → its judged item, or `null` when it cannot be asked
 * honestly. Every rejection is a CONTENT fault the spoken ask exposed:
 *   - unknown type, or a facet that does not belong to it;
 *   - a name the tutor cannot say, names not separable by ear, or a name that
 *     carries the facet's answer vocabulary (defect 11);
 *   - a tie at the deciding extreme, or a period table that contradicts the
 *     distance law the affirm teaches;
 *   - a facet the band cannot research (moons/temperature live on stat cards
 *     the pre-reader screen does not render);
 *   - a declared answer key that disagrees with the computed one.
 * Nothing is backfilled: a placeholder here becomes a spoken ask the tutor has
 * to judge.
 */
export const itemFromChallenge = (
  ch: SolarChallengeLike,
  ctx: SolarBuildContext,
): SolarItem | null => {
  const kind = (Object.keys(FACETS_OF_KIND) as SolarChallengeType[]).find((k) => k === ch.type);
  if (!kind) return null;
  const facet = FACETS_OF_KIND[kind].find((f) => f === ch.facet);
  if (!facet) return null;

  const { bodies, rung } = ctx;
  const isPreReader = rung === 'K' || rung === '1';
  const planets = planetsOf(bodies);
  if (planets.length < 2) return null;

  // Speakability of the whole board: every planet name may be an utterance the
  // judge must tell apart, so the board is gated as a set.
  const boardNames = planets.map((p) => p.name.trim());
  if (!boardNames.every(isSayableName)) return null;
  if (!namesEarSeparable(boardNames)) return null;
  if (!namesCleanFor(facet, bodies)) return null;

  const declaredAnswers = (ch.answerBodyIds ?? []).filter((id) => typeof id === 'string');
  const agreesWithDeclared = (computed: readonly SolarBodyLike[]): boolean =>
    declaredAnswers.length === 0
    || (declaredAnswers.length === computed.length
      && computed.every((b) => declaredAnswers.includes(b.id)));

  const neighbourOf = (p: SolarBodyLike): SolarBodyLike => {
    const i = planets.findIndex((x) => x.id === p.id);
    return planets[i + 1] ?? planets[i - 1];
  };

  const finish = (partial: {
    answers: SolarBodyLike[];
    targetBodyId?: string;
    pair?: SolarBodyLike[];
    position?: number;
    signature: string;
    hottestTrap?: boolean;
  }): SolarItem | null => {
    const { answers } = partial;
    if (answers.length === 0) return null;
    if (!agreesWithDeclared(answers)) return null;
    const answerIds = new Set(answers.map((b) => b.id));
    const wrong = planets.find((p) => !answerIds.has(p.id));
    if (!wrong) return null; // every planet is right → nothing is measured
    const pair = partial.pair ?? [];
    const askOrder = pair.length === 2 && hashOf(ch.id) % 2 === 1 ? [pair[1], pair[0]] : pair;
    return {
      id: ch.id,
      kind,
      facet,
      band: rung,
      answerKind: answerKindFor(kind),
      responseClass: responseClassFor(kind),
      action: actionFor(kind),
      answerNames: answers.map((b) => b.name.trim()),
      answerBodyIds: answers.map((b) => b.id),
      targetBodyId: partial.targetBodyId ?? '',
      pairNames: askOrder.map((b) => b.name.trim()),
      pairBodyIds: askOrder.map((b) => b.id),
      position: partial.position ?? 0,
      planetCount: planets.length,
      wrongName: wrong.name.trim(),
      signatureName: partial.signature,
      hottestTrap: partial.hottestTrap ?? false,
      tier: ctx.tier ?? 'medium',
    };
  };

  switch (facet) {
    case 'name': {
      const target = byId(bodies, declaredAnswers[0] ?? ch.optionBodyIds?.[0]);
      if (!target || target.type !== 'planet') return null;
      return finish({
        answers: [target],
        targetBodyId: target.id,
        signature: neighbourOf(target).name.trim(),
      });
    }

    case 'closest': {
      const winner = strictWinner(planets, (b) => b.distanceAu, 'min');
      if (!winner) return null;
      return finish({
        answers: [winner],
        signature: planets[planets.length - 1].name.trim(),
      });
    }
    case 'farthest': {
      const winner = strictWinner(planets, (b) => b.distanceAu, 'max');
      if (!winner) return null;
      return finish({ answers: [winner], signature: planets[0].name.trim() });
    }
    case 'position': {
      const n = ch.position ?? 0;
      // First and last belong to closest/farthest; counting starts at 2. And a
      // COUNTING task needs an unambiguous line — no shared distances anywhere.
      if (!Number.isInteger(n) || n < 2 || n > planets.length - 1) return null;
      if (n - 1 >= ORDINALS.length) return null;
      if (new Set(planets.map((p) => p.distanceAu)).size !== planets.length) return null;
      if (isPreReader) return null; // ordinal counting is not a K-1 move (click-era gate, kept)
      return finish({
        answers: [planets[n - 1]],
        position: n,
        // The count-the-Sun error lands one planet SHORT of the target.
        signature: planets[n - 2].name.trim(),
      });
    }

    case 'rocky':
    case 'giant':
    case 'dwarf': {
      const members = categoryMembers(bodies, facet);
      if (members.length === 0) return null;
      if (facet !== 'dwarf' && members.length >= planets.length) return null;
      if (!members.every((m) => isSayableName(m.name))) return null;
      const nonMembers = planets.filter((p) => !members.some((m) => m.id === p.id));
      if (nonMembers.length === 0) return null;
      const signature =
        facet === 'giant'
          ? strictWinner(nonMembers, (b) => b.radiusKm, 'max')?.name
          : strictWinner(nonMembers, (b) => b.radiusKm, 'min')?.name;
      return finish({
        answers: members,
        signature: (signature ?? nonMembers[0].name).trim(),
      });
    }

    case 'biggest': {
      const winner = strictWinner(planets, (b) => b.radiusKm, 'max');
      if (!winner) return null;
      // The Sun-is-not-a-planet trap is the signature; it needs a sun on screen
      // to be live, else the runner-up stands in.
      const sun = bodies.find((b) => b.type === 'star');
      const runnerUp = [...planets].sort((a, b) => b.radiusKm - a.radiusKm)[1];
      return finish({
        answers: [winner],
        signature: (sun?.name ?? runnerUp.name).trim(),
      });
    }
    case 'smallest': {
      const winner = strictWinner(planets, (b) => b.radiusKm, 'min');
      if (!winner) return null;
      const dwarf = bodies.find(isDwarf);
      const runnerUp = [...planets].sort((a, b) => a.radiusKm - b.radiusKm)[1];
      return finish({
        answers: [winner],
        signature: (dwarf?.name ?? runnerUp.name).trim(),
      });
    }
    case 'most_moons': {
      if (isPreReader) return null; // the moon counts live on stat cards K-1 never renders
      const winner = strictWinner(planets, (b) => b.moons, 'max');
      if (!winner || winner.moons <= 0) return null;
      const runnerUp = [...planets].sort((a, b) => b.moons - a.moons)[1];
      return finish({ answers: [winner], signature: runnerUp.name.trim() });
    }
    case 'hottest': {
      if (isPreReader) return null; // temperature lives on the stat cards too
      const winner = strictWinner(planets, (b) => b.temperatureC, 'max');
      if (!winner) return null;
      const closest = planets[0];
      const trap = winner.id !== closest.id;
      const runnerUp = [...planets].sort((a, b) => b.temperatureC - a.temperatureC)[1];
      return finish({
        answers: [winner],
        signature: (trap ? closest.name : runnerUp.name).trim(),
        hottestTrap: trap,
      });
    }
    case 'pair_bigger': {
      const a = byId(bodies, ch.optionBodyIds?.[0]);
      const b = byId(bodies, ch.optionBodyIds?.[1]);
      if (!a || !b || a.id === b.id || a.type !== 'planet' || b.type !== 'planet') return null;
      const [small, big] = a.radiusKm < b.radiusKm ? [a, b] : [b, a];
      if (small.radiusKm <= 0 || big.radiusKm / small.radiusKm < PAIR_SIZE_RATIO) return null;
      if (!namesEarSeparable([a.name, b.name])) return null;
      return finish({ answers: [big], pair: [a, b], signature: small.name.trim() });
    }

    case 'longest_year':
    case 'shortest_year': {
      if (!periodsMonotonicWithDistance(planets)) return null;
      const dir = facet === 'longest_year' ? 'max' : 'min';
      const winner = strictWinner(planets, (b) => b.orbitalPeriodDays, dir);
      if (!winner) return null;
      const other = strictWinner(planets, (b) => b.orbitalPeriodDays, dir === 'max' ? 'min' : 'max');
      return finish({ answers: [winner], signature: (other?.name ?? '').trim() || planets[0].name.trim() });
    }
    case 'pair_faster': {
      if (!periodsMonotonicWithDistance(planets)) return null;
      const a = byId(bodies, ch.optionBodyIds?.[0]);
      const b = byId(bodies, ch.optionBodyIds?.[1]);
      if (!a || !b || a.id === b.id || a.type !== 'planet' || b.type !== 'planet') return null;
      if (a.orbitalPeriodDays <= 0 || b.orbitalPeriodDays <= 0) return null;
      const [fast, slow] = a.orbitalPeriodDays < b.orbitalPeriodDays ? [a, b] : [b, a];
      if (slow.orbitalPeriodDays / fast.orbitalPeriodDays < PAIR_PERIOD_RATIO) return null;
      if (!namesEarSeparable([a.name, b.name])) return null;
      return finish({ answers: [fast], pair: [a, b], signature: slow.name.trim() });
    }
  }
};

/**
 * The whole session's items.
 *
 * DEDUP IS SESSION-WIDE, NOT CONSECUTIVE (defect class 2):
 *   - one FACET once (position distinguished by n, pairs by the pair);
 *   - a BODY may star as a single-answer at most once across the session —
 *     every credited item rings its answer on screen, so a second item
 *     resolving to the same body is recall. Classify keeps its whole member
 *     set (its reveal names the CATEGORY, not a member, so it consumes
 *     nothing — see `revealTextFor`).
 */
export const itemsFromChallenges = (
  challenges: readonly SolarChallengeLike[],
  ctx: SolarBuildContext,
): { items: SolarItem[]; droppedChallenges: number } => {
  const items: SolarItem[] = [];
  const seenIds = new Set<string>();
  const seenFacets = new Set<string>();
  const answeredBodies = new Set<string>();
  let dropped = 0;
  for (const ch of challenges ?? []) {
    if (!ch?.id || seenIds.has(ch.id)) { dropped++; continue; }
    if (items.length >= MAX_SESSION_ITEMS) { dropped++; continue; }
    const item = itemFromChallenge(ch, ctx);
    if (!item) { dropped++; continue; }
    const facetKey = `${item.kind}:${item.facet}:${item.position || ''}:${item.targetBodyId}:${[...item.pairBodyIds].sort().join('+')}`;
    if (seenFacets.has(facetKey)) { dropped++; continue; }
    const singleAnswer = item.kind !== 'classify';
    if (singleAnswer && answeredBodies.has(item.answerBodyIds[0])) { dropped++; continue; }
    seenIds.add(ch.id);
    seenFacets.add(facetKey);
    if (singleAnswer) answeredBodies.add(item.answerBodyIds[0]);
    items.push(item);
  }
  return { items, droppedChallenges: dropped };
};

// ============================================================================
// The ask
// ============================================================================

const namePair = (names: readonly string[]): string => names.join(' and ');

const ordinalOf = (n: number): string => ORDINALS[n - 1] ?? `${n}th`;

/**
 * The ask, code-owned at every band. It STATES ITS PROBLEM ALOUD because a pre-reader cannot read the labels. The
 * identify ask is deliberately an invariant short repeat: that mode may not name or describe anything on screen (the
 * name is the answer and the appearance is the evidence). A pair ask names both planets: they are the key's menu.
 */
export const askFor = (item: SolarItem): string => {
  switch (item.facet) {
    case 'name':
      return 'Look at the planet glowing bright. What planet is that?';
    case 'closest':
      return 'Which planet is closest to the Sun? Say its name.';
    case 'farthest':
      return 'Which planet is farthest from the Sun? Say its name.';
    case 'position':
      return `Count the rings out from the Sun. Which planet is ${ordinalOf(item.position)} from the Sun? Say its name.`;
    case 'rocky':
      return 'Rocky planets are the smaller ones made of rock. Say the name of one rocky planet.';
    case 'giant':
      return 'Gas giants are the great big planets made of gas. Say the name of one gas giant.';
    case 'dwarf':
      return 'A dwarf planet is a tiny world, smaller than a true planet. Say the name of one dwarf planet.';
    case 'biggest':
      return 'Look at all the planets. Which planet is the biggest? Say its name.';
    case 'smallest':
      return 'Look at all the planets. Which planet is the smallest? Say its name.';
    case 'most_moons':
      return 'Tap the planets and look at their moons. Which planet has the most moons? Say its name.';
    case 'hottest':
      return 'Tap the planets and check how hot each one is. Which planet is the hottest? Say its name.';
    case 'pair_bigger':
      return `Look at ${namePair(item.pairNames)}. Which one is bigger? Say its name.`;
    case 'longest_year':
      return 'Watch them travel. Which planet takes the longest to go all the way around the Sun? Say its name.';
    case 'shortest_year':
      return 'Watch them travel. Which planet goes around the Sun the quickest? Say its name.';
    case 'pair_faster':
      return `Watch ${namePair(item.pairNames)} go around the Sun. Which one is faster? Say its name.`;
  }
};

/** The reveal the stage paints once the answer is credited, never before: the name, or the KIND on classify. */
export const revealTextFor = (item: SolarItem): string =>
  item.kind === 'classify'
    ? cap(CATEGORY_LABEL[item.facet as 'rocky' | 'giant' | 'dwarf'])
    : item.answerNames[0];

// ============================================================================
// The key
// ============================================================================

const isSun = (name: string) => name.trim().toLowerCase() === 'sun';

/** The facet's signature planet, when it is a planet that is not an answer. */
const signaturePlanet = (item: SolarItem): string | undefined =>
  item.signatureName && !isSun(item.signatureName) && !item.answerNames.includes(item.signatureName)
    ? item.signatureName : undefined;

/**
 * The key the tutor judges each item with: the planet's name (any one member on classify), a menu of the two names on
 * a pair item, whose ask says both, and the facet's signature planet as the wrong answer that sounds right.
 */
export function solarKey(item: SolarItem): SpokenKey {
  const sig = signaturePlanet(item);
  const signature = sig ? `"${sig}" is not it. ` : '';
  if (item.kind === 'classify') {
    const [answer, ...rest] = item.answerNames;
    return {
      answer, alsoAccept: rest,
      acceptRule: 'Any one of them counts, alone or inside a phrase.',
      signatureError: `${signature}The kind's name with no planet name, or the Sun, is not it.`,
    };
  }
  return {
    answer: item.answerNames[0], alsoAccept: [],
    ...(isPairFacet(item.facet) ? { menu: [...item.pairNames] } : {}),
    acceptRule: 'The name alone or inside a phrase counts.',
    signatureError: `${signature}The Sun, a colour or "that one" with no name is not it.`,
  };
}

// ============================================================================
// Known misses
// ============================================================================

/** What a wrong spoken name shows (handoff 20 Part B). */
export type SpokenSolarMiss = 'said_sun' | 'neighbour_planet' | 'signature_planet' | 'other_planet';

/** How each facet's signature wrong name relates to the answer, stated as a fact the listener cannot see. */
const SIGNATURE_FACT: Partial<Record<SolarFacet, (sig: string) => string>> = {
  smallest: sig => `${sig} looks tiny but is a dwarf planet or a runner-up, not the smallest true planet.`,
  hottest: sig => `${sig} is the planet closest to the Sun, but it is not the hottest.`,
};

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the Sun (a star, not a
 * planet); the facet's signature name (the next planet on identify, `hottestTrap` closest planet...); any other
 * planet name. Concrete per item: the names computed from the bodies on screen.
 */
export function solarSpokenMisses(item: SolarItem): KnownMiss[] {
  const answer = item.kind === 'classify' ? item.answerNames.join(', ') : item.answerNames[0];
  const fact = item.kind === 'classify' ? `The right answers are ${answer}.` : `The right answer is ${answer}.`;
  const sig = signaturePlanet(item);
  const wrong = item.wrongName && item.wrongName !== sig && !isSun(item.wrongName) && !item.answerNames.includes(item.wrongName)
    ? item.wrongName : undefined;
  const sigFact = !sig || item.kind === 'identify' || (item.facet === 'hottest' && !item.hottestTrap) || !SIGNATURE_FACT[item.facet]
    ? '' : ` ${SIGNATURE_FACT[item.facet]!(sig)}`;
  return [
    { id: 'said_sun', pattern: `${fact} The learner's answer is the Sun, which is a star, not a planet.`, examples: ['the Sun'] },
    ...(sig ? [{ id: item.kind === 'identify' ? 'neighbour_planet' : 'signature_planet', pattern: item.kind === 'identify'
      ? `The glowing planet is ${answer}. The learner's answer is ${sig}, the planet next to ${answer}.`
      : `${fact}${sigFact} The learner's answer is ${sig}.`, examples: [sig] }] : []),
    { id: 'other_planet', pattern: `${fact} The learner's answer names a different planet${sig ? ` (not ${sig})` : ''}.`,
      examples: wrong ? [wrong] : [] },
  ];
}

// ============================================================================
// Scene
// ============================================================================

/** What is drawn. Never the answer: the spotlit planet is not named, and the research card stays shut where it would print it. */
export function solarScene(item: SolarItem, view: { preReader: boolean }): SceneOf {
  const facts: Record<string, string> = {
    shown: item.kind === 'identify' ? 'The solar system model. One planet glows bright; while this question is open no planet wears its name.'
      : isPairFacet(item.facet) ? `The solar system model, with ${item.pairNames.join(' and ')} glowing together.`
        : `The solar system model: the Sun and ${item.planetCount} planets, each on its own ring.`,
    constraints: 'Tapping a planet is looking, never an answer'
      + (view.preReader || item.kind === 'identify' ? '; no body card opens on this item.' : '; it opens that body\'s card.')
      + (item.kind === 'identify' ? '' : ' Every answer is on screen among the planets: pointing to one planet, or to its ring, says it.'),
  };
  return { objects: [], facts };
}

// ============================================================================
// Harness answers
// ============================================================================

/** The journey's answers: the code-computed name, or a confidently wrong planet on screen. */
export const solarHarnessAnswers = (item: SolarItem): { correct: string; plainWrong: string } => ({
  correct: item.answerNames[0],
  plainWrong: item.wrongName,
});
