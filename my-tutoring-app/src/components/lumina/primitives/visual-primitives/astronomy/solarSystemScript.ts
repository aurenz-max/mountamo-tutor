/**
 * solarSystemScript — HAND-AUTHORED judged-loop script for solar-system-explorer,
 * the first SCIENCE port of the DI modality (qa/di/BACKLOG.md). The exact
 * wording IS the pedagogy — these lines are authored per pack, never generated.
 * Item CONTENT (which bodies, which facet) is generator-scoped; this module owns
 * the cue shapes, the build gates and the in-band judging contracts.
 *
 * ── THE REIMAGINING, IN ONE SENTENCE ────────────────────────────────────────
 *
 * The child and the tutor sit under a LIVING SKY: the tutor asks about the sky
 * out loud, the child answers OUT LOUD with a planet's name, and the tutor's
 * own affirmation is the only thing that moves the lesson — the screen
 * spotlights, reveals and keeps orbiting, but it never asks, never checks and
 * never advances.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 *   identify           → SPOKEN planet name   short_spoken_word (benched)
 *   order_from_sun     → SPOKEN planet name   short_spoken_word (benched)
 *   classify           → SPOKEN planet name   short_spoken_word (benched)
 *   compare_attribute  → SPOKEN planet name   short_spoken_word (benched)
 *   orbital_reasoning  → SPOKEN planet name   short_spoken_word (benched)
 *
 * ALL FIVE modes speak, and none is a conversion stretch: every answer this
 * primitive has ever graded IS a celestial body, and a body has a short,
 * closed-set, sayable NAME. At the table a teacher points at a poster and asks
 * "which planet is closest to the Sun?" — the child says "Mercury". There is
 * no confirm button in that picture, and no reason for one here. NO new
 * response class, so this port ships on the standing rule (machine gates +
 * live generation probe + a `--di` drive), owing no bench sitting.
 *
 * WHY THE TAP LOOP WAS A COSTUME. The click era tapped a body, then pressed a
 * separate confirm button, under a MAX_ATTEMPTS reveal ladder and a Next
 * button. Costume test — can a child who cannot do the skill still perform the
 * action? Yes: tap-anything is 1-in-N by guessing, and the vocabulary the
 * K objective is ABOUT (the planet NAMES) never left the child's mouth.
 * The tap SURVIVES as what it honestly is — LOOKING. Zooming, panning and
 * tapping a body open are research on the model (the compare modes' own
 * instrument); they are never an answer, and the judging contract says so.
 *
 * WHY `identify` FLIPPED DIRECTION. "Tap Mars" (receptive) became "the model
 * spotlights a planet — what planet is that?" (expressive). Naming a shown
 * thing is the K standard, it is the direction a table teacher actually drills
 * ("what is this one called?"), and the receptive form cannot be spoken
 * without the tutor naming the answer inside the ask. The spotlight is a
 * runner-gated stimulus: it appears only after the tutor's ask for THIS item
 * has been spoken (19c — the tutor owns the stimulus clock, declared not
 * hand-rolled). While an identify item is open the body LABELS are withheld —
 * a printed name under the spotlit planet would be the answer in pixels.
 *
 * ── THE §2 SCRIPT QUESTIONS, ANSWERED HERE ──────────────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? For identify, yes — modeling would say the name,
 *    so nothing is modeled before the ask and the name is earned in the
 *    correction (model → test: "My turn: that planet is Mars — the red one.
 *    Your turn. What planet is that?"). For the derivable modes the correction
 *    models the STRATEGY (count the rings; watch which one crawls; check the
 *    cards) and names the answer once, DISTAR-style, then re-elicits.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? The sky is always on screen and
 *    the ask states its whole problem aloud — a pre-reader cannot read the
 *    labels, so no ask ever depends on reading one.
 *
 * 3. SIGNATURE ERRORS, per facet — the fluent, confident miss:
 *    - order closest/farthest: the DIRECTION REVERSAL (the other end).
 *    - order position n: the COUNT-THE-SUN error — a learner who counts the
 *      Sun as "one" lands exactly one planet short.
 *    - compare biggest: "the Sun" — it IS the biggest thing on screen, and it
 *      is a star, not a planet. The refusal teaches the star/planet line.
 *    - compare hottest: the CLOSEST planet — closest-is-hottest is the
 *      canonical trap, and the affirm names why it is wrong.
 *    - classify giant: the biggest ROCKY planet (big ≠ made of gas).
 *    - orbital longest year: the QUICKEST planet (the reversal).
 *    - identify: the NEIGHBOUR planet — right neighbourhood, wrong name.
 *
 * ── ⭐ DEFECT CLASSES CHECKED AGAINST THIS PRIMITIVE (skill preamble) ───────
 *
 * (2) THE ANSWER MAY BE ANSWERED ONCE. Every item closes by naming its answer
 *     aloud AND ringing it on screen, so `itemsFromChallenges` dedupes
 *     session-wide: one facet once, and one BODY at most once as a
 *     single-answer item — after "Yes, Mercury rides the smallest ring", an
 *     identify spotlight on Mercury is recall, not skill.
 *
 * (11) THE STIMULUS'S OWN LABEL CAN BE THE ANSWER. Body names are GENERATED
 *     content. A body called "Giant Jupiter" answers `compare biggest` from
 *     the label; "Speedy Mercury" answers the orbital modes. Every item scans
 *     ALL on-screen names against its facet's dimension vocabulary
 *     (`nameCarriesAny`, the shared defect-11 scanner) and DROPS on a hit.
 *     And the pixels half: the identify label withhold above, plus the stat
 *     cards staying exactly as band-gated as the click era left them.
 *
 * (5) VERDICT_ENDS_THE_TURN rides every contract-carrying cue AND the catalog
 *     directive — an affirmation that runs on into a fabricated next ask was
 *     11-of-12 on word-sorter.
 *
 * (8) WRITING THE SPOKEN ASK AUDITED THE CONTENT. Two findings: (a) the
 *     orbital affirms say "farther means a longer year", so the build gate
 *     requires the generated periods to actually be monotonic in distance —
 *     a hallucinated period table would put a false law in the tutor's mouth;
 *     (b) "smallest planet" with Pluto on screen has two defensible answers
 *     unless the star/dwarf line is drawn, so the contract draws it and the
 *     dwarf is the named signature error, not an ambiguity.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * `checkPackGates` in this pack's test file over every cue it can emit.
 */

