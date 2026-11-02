/**
 * The workbench's conductor test, pure: the everyday things a learner can put into a gap in a circuit, whether each lets
 * electricity through (a conductor) so the bulb lights, the items code builds, and the check. The 3D table lights the
 * bulb when the thing in the gap conducts, as this file says.
 *
 * Metal things conduct, whatever they look like: a dull rusty nail lights the bulb and a shiny plastic button does not.
 * Pencil lead (graphite) is not a metal but conducts too. Rubber, wood, plastic, paper, string and glass do not. An item
 * is test, then decide: the learner tests a few things in the gap, then, without testing, calls whether others would
 * light the bulb, using what the tests showed about what they are made of.
 */
import type { Rng, Tier } from './circuitModel';

export type CondMaterial = 'metal' | 'graphite' | 'rubber' | 'wood' | 'plastic' | 'paper' | 'string' | 'glass';
export type CondShape = 'spoon' | 'coin' | 'key' | 'foil' | 'clip' | 'nail' | 'eraser' | 'block' | 'straw' | 'button'
  | 'card' | 'yarn' | 'marble' | 'lead';

export interface CondThing {
  key: string;
  /** With its article dropped: "metal spoon", "rusty nail". */
  name: string;
  material: CondMaterial;
  shape: CondShape;
  /** Shiny or dull: what the eye goes by. */
  shiny: boolean;
  color: number;
}

export const COND_THINGS: readonly CondThing[] = [
  { key: 'spoon', name: 'metal spoon', material: 'metal', shape: 'spoon', shiny: true, color: 0xc9d1d9 },
  { key: 'coin', name: 'coin', material: 'metal', shape: 'coin', shiny: true, color: 0xd9a441 },
  { key: 'key', name: 'key', material: 'metal', shape: 'key', shiny: true, color: 0xd9b54a },
  { key: 'foil', name: 'piece of foil', material: 'metal', shape: 'foil', shiny: true, color: 0xdfe5ea },
  { key: 'paper-clip', name: 'paper clip', material: 'metal', shape: 'clip', shiny: true, color: 0xb9c2cc },
  { key: 'rusty-nail', name: 'rusty nail', material: 'metal', shape: 'nail', shiny: false, color: 0x8a4b2a },
  { key: 'pencil-lead', name: 'pencil lead', material: 'graphite', shape: 'lead', shiny: false, color: 0x3a3d42 },
  { key: 'eraser', name: 'eraser', material: 'rubber', shape: 'eraser', shiny: false, color: 0xf49ab8 },
  { key: 'wood-block', name: 'wooden block', material: 'wood', shape: 'block', shiny: false, color: 0xb07a45 },
  { key: 'straw', name: 'plastic straw', material: 'plastic', shape: 'straw', shiny: false, color: 0x4fb3e8 },
  { key: 'button', name: 'shiny plastic button', material: 'plastic', shape: 'button', shiny: true, color: 0xe6c84a },
  { key: 'card', name: 'paper card', material: 'paper', shape: 'card', shiny: false, color: 0xf2efe6 },
  { key: 'yarn', name: 'piece of yarn', material: 'string', shape: 'yarn', shiny: false, color: 0xd9534f },
  { key: 'marble', name: 'glass marble', material: 'glass', shape: 'marble', shiny: true, color: 0x7ccbe6 },
  { key: 'craft-stick', name: 'craft stick', material: 'wood', shape: 'straw', shiny: false, color: 0xd9b07a },
  { key: 'paper-cup', name: 'paper cup lid', material: 'paper', shape: 'button', shiny: false, color: 0xf7f3ea },
  { key: 'string', name: 'piece of string', material: 'string', shape: 'yarn', shiny: false, color: 0xe8dcc0 },
  { key: 'washer', name: 'old iron washer', material: 'metal', shape: 'coin', shiny: false, color: 0x5d6166 },
  { key: 'plastic-spoon', name: 'shiny plastic spoon', material: 'plastic', shape: 'spoon', shiny: true, color: 0xe8e8f0 },
  { key: 'rubber-ball', name: 'shiny rubber ball', material: 'rubber', shape: 'marble', shiny: true, color: 0x3fbf6a },
];
export const condByKey = (key: string) => COND_THINGS.find(t => t.key === key);
export const conducts = (t: CondThing): boolean => t.material === 'metal' || t.material === 'graphite';
/** Its look fools the eye: dull but conducts, or shiny but does not. */
export const looksFool = (t: CondThing): boolean => conducts(t) !== t.shiny;

export const MATERIAL_WORDS: Record<CondMaterial, string> = {
  metal: 'metal', graphite: 'pencil lead', rubber: 'rubber', wood: 'wood', plastic: 'plastic', paper: 'paper', string: 'string', glass: 'glass',
};

// ============================================================================
// Items
// ============================================================================

