/**
 * Buoyancy harbor's world model, pure: the materials and everyday things the harbor has, whether each floats, the
 * drop-test items code builds, and the drop test's check. The 3D tank (`buoyancy3d.ts`) runs the same densities, so
 * what the learner sees is what this file decides.
 *
 * Whether a solid thing floats depends on what it is made of (its density against water's), not on its size: a big log
 * floats and a small paper clip sinks. A drop test shows two things the learner tests, then asks about a third thing
 * made of the same stuff as one of them, usually of a different size. The learner calls float or sink and taps the test
 * that tells them; both must be right.
 */

import type { BoatChallenge } from './boatModel';
import type { SaltChallenge } from './saltModel';
import type { RuleChallenge } from './ruleModel';
import type { CargoChallenge } from './cargoModel';
import type { ShapeChallenge } from './shapeModel';

export type Material = 'wood' | 'cork' | 'foam' | 'wax' | 'ice' | 'steel' | 'stone' | 'glass' | 'rubber' | 'food';
export type Size = 'small' | 'medium' | 'big';
export type Shape = 'log' | 'stick' | 'block' | 'ball' | 'plug' | 'clip' | 'nail' | 'key' | 'spoon' | 'wrench' | 'rock'
  | 'cube' | 'candle' | 'board' | 'noodle' | 'peanut' | 'dome' | 'egg' | 'carrot' | 'grape' | 'potato';

/** Grams per cubic centimetre; water is 1. Foods differ thing by thing (`HarborThing.density`); 1.05 is a typical one. */
export const DENSITY: Record<Material, number> = {
  foam: 0.03, cork: 0.24, wood: 0.5, wax: 0.9, ice: 0.92, rubber: 1.5, glass: 2.5, stone: 2.6, steel: 7.85, food: 1.05,
};

/** What a K learner calls the stuff. */
export const MATERIAL_WORD: Record<Material, string> = {
  wood: 'wood', cork: 'cork', foam: 'foam', wax: 'wax', ice: 'ice', steel: 'metal', stone: 'stone', glass: 'glass', rubber: 'rubber', food: 'food',
};

export interface HarborThing {
  key: string;
  /** With its article dropped: "big log", "paper clip". */
  name: string;
  material: Material;
  size: Size;
  shape: Shape;
  /** Paint colour (wax and rubber vary). */
  color?: number;
  /** Its own density, where things of one stuff differ (foods); else its material's. */
  density?: number;
}

export const THINGS: readonly HarborThing[] = [
  { key: 'twig', name: 'twig', material: 'wood', size: 'small', shape: 'stick' },
  { key: 'wood-block', name: 'wooden block', material: 'wood', size: 'medium', shape: 'block' },
  { key: 'log', name: 'big log', material: 'wood', size: 'big', shape: 'log' },
  { key: 'cork', name: 'cork', material: 'cork', size: 'small', shape: 'plug' },
  { key: 'cork-board', name: 'cork board', material: 'cork', size: 'big', shape: 'board' },
  { key: 'foam-peanut', name: 'foam peanut', material: 'foam', size: 'small', shape: 'peanut' },
  { key: 'foam-ball', name: 'foam ball', material: 'foam', size: 'medium', shape: 'ball', color: 0xffd84a },
  { key: 'pool-noodle', name: 'pool noodle', material: 'foam', size: 'big', shape: 'noodle', color: 0x3fbf6a },
  { key: 'birthday-candle', name: 'birthday candle', material: 'wax', size: 'small', shape: 'stick', color: 0xff8fb8 },
  { key: 'big-candle', name: 'big candle', material: 'wax', size: 'big', shape: 'candle', color: 0xfff1c9 },
  { key: 'ice-cube', name: 'ice cube', material: 'ice', size: 'small', shape: 'cube' },
  { key: 'ice-block', name: 'block of ice', material: 'ice', size: 'big', shape: 'cube' },
  { key: 'paper-clip', name: 'paper clip', material: 'steel', size: 'small', shape: 'clip' },
  { key: 'nail', name: 'nail', material: 'steel', size: 'small', shape: 'nail' },
  { key: 'key', name: 'key', material: 'steel', size: 'small', shape: 'key' },
  { key: 'metal-spoon', name: 'metal spoon', material: 'steel', size: 'medium', shape: 'spoon' },
  { key: 'wrench', name: 'big wrench', material: 'steel', size: 'big', shape: 'wrench' },
  { key: 'pebble', name: 'pebble', material: 'stone', size: 'small', shape: 'rock' },
  { key: 'rock', name: 'rock', material: 'stone', size: 'medium', shape: 'rock' },
  { key: 'boulder', name: 'boulder', material: 'stone', size: 'big', shape: 'rock' },
  { key: 'marble', name: 'marble', material: 'glass', size: 'small', shape: 'ball' },
  { key: 'paperweight', name: 'glass paperweight', material: 'glass', size: 'medium', shape: 'dome' },
  { key: 'eraser', name: 'eraser', material: 'rubber', size: 'small', shape: 'block', color: 0xf49ab8 },
  { key: 'doorstop', name: 'rubber doorstop', material: 'rubber', size: 'medium', shape: 'block', color: 0x5a5f66 },
];