import type {
  JudgedScriptItem,
  ResponseClassId,
  JudgedCueSurface,
} from '../../../hooks/judgedScriptContract';
import { numberWordFor } from '../math/countingBoardScript';
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

/**
 * Colour-and-appearance clauses, code-owned. The click era used these inside
 * the ASK ("Tap Mars — the red one"); the spoken flip moves them to the affirm
 * and the correction, where naming what the child is looking at is teaching
 * rather than a leak. Colour-only on purpose: "the biggest one" in an identify
 * line would answer a compare item elsewhere in the same session.
 */
export const SOLAR_APPEARANCE: Record<string, string> = {
  mercury: 'the small grey one',
  venus: 'the pale yellow one',
  earth: 'the blue one, our home',
  mars: 'the red one',
  jupiter: 'the one with orange stripes',
  saturn: 'the pale gold one with rings',
  uranus: 'the light blue-green one',
  neptune: 'the deep blue one',
  pluto: 'the small brown one',
};

/** Category rules, COMPUTED from body data — one definition, imported by the
 *  generator, so the two sides of the wire cannot disagree on what a gas giant
 *  is (the letter-spotter drift lesson). */
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

const CATEGORY_CLAUSE: Record<'rocky' | 'giant' | 'dwarf', string> = {
  rocky: 'the smaller ones made of rock',
  giant: 'the great big planets made of gas',
  dwarf: 'the tiny worlds, smaller than a true planet',
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

/** Every mode speaks. The costume test cleared the whole board — see the
 *  module docblock — so there is deliberately no gesture branch to reach. */
export const answerKindFor = (_kind: SolarChallengeType): 'voice' => 'voice';

export const responseClassFor = (_kind: SolarChallengeType): ResponseClassId =>
  'short_spoken_word';

/** Task identity for the runner's how-to-play re-speak policy. */
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
  /** identify: code-owned appearance clause ('' when the body is unknown). */
  appearance: string;
  /** A confidently-wrong on-screen name for the harness (never spoken). */
  wrongName: string;
  /** The facet's SIGNATURE error — the fluent miss the contract refuses. */
  signatureName: string;
  /** hottest only: is the closest-is-hottest trap live in this data? */
  hottestTrap: boolean;
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
}

/** Session length ceiling — a judged session is minutes of speech per item. */
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