export interface ConductorChallenge {
  id: string;
  type: 'conductor_test';
  instruction: string;
  /** No bulbs to wire: one bulb in a loop with a gap. Kept for the shared table. */
  bulbs: ['red'];
  /** The things the learner tests in the gap, left to right: at least one conducts and one does not. */
  tested: CondThing[];
  /** The things to decide about without testing, each made of the same stuff as a tested thing. */
  toSort: CondThing[];
  supportTier?: Tier;
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

const names = (ts: readonly CondThing[]) =>
  ts.length === 1 ? `the ${ts[0].name}` : `${ts.slice(0, -1).map(t => `the ${t.name}`).join(', ')} and the ${ts[ts.length - 1].name}`;

export const conductorInstruction = (tested: readonly CondThing[], toSort: readonly CondThing[]) =>
  `Test ${names(tested)} in the gap. Then, without testing: will ${names(toSort)} make the bulb light?`;

export function makeConductor(id: string, tested: CondThing[], toSort: CondThing[]): ConductorChallenge {
  return { id, type: 'conductor_test', instruction: conductorInstruction(tested, toSort), bulbs: ['red'], tested, toSort };
}

/** Fair: one tested thing conducts and one does not, and each thing to sort shares its stuff with a tested thing. */
export function conductorFair(c: Pick<ConductorChallenge, 'tested' | 'toSort'>): boolean {
  if (!c.tested.some(conducts) || c.tested.every(conducts)) return false;
  const keys = new Set(c.tested.map(t => t.key));
  return c.toSort.every(s => !keys.has(s.key) && c.tested.some(t => t.material === s.material));
}

const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/**
 * One item. Easy: two tests (a shiny metal and a dull non-metal) and one thing to sort that looks the way it acts.
 * Medium: three tests, two things to sort. Hard: three tests and two things to sort whose look fools the eye (a dull
 * rusty nail, a shiny plastic button, pencil lead), each beside a tested thing of its stuff that looks the other way.
 */
export function buildConductor(tier: Tier, rng: Rng, id: string): ConductorChallenge | null {
  const pool = shuffle(COND_THINGS.filter(t => t.material !== 'graphite' || tier === 'hard'), rng);
  const sortCount = tier === 'easy' ? 1 : 2, testCount = tier === 'easy' ? 2 : 3;
  for (let attempt = 0; attempt < 80; attempt++) {
    const sortPool = shuffle(pool.filter(t => (tier === 'hard' ? looksFool(t) : !looksFool(t))), rng);
    const toSort = sortPool.slice(0, sortCount);
    if (toSort.length < sortCount || (sortCount === 2 && conducts(toSort[0]) === conducts(toSort[1]))) continue;
    const tested: CondThing[] = [];
    for (const s of toSort) {
      const partners = pool.filter(t => t.material === s.material && t.key !== s.key && !tested.includes(t) && !toSort.includes(t)
        && (tier === 'hard' ? !looksFool(t) : true));
      if (!partners.length) break;
      tested.push(partners[0]);
    }
    if (tested.length < toSort.length) continue;
    // Fill the tests with things of other stuff that look the way they act, conductor and not.
    for (const t of pool) {
      if (tested.length >= testCount) break;
      if (tested.includes(t) || toSort.includes(t) || looksFool(t) || tested.some(x => x.material === t.material)) continue;
      if (tested.length === testCount - 1 && tested.every(x => conducts(x) === conducts(t))) continue;
      tested.push(t);
    }
    const c = makeConductor(id, shuffle(tested, rng), toSort);
    if (tested.length === testCount && conductorFair(c)) return c;
  }
  return null;
}

/** N items, no thing to sort twice in a session where the pool allows it. */
export function pickConductors(n: number, tier: Tier, rng: Rng, idPrefix = 'cond'): ConductorChallenge[] {
  const out: ConductorChallenge[] = [];
  for (let i = 0; out.length < n && i < n * 20; i++) {
    const c = buildConductor(tier, rng, `${idPrefix}-${out.length + 1}`);
    if (!c) continue;
    const seen = new Set(out.flatMap(x => x.toSort.map(t => t.key)));
    if (i < n * 10 && c.toSort.some(t => seen.has(t.key))) continue;
    out.push(c);
  }
  return out;
}

// ============================================================================
// The check
// ============================================================================

export type LightCall = 'lights' | 'stays_off';
export type ConductorMiss = 'judged_by_shine' | 'sort_slip';

export const callFor = (t: CondThing): LightCall => (conducts(t) ? 'lights' : 'stays_off');
export const conductorMatches = (c: ConductorChallenge, calls: ReadonlyArray<LightCall | null>) =>
  c.toSort.every((t, i) => calls[i] === callFor(t));

/** The named miss: a wrong call on a thing whose shine fools the eye, else another wrong call. */
export function conductorMiss(c: ConductorChallenge, calls: ReadonlyArray<LightCall | null>): ConductorMiss | undefined {
  if (conductorMatches(c, calls)) return undefined;
  return c.toSort.some((t, i) => calls[i] !== callFor(t) && looksFool(t)) ? 'judged_by_shine' : 'sort_slip';
}

const callWords = (k: LightCall | null) => (k === 'lights' ? 'lights the bulb' : k === 'stays_off' ? 'leaves it off' : 'no call');

/** The learner's calls in words, never the right ones. */
export const describeConductor = (c: ConductorChallenge, calls: ReadonlyArray<LightCall | null>) =>
  `said ${c.toSort.map((t, i) => `the ${t.name} ${callWords(calls[i])}`).join(' and ')}`;

export function conductorFeedback(c: ConductorChallenge, calls: ReadonlyArray<LightCall | null>): string {
  const miss = conductorMiss(c, calls);
  if (!miss) {
    return 'Yes! Metal lets electricity through, so metal things light the bulb, shiny or not. Things made of other stuff block it.'
      + ([...c.tested, ...c.toSort].some(t => t.material === 'graphite') ? ' Pencil lead lets it through too, even though it is not a metal.' : '');
  }
  if (miss === 'judged_by_shine') return 'Shiny or dull does not decide it. Look at your tests: what is each thing made of?';
  return 'Not quite. Find the test made of the same stuff. What did the bulb do then?';
}