export const thingByKey = (key: string): HarborThing | undefined => THINGS.find(t => t.key === key);
export const densityOf = (t: HarborThing): number => t.density ?? DENSITY[t.material];
export const floats = (t: HarborThing): boolean => densityOf(t) < 1;
export const result = (t: HarborThing): 'floats' | 'sinks' => (floats(t) ? 'floats' : 'sinks');
/** The size fools the eye: a big thing that floats or a small thing that sinks. */
export const sizeSurprise = (t: HarborThing): boolean => (floats(t) ? t.size === 'big' : t.size === 'small');

// ============================================================================
// Items
// ============================================================================

export const BUOYANCY_TASKS = ['drop_test', 'find_the_rule', 'make_it_float', 'build_boat', 'cargo_two_designs', 'salt_water'] as const;
export type BuoyancyTask = typeof BUOYANCY_TASKS[number];
export type BuoyancyBand = 'K-2' | '3-5';
export type Tier = 'easy' | 'medium' | 'hard';

export interface DropTestChallenge {
  id: string;
  type: 'drop_test';
  instruction: string;
  /** The two things the learner tests, left then right: one floats and one sinks, of different stuff. */
  tested: [HarborThing, HarborThing];
  /** The thing to decide about, made of the same stuff as exactly one tested thing. Never dropped before a right call. */
  mystery: HarborThing;  /** The lesson's support tier on this item: when the model levers come (`HARBOR_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}
export type BuoyancyChallenge = DropTestChallenge | RuleChallenge | ShapeChallenge | BoatChallenge | CargoChallenge | SaltChallenge;

/** The tested thing made of the same stuff as the mystery (the evidence). */
export const evidenceIndex = (c: DropTestChallenge): 0 | 1 => (c.tested[0].material === c.mystery.material ? 0 : 1);

export type Rng = () => number;
/** A small seeded generator (mulberry32), so a seed rebuilds the same session. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];
function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function dropTestInstruction(tested: readonly HarborThing[], mystery: HarborThing): string {
  return `Test the ${tested[0].name} and the ${tested[1].name}. Then decide: will the ${mystery.name} float or sink?`;
}

/**
 * One drop test around a mystery thing. Easy: the mystery's size matches what the eye expects and the other tested
 * thing is a different size. Hard: the size fools the eye, its same-stuff partner is a different size, and the other
 * tested thing is the mystery's size (a big boulder beside a big log). Medium: whatever the draw gives.
 */
export function buildDropTest(mystery: HarborThing, tier: Tier, rng: Rng, id: string, seen: ReadonlySet<string> = new Set()): DropTestChallenge {
  /** Prefer things the session has not shown yet. */
  const fresh = (xs: HarborThing[]) => (xs.some(t => !seen.has(t.key)) ? xs.filter(t => !seen.has(t.key)) : xs);
  const partners = fresh(THINGS.filter(t => t.material === mystery.material && t.key !== mystery.key));
  const sameStuff = (tier === 'hard' ? partners.filter(t => t.size !== mystery.size) : []).length
    ? pick(partners.filter(t => t.size !== mystery.size), rng) : pick(partners, rng);
  const others = fresh(THINGS.filter(t => floats(t) !== floats(mystery)));
  const bySize = tier === 'hard' ? others.filter(t => t.size === mystery.size)
    : tier === 'easy' ? others.filter(t => t.size !== mystery.size) : others;
  const other = pick(bySize.length ? bySize : others, rng);
  const tested: [HarborThing, HarborThing] = rng() < 0.5 ? [sameStuff, other] : [other, sameStuff];
  return { id, type: 'drop_test', instruction: dropTestInstruction(tested, mystery), tested, mystery };
}

/** The mysteries a tier draws from. */
export function mysteryPool(tier: Tier, floater: boolean): HarborThing[] {
  const pool = THINGS.filter(t => floats(t) === floater);
  if (tier === 'hard') return pool.filter(sizeSurprise);
  if (tier === 'easy') return pool.filter(t => !sizeSurprise(t));
  return pool;
}

/** N drop tests: floaters and sinkers alternate (then shuffle), no mystery twice, materials spread out. */
export function pickDropTests(n: number, tier: Tier, rng: Rng, idPrefix = 'drop'): DropTestChallenge[] {
  const used = new Set<string>();
  const mats = new Set<string>();
  const out: DropTestChallenge[] = [];
  const firstFloats = rng() < 0.5;
  for (let i = 0; i < n; i++) {
    const floater = (i % 2 === 0) === firstFloats;
    const pool = mysteryPool(tier, floater).filter(t => !used.has(t.key));
    const fresh = pool.filter(t => !mats.has(t.material));
    const m = pick(fresh.length ? fresh : pool.length ? pool : mysteryPool('medium', floater), rng);
    used.add(m.key); mats.add(m.material);
    const c = buildDropTest(m, tier, rng, '', used);
    c.tested.forEach(t => used.add(t.key));
    out.push(c);
  }
  return shuffle(out, rng).map((c, i) => ({ ...c, id: `${idPrefix}-${i + 1}` }));
}

// ============================================================================
// The drop test's check
// ============================================================================

export type Call = 'floats' | 'sinks';
export interface DropTestAnswer {
  call: Call | null;
  /** The tested thing tapped as the one that tells (0 left, 1 right). */
  evidence: 0 | 1 | null;
}

export type DropTestMiss = 'judged_by_size' | 'wrong_call' | 'other_thing';

export const dropTestMatches = (c: DropTestChallenge, a: DropTestAnswer): boolean =>
  a.call === result(c.mystery) && a.evidence === evidenceIndex(c);

/** The named miss: a wrong call first (by size when the size fools the eye), then the wrong test as evidence. */
export function dropTestMiss(c: DropTestChallenge, a: DropTestAnswer): DropTestMiss | undefined {
  if (a.call !== result(c.mystery)) return sizeSurprise(c.mystery) ? 'judged_by_size' : 'wrong_call';
  if (a.evidence !== evidenceIndex(c)) return 'other_thing';
  return undefined;
}

const verb = (call: Call) => (call === 'floats' ? 'float' : 'sink');

/** The learner's answer in words, never the key. */
export function describeDropTest(c: DropTestChallenge, a: DropTestAnswer): string {
  const call = a.call ? `said the ${c.mystery.name} will ${verb(a.call)}` : 'made no call';
  const ev = a.evidence == null ? 'picked no test' : `picked the ${c.tested[a.evidence].name} as the test that tells`;
  return `${call}, and ${ev}`;
}

export function dropTestFeedback(c: DropTestChallenge, a: DropTestAnswer): string {
  const m = c.mystery;
  const mat = MATERIAL_WORD[m.material];
  const miss = dropTestMiss(c, a);
  if (!miss) {
    const ev = c.tested[evidenceIndex(c)];
    const surprise = sizeSurprise(m) ? (floats(m) ? ', even though it is so big' : ', even though it is so small') : '';
    return `Yes! The ${m.name} is made of ${mat}, just like the ${ev.name}. The ${ev.name} ${result(ev) === 'floats' ? 'floated' : 'sank'}, `
      + `so the ${m.name} ${result(m) === 'floats' ? 'floats' : 'sinks'} too${surprise}.`;
  }
  if (miss === 'judged_by_size') return `Big or small is not what decides it. What is the ${m.name} made of? Look at what happened to the test made of the same stuff.`;
  if (miss === 'wrong_call') return `Look at your tests again. Which one is made of ${mat}, and what did it do in the water?`;
  return `Is the ${c.tested[a.evidence!].name} made of the same stuff as the ${m.name}? Find the test made of ${mat}.`;
}
