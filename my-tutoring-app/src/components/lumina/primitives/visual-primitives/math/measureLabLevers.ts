/**
 * The in-item levers on a measure-lab item (`/add-support-tiers`; report qa/eval-reports/measure-lab-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `measureMiss` observes. Pure: the component draws from these, the
 * workspace publishes them, the tests hold each leak rule. Every easier item has the id `<item>~smaller`, the same
 * mode, and is built by `practiceItem`. Every lever is a drawing (the learner is a Kindergarten pre-reader).
 *
 * - balance_predict: `down_model` (help) a small model balance beside the scale, three blocks on one pan and one on
 *   the other, the three-block pan down. Fixed: it never shows the item's objects. `far_pair` (simplify) an ungraded
 *   pair far apart in everyday weight (a feather and a brick), neither of the item's objects.
 * - capacity_predict: `cup_lines` (help) a shelf under each container; once the test has filled both, one cup picture
 *   per cup it took stands on it. Before the test the shelves are empty. `easy_pair` (simplify) an ungraded pair of
 *   two different shapes where the one drawn much larger holds more, neither of the item's names.
 * - pour_count: `poured_shelf` (help) a shelf under the container where each cup the learner pours stands in a row.
 *   No number. `smaller_pour` (simplify) an ungraded container that takes three cups. None when the item takes three.
 * - order_capacity: `order_steps` (help) three wordless bars growing left to right, the way "least first" runs; they
 *   name no jar. `level_lines` (help) the same even lines across every jar. `far_levels` (simplify) three identical
 *   jars far apart in water, only when two of the item's levels are close.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { MeasureContainer, MeasureLabChallenge } from './MeasureLab';
import type { MeasureMiss, MeasureView } from './measureLabWorkspace';

export const DOWN_MODEL_LEVER = 'down_model';
export const FAR_PAIR_LEVER = 'far_pair';
export const CUP_LINES_LEVER = 'cup_lines';
export const EASY_PAIR_LEVER = 'easy_pair';
export const POURED_SHELF_LEVER = 'poured_shelf';
export const SMALLER_POUR_LEVER = 'smaller_pour';
export const ORDER_STEPS_LEVER = 'order_steps';
export const LEVEL_LINES_LEVER = 'level_lines';
export const FAR_LEVELS_LEVER = 'far_levels';

export const PRACTICE_SUFFIX = '~smaller';
export const isPractice = (c: Pick<MeasureLabChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** The model balance: fixed blocks, never read from the item. */
export const DOWN_MODEL = { heavyBlocks: 3, lightBlocks: 1, downSide: 'left' } as const;
/** order_steps: wordless bar heights, left to right. The prompt always asks for the least first. */
export const ORDER_STEPS = [10, 20, 30] as const;
/** level_lines: even lines across every jar, as fractions of its height. The same on each jar. */
export const LEVEL_LINES = [1, 2, 3, 4, 5, 6, 7].map(k => k / 8);

const lower = (s?: string) => (s ?? '').toLowerCase();
const practiceOf = (c: MeasureLabChallenge, fields: Partial<MeasureLabChallenge>): MeasureLabChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, ...fields });

// ── balance_predict ─────────────────────────────────────────────────────────

const FAR_PAIRS: ReadonlyArray<readonly [{ name: string; emoji: string }, { name: string; emoji: string }]> = [
  [{ name: 'feather', emoji: '🪶' }, { name: 'brick', emoji: '🧱' }],
  [{ name: 'leaf', emoji: '🍂' }, { name: 'big rock', emoji: '🪨' }],
  [{ name: 'balloon', emoji: '🎈' }, { name: 'pumpkin', emoji: '🎃' }],
];

const objectNames = (c: MeasureLabChallenge) => [c.left?.name, c.right?.name].map(lower);

