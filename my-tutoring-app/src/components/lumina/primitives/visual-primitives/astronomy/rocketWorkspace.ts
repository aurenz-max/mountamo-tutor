/**
 * rocket-builder on the shared tutor/JEV teaching workspace (W1, plain shape; R2 batch B1, rebuilt 2026-10-16 under the
 * 10-15 ruling).
 *
 * The old builder was a sandbox: a live green/red Thrust/Weight panel and a "(TWR: 0.85)" failure line stated the
 * lift-off answer, two failed launches went unscored and a third-launch success scored 100, and Gemini's parts and target
 * altitude were never checked for reachability. The rebuild keeps the subject (a rocket is parts with weight, engines
 * push, fuel burns, empty tanks can be dropped) and turns it into four predictions. Every item and key is built by code
 * from one toy flight model (`flightOf`): weight is counted in blocks and push in arrows, a rocket lifts off only when its
 * push is MORE than its weight, fuel is heavy and burns away, and a staged rocket drops each tank once it is empty.
 * Nothing launches before the answer is checked, so the first answer is a committed prediction; no total, ratio or
 * readout is drawn.
 *
 * - can_it_lift: one rocket; say or tap whether it lifts off. easy: 3 parts, push far from weight; medium: 3-5 parts,
 *   1-2 apart; hard: 5-6 parts with two engines to add up, 0-1 apart (push equal to weight stays on the pad).
 * - add_to_lift: a rocket that stays on the pad and 2-4 parts to add; say or tap the one that makes it lift off.
 *   easy: an engine or a fuel tank; medium: adds a weak engine; hard: adds the engine with the biggest push, which is
 *   too heavy to help.
 * - on_budget: 2-4 rockets with coins on their parts and a budget; say or tap the one that lifts off AND costs no more
 *   than the budget. easy: 2 rockets, one fails one rule; medium: 3 (one over budget, one stays down); hard: 4, a foil one
 *   coin over, the cheapest one stays down, the key may cost exactly the budget.
 * - reach_target: 2-4 rockets that differ in fuel, engine, weight or staging; say or tap the one that flies highest (or
 *   lowest). easy: 2 rockets, one difference; medium: 3 in a chain of differences; hard: 4, the one with the most fuel is
 *   too heavy to lift off.
 *
 * Every item is a sayable closed choice (J14, user 10-13): said and judged by the tutor against its key (`rocketKey`), or
 * tapped and checked by code. The boss (`rocketBuilder.boss.ts`) builds the assignment from them.
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { ROCKET_MISSES } from './rocketBuilder.card';

export { ROCKET_MISSES };

export type RocketMode = 'can_it_lift' | 'add_to_lift' | 'on_budget' | 'reach_target';
export const ROCKET_MODES: RocketMode[] = ['can_it_lift', 'add_to_lift', 'on_budget', 'reach_target'];
export type RocketTier = 'easy' | 'medium' | 'hard';

// ── Parts and rockets ────────────────────────────────────────────────────────────────────

export type PartKind = 'engine' | 'tank' | 'cargo' | 'capsule';
export const ENGINE_COLORS = ['red', 'blue', 'green', 'purple'] as const;
export type EngineColor = typeof ENGINE_COLORS[number];
export const ROCKET_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type RocketColor = typeof ROCKET_COLORS[number];
export const COLOR_HEX: Record<RocketColor | EngineColor, string> = {
  red: '#f87171', blue: '#60a5fa', green: '#4ade80', yellow: '#facc15', purple: '#c084fc',
};

/** One part. `weight` in blocks; an engine's `push` in arrows; `cost` in coins (on_budget only). A tank is always full. */
export interface Part { kind: PartKind; weight: number; push?: number; cost?: number; color?: EngineColor }
/** A rocket, parts from the bottom up. `staged`: it drops each tank once the tank is empty. */
export interface Rocket { color: RocketColor; parts: Part[]; staged?: boolean }

export const weightOf = (r: Pick<Rocket, 'parts'>) => r.parts.reduce((s, p) => s + p.weight, 0);
export const pushOf = (r: Pick<Rocket, 'parts'>) => r.parts.reduce((s, p) => s + (p.push ?? 0), 0);
export const costOf = (r: Pick<Rocket, 'parts'>) => r.parts.reduce((s, p) => s + (p.cost ?? 0), 0);
export const tanksOf = (r: Pick<Rocket, 'parts'>) => r.parts.filter(p => p.kind === 'tank').length;
/** The rule: a rocket lifts off only when its push is more than its weight. */
export const lifts = (r: Pick<Rocket, 'parts'>) => pushOf(r) > weightOf(r);

/** Each tank: 2 blocks full, 1 block empty (the fuel is the other block). */
export const TANK_WEIGHT = 2;

/**
 * The toy flight: weight is also mass (g = 1). The engines burn one tank at a time, bottom first; burning a tank's fuel
 * takes one time unit and removes one block; a staged rocket also drops the empty tank. After the last tank it coasts
 * up until gravity stops it. Returns 0 for a rocket that does not lift off.
 */
