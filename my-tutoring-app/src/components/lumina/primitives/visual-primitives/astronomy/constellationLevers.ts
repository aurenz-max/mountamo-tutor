/**
 * The in-item levers on a constellation-builder item, as one lever set (`CONSTELLATION_LEVERS`, `bossLevers.ts`;
 * `/add-support-tiers`; report qa/eval-reports/constellation-builder-levers-2026-10-15.md). No real-learner evidence: the misses are what the
 * activity's own checks observe (`constellationWorkspace.ts`), plus the catalog's documented struggles (random taps
 * with no pattern in mind; a wrong star near a right one; dim stars mistaken for pattern stars). Pure: the component
 * draws from these, the workspace publishes them, the tests hold each leak rule. Every help lever is a drawing with no
 * words (K-1 pre-readers); every easier item has the id `<item>~easier`.
 *
 * - `spotlight` (help, guided_trace): every star but the ringed one and the ones already joined fades, and the ring
 *   grows. It marks only the star the ring already marks.
 * - `shape_card` (help, free_connect): a small card beside the field with the pattern's lines and its stars only, no
 *   background stars and no field position. The learner still has to find those stars in the field.
 * - `bright_stars` (help, free_connect, only where the tier drew every star by its own brightness): the pattern's
 *   stars drawn bright again, as the easy tier draws them. Never a line.
 * - `easier_pattern` (simplify, every mode): an ungraded item of the same mode with a different, smaller or plainer
 *   real constellation from `PATTERNS`, never the item's own constellation (on identify, never any name it offers).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ConnectionLine, ConstellationChallenge, StarData } from './ConstellationBuilder';
import { CONSTELLATION_MISSES } from './constellationBuilder.card';
import { identifyOptions, patternStars, sameName } from './constellationWorkspace';

export const SPOTLIGHT_LEVER = 'spotlight';
export const SHAPE_CARD_LEVER = 'shape_card';
export const BRIGHT_STARS_LEVER = 'bright_stars';
export const EASIER_PATTERN_LEVER = 'easier_pattern';

export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<ConstellationChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item of the same kind, ungraded; the full item comes back after it.';
export const practiceParent = (itemId: string | null | undefined, challenges: readonly ConstellationChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

interface Pattern {
  name: string;
  aliases?: string[];
  /** Best evening season, northern sky; none for an asterism named by its season. */
  season?: 'winter' | 'spring' | 'summer' | 'fall';
  /** A real constellation a learner may be asked to name (the Summer Triangle is a trace shape only). */
  nameable: boolean;
  /** 0-100 positions, roughly as the stars sit. */
  stars: Array<[number, number]>;
  lines: Array<[number, number]>;
  /** A path through every star, for a guided trace. */
  order?: number[];
}