export function farPair(c: MeasureLabChallenge): MeasureLabChallenge | null {
  if (c.type !== 'balance_predict' || isPractice(c)) return null;
  const used = objectNames(c);
  const pair = FAR_PAIRS.find(([a, b]) => !used.includes(lower(a.name)) && !used.includes(lower(b.name)));
  if (!pair) return null;
  const [light, heavy] = pair;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  // Fixed sides (light left, heavy right), never read from the item's answer.
  const left = { id: `${id}-l`, name: light.name, emoji: light.emoji, weight: 1 };
  const right = { id: `${id}-r`, name: heavy.name, emoji: heavy.emoji, weight: 10 };
  return practiceOf(c, { prompt: `Which is heavier — the ${left.name} or the ${right.name}?`, left, right,
    expectedChoice: right.id });
}

/** Leak rule for the balance practice: never the item's objects, a clear winner, the key agrees with the weights. */
export function farPairLeaks(parent: MeasureLabChallenge, p: MeasureLabChallenge): boolean {
  if (p.id === parent.id || p.type !== parent.type || !p.left || !p.right) return true;
  const used = objectNames(parent);
  return used.includes(lower(p.left.name)) || used.includes(lower(p.right.name))
    || Math.abs(p.left.weight - p.right.weight) < 5
    || p.expectedChoice !== (p.left.weight > p.right.weight ? p.left.id : p.right.id);
}

// ── capacity_predict ────────────────────────────────────────────────────────

const PAIR_NOUNS = ['vase', 'tub', 'jug', 'pail', 'basket'];
const containerNames = (c: MeasureLabChallenge) =>
  [c.containerA, c.containerB, c.container, ...(c.containers ?? [])].filter(Boolean).map(x => lower(x!.name));

export function easyPair(c: MeasureLabChallenge): MeasureLabChallenge | null {
  if (c.type !== 'capacity_predict' || isPractice(c)) return null;
  const used = containerNames(c);
  const [small, big] = PAIR_NOUNS.filter(n => !used.includes(n));
  if (!small || !big) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  // Two shapes (the mode's floor); the one drawn much larger holds more. Fixed sides, never the item's answer side.
  const a: MeasureContainer = { id: `${id}-a`, name: small, shape: 'tall', capacity: 2, scale: 0.6 };
  const b: MeasureContainer = { id: `${id}-b`, name: big, shape: 'round', capacity: 8, scale: 1.3 };
  return practiceOf(c, { prompt: `Which holds more — the ${a.name} or the ${b.name}?`, containerA: a, containerB: b,
    expectedChoice: b.id });
}

/** Leak rule for the capacity practice: two shapes, none of the item's names, the larger drawing holds more. */
export function easyPairLeaks(parent: MeasureLabChallenge, p: MeasureLabChallenge): boolean {
  const a = p.containerA, b = p.containerB;
  if (p.id === parent.id || p.type !== parent.type || !a || !b || a.shape === b.shape) return true;
  const used = containerNames(parent);
  const bigger = (a.scale ?? 1) > (b.scale ?? 1) ? a : b;
  return used.includes(lower(a.name)) || used.includes(lower(b.name)) || Math.abs(a.capacity - b.capacity) < 4
    || bigger.capacity < Math.max(a.capacity, b.capacity) || p.expectedChoice !== bigger.id;
}

// ── pour_count ──────────────────────────────────────────────────────────────

/** The count buttons offered for an answer (the generator's rule). */
export function countOptions(expected: number, count = 4): number[] {
  const opts = new Set<number>([expected]);
  for (const d of [1, -1, 2, -2, 3, -3]) {
    if (opts.size >= count) break;
    const v = expected + d;
    if (v >= 1 && v <= 12) opts.add(v);
  }
  for (let fill = 1; opts.size < count && fill <= 12; fill++) opts.add(fill);
  return Array.from(opts).sort((a, b) => a - b);
}

const SMALL_POUR = 3;

export function smallerPour(c: MeasureLabChallenge): MeasureLabChallenge | null {
  if (c.type !== 'pour_count' || isPractice(c) || !c.container || c.container.capacity <= SMALL_POUR) return null;
  const used = containerNames(c);
  const name = PAIR_NOUNS.find(n => !used.includes(n));
  if (!name) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  const unit = c.unitName || 'cups';
  const container: MeasureContainer = { id: `${id}-c`, name, shape: c.container.shape, capacity: SMALL_POUR };
  return practiceOf(c, { prompt: `Fill the ${name} with ${unit}. How many does it take?`, container,
    expectedCount: SMALL_POUR, options: countOptions(SMALL_POUR) });
}

