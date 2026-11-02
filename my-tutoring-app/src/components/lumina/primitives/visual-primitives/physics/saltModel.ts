/**
 * The harbor's salt water test, pure: the foods that sink in fresh water but float in salty water, how salty the tank is
 * after each spoon, the salt items code builds, and the check. The 3D tank (`buoyancy3d.ts`) pushes up with the water's
 * density this file computes, so what the learner sees is what this file decides.
 *
 * Salt dissolved in water makes the same water heavier, so it pushes up harder: an egg that sinks in fresh water floats
 * once enough salt is stirred in. Each food needs a different amount. The thing did not change; the water did. Foods
 * are close to water's density (1.03-1.11 g/cm³); each spoon raises the water's by 0.02, so food densities sit between
 * spoon steps and a food never balances exactly.
 */
import { densityOf, type HarborThing, type Rng, type Tier } from './buoyancyModel';

/** The most spoons the tank's salt jar holds. */
export const MAX_SPOONS = 8;
const PER_SPOON = 0.02;
export const waterDensity = (spoons: number): number => 1 + PER_SPOON * spoons;
export const floatsAt = (t: HarborThing, spoons: number): boolean => densityOf(t) < waterDensity(spoons);
/** The fewest spoons that float it. */
export const spoonsToFloat = (t: HarborThing): number => Math.floor((densityOf(t) - 1) / PER_SPOON) + 1;

/** Lightest first. The big sweet potato floats first and the small grape last: size does not decide it here either. */
export const FOODS: readonly HarborThing[] = [
  { key: 'sweet-potato', name: 'big sweet potato', material: 'food', size: 'big', shape: 'potato', color: 0xc8643a, density: 1.03 },
  { key: 'egg', name: 'egg', material: 'food', size: 'medium', shape: 'egg', color: 0xf3e6cf, density: 1.05 },
  { key: 'baby-carrot', name: 'baby carrot', material: 'food', size: 'small', shape: 'carrot', color: 0xf07a22, density: 1.07 },
  { key: 'potato', name: 'potato chunk', material: 'food', size: 'medium', shape: 'potato', color: 0xe9d39a, density: 1.09 },
  { key: 'grape', name: 'grape', material: 'food', size: 'small', shape: 'grape', color: 0x7a3c8f, density: 1.11 },
];
export const foodByKey = (key: string): HarborThing | undefined => FOODS.find(t => t.key === key);

// ============================================================================
// Items
// ============================================================================

export interface SaltChallenge {
  id: string;
  type: 'salt_water';
  instruction: string;
  /** 1-3 foods, left to right. Each sinks in fresh water. */
  things: HarborThing[];
  /** Keys of the foods that must float. */
  floatGoal: string[];
  /** Keys of the foods that must stay on the bottom (none at easy). */
  sinkGoal: string[];
  /** The lesson's support tier on this item: when the model levers come (`HARBOR_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Help levers drawn from the start (the tier's starting position). Not a pull: nothing is recorded. */
  startLevers?: string[];
}

const list = (ts: readonly HarborThing[]) =>
  ts.length === 1 ? `the ${ts[0].name}` : `${ts.slice(0, -1).map(t => `the ${t.name}`).join(', ')} and the ${ts[ts.length - 1].name}`;

export function saltInstruction(things: readonly HarborThing[], floatGoal: readonly string[], sinkGoal: readonly string[]): string {
  const up = things.filter(t => floatGoal.includes(t.key)), down = things.filter(t => sinkGoal.includes(t.key));
  if (!down.length) return `Make ${list(up)} float. Add salt to the water one spoon at a time.`;
  return `Make ${list(up)} float, but keep ${list(down)} on the bottom.`;
}

const goalThings = (c: SaltChallenge, keys: readonly string[]) => c.things.filter(t => keys.includes(t.key));
/** The spoons that pass: from the most any float-goal food needs to one under the fewest any sink-goal food needs. */
export function saltWindow(c: SaltChallenge): [number, number] {
  const lo = Math.max(...goalThings(c, c.floatGoal).map(spoonsToFloat));
  const sinks = goalThings(c, c.sinkGoal).map(spoonsToFloat);
  return [lo, sinks.length ? Math.min(...sinks) - 1 : MAX_SPOONS];
}