export function flightOf(r: Pick<Rocket, 'parts' | 'staged'>): number {
  const P = pushOf(r);
  let w = weightOf(r);
  if (P <= w) return 0;
  let v = 0, h = 0;
  const dt = 0.005;
  for (let k = 0; k < tanksOf(r); k++) {
    for (let t = 0; t < 1 - 1e-9; t += dt) {
      const a = (P - w) / w; // net push per block of mass, in g
      v += a * dt; h += v * dt; w -= dt;
    }
    if (r.staged) w -= 1;
  }
  return h + (v * v) / 2;
}

export const rocketLabel = (r: Rocket) => `${r.color.charAt(0).toUpperCase()}${r.color.slice(1)} rocket`;
const PART_NAME: Record<PartKind, string> = { engine: 'engine', tank: 'fuel tank', cargo: 'cargo box', capsule: 'capsule' };
/** An option's label: a coloured engine, or a plain part. */
export const partLabel = (p: Part) => (p.kind === 'engine' && p.color
  ? `${p.color.charAt(0).toUpperCase()}${p.color.slice(1)} engine` : PART_NAME[p.kind].charAt(0).toUpperCase() + PART_NAME[p.kind].slice(1));

// ── Items ────────────────────────────────────────────────────────────────────────────────

export interface LiftItem { id: string; mode: 'can_it_lift'; rocket: Rocket }
export interface AddItem { id: string; mode: 'add_to_lift'; rocket: Rocket; options: Part[] }
export interface BudgetItem { id: string; mode: 'on_budget'; budget: number; rockets: Rocket[] }
export type ReachAsk = 'highest' | 'lowest';
export interface ReachItem { id: string; mode: 'reach_target'; ask: ReachAsk; rockets: Rocket[] }
export type RocketItem = LiftItem | AddItem | BudgetItem | ReachItem;
export type ManyItem = BudgetItem | ReachItem;
export const isManyItem = (i: RocketItem): i is ManyItem => i.mode === 'on_budget' || i.mode === 'reach_target';

export type LiftChoice = 'lifts' | 'stays';
export const LIFT_CHOICES: LiftChoice[] = ['lifts', 'stays'];
export const LIFT_TEXT: Record<LiftChoice, string> = { lifts: 'Yes, it lifts off', stays: 'No, it stays on the pad' };

/** The rocket with one part added on top of its engines (add_to_lift): an engine goes beside the others at the bottom. */
export function withPart(r: Rocket, p: Part): Rocket {
  return { ...r, parts: p.kind === 'engine' ? [p, ...r.parts] : [...r.parts.slice(0, -1), p, ...r.parts.slice(-1)] };
}

// ── Keys, checks ─────────────────────────────────────────────────────────────────────────

/** The number of options an item shows, in screen order. */
export const optionCount = (item: RocketItem) =>
  item.mode === 'can_it_lift' ? 2 : item.mode === 'add_to_lift' ? item.options.length : item.rockets.length;

export function optionLabel(item: RocketItem, i: number): string {
  if (item.mode === 'can_it_lift') return LIFT_TEXT[LIFT_CHOICES[i]];
  if (item.mode === 'add_to_lift') return partLabel(item.options[i]);
  return rocketLabel(item.rockets[i]);
}

/** The key's index, or -1 when the item has no single key. */
export function keyOf(item: RocketItem): number {
  if (item.mode === 'can_it_lift') return lifts(item.rocket) ? 0 : 1;
  if (item.mode === 'add_to_lift') {
    const m = item.options.map((p, i) => ({ i, ok: lifts(withPart(item.rocket, p)) })).filter(x => x.ok);
    return m.length === 1 ? m[0].i : -1;
  }
  if (item.mode === 'on_budget') {
    const m = item.rockets.map((r, i) => ({ i, ok: lifts(r) && costOf(r) <= item.budget })).filter(x => x.ok);
    return m.length === 1 ? m[0].i : -1;
  }
  const h = item.rockets.map(flightOf);
  const want = item.ask === 'highest' ? Math.max(...h) : Math.min(...h);
  return h.filter(x => Math.abs(x - want) < 1e-9).length === 1 ? h.indexOf(want) : -1;
}

/** The learner's work: the option tapped (choice index). */
export interface RocketWork { pick: number | null }
export const emptyWork = (): RocketWork => ({ pick: null });
export const workComplete = (_item: RocketItem, w: RocketWork) => w.pick !== null;
export function rocketCorrect(item: RocketItem | undefined, w: RocketWork): boolean {
  return !!item && w.pick !== null && w.pick === keyOf(item);
}

// ── Misses ───────────────────────────────────────────────────────────────────────────────

export type LiftMiss = 'said_lifts' | 'said_stays' | 'said_equal_lifts';
export type AddMiss = 'added_no_push' | 'heavy_engine' | 'too_weak';
export type BudgetMiss = 'over_budget' | 'no_lift' | 'fails_both';
export type ReachMiss = 'picked_no_lift' | 'picked_lower' | 'picked_higher';
export type RocketMiss = LiftMiss | AddMiss | BudgetMiss | ReachMiss;