/** Leak rule for the pour practice: fewer cups than the item, never its count, a countable size, the key offered. */
export function smallerPourLeaks(parent: MeasureLabChallenge, p: MeasureLabChallenge): boolean {
  const want = parent.container?.capacity ?? 0, got = p.container?.capacity ?? 0;
  return p.id === parent.id || p.type !== parent.type || got >= want || got < 3 || p.expectedCount !== got
    || !(p.options ?? []).includes(got) || containerNames(parent).includes(lower(p.container?.name));
}

// ── order_capacity ──────────────────────────────────────────────────────────

const levelsOf = (c: MeasureLabChallenge) => (c.containers ?? []).map(j => j.filled ?? 0);
const minGap = (levels: number[]) => {
  const s = [...levels].sort((a, b) => a - b);
  return Math.min(...s.slice(1).map((v, i) => v - s[i]));
};
/** Screen order middle, most, least: never already sorted either way. */
const FAR_LEVELS = [4, 8, 1];
const JAR_NOUNS = ['jar', 'glass', 'pail'];
const nounOf = (name: string) => lower(name).replace(/\s*\d+$/, '');

export function farLevels(c: MeasureLabChallenge): MeasureLabChallenge | null {
  if (c.type !== 'order_capacity' || isPractice(c) || (c.containers ?? []).length !== 3 || minGap(levelsOf(c)) >= 3) return null;
  const nouns = (c.containers ?? []).map(j => nounOf(j.name));
  const noun = JAR_NOUNS.find(n => !nouns.includes(n));
  if (!noun) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  const shape = c.containers![0].shape;
  const containers: MeasureContainer[] = FAR_LEVELS.map((filled, k) =>
    ({ id: `${id}-${k}`, name: `${noun} ${k + 1}`, shape, capacity: 8, filled }));
  const expectedOrder = [...containers].sort((x, y) => (x.filled ?? 0) - (y.filled ?? 0)).map(j => j.id);
  return practiceOf(c, { prompt: `Put the ${noun}s in order. Start with the one that has the least.`, containers, expectedOrder });
}

/** Leak rule for the order practice: not the item's levels, far apart, identical jars, not drawn already in order. */
export function farLevelsLeaks(parent: MeasureLabChallenge, p: MeasureLabChallenge): boolean {
  const pl = levelsOf(p), shown = pl.join(',');
  const asc = [...pl].sort((a, b) => a - b).join(','), desc = [...pl].sort((a, b) => b - a).join(',');
  const parentNames = (parent.containers ?? []).map(j => lower(j.name));
  return p.id === parent.id || p.type !== parent.type || pl.length !== 3 || minGap(pl) < 3
    || asc === [...levelsOf(parent)].sort((a, b) => a - b).join(',') || shown === asc || shown === desc
    || new Set((p.containers ?? []).map(j => `${j.shape}|${j.capacity}`)).size !== 1
    || (p.containers ?? []).some(j => parentNames.includes(lower(j.name)));
}

// ── shared ──────────────────────────────────────────────────────────────────

/** The easier item a simplify lever opens, in the item's own mode, or null. */
export function practiceItem(c: MeasureLabChallenge): MeasureLabChallenge | null {
  switch (c.type) {
    case 'balance_predict': return farPair(c);
    case 'capacity_predict': return easyPair(c);
    case 'pour_count': return smallerPour(c);
    default: return farLevels(c);
  }
}