export function makeSaltChallenge(id: string, things: HarborThing[], floatGoal: string[], sinkGoal: string[]): SaltChallenge {
  return { id, type: 'salt_water', instruction: saltInstruction(things, floatGoal, sinkGoal), things, floatGoal, sinkGoal };
}

/** Every item a tier allows, as food indexes into FOODS (lightest first). */
function candidates(tier: Tier): Array<{ float: number[]; sink: number[] }> {
  const n = FOODS.length, out: Array<{ float: number[]; sink: number[] }> = [];
  if (tier === 'easy') for (let i = 0; i < n; i++) out.push({ float: [i], sink: [] });
  // Medium: one floats, one stays down, at least two spoons apart (a window of two or more spoons).
  if (tier === 'medium') for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) out.push({ float: [i], sink: [j] });
  // Hard: three foods with a window of one spoon: the boundary pair is next to each other, the third is beyond it.
  if (tier === 'hard') for (let i = 0; i + 1 < n; i++) {
    for (let k = 0; k < i; k++) out.push({ float: [k, i], sink: [i + 1] });
    for (let k = i + 2; k < n; k++) out.push({ float: [i], sink: [i + 1, k] });
  }
  return out;
}

const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** N salt items from the tier's candidates, no set twice; the foods stand in a shuffled order on the pier. */
export function pickSaltChallenges(n: number, tier: Tier, rng: Rng, idPrefix = 'salt'): SaltChallenge[] {
  const pool = shuffle(candidates(tier), rng);
  return Array.from({ length: n }, (_, i) => {
    const { float, sink } = pool[i % pool.length];
    const things = shuffle([...float, ...sink].map(k => FOODS[k]), rng);
    return makeSaltChallenge(`${idPrefix}-${i + 1}`, things, float.map(k => FOODS[k].key), sink.map(k => FOODS[k].key));
  });
}

// ============================================================================
// The check
// ============================================================================

export type SaltMiss = 'too_little_salt' | 'too_much_salt';

export const saltMatches = (c: SaltChallenge, spoons: number): boolean =>
  goalThings(c, c.floatGoal).every(t => floatsAt(t, spoons)) && goalThings(c, c.sinkGoal).every(t => !floatsAt(t, spoons));

/** The named miss: a food that should float is still down, else a food that should stay down floats. */
export function saltMiss(c: SaltChallenge, spoons: number): SaltMiss | undefined {
  if (goalThings(c, c.floatGoal).some(t => !floatsAt(t, spoons))) return 'too_little_salt';
  if (goalThings(c, c.sinkGoal).some(t => floatsAt(t, spoons))) return 'too_much_salt';
  return undefined;
}

const spoonWords = (n: number) => `${n} ${n === 1 ? 'spoon' : 'spoons'} of salt`;

/** What the tank shows: the salt in it and what floats. Never the goal's window. */
export function describeSalt(c: SaltChallenge, spoons: number): string {
  const up = c.things.filter(t => floatsAt(t, spoons)), down = c.things.filter(t => !floatsAt(t, spoons));
  const parts = [up.length && `${list(up)} ${up.length === 1 ? 'floats' : 'float'}`, down.length && `${list(down)} ${down.length === 1 ? 'is' : 'are'} on the bottom`]
    .filter(Boolean).join(', and ');
  return `put ${spoons ? spoonWords(spoons) : 'no salt'} in the water: ${parts}`;
}

export function saltFeedback(c: SaltChallenge, spoons: number): string {
  const miss = saltMiss(c, spoons);
  if (!miss) {
    const down = goalThings(c, c.sinkGoal);
    return `Yes! Salt makes the water heavier, so it pushes up harder. With ${spoonWords(spoons)} it holds up ${list(goalThings(c, c.floatGoal))}`
      + (down.length ? ` but not ${list(down)}.` : '.');
  }
  if (miss === 'too_little_salt') {
    const stuck = goalThings(c, c.floatGoal).filter(t => !floatsAt(t, spoons));
    return `${list(stuck)[0].toUpperCase()}${list(stuck).slice(1)} ${stuck.length === 1 ? 'is' : 'are'} still on the bottom. Salty water pushes up harder. What could you do to the water?`;
  }
  const up = goalThings(c, c.sinkGoal).filter(t => floatsAt(t, spoons));
  return `Now ${list(up)} ${up.length === 1 ? 'floats' : 'float'} too! The water pushes up too hard. How could you make it a little less salty?`;
}
