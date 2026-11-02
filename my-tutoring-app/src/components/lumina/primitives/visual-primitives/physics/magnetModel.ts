/**
 * The workbench's magnet test, pure: everyday things, whether a magnet pulls each one, the items code builds, and the
 * check. The 3D table lifts a thing up to the magnet when this file says the magnet pulls it.
 *
 * A magnet pulls things made of iron or steel, even without touching them. Most other things it does not pull, and
 * that includes many metals: aluminium foil, a copper coin and a brass key stay put. So "it is metal" is not the rule;
 * "it has iron in it" is. The learner tests a few things with the magnet, then decides about others from what they are
 * made of.
 */
import type { Rng, Tier } from './circuitModel';
import type { CondShape } from './conductorModel';

export type MagnetMaterial = 'iron' | 'aluminium' | 'copper' | 'brass' | 'plastic' | 'wood' | 'rubber' | 'paper' | 'glass';
export interface MagnetThing { key: string; name: string; material: MagnetMaterial; shape: CondShape; color: number }

export const MAGNET_THINGS: readonly MagnetThing[] = [
  { key: 'paper-clip', name: 'steel paper clip', material: 'iron', shape: 'clip', color: 0xb9c2cc },
  { key: 'nail', name: 'iron nail', material: 'iron', shape: 'nail', color: 0x6b6f73 },
  { key: 'washer', name: 'steel washer', material: 'iron', shape: 'coin', color: 0x9aa3ab },
  { key: 'bolt', name: 'steel bolt', material: 'iron', shape: 'nail', color: 0x8c949c },
  { key: 'foil', name: 'piece of aluminium foil', material: 'aluminium', shape: 'foil', color: 0xdfe5ea },
  { key: 'can-tab', name: 'aluminium can tab', material: 'aluminium', shape: 'clip', color: 0xd0d6dc },
  { key: 'penny', name: 'copper coin', material: 'copper', shape: 'coin', color: 0xc8743a },
  { key: 'copper-wire', name: 'piece of copper wire', material: 'copper', shape: 'yarn', color: 0xd27a3a },
  { key: 'brass-key', name: 'brass key', material: 'brass', shape: 'key', color: 0xd9b54a },
  { key: 'button', name: 'plastic button', material: 'plastic', shape: 'button', color: 0x4fb3e8 },
  { key: 'straw', name: 'plastic straw', material: 'plastic', shape: 'straw', color: 0xf28c8c },
  { key: 'pencil', name: 'wooden craft stick', material: 'wood', shape: 'straw', color: 0xd9b07a },
  { key: 'eraser', name: 'eraser', material: 'rubber', shape: 'eraser', color: 0xf49ab8 },
  { key: 'card', name: 'paper card', material: 'paper', shape: 'card', color: 0xf2efe6 },
  { key: 'marble', name: 'glass marble', material: 'glass', shape: 'marble', color: 0x7ccbe6 },
];
export const magnetByKey = (k: string) => MAGNET_THINGS.find(t => t.key === k);
export const pulled = (t: MagnetThing) => t.material === 'iron';
/** A metal the magnet does not pull: the trap for "all metal sticks". */
export const metalNotIron = (t: MagnetThing) => t.material === 'aluminium' || t.material === 'copper' || t.material === 'brass';
export const MAGNET_MATERIAL_WORDS: Record<MagnetMaterial, string> = {
  iron: 'iron or steel', aluminium: 'aluminium (a metal)', copper: 'copper (a metal)', brass: 'brass (a metal)',
  plastic: 'plastic', wood: 'wood', rubber: 'rubber', paper: 'paper', glass: 'glass',
};

export interface MagnetChallenge {
  id: string;
  type: 'magnet_test';
  instruction: string;
  bulbs: ['red'];
  tested: MagnetThing[];
  toSort: MagnetThing[];
  supportTier?: Tier;
  startLevers?: string[];
}

const names = (ts: readonly MagnetThing[]) =>
  ts.length === 1 ? `the ${ts[0].name}` : `${ts.slice(0, -1).map(t => `the ${t.name}`).join(', ')} and the ${ts[ts.length - 1].name}`;
export const magnetInstruction = (tested: readonly MagnetThing[], toSort: readonly MagnetThing[]) =>
  `Hold the magnet over ${names(tested)}. Then, without testing: will the magnet pull ${names(toSort)}?`;