/** Orbital pedagogy gate (finding 8a): the affirms teach "farther = longer
 *  year", so the generated table must actually obey it or the tutor speaks a
 *  false law. Strictly monotonic — equal periods are a tie somewhere too. */
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
      appearance: partial.targetBodyId ? (SOLAR_APPEARANCE[partial.targetBodyId] ?? '') : '',
      wrongName: wrong.name.trim(),
      signatureName: partial.signature,
      hottestTrap: partial.hottestTrap ?? false,
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
 *     every affirm names its answer aloud and rings it on screen, so a second
 *     item resolving to the same body is recall. Classify keeps its whole
 *     member set (its affirm deliberately names the CATEGORY, not a member,
 *     so it consumes nothing — see `affirmFor`).
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
// The spoken surface
// ============================================================================

/** Planet names take no article — "Jupiter or Mars", never "the Jupiter". */
const nameChoice = (names: readonly string[]): string => names.join(' or ');
const namePair = (names: readonly string[]): string => names.join(' and ');

const ordinalOf = (n: number): string => ORDINALS[n - 1] ?? `${n}th`;

/** "one, two, three" up to the target — the counting walk the position
 *  correction models. */
const countWalk = (n: number): string =>
  Array.from({ length: n }, (_, i) => numberWordFor(i + 1)).join(', ');

/**
 * How-to-play — spoken on the OPENER and whenever the ACTION changes, never
 * per item (the lead-in belongs to the introduction of an action; DISTAR fades
 * the model rather than re-reading it).
 */
export const howToPlayFor = (item: SolarItem): string => {
  switch (item.kind) {
    case 'identify':
      return 'When a planet glows bright, look at it, then say its name out loud. ';
    case 'order_from_sun':
      return 'Look at the rings around the Sun — each planet rides its own ring. Say the planet\'s name out loud. ';
    case 'classify':
      return 'Think about what kind of planet each one is, then say one planet\'s name out loud. ';
    case 'compare_attribute':
      return 'Look at the planets next to each other, then say the name of the one I ask for. ';
    case 'orbital_reasoning':
      return 'Watch the planets travel around the Sun, then say the name of the one I ask for. ';
  }
};

/**
 * The ask — code-owned at every band, and it STATES ITS PROBLEM ALOUD because
 * a pre-reader cannot read the labels. The identify ask is deliberately an
 * invariant SHORT repeat (10 words): that mode may not name or describe
 * anything on screen — the name is the answer and the appearance is the
 * evidence — so it carries the DI signal, not a recitation
 * (`findRepeatedConsecutiveAsks` calibration).
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

/** The span of the ask inside which an answer name may legitimately appear:
 *  the pair MENU clause, and nothing else. */
export const leakExemptSpanFor = (item: SolarItem): string | undefined => {
  switch (item.facet) {
    case 'pair_bigger':
      return `Look at ${namePair(item.pairNames)}.`;
    case 'pair_faster':
      return `Watch ${namePair(item.pairNames)} go around the Sun.`;
    default:
      return undefined;
  }
};

// ── Verdict lines ───────────────────────────────────────────────────────────

const name0 = (item: SolarItem): string => item.answerNames[0];

const affirmFor = (item: SolarItem): string => {
  const n = name0(item);
  switch (item.facet) {
    case 'name':
      return item.appearance
        ? `Yes, ${n}. ${n} is ${item.appearance}.`
        : `Yes, that planet is ${n}.`;
    case 'closest':
      return `Yes, ${n}. ${n} rides the smallest ring, right beside the Sun.`;
    case 'farthest':
      return `Yes, ${n}. ${n} rides the biggest ring, far far away.`;
    case 'position':
      return `Yes, ${n}. Count the rings — ${countWalk(item.position)} — ${n} is ${ordinalOf(item.position)} from the Sun.`;
    case 'rocky':
    case 'giant':
    case 'dwarf':
      // Deliberately names the CATEGORY and not a member: the affirm cannot
      // know WHICH member the child said, and naming one they did not say
      // would judge an answer nobody gave. This is also what keeps classify
      // from consuming its members for the session dedupe.
      return `Yes, that one is a ${CATEGORY_LABEL[item.facet]} — ${CATEGORY_CLAUSE[item.facet]}.`;
    case 'biggest':
      return `Yes, ${n}. ${n} is the biggest planet here.`;
    case 'smallest':
      return `Yes, ${n}. ${n} is the smallest planet here.`;
    case 'most_moons':
      return `Yes, ${n}. ${n} has more moons than any other planet here.`;
    case 'hottest':
      return item.hottestTrap
        ? `Yes, ${n}. ${n} is the hottest planet here, even though it is not the closest to the Sun.`
        : `Yes, ${n}. ${n} is the hottest planet here.`;
    case 'pair_bigger':
      return `Yes, ${n} is bigger than ${item.pairNames.find((p) => p !== n) ?? ''}.`;
    case 'longest_year':
      return `Yes, ${n}. ${n} is the farthest away, so its trip around the Sun is the longest of all.`;
    case 'shortest_year':
      return `Yes, ${n}. ${n} is the closest in, so its trip around the Sun is the shortest.`;
    case 'pair_faster':
      return `Yes, ${n} is faster — its ring is closer to the Sun, so its trip is shorter.`;
  }
};