export function optionMiss(item: RocketItem, i: number): RocketMiss | undefined {
  const key = keyOf(item);
  if (i === key || i < 0 || i >= optionCount(item)) return undefined;
  if (item.mode === 'can_it_lift') {
    if (i === 1) return 'said_stays';
    return pushOf(item.rocket) === weightOf(item.rocket) ? 'said_equal_lifts' : 'said_lifts';
  }
  if (item.mode === 'add_to_lift') {
    const p = item.options[i];
    if (p.kind !== 'engine') return 'added_no_push';
    const k = item.options[key];
    return (p.push ?? 0) > (k?.push ?? 0) ? 'heavy_engine' : 'too_weak';
  }
  if (item.mode === 'on_budget') {
    const r = item.rockets[i], up = lifts(r), cheap = costOf(r) <= item.budget;
    return !up && !cheap ? 'fails_both' : !up ? 'no_lift' : 'over_budget';
  }
  if (!lifts(item.rockets[i])) return 'picked_no_lift';
  return item.ask === 'highest' ? 'picked_lower' : 'picked_higher';
}

export function rocketMiss(item: RocketItem | undefined, w: RocketWork): RocketMiss | undefined {
  if (!item || w.pick === null) return undefined;
  return optionMiss(item, w.pick);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

export function askOf(item: RocketItem): string {
  if (item.mode === 'can_it_lift') return 'Will this rocket lift off the launch pad?';
  if (item.mode === 'add_to_lift') return 'This rocket stays on the launch pad. Which one part can you add so it lifts off?';
  if (item.mode === 'on_budget') return `You have ${item.budget} coins. Which rocket lifts off and costs no more than ${item.budget} coins?`;
  return item.ask === 'highest' ? 'Which rocket will fly the highest?' : 'Which rocket will fly the least high?';
}

// ── Item space ───────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items still builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const pickOne = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];
const int = (lo: number, hi: number, rng: Rng) => lo + Math.floor(rng() * (hi - lo + 1));
/** The next value of a list, least used so far (a session's items ask different things). */
const fresh = <T extends string>(xs: readonly T[], used: Map<string, number>, rng: Rng): T => {
  const least = Math.min(...xs.map(x => used.get(x) ?? 0));
  const out = pickOne(xs.filter(x => (used.get(x) ?? 0) === least), rng);
  used.set(out, (used.get(out) ?? 0) + 1);
  return out;
};

const engine = (push: number, weight: number, extra: Partial<Part> = {}): Part => ({ kind: 'engine', push, weight, ...extra });
const tank = (extra: Partial<Part> = {}): Part => ({ kind: 'tank', weight: TANK_WEIGHT, ...extra });
const capsule = (weight: number, extra: Partial<Part> = {}): Part => ({ kind: 'capsule', weight, ...extra });
const cargo = (weight: number, extra: Partial<Part> = {}): Part => ({ kind: 'cargo', weight, ...extra });

/** Split a total push over n engines (each at least 1). */
function splitPush(total: number, n: number, rng: Rng): number[] {
  if (n === 1) return [total];
  const a = Math.max(1, Math.min(total - 1, Math.round(total / 2) + int(-1, 1, rng)));
  return [a, total - a];
}

function buildLift(tier: RocketTier, rng: Rng, used: Map<string, number>): LiftItem | null {
  // hard: a rocket that stays down is as often one whose push only equals its weight.
  const lifted = fresh(['lifts', 'stays'] as const, used, rng);
  const outcome = lifted === 'stays' && tier === 'hard' && rng() < 0.5 ? 'equal' : lifted;
  const engines = tier === 'hard' ? 2 : 1;
  const engineWeights = Array.from({ length: engines }, () => int(1, 2, rng));
  const above: Part[] = [];
  const tanks = tier === 'easy' ? 1 : int(1, 2, rng);
  for (let i = 0; i < tanks; i++) above.push(tank());
  if (tier === 'hard' || (tier === 'medium' && rng() < 0.5)) above.push(cargo(int(1, 3, rng)));
  above.push(capsule(int(1, 2, rng)));
  const W = engineWeights.reduce((s, w) => s + w, 0) + above.reduce((s, p) => s + p.weight, 0);
  const margin = tier === 'easy' ? int(3, 4, rng) : tier === 'medium' ? int(1, 2, rng) : 1;
  const P = outcome === 'lifts' ? W + margin : outcome === 'equal' ? W : W - margin;
  if (P < engines) return null;
  const pushes = splitPush(P, engines, rng);
  const rocket: Rocket = { color: 'red', parts: [...pushes.map((p, i) => engine(p, engineWeights[i])), ...above] };
  const item: LiftItem = { id: 'x', mode: 'can_it_lift', rocket };
  return validRocketItem(item) ? { ...item, id: '' } : null;
}

/**
 * add_to_lift. Every tier defeats the fixed strategy a learner could use without counting (coordinator 10-16; CLAUDE.md:
 * no trivial solve from layout). easy: the key and ONE foil, a fuel tank, a heavy engine (more push than the key, but its
 * own weight cancels it) or a weak engine, so "any engine" and "the biggest push" fail on some items; medium: the key, a
 * fuel tank and one other engine, heavy (about half the items) or weak; hard: the key, a heavy engine, a weak engine and a
 * tank or cargo, so the biggest push is never the key. The key's margin narrows as the tier rises.
 */
function buildAdd(tier: RocketTier, rng: Rng, used: Map<string, number>): AddItem | null {
  const D = tier === 'medium' ? int(1, 3, rng) : int(1, 2, rng);
  const above: Part[] = [tank()];
  if (tier !== 'easy' && rng() < 0.5) above.push(tank());
  if (rng() < 0.5) above.push(cargo(int(1, 2, rng)));
  above.push(capsule(int(1, 2, rng)));
  const w0 = int(1, 2, rng);
  const W = w0 + above.reduce((s, p) => s + p.weight, 0);
  const P0 = W - D;
  if (P0 < 1) return null;
  const rocket: Rocket = { color: 'red', parts: [engine(P0, w0), ...above] };
  const colors = shuffle(ENGINE_COLORS, rng);
  const wk = int(1, tier === 'easy' ? 3 : 2, rng);
  const key = engine(wk + D + (tier === 'easy' ? int(2, 3, rng) : tier === 'medium' ? int(1, 2, rng) : 1), wk, { color: colors[0] });
  /** More push than the key, but its own weight leaves it no more than D net: the rocket stays down. */
  const heavy = (c: EngineColor) => { const ph = (key.push ?? 0) + int(1, 2, rng); return engine(ph, ph - D + int(0, 1, rng), { color: c }); };
  /** Less push than the key, and not enough over its own weight. */
  const weak = (c: EngineColor) => { const ww = int(1, 2, rng); return engine(ww + Math.max(0, D - int(0, 1, rng)), ww, { color: c }); };
  const opts: Part[] = [key];
  if (tier === 'easy') {
    const foil = fresh(['tank', 'heavy', 'weak'] as const, used, rng);
    opts.push(foil === 'tank' ? tank() : foil === 'heavy' ? heavy(colors[1]) : weak(colors[1]));
  } else if (tier === 'medium') {
    opts.push(fresh(['heavy', 'weak'] as const, used, rng) === 'heavy' ? heavy(colors[1]) : weak(colors[1]), tank());
  } else {
    opts.push(weak(colors[1]), heavy(colors[2]), rng() < 0.5 ? cargo(2) : tank());
  }
  const item: AddItem = { id: 'x', mode: 'add_to_lift', rocket, options: shuffle(opts, rng) };
  return validRocketItem(item) ? { ...item, id: '' } : null;
}

/** A random rocket for on_budget, with coins on every part. */
function budgetRocket(color: RocketColor, tier: RocketTier, rng: Rng): Rocket {
  const parts: Part[] = [engine(int(2, 8, rng), int(1, 2, rng), { cost: int(2, 4, rng) })];
  const tanks = tier === 'easy' ? 1 : int(1, 2, rng);
  for (let i = 0; i < tanks; i++) parts.push(tank({ cost: int(1, 2, rng) }));
  if (tier === 'hard' && rng() < 0.6) parts.push(cargo(int(1, 2, rng), { cost: 1 }));
  parts.push(capsule(int(1, 2, rng), { cost: int(1, 2, rng) }));
  return { color, parts };
}

type BudgetRole = 'key' | 'over' | 'down' | 'both';
function fitsRole(r: Rocket, role: BudgetRole, budget: number, tier: RocketTier): boolean {
  const m = pushOf(r) - weightOf(r), c = costOf(r);
  const gap = tier === 'easy' ? 2 : 1;
  if (role === 'key') return m >= gap && c <= budget;
  if (role === 'over') return m >= gap && c >= budget + gap && (tier !== 'hard' || c === budget + 1);
  if (role === 'down') return (tier === 'hard' ? m <= 0 : m <= -gap) && c <= budget - (tier === 'hard' ? 1 : 0);
  return m <= -1 && c >= budget + 1;
}

function buildBudget(tier: RocketTier, rng: Rng, used: Map<string, number>): BudgetItem | null {
  const roles: BudgetRole[] = tier === 'easy' ? ['key', fresh(['over', 'down'] as const, used, rng)]
    : tier === 'medium' ? ['key', 'over', 'down'] : ['key', 'over', 'down', 'both'];
  const colors = shuffle(ROCKET_COLORS, rng);
  let key: Rocket | null = null;
  for (let t = 0; t < 200 && !key; t++) { const r = budgetRocket(colors[0], tier, rng); if (pushOf(r) - weightOf(r) >= (tier === 'easy' ? 2 : 1)) key = r; }
  if (!key) return null;
  const budget = costOf(key) + (tier === 'hard' ? int(0, 1, rng) : int(0, 2, rng));
  const rockets: Rocket[] = [key];
  roles.slice(1).forEach((role, k) => {
    for (let t = 0; t < 400; t++) {
      const r = budgetRocket(colors[k + 1], tier, rng);
      if (fitsRole(r, role, budget, tier)) { rockets.push(r); return; }
    }
  });
  if (rockets.length !== roles.length) return null;
  const item: BudgetItem = { id: 'x', mode: 'on_budget', budget, rockets: shuffle(rockets, rng) };
  // hard: the cheapest rocket is never the key.
  if (tier === 'hard') {
    const costs = item.rockets.map(costOf), min = Math.min(...costs);
    if (costs.filter(c => c === min).length === 1 && costs.indexOf(min) === keyOf(item)) return null;
  }
  return validRocketItem(item) ? { ...item, id: '' } : null;
}

type Factor = 'fuel' | 'engine' | 'lighter' | 'staged';
function applyFactor(r: Rocket, f: Factor, rng: Rng): Rocket {
  const parts = r.parts.map(p => ({ ...p }));
  if (f === 'fuel') {
    const at = parts.findIndex(p => p.kind === 'tank');
    parts.splice(at, 0, tank());
    return { ...r, parts };
  }
  if (f === 'engine') { parts[0] = { ...parts[0], push: (parts[0].push ?? 0) + int(2, 3, rng) }; return { ...r, parts }; }
  if (f === 'lighter') {
    const c = parts.findIndex(p => p.kind === 'cargo');
    if (c >= 0) parts.splice(c, 1);
    return { ...r, parts };
  }
  return { ...r, parts, staged: true };
}

function buildReach(tier: RocketTier, rng: Rng, used: Map<string, number>): ReachItem | null {
  const ask: ReachAsk = tier === 'hard' ? 'highest' : fresh(['highest', 'lowest'] as const, used, rng);
  const factors: Factor[] = tier === 'hard' ? shuffle(['engine', 'lighter', 'staged'] as const, rng) : shuffle(['fuel', 'engine', 'lighter', 'staged'] as const, rng);
  const steps = tier === 'easy' ? 1 : 2;
  const chosen = factors.slice(0, steps);
  if (tier === 'easy' && chosen[0] === 'staged') chosen[0] = 'fuel';
  const tanks = chosen.includes('staged') || tier === 'hard' ? 2 : 1;
  const parts: Part[] = [engine(0, int(1, 2, rng))];
  for (let i = 0; i < tanks; i++) parts.push(tank());
  if (chosen.includes('lighter') || rng() < 0.4) parts.push(cargo(int(2, 3, rng)));
  parts.push(capsule(int(1, 2, rng)));
  const W = weightOf({ parts });
  // hard: a base margin of 1-3, so the same rocket with two more tanks (4 more blocks) cannot lift off.
  const margin = tier === 'hard' ? int(1, 3, rng) : chosen.includes('fuel') ? int(4, 6, rng) : int(2, 5, rng);
  parts[0] = { ...parts[0], push: W + margin };
  const colors = shuffle(ROCKET_COLORS, rng);
  const chain: Rocket[] = [{ color: colors[0], parts }];
  for (const f of chosen) chain.push({ ...applyFactor(chain[chain.length - 1], f, rng), color: colors[chain.length] });
  const h = chain.map(flightOf);
  for (let k = 1; k < h.length; k++) if (!(h[k - 1] > 0 && h[k] >= h[k - 1] * (tier === 'easy' ? 1.3 : 1.15))) return null;
  const rockets = [...chain];
  if (tier === 'hard') {
    const over = applyFactor(applyFactor(chain[0], 'fuel', rng), 'fuel', rng);
    if (lifts(over)) return null;
    rockets.push({ ...over, color: colors[3] });
  }
  const item: ReachItem = { id: 'x', mode: 'reach_target', ask, rockets: shuffle(rockets, rng) };
  return validRocketItem(item) ? { ...item, id: '' } : null;
}

export const ITEM_COUNT = { single: 4, blend: 2 };

/** The items of one mode at one tier; each asks something different where it can, and no two are the same. */
export function buildModeItems(mode: RocketMode, tier: RocketTier, count: number, rng: Rng): RocketItem[] {
  const out: RocketItem[] = [];
  const seen = new Set<string>();
  const used = new Map<string, number>();
  for (let tries = 0; out.length < count && tries < 400; tries++) {
    const item = mode === 'can_it_lift' ? buildLift(tier, rng, used) : mode === 'add_to_lift' ? buildAdd(tier, rng, used)
      : mode === 'on_budget' ? buildBudget(tier, rng, used) : buildReach(tier, rng, used);
    if (!item) continue;
    const sig = JSON.stringify({ ...item, id: '' });
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(item);
  }
  return out;
}

export function buildRocketItems(opts: { modes: RocketMode[]; tier: RocketTier; rng: Rng }): RocketItem[] {
  const count = opts.modes.length === 1 ? ITEM_COUNT.single : ITEM_COUNT.blend;
  const out: RocketItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, count, opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface RocketItemsSource {
  title?: string;
  gradeLevel?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: RocketItem[];
}

export const resolveTier = (d: RocketItemsSource): RocketTier => {
  const t = (d.difficulty ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The modes a session asks when nothing pins them, by grade rung (K-5). */
export function defaultModes(grade?: string): RocketMode[] {
  const s = String(grade ?? '').trim().toUpperCase();
  const g = s === 'K' || s.startsWith('KINDER') ? 0 : parseInt(s.replace(/\D/g, ''), 10);
  if (Number.isNaN(g) || g <= 1) return ['can_it_lift'];
  if (g === 2) return ['can_it_lift', 'add_to_lift'];
  if (g === 3) return ['can_it_lift', 'add_to_lift', 'on_budget'];
  return [...ROCKET_MODES];
}

/** The modes a lesson asks: its pin, else by grade. A legacy payload (parts library, target altitude) has no modes. */
export function resolveRocketModes(d: RocketItemsSource): RocketMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is RocketMode => (ROCKET_MODES as string[]).includes(m));
  return asked.length ? ROCKET_MODES.filter(m => asked.includes(m)) : defaultModes(d.gradeLevel);
}

const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
function validPart(p: Part | undefined, budget: boolean): boolean {
  if (!p || !(['engine', 'tank', 'cargo', 'capsule'] as string[]).includes(p.kind) || !isInt(p.weight, 1, 8)) return false;
  if (p.kind === 'tank' && p.weight !== TANK_WEIGHT) return false;
  if (p.kind === 'engine' ? !isInt(p.push, 1, 16) : p.push !== undefined) return false;
  if (budget ? !isInt(p.cost, 1, 6) : p.cost !== undefined) return false;
  return p.color === undefined || (ENGINE_COLORS as readonly string[]).includes(p.color);
}
function validRocket(r: Rocket | undefined, budget: boolean): boolean {
  if (!r || !(ROCKET_COLORS as readonly string[]).includes(r.color) || !Array.isArray(r.parts) || r.parts.length < 2 || r.parts.length > 8) return false;
  if (!r.parts.every(p => validPart(p, budget)) || r.parts[0].kind !== 'engine' || tanksOf(r) < 1) return false;
  return !r.staged || tanksOf(r) >= 2;
}
const distinctColors = (rs: Rocket[]) => new Set(rs.map(r => r.color)).size === rs.length;

/** False when a stored item is not one code could have built (its key must be computable, and only one). */
export function validRocketItem(i: RocketItem | undefined): i is RocketItem {
  if (!i || typeof i.id !== 'string' || !i.id) return false;
  if (i.mode === 'can_it_lift') return validRocket(i.rocket, false) && keyOf(i) >= 0;
  if (i.mode === 'add_to_lift') {
    if (!validRocket(i.rocket, false) || lifts(i.rocket) || !Array.isArray(i.options) || i.options.length < 2 || i.options.length > 4) return false;
    if (!i.options.every(p => validPart(p, false))) return false;
    const labels = i.options.map(partLabel);
    return new Set(labels).size === labels.length && i.options.every(p => p.kind !== 'engine' || !!p.color) && keyOf(i) >= 0;
  }
  if (i.mode === 'on_budget') {
    if (!isInt(i.budget, 2, 30) || !Array.isArray(i.rockets) || i.rockets.length < 2 || i.rockets.length > 4) return false;
    return i.rockets.every(r => validRocket(r, true)) && distinctColors(i.rockets) && keyOf(i) >= 0;
  }
  if (i.mode === 'reach_target') {
    if (!['highest', 'lowest'].includes(i.ask) || !Array.isArray(i.rockets) || i.rockets.length < 2 || i.rockets.length > 4) return false;
    if (!i.rockets.every(r => validRocket(r, false)) || !distinctColors(i.rockets) || keyOf(i) < 0) return false;
    // The key stands clear of the next rocket: at least 10% higher (or lower).
    const h = i.rockets.map(flightOf), k = h[keyOf(i)];
    const rest = h.filter((_, j) => j !== keyOf(i));
    return i.ask === 'highest' ? k >= Math.max(...rest) * 1.1 : k > 0 && Math.min(...rest) >= k * 1.1;
  }
  return false;
}

/** Every item of the session: the stored, code-built items when all are valid, else built from the lesson's fields. */
export function rocketItems(d: RocketItemsSource): RocketItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validRocketItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const tier = resolveTier(d);
  return buildRocketItems({ modes: resolveRocketModes(d), tier, rng: seededRng(`${d.title ?? 'rocket'}:${d.gradeLevel ?? ''}:${tier}`) });
}

// ── What the screen says after the answer ────────────────────────────────────────────────

const FACTOR_TEXT: Record<Factor, string> = {
  fuel: 'it has more fuel, so its engine pushes for longer',
  engine: 'its engine pushes harder',
  lighter: 'it carries less weight',
  staged: 'it drops each fuel tank once the tank is empty, so it gets lighter as it climbs',
};

/** How rocket a is better than rocket b, in words: the first difference found. */
function betterBecause(a: Rocket, b: Rocket): string {
  if (pushOf(a) > pushOf(b)) return FACTOR_TEXT.engine;
  if (tanksOf(a) > tanksOf(b)) return FACTOR_TEXT.fuel;
  if (a.staged && !b.staged) return FACTOR_TEXT.staged;
  if (weightOf(a) < weightOf(b)) return FACTOR_TEXT.lighter;
  return 'it has the better mix of push, fuel and weight';
}

/** The answer, explained (shown after credit or a reveal). */
export function revealText(item: RocketItem): string {
  const key = keyOf(item);
  if (item.mode === 'can_it_lift') {
    const P = pushOf(item.rocket), W = weightOf(item.rocket);
    if (P > W) return 'It lifts off: its push is more than its weight.';
    if (P === W) return 'It stays on the pad: its push is only as big as its weight, and a rocket needs more push than weight to lift off.';
    return 'It stays on the pad: its push is less than its weight.';
  }
  if (item.mode === 'add_to_lift') {
    return `The ${partLabel(item.options[key]).toLowerCase()}: it adds more push than it adds weight, so now the rocket's push is more than its weight.`;
  }
  if (item.mode === 'on_budget') {
    const r = item.rockets[key];
    return `The ${rocketLabel(r).toLowerCase()}: its push is more than its weight, and it costs ${costOf(r)} coins, no more than ${item.budget}.`;
  }
  const h = item.rockets.map(flightOf);
  const order = h.map((x, i) => ({ x, i })).filter(o => o.i !== key && o.x > 0).sort((a, b) => b.x - a.x);
  const down = item.rockets.filter(r => !lifts(r));
  const k = item.rockets[key];
  const tail = down.length ? ` The ${rocketLabel(down[0]).toLowerCase()} has the most fuel, but all that fuel is too heavy for its engine: it never lifts off.` : '';
  if (item.ask === 'highest') {
    const next = order[0] ? item.rockets[order[0].i] : null;
    return `The ${rocketLabel(k).toLowerCase()} flies highest${next ? `: compared with the ${rocketLabel(next).toLowerCase()}, ${betterBecause(k, next)}` : ''}.${tail}`;
  }
  const above = order.length ? item.rockets[order[order.length - 1].i] : null;
  return `The ${rocketLabel(k).toLowerCase()} flies least high${above ? `: the ${rocketLabel(above).toLowerCase()} beats it because ${betterBecause(above, k)}` : ''}.`;
}

// ── The spoken key ───────────────────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const optionLabels = (item: RocketItem) => Array.from({ length: optionCount(item) }, (_, i) => optionLabel(item, i));

/** The ways a learner says choice `at`, beside its label. */
function waysToSay(item: RocketItem, at: number): string[] {
  if (item.mode === 'can_it_lift') return at === 0 ? ['yes', 'it lifts off', 'it goes up', 'it flies'] : ['no', 'it stays', 'it stays on the pad', 'it does not lift off'];
  const place = `the ${ORDINAL[at]} one`;
  if (item.mode === 'add_to_lift') {
    const p = item.options[at];
    return p.kind === 'engine' ? [`the ${p.color} engine`, `the ${p.color} one`, `${p.color}`, place] : [`the ${partLabel(p).toLowerCase()}`, place];
  }
  const c = item.rockets[at].color;
  return [`the ${c} rocket`, `the ${c} one`, c, place];
}

/** The key a spoken reply is judged against: the right choice, the ways to say it, and the other choices as wrong. */
export function rocketKey(item: RocketItem): SpokenKey {
  const labels = optionLabels(item), at = keyOf(item);
  const others = labels.filter((_, i) => i !== at).map(l => `"${l}"`);
  return { answer: labels[at], alsoAccept: waysToSay(item, at),
    signatureError: `${others.join(', ')} ${others.length > 1 ? 'are' : 'is'} wrong, and so is naming two choices or hedging between them.` };
}

const MISS_WORDS: Record<RocketMiss, string> = {
  said_lifts: 'says the rocket lifts off',
  said_equal_lifts: 'says the rocket lifts off, though its push is only as big as its weight',
  said_stays: 'says the rocket stays on the pad',
  added_no_push: 'names a part with no engine, which only adds weight',
  heavy_engine: 'names the engine with the biggest push, which adds too much weight of its own',
  too_weak: 'names an engine that does not push enough',
  over_budget: 'names a rocket that lifts off but costs more than the budget',
  no_lift: 'names a rocket within the budget that does not lift off',
  fails_both: 'names a rocket that costs too much and does not lift off',
  picked_no_lift: 'names a rocket that never lifts off',
  picked_lower: 'names a rocket that does not fly as high',
  picked_higher: 'names a rocket that flies higher',
};

/** An item's known wrong spoken answers, most specific first, with the tap's miss ids. */
export function rocketSpokenMisses(item: RocketItem): KnownMiss[] {
  const labels = optionLabels(item), at = keyOf(item);
  const groups = new Map<RocketMiss, string[]>();
  labels.forEach((l, i) => { if (i === at) return; const m = optionMiss(item, i)!; groups.set(m, [...(groups.get(m) ?? []), l]); });
  const out: KnownMiss[] = [];
  for (const m of ROCKET_MISSES[item.mode]) {
    const xs = groups.get(m);
    if (!xs) continue;
    out.push({ id: m, pattern: `The right answer is "${labels[at]}". The learner's answer ${MISS_WORDS[m]}: ${xs.map(x => `"${x}"`).join(', ')}.`, examples: xs });
  }
  return out;
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface RocketView {
  work: RocketWork;
  /** The answer has been credited (or revealed): the launch and the result are on screen. */
  solved: boolean;
  /** add_to_lift: the learner's checked part is on the rocket and its launch is on screen. */
  flown: boolean;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** One part as drawn: its kind and the blocks, arrows and coins beside it. */
function partWords(p: Part, coins: boolean): string {
  const bits = [plural(p.weight, 'weight block')];
  if (p.push) bits.push(plural(p.push, 'push arrow'));
  if (coins && p.cost) bits.push(plural(p.cost, 'coin'));
  return `${p.kind === 'engine' && p.color ? `${p.color} engine` : PART_NAME[p.kind]} (${bits.join(', ')})`;
}
/** A rocket as drawn, from the bottom up. Each part's own numbers only: never a total. */
export function rocketWords(r: Rocket, coins = false): string {
  return `${r.parts.map(p => partWords(p, coins)).join(', ')}${r.staged ? '; it is marked to drop each fuel tank once the tank is empty' : ''}`;
}

export function describeRocketWork(item: RocketItem | undefined, w: RocketWork): string {
  if (!item) return 'Nothing chosen yet';
  if (w.pick === null) return item.mode === 'can_it_lift' ? 'Nothing chosen yet' : 'Nothing picked yet';
  return item.mode === 'can_it_lift' ? `Chose "${optionLabel(item, w.pick)}"` : `Picked the ${optionLabel(item, w.pick).toLowerCase()}`;
}

const CONSTRAINTS = 'No total, sum or comparison of push and weight is drawn.';
/** What launches when (replay 10-16: after a miss the tutor said "the rocket stayed on the pad", the key of a yes-or-no item). */
const LAUNCHES: Record<RocketMode, string> = {
  can_it_lift: 'The rocket launches only once the answer is credited. After a wrong answer nothing has launched: the screen shows no rocket flying or staying down.',
  add_to_lift: 'After any check, the part the learner chose is added and that rocket is started; nothing else launches.',
  on_budget: 'The rockets launch only once the answer is credited. After a wrong answer nothing has launched: the screen shows no rocket flying or staying down.',
  reach_target: 'The rockets launch only once the answer is credited. After a wrong answer nothing has launched: the screen shows no rocket flying or staying down.',
};

/** What is drawn and asked. Never the key; results only after the answer. */
export function workspaceScene(item: RocketItem, view: RocketView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  if (item.mode === 'can_it_lift') {
    facts.shown = `One rocket on the launch pad. Each part shows its weight as grey blocks and each engine its push as orange arrows. From the bottom: ${rocketWords(item.rocket)}.`;
    facts.choices = LIFT_CHOICES.map((c, i) => `${i + 1}) ${LIFT_TEXT[c]}`).join('  ');
    if (view.solved) facts.credited = lifts(item.rocket) ? 'The rocket has launched and flown up.' : 'The rocket was started and stayed on the pad.';
  } else if (item.mode === 'add_to_lift') {
    facts.shown = `A rocket on the launch pad that stays down. Each part shows its weight as grey blocks and each engine its push as orange arrows. From the bottom: ${rocketWords(item.rocket)}.`;
    facts.choices = item.options.map((p, i) => `${i + 1}) ${partWords(p, false)}`).join('  ');
    if (view.flown && view.work.pick !== null && item.options[view.work.pick]) {
      const p = item.options[view.work.pick];
      facts.flight = `The learner's ${partLabel(p).toLowerCase()} was added and the rocket ${lifts(withPart(item.rocket, p)) ? 'lifted off' : 'still stayed on the pad'}.`;
    }
  } else {
    const coins = item.mode === 'on_budget';
    facts.shown = `${item.rockets.length} rockets side by side on launch pads (${item.rockets.map(r => rocketLabel(r).toLowerCase()).join(', ')}). `
      + `Each part shows its weight as grey blocks, each engine its push as orange arrows${coins ? ', and each part its price in coins' : ''}.`;
    // One fact per rocket: each stays under the observer's per-fact cap.
    for (const r of item.rockets) facts[`rocket_${r.color}`] = `${rocketLabel(r)}, from the bottom: ${rocketWords(r, coins)}.`;
    if (view.solved) facts.credited = item.mode === 'reach_target' ? 'All the rockets have launched; the screen shows how high each flew.' : 'All the rockets have launched; the ones that cannot lift off stayed on the pad.';
  }
  facts.learnerWork = describeRocketWork(item, view.work);
  facts.launches = LAUNCHES[item.mode];
  facts.constraints = CONSTRAINTS;
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and the wrong answer showing the mode's first-listed miss it can. */
export function rocketHarnessAnswers(item: RocketItem): { correct: RocketWork; plainWrong: RocketWork } {
  const order = ROCKET_MISSES[item.mode], key = keyOf(item);
  const wrongs = Array.from({ length: optionCount(item) }, (_, i) => i).filter(i => i !== key)
    .sort((a, b) => order.indexOf(optionMiss(item, a)!) - order.indexOf(optionMiss(item, b)!));
  return { correct: { pick: key }, plainWrong: { pick: wrongs[0] } };
}