export const makeMagnet = (id: string, tested: MagnetThing[], toSort: MagnetThing[]): MagnetChallenge =>
  ({ id, type: 'magnet_test', instruction: magnetInstruction(tested, toSort), bulbs: ['red'], tested, toSort });

/** Fair: a pulled and an unpulled test, and each thing to sort shares its stuff with a test (a metal-not-iron thing to
 *  sort is fair beside any metal-not-iron test: the lesson is that those metals stay put). */
export function magnetFair(c: Pick<MagnetChallenge, 'tested' | 'toSort'>): boolean {
  if (!c.tested.some(pulled) || c.tested.every(pulled)) return false;
  const keys = new Set(c.tested.map(t => t.key));
  return c.toSort.every(s => !keys.has(s.key) && c.tested.some(t => t.material === s.material || (metalNotIron(t) && metalNotIron(s))));
}

const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/**
 * One item. Easy: an iron thing and a non-metal tested, one thing to decide. Medium: three tests (iron, a non-iron
 * metal, a non-metal), two to decide, one pulled and one not. Hard: the same, but both things to decide are metals and
 * one of them is not iron, beside a pulled metal that looks alike.
 */
export function buildMagnet(tier: Tier, rng: Rng, id: string): MagnetChallenge | null {
  const pool = shuffle(MAGNET_THINGS, rng);
  const iron = pool.filter(pulled), other = pool.filter(metalNotIron), plain = pool.filter(t => !pulled(t) && !metalNotIron(t));
  for (let attempt = 0; attempt < 40; attempt++) {
    const i = shuffle(iron, rng), o = shuffle(other, rng), p = shuffle(plain, rng);
    let tested: MagnetThing[], toSort: MagnetThing[];
    if (tier === 'easy') {
      tested = [i[0], p[0]];
      toSort = [rng() < 0.5 ? i[1] : p.find(x => x.material === p[0].material && x.key !== p[0].key) ?? i[1]];
    } else if (tier === 'medium') {
      tested = [i[0], o[0], p[0]];
      toSort = [i[1], p.find(x => x.material === p[0].material && x.key !== p[0].key) ?? o[1]];
    } else {
      tested = [i[0], o[0], p[0]];
      toSort = [i[1], o[1]];
    }
    const c = makeMagnet(id, shuffle(tested, rng), toSort);
    if (toSort.every(Boolean) && magnetFair(c)) return c;
  }
  return null;
}

export function pickMagnets(n: number, tier: Tier, rng: Rng, idPrefix = 'magnet'): MagnetChallenge[] {
  const out: MagnetChallenge[] = [];
  for (let i = 0; out.length < n && i < n * 20; i++) {
    const c = buildMagnet(tier, rng, `${idPrefix}-${out.length + 1}`);
    if (c) out.push(c);
  }
  return out;
}

// ============================================================================
// The check
// ============================================================================

export type PullCall = 'pulls' | 'stays';
export type MagnetMiss = 'all_metal_sticks' | 'sort_slip';
export const callOf = (t: MagnetThing): PullCall => (pulled(t) ? 'pulls' : 'stays');
export const magnetMatches = (c: MagnetChallenge, calls: ReadonlyArray<PullCall | null>) => c.toSort.every((t, i) => calls[i] === callOf(t));
/** The named miss: a non-iron metal called pulled ("all metal sticks"), else another wrong call. */
export function magnetMiss(c: MagnetChallenge, calls: ReadonlyArray<PullCall | null>): MagnetMiss | undefined {
  if (magnetMatches(c, calls)) return undefined;
  return c.toSort.some((t, i) => metalNotIron(t) && calls[i] === 'pulls') ? 'all_metal_sticks' : 'sort_slip';
}
export const describeMagnet = (c: MagnetChallenge, calls: ReadonlyArray<PullCall | null>) =>
  `said ${c.toSort.map((t, i) => `the magnet ${calls[i] === 'pulls' ? 'pulls' : calls[i] === 'stays' ? 'does not pull' : '(no call)'} the ${t.name}`).join(' and ')}`;
export function magnetFeedback(c: MagnetChallenge, calls: ReadonlyArray<PullCall | null>): string {
  const miss = magnetMiss(c, calls);
  if (!miss) return 'Yes! A magnet pulls things with iron in them, like steel. Lots of other metals, like aluminium and copper, it does not pull.';
  if (miss === 'all_metal_sticks') return 'Not every metal! Look at your tests: did the magnet pull every metal thing?';
  return 'Not quite. Find the test made of the same stuff. What did the magnet do?';
}