/** Standing gate 3: open "My turn:", model (the answer AND the strategy that
 *  finds it), then re-elicit. The re-ask inherits the whole problem, because
 *  the child cannot read it off the screen. */
const correctionFor = (item: SolarItem): string => {
  const n = name0(item);
  switch (item.facet) {
    case 'name':
      return `My turn: that planet is ${n}${item.appearance ? ` — ${item.appearance}` : ''}. `
        + `Your turn. What planet is that?`;
    case 'closest':
      return `My turn: start at the Sun and find the smallest ring — ${n} rides it. `
        + `Your turn. Which planet is closest to the Sun?`;
    case 'farthest':
      return `My turn: find the biggest ring, out at the very edge — ${n} rides it. `
        + `Your turn. Which planet is farthest from the Sun?`;
    case 'position':
      return `My turn: count the rings out from the Sun — ${countWalk(item.position)} — ${n} is ${ordinalOf(item.position)}. `
        + `Your turn. Which planet is ${ordinalOf(item.position)} from the Sun?`;
    case 'rocky':
      return `My turn: rocky planets are the smaller ones made of rock — ${n} is one. `
        + `Your turn. Say the name of one rocky planet.`;
    case 'giant':
      return `My turn: gas giants are the great big ones made of gas — ${n} is one. `
        + `Your turn. Say the name of one gas giant.`;
    case 'dwarf':
      return `My turn: a dwarf planet is a tiny world, smaller than a true planet — ${n} is one. `
        + `Your turn. Say the name of one dwarf planet.`;
    case 'biggest':
      return `My turn: look at how much room each planet takes up — ${n} takes the most. `
        + `Your turn. Which planet is the biggest?`;
    case 'smallest':
      return `My turn: look for the tiniest circle of all — that is ${n}. `
        + `Your turn. Which planet is the smallest?`;
    case 'most_moons':
      return `My turn: tap the planets and check their cards one at a time — ${n} has the most moons. `
        + `Your turn. Which planet has the most moons?`;
    case 'hottest':
      return item.hottestTrap
        ? `My turn: the closest planet is not the hottest — ${n} is the hottest. `
          + `Your turn. Which planet is the hottest?`
        : `My turn: tap the planets and check how hot each one is — ${n} is the hottest. `
          + `Your turn. Which planet is the hottest?`;
    case 'pair_bigger':
      return `My turn: look at how much room each one takes up — ${n} is bigger. `
        + `Your turn. Look at ${namePair(item.pairNames)} — which one is bigger?`;
    case 'longest_year':
      return `My turn: the farther the ring, the longer the trip — ${n} is farthest, so its year is the longest. `
        + `Your turn. Which planet takes the longest to go around the Sun?`;
    case 'shortest_year':
      return `My turn: the closer the ring, the quicker the trip — ${n} is closest, so its year is the shortest. `
        + `Your turn. Which planet goes around the Sun the quickest?`;
    case 'pair_faster':
      return `My turn: the closer ring is the quicker trip — ${n} is faster. `
        + `Your turn. Watch ${namePair(item.pairNames)} — which one is faster?`;
  }
};

/**
 * The refuse clause and the accept clause — both halves load-bearing. The
 * signature error per facet is the fluent, confident miss the tap surface used
 * to absorb silently.
 */