export const practiceParent = (itemId: string | null | undefined, challenges: readonly MeasureLabChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

/**
 * The cup pictures on each shelf (`cup_lines`, `poured_shelf`), per container id. Leak rule: capacity shows cups only
 * once the test has filled BOTH containers (what the test already shows); pour_count shows only the cups poured.
 */
export function shelfCups(c: MeasureLabChallenge, view: MeasureView): Record<string, number> {
  if (c.type === 'capacity_predict' && c.containerA && c.containerB) {
    const a = view.poured[c.containerA.id], b = view.poured[c.containerB.id];
    const tested = a !== undefined && b !== undefined;
    return { [c.containerA.id]: tested ? a : 0, [c.containerB.id]: tested ? b : 0 };
  }
  if (c.type === 'pour_count' && c.container) return { [c.container.id]: view.poured[c.container.id] ?? 0 };
  return {};
}

export function measureLabLevers(c: MeasureLabChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPractice(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly MeasureMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const simpler = practiceItem(c);
  switch (c.type) {
    case 'balance_predict': return [
      lever(DOWN_MODEL_LEVER, 'help', ['picked_lighter'], 'The learner picks the lighter one, or mixes up heavier and lighter.',
        'Shows a small model balance beside the scale: three blocks on one pan, one block on the other, the pan with more '
          + 'blocks down. It shows none of the item\'s objects.'),
      ...(simpler ? [lever(FAR_PAIR_LEVER, 'simplify', ['picked_lighter'], 'The learner cannot yet tell which is heavier.',
        'Opens an easier pair first: two everyday things far apart in weight. It is not graded; the full item comes back after it.')] : []),
    ];
    case 'capacity_predict': return [
      lever(CUP_LINES_LEVER, 'help', ['tall_means_more', 'picked_less'],
        'The learner picks by how tall it looks, or cannot read which one took more.',
        'Puts a shelf under each container. After the test fills both, each shelf holds one cup picture for every cup '
          + 'that container took, so the longer line is easy to see. Before the test the shelves are empty.'),
      ...(simpler ? [lever(EASY_PAIR_LEVER, 'simplify', ['tall_means_more', 'picked_less'],
        'The learner cannot yet compare these two containers.',
        'Opens an easier pair first: two containers of different shapes, one drawn much bigger. It is not graded; the '
          + 'full item comes back after it.')] : []),
    ];
    case 'pour_count': return [
      lever(POURED_SHELF_LEVER, 'help', ['one_short', 'one_over', 'too_few', 'too_many'],
        'The learner loses count of the cups poured.',
        'Puts a shelf under the container: each cup the learner pours stands on it in a row, to count. No number is shown.'),
      ...(simpler ? [lever(SMALLER_POUR_LEVER, 'simplify', ['one_short', 'one_over', 'too_few', 'too_many'],
        'The learner cannot yet count this many cups.',
        'Opens an easier container first that takes only a few cups. It is not graded; the full item comes back after it.')] : []),
    ];
    default: return [
      lever(ORDER_STEPS_LEVER, 'help', ['most_to_least'], 'The learner starts from the fullest one.',
        'Shows three wordless bars beside the containers that grow from left to right, the way the order goes. They mark no container.'),
      lever(LEVEL_LINES_LEVER, 'help', ['two_swapped', 'out_of_order'], 'The learner mixes up two containers whose water is close.',
        'Draws the same even lines across every container, so each water level can be read against them.'),
      ...(simpler ? [lever(FAR_LEVELS_LEVER, 'simplify', ['two_swapped', 'out_of_order'],
        'These water levels are too close to order yet.',
        'Opens an easier set first: three of the same container with water far apart. It is not graded; the full item comes back after it.')] : []),
    ];
  }
}

/** What the pulled help levers put on screen, for the tutor. Never a weight, a count, a winner or a jar's place. */
export function leverFacts(c: MeasureLabChallenge | null, pulled: readonly string[]): string {
  if (!c || isPractice(c)) return '';
  return [
    c.type === 'balance_predict' && pulled.includes(DOWN_MODEL_LEVER)
      && 'Beside the scale is a small model balance: three blocks on one pan, one block on the other, and the pan with more blocks is down.',
    c.type === 'capacity_predict' && pulled.includes(CUP_LINES_LEVER)
      && 'Under each container is a shelf; once both are filled, each shelf holds one cup picture for every cup that container took.',
    c.type === 'pour_count' && pulled.includes(POURED_SHELF_LEVER)
      && 'Under the container is a shelf where each cup poured stands in a row, with no number.',
    c.type === 'order_capacity' && pulled.includes(ORDER_STEPS_LEVER)
      && 'Beside the containers are three wordless bars that grow from left to right, the way the order goes.',
    c.type === 'order_capacity' && pulled.includes(LEVEL_LINES_LEVER)
      && 'The same even lines are drawn across every container.',
  ].filter((s): s is string => !!s).join(' ');
}