/** Real star patterns, smallest and plainest first. */
export const PATTERNS: readonly Pattern[] = [
  { name: 'Summer Triangle', nameable: false, stars: [[20, 15], [85, 30], [45, 90]], lines: [[0, 1], [1, 2], [2, 0]], order: [0, 1, 2] },
  { name: 'Pegasus', season: 'fall', nameable: true, stars: [[10, 15], [80, 10], [85, 75], [15, 80]], lines: [[0, 1], [1, 2], [2, 3], [3, 0]], order: [0, 1, 2, 3] },
  { name: 'Cassiopeia', season: 'fall', nameable: true, stars: [[0, 25], [25, 75], [50, 40], [75, 80], [100, 20]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]], order: [0, 1, 2, 3, 4] },
  { name: 'Cygnus', aliases: ['Northern Cross', 'Swan'], season: 'summer', nameable: true,
    stars: [[50, 0], [50, 40], [50, 100], [10, 45], [90, 35]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] },
  { name: 'Orion', aliases: ['Hunter'], season: 'winter', nameable: true,
    stars: [[20, 5], [80, 12], [40, 50], [50, 48], [60, 46], [28, 95], [82, 90]],
    lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  { name: 'Big Dipper', aliases: ['Ursa Major', 'Great Bear', 'Plough', 'Plow'], season: 'spring', nameable: true,
    stars: [[0, 20], [5, 55], [35, 65], [35, 35], [55, 30], [75, 32], [100, 50]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
  { name: 'Leo', aliases: ['Lion'], season: 'spring', nameable: true,
    stars: [[20, 85], [25, 55], [18, 32], [35, 12], [72, 45], [98, 62], [70, 72]],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [6, 0]] },
];

/** "the Big Dipper", "the Summer Triangle", but "Orion". */
const called = (p: Pattern) => /^(Big|Summer) /.test(p.name) ? `the ${p.name}` : p.name;
const isNamed = (p: Pattern, name: string) => [p.name, ...(p.aliases ?? [])].some(n => sameName(n, name));
const seasonOf = (s: string) => { const n = s.toLowerCase(); return n.includes('autumn') ? 'fall' : n.trim(); };
const OPPOSITE: Record<string, Pattern['season']> = { winter: 'summer', summer: 'winter', spring: 'fall', fall: 'spring' };
/** Dim stars in the corners of a practice field, away from the pattern. */
const PRACTICE_BACKGROUND: Array<[number, number, number]> = [[6, 8, 5], [92, 10, 5.5], [8, 90, 5], [90, 88, 5.5], [50, 6, 6], [5, 50, 5.5], [95, 52, 6]];

/** A practice field: the pattern's stars bright in the middle, dim stars in the corners. A guided trace joins the
 *  stars along `order` (consecutive pairs, as the generator derives them); every other mode draws `lines`. */
function practiceField(p: Pattern, id: string, guided: boolean): { stars: StarData[]; connections: ConnectionLine[]; order: string[] } {
  const ids = p.stars.map((_, i) => `${id}-p${i}`);
  const stars: StarData[] = [
    ...p.stars.map(([x, y], i) => ({ id: ids[i], x: 22 + x * 0.56, y: 20 + y * 0.6, magnitude: 1.5, isPartOfConstellation: true })),
    ...PRACTICE_BACKGROUND.map(([x, y, m], i) => ({ id: `${id}-b${i}`, x, y, magnitude: m, isPartOfConstellation: false })),
  ];
  const order = guided ? (p.order ?? []).map(i => ids[i]) : [];
  const connections = guided
    ? order.slice(1).map((to, i) => ({ fromStarId: order[i], toStarId: to }))
    : p.lines.map(([a, b]) => ({ fromStarId: ids[a], toStarId: ids[b] }));
  return { stars, connections, order };
}

/**
 * Names an easier item must not use. Identify: every name the item offers, since a named drawing of one of them
 * would let the learner rule it out by its shape. Seasonal: the answer only; the practice asks about another season,
 * so naming one of the item's other choices there teaches nothing against the item's key.
 */
function itemNames(c: ConstellationChallenge, _challenges: readonly ConstellationChallenge[]): string[] {
  if (c.type === 'identify') return identifyOptions(c);
  return [c.constellationName];
}

/**
 * The easier item a simplify lever opens: same mode, one step less (a trace with fewer stars; a name with
 * two choices and a plainer shape or a season the item does not ask about), never the item's constellation or any
 * name the item shows, and its own answer.
 */
export function practiceItem(c: ConstellationChallenge, challenges: readonly ConstellationChallenge[] = []): ConstellationChallenge | null {
  if (isPractice(c)) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  const avoid = itemNames(c, challenges);
  const fresh = (p: Pattern) => !avoid.some(n => isNamed(p, n));
  const base = { id, type: c.type, mythologyFact: '', season: c.season };
  if (c.type === 'guided_trace' || c.type === 'free_connect') {
    // One step less: fewer stars to find and join.
    const size = c.type === 'guided_trace' ? c.starOrder.length : patternStars(c).size;
    const p = PATTERNS.find(x => fresh(x) && (c.type === 'free_connect' || x.order) && x.stars.length < size);
    if (!p) return null;
    const f = practiceField(p, id, c.type === 'guided_trace');
    return { ...base, constellationName: p.name, stars: f.stars, starOrder: f.order,
      correctConnections: f.connections,
      instruction: c.type === 'guided_trace' ? `Tap the stars in order to draw ${called(p)}.` : `Join the bright stars to draw ${called(p)}.` };
  }
  if (c.type === 'identify') {
    const named = PATTERNS.filter(x => x.nameable && fresh(x));
    const [p, foil] = named;
    if (!p || !foil) return null;
    const f = practiceField(p, id, false);
    return { ...base, constellationName: p.name, stars: f.stars, starOrder: [], correctConnections: f.connections,
      instruction: 'Look at the lines. Which constellation is this?', choices: [p.name, foil.name] };
  }
  const itemSeason = seasonOf(c.season);
  const p = PATTERNS.find(x => x.nameable && x.season && x.season !== itemSeason && fresh(x));
  if (!p?.season) return null;
  // The foil is from a third season: the opposite one unless that is the item's own, where it would be a right answer.
  const third = (x: Pattern) => x.nameable && !!x.season && x.season !== p.season && x.season !== itemSeason && fresh(x);
  const foil = PATTERNS.find(x => third(x) && x.season === OPPOSITE[p.season!]) ?? PATTERNS.find(third);
  if (!foil) return null;
  return { ...base, season: p.season, constellationName: p.name, starOrder: [], correctConnections: [],
    instruction: `Which constellation is best seen on ${p.season} evenings?`, choices: [p.name, foil.name] };
}

/** Leak rule for the easier item: same mode, not the item, a name the item never shows, and one step less. */
export function practiceLeaks(parent: ConstellationChallenge, p: ConstellationChallenge, challenges: readonly ConstellationChallenge[] = []): boolean {
  const names = itemNames(parent, challenges);
  const smaller = parent.type === 'guided_trace' ? p.starOrder.length < parent.starOrder.length
    : parent.type === 'free_connect' ? patternStars(p).size < patternStars(parent).size
      : p.choices?.length === 2 && !p.choices.some(o => sameName(o, parent.constellationName));
  return p.id === parent.id || p.type !== parent.type || !smaller
    || names.some(n => sameName(n, p.constellationName))
    || (parent.type === 'identify' && !!p.choices?.some(o => names.some(n => sameName(n, o))))
    || (parent.type === 'seasonal' && seasonOf(p.season) === seasonOf(parent.season));
}

/** What the lever set reads beside the item: whether the field already draws the pattern's stars bright (the easy tier). */
export interface ConstellationLeverCtx { membersBright: boolean }

export const CONSTELLATION_LEVERS = leverSet<ConstellationChallenge, ConstellationLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => CONSTELLATION_MISSES[mode as keyof typeof CONSTELLATION_MISSES] ?? [],
  specs: [
    { id: SPOTLIGHT_LEVER, type: 'marks', modes: ['guided_trace'], answers: 'all',
      when: 'The learner taps stars other than the ringed one.',
      does: 'Fades every star except the ringed one and the ones already joined, and makes the ring bigger. It marks no other star.',
      fact: 'The other stars are faded and the ring around the next star is bigger.' },
    { id: SHAPE_CARD_LEVER, type: 'custom', carrier: 'shown', modes: ['free_connect'], answers: 'all',
      why: 'It draws the pattern\'s shape on a separate card beside the sky: no mark on the field, and not a different item.',
      when: 'The learner joins stars the pattern does not join, or does not know the shape to look for.',
      does: 'Shows a small card beside the sky with the pattern\'s lines and stars only, as a picture of the shape to find. '
        + 'It has no background stars and does not mark any star in the sky.',
      fact: 'A small card beside the sky shows the pattern\'s shape: its lines and stars only.' },
    { id: BRIGHT_STARS_LEVER, type: 'marks', modes: ['free_connect'], answers: ['background_star'],
      // Only where the tier drew every star by its own brightness.
      offer: (_c, ctx) => !ctx.membersBright,
      when: 'The learner taps dim background stars.',
      does: 'Draws the pattern\'s stars brighter than the background stars. It draws no line.',
      fact: 'The pattern\'s stars are now drawn brighter than the background stars.' },
    { id: EASIER_PATTERN_LEVER, type: 'easier', answers: 'all',
      when: c => (c.type === 'identify' ? 'The learner cannot yet tell this pattern from the other names.'
        : c.type === 'seasonal' ? 'The learner does not yet know which constellations go with this season.'
          : 'The learner cannot yet keep track of this many stars.'),
      does: c => `${c.type === 'identify' ? 'Opens an easier item first: a plainer constellation\'s lines with only two names to choose from. '
        : c.type === 'seasonal' ? 'Opens an easier item first: another season with only two names to choose from. '
          : 'Opens an easier item first: a smaller star pattern of the same kind. '}It is not graded; the full item comes back after it.`,
      content: c => practiceItem(c) },
  ],
});

/** The shape card's lines, scaled into a `w` x `h` box: the pattern's own lines, no other star. */
export function shapeCardLines(c: ConstellationChallenge, stars: readonly StarData[], w: number, h: number) {
  const ids = Array.from(new Set(c.correctConnections.flatMap(l => [l.fromStarId, l.toStarId])));
  const at = new Map(stars.filter(s => ids.includes(s.id)).map(s => [s.id, s]));
  const pts = Array.from(at.values());
  if (!pts.length) return { lines: [], dots: [] };
  const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const scale = Math.min((w - 16) / Math.max(maxX - minX, 1), (h - 16) / Math.max(maxY - minY, 1));
  const place = (s: StarData) => ({ x: 8 + (s.x - minX) * scale, y: 8 + (s.y - minY) * scale });
  return {
    dots: pts.map(place),
    lines: c.correctConnections.filter(l => at.has(l.fromStarId) && at.has(l.toStarId))
      .map(l => ({ a: place(at.get(l.fromStarId)!), b: place(at.get(l.toStarId)!) })),
  };
}