const discriminationFor = (item: SolarItem): string => {
  const sunLaw =
    `If they say the Sun, that is wrong — the Sun is the star everything rides around, not a planet. `;
  const acceptName =
    `Accept the planet's name alone or inside a phrase ("it's ${name0(item)}", "${name0(item)} is"). `
    + `A colour, a description, or a pointing word with no name — "the red one", "that one" — does not `
    + `answer this question: treat it as wrong and give the correction, which names the planet. `;
  switch (item.kind) {
    case 'identify':
      return `"${item.signatureName}" is the tempting wrong answer — a learner who knows the neighbourhood `
        + `but mixes up the neighbours says it confidently. ${acceptName}`;
    case 'order_from_sun':
      return item.facet === 'position'
        ? `"${item.signatureName}" is the confident wrong answer here — a learner who counts the Sun as `
          + `number one lands exactly one planet short. ${sunLaw}${acceptName}`
        : `"${item.signatureName}" is the confident wrong answer here — the learner who mixed up closest `
          + `and farthest names the other end quickly and surely. ${sunLaw}${acceptName}`;
    case 'classify': {
      const members = item.answerNames.join(', ');
      const label = CATEGORY_LABEL[item.facet as 'rocky' | 'giant' | 'dwarf'];
      const why = item.facet === 'giant'
        ? 'it is the biggest of the rocky ones, and big is not the same as made of gas'
        : item.facet === 'rocky'
          ? 'it is the smallest of the giants, and small is not the same as made of rock'
          : 'it is the smallest true planet — small, but not a dwarf planet';
      return `Right answers, and the ONLY right answers: ${members}. `
        + `"${item.signatureName}" is the tempting wrong answer — ${why}. `
        + `Any planet not in that list is wrong however confidently it is said, and so is the Sun. `
        + `Accept any one right name alone or inside a phrase; the ${label} label itself with no planet `
        + `name does not answer — the question asks for a name. `;
    }
    case 'compare_attribute':
      if (item.facet === 'biggest') {
        return `"${item.signatureName}" is the tempting wrong answer — the Sun IS the biggest thing on `
          + `screen, but it is a star, not a planet, so it does not answer a question about planets. `
          + `${acceptName}`;
      }
      if (item.facet === 'smallest') {
        return `"${item.signatureName}" is the tempting wrong answer — it looks tinier still, but it is `
          + `a dwarf planet or a runner-up, not the smallest true planet here. ${sunLaw}${acceptName}`;
      }
      if (item.facet === 'hottest' && item.hottestTrap) {
        return `"${item.signatureName}" is the confident wrong answer — closest to the Sun FEELS like it `
          + `must be hottest, and it is not. That trap is the whole point of this question. ${acceptName}`;
      }
      return `"${item.signatureName}" is the near miss a learner names confidently. ${sunLaw}${acceptName}`;
    case 'orbital_reasoning':
      return `"${item.signatureName}" is the confident wrong answer — the learner who flipped the `
        + `relationship names the opposite end quickly and surely. ${sunLaw}${acceptName}`;
  }
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE — an
 * imperative aimed at the tutor gets PERFORMED (`findPerformedStageDirections`
 * keeps this structural). And the LOOKING clause is this primitive's own:
 * zooming, panning and tapping bodies open is the child researching the model,
 * which the compare facets deliberately invite.
 */
const judgingContract = (item: SolarItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
  + `looks, zooms and thinks, and their think time is unbounded. `
  + `Tapping a planet, zooming or panning is the learner LOOKING at the model — research, never an `
  + `answer. Judge only what they SAY. `
  + `Never say the answer during their turn and never describe or compare the planets out loud for them. `
  + `The correct answer is "${name0(item)}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "${affirmFor(item)}" and stop there — add no praise, no `
  + `encouragement, no mention of what comes next, and never carry on into another question of your own; `
  + `the next question always arrives as its own cue. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the whole `
  + `turn, and it is the SAME line on every wrong answer, including a repeat of the same wrong answer — `
  + `never paraphrase it, never soften it, and never replace it with a hint of your own.`;

/**
 * The tail every cue ends with — the counting-board form, which forbids
 * narrating the STATE and not merely reading the tag. This port re-proved why
 * on its own first drive (2026-08-18): identify's ask is near-empty BY DESIGN
 * (the spotlight is the question), and on 5 of 6 asks the tutor filled the
 * silence by reading the `[CURRENT STATE]` block aloud — defect class 6,
 * exactly as the skill predicts for a mode whose ask names nothing. The weaker
 * "never read bracket tags" tail does not prevent it; this one, plus the
 * stimulus line stating its own non-speakability (see `stimulusFor`), is the
 * fix decodable-reader measured from 2-of-7 beats to 0.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ============================================================================
// Cues
// ============================================================================

export interface SolarCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: SolarItem, opts: SolarCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to explore the sky! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[SOLAR_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${judgingContract(item)} ${NEVER_PERFORM}`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: SolarItem,
  next: SolarItem | null,
  opts: SolarCueOptions = {},
): string => {
  if (!next) {
    return `[SOLAR_MOVE] Say exactly: "Good try! The sky keeps some secrets for another day — we will `
      + `look again soon." Then stop — never ask whether they want another question; the activity is over.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[SOLAR_MOVE] Say exactly: "Good try! ${how}${askFor(next)}" ${judgingContract(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[SOLAR_COMPLETE] Say exactly: "What great sky-watching today! You called the planets by name, like a `
  + `real astronomer. See you next time!" Then stop — the activity is over; never ask whether they want `
  + `to keep going.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer, and never a hint. */
export const pronounceCue = (item: SolarItem): string =>
  `[SOLAR_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: `
  + `"${askFor(item)}" Do not treat anything you just heard as an answer, add nothing, and never say `
  + `the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY,
 * answer-free by construction. The identify branch never says WHICH planet
 * glows; the pair branches may name the pair, because the ask itself does.
 */
export const stimulusFor = (item: SolarItem): string => {
  switch (item.kind) {
    case 'identify':
      // States its own non-speakability, decodable-reader's read_line shape:
      // the ask for this mode is near-empty by design, and a model handed a
      // near-empty line and a state block fills the silence from the state
      // block unless the block itself says it is not content.
      return 'one planet in the model is glowing bright and the learner is naming it out loud; '
        + 'this state line is for you alone and is never spoken to the learner';
    case 'order_from_sun':
      return 'the whole solar system with its orbit rings around the Sun, ready to be counted';
    case 'classify':
      return 'the live solar system; every planet is on screen, and one kind is being asked for';
    case 'compare_attribute':
      return isPairFacet(item.facet)
        ? `two planets to compare, glowing together: ${namePair(item.pairNames)}`
        : 'all the planets side by side in one sky, ready to compare';
    case 'orbital_reasoning':
      return isPairFacet(item.facet)
        ? `two planets racing around the Sun: ${namePair(item.pairNames)}`
        : 'the planets moving live around the Sun, each on its own ring';
  }
};

/** The reveal payload the stage paints while the tutor affirms — never before. */
export const revealTextFor = (item: SolarItem): string =>
  item.kind === 'classify'
    ? cap(CATEGORY_LABEL[item.facet as 'rocky' | 'giant' | 'dwarf'])
    : name0(item);

// ============================================================================
// The cue surface — one source for the component and the DI harness
// ============================================================================

/**
 * Everything solar-system-explorer ever sends the tutor. The component spreads
 * this and adds what only a mounted component can own (status lines, and the
 * `diagnosisObservation` that reads the live sky); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 */
export const solarSystemPackBase = (
  items: SolarItem[],
): JudgedCueSurface<SolarItem> => ({
  primitiveType: 'solar-system-explorer',
  activityLine: 'live direct instruction solar system practice — the learner answers out loud',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

export interface SolarHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

const SIGNATURE_WHY: Record<SolarFacet, string> = {
  name: 'the neighbour planet — right neighbourhood, wrong name',
  closest: 'the direction reversal — the farthest planet, named confidently',
  farthest: 'the direction reversal — the closest planet, named confidently',
  position: 'the count-the-Sun error — one planet short of the target',
  rocky: 'the smallest giant — small mistaken for rocky',
  giant: 'the biggest rocky planet — big mistaken for made-of-gas',
  dwarf: 'the smallest true planet — small mistaken for dwarf',
  biggest: 'the Sun — the biggest thing on screen, but a star, not a planet',
  smallest: 'the tinier dwarf (or runner-up) that is not a true planet answer',
  most_moons: 'the famous runner-up, named from fame rather than the cards',
  hottest: 'the closest planet — closest-is-hottest, the canonical trap',
  pair_bigger: 'the other planet of the pair — the direction reversal',
  longest_year: 'the quickest planet — the relationship flipped',
  shortest_year: 'the slowest planet — the relationship flipped',
  pair_faster: 'the other planet of the pair — the direction reversal',
};

/**
 * The answers a headless student gives on a judged drive. Lives beside the
 * contract it mirrors: `discriminationFor` CLAIMS the judge refuses each
 * facet's signature error, and this is the claim made testable. Change one,
 * change both.
 */
export const solarHarnessAnswers = (item: SolarItem): SolarHarnessAnswers => ({
  correct: name0(item),
  plainWrong: item.wrongName,
  signatureWrong: item.signatureName
    ? { text: item.signatureName, why: SIGNATURE_WHY[item.facet] }
    : undefined,
  leakTokens: item.answerNames,
  leakExemptSpan: leakExemptSpanFor(item),
});
