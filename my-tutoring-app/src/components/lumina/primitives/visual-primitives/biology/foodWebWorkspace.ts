/**
 * Food web builder on the shared tutor/JEV teaching workspace (W1 minimal binding, plain shape) and its open build
 * `build_chain` ("Make a food chain with 4 living things that ends at the Hawk"; /add-eval-modes references/build-mode.md).
 *
 * Pure: the component, the generator, the journey row, the oracle probe and the tests read the same graph, check,
 * misses, assignment and scene. Every arrow is judged against the lesson's own feeding relations
 * (`correctConnections`, prey → eater), so code owns the target and the check; the model only writes the ecology.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { Connection, FoodWebChallenge, FoodWebChallengeType, Organism } from './FoodWebBuilder';

/** An arrow the learner drew: from the food to the eater when it is right. */
export interface Arrow { fromId: string; toId: string }

const key = (a: Arrow) => `${a.fromId}>${a.toId}`;
export const feeds = (connections: readonly Connection[], fromId: string, toId: string) =>
  connections.some(c => c.fromId === fromId && c.toId === toId);

// ── The ecology, cleaned by code ─────────────────────────────────────────────

/**
 * The feeding relations a chain may use: known organisms, no self-arrows or duplicates, nothing eats a producer, and
 * a decomposer feeds nothing but another decomposer. The model writes the ecology; code refuses what cannot be food.
 */
export function feedingRelations(organisms: readonly Organism[], connections: readonly Connection[]): Connection[] {
  const level = new Map(organisms.map(o => [o.id, o.trophicLevel]));
  const seen = new Set<string>();
  return connections.filter(c => {
    const from = level.get(c.fromId), to = level.get(c.toId);
    if (!from || !to || c.fromId === c.toId || to === 'producer') return false;
    if (from === 'decomposer' && to !== 'decomposer') return false;
    const k = key(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Every food chain the lesson's data allows: simple paths from a producer along feeding arrows, up to `maxLength` living things. */
export function feedingChains(organisms: readonly Organism[], connections: readonly Connection[], maxLength = 6): string[][] {
  const out: string[][] = [];
  const eaters = new Map<string, string[]>();
  for (const c of connections) eaters.set(c.fromId, [...(eaters.get(c.fromId) ?? []), c.toId]);
  const walk = (path: string[]) => {
    if (path.length >= 2) out.push(path);
    if (path.length >= maxLength) return;
    for (const next of eaters.get(path[path.length - 1]) ?? []) if (!path.includes(next)) walk([...path, next]);
  };
  organisms.filter(o => o.trophicLevel === 'producer').forEach(o => walk([o.id]));
  return out;
}

// ── The learner's build ──────────────────────────────────────────────────────

export interface ChainShape {
  placed: number;
  arrows: number;
  /** The one line of arrows, start to end, when the build is exactly one chain through every living thing placed. */
  path: string[] | null;
  /** Living things on the longest line of arrows the learner drew (0 with no arrow). */
  longest: number;
}

export function chainShape(placed: readonly string[], arrows: readonly Arrow[]): ChainShape {
  const out = new Map<string, string[]>(), into = new Map<string, number>();
  for (const a of arrows) { out.set(a.fromId, [...(out.get(a.fromId) ?? []), a.toId]); into.set(a.toId, (into.get(a.toId) ?? 0) + 1); }
  let longest = 0;
  const walk = (at: string, seen: Set<string>) => {
    longest = Math.max(longest, seen.size);
    for (const next of out.get(at) ?? []) if (!seen.has(next)) { seen.add(next); walk(next, seen); seen.delete(next); }
  };
  if (arrows.length) for (const start of Array.from(new Set(arrows.map(a => a.fromId)))) walk(start, new Set([start]));
  let path: string[] | null = null;
  const starts = placed.filter(id => !into.get(id));
  const single = arrows.length === placed.length - 1 && placed.length >= 2
    && arrows.every(a => placed.includes(a.fromId) && placed.includes(a.toId))
    && placed.every(id => (out.get(id)?.length ?? 0) <= 1 && (into.get(id) ?? 0) <= 1);
  if (single && starts.length === 1) {
    const line = [starts[0]];
    while (out.get(line[line.length - 1])?.[0] && !line.includes(out.get(line[line.length - 1])![0])) line.push(out.get(line[line.length - 1])![0]);
    if (line.length === placed.length) path = line;
  }
  return { placed: placed.length, arrows: arrows.length, path, longest };
}

/**
 * What a wrong chain shows (`TeachingAttempt.miss`), most specific first:
 * - `arrow_backwards`: an arrow points from the eater to its food (the reverse is a real feeding relation);
 * - `not_a_feeding_pair`: an arrow joins two living things where neither eats the other;
 * - `broken_chain`: the arrows are not one line through every living thing placed (a gap, a branch, one left out);
 * - `wrong_end`: one right chain, but it does not end at the living thing asked for;
 * - `no_producer`: it ends right, but does not start with a living thing that makes its own food;
 * - `too_short` / `too_long`: a right chain to the right end with fewer or more living things than asked.
 */
export type FoodChainMiss = 'arrow_backwards' | 'not_a_feeding_pair' | 'broken_chain' | 'wrong_end' | 'no_producer' | 'too_short' | 'too_long';
export const FOOD_CHAIN_MISSES: readonly FoodChainMiss[] = ['arrow_backwards', 'not_a_feeding_pair', 'broken_chain', 'wrong_end', 'no_producer', 'too_short', 'too_long'];

export function foodChainMiss(
  target: { length: number; endId: string }, organisms: readonly Organism[], connections: readonly Connection[],
  placed: readonly string[], arrows: readonly Arrow[],
): FoodChainMiss | undefined {
  const wrong = arrows.filter(a => !feeds(connections, a.fromId, a.toId));
  if (wrong.some(a => feeds(connections, a.toId, a.fromId))) return 'arrow_backwards';
  if (wrong.length) return 'not_a_feeding_pair';
  const { path } = chainShape(placed, arrows);
  if (!path) return 'broken_chain';
  if (path[path.length - 1] !== target.endId) return 'wrong_end';
  if (organisms.find(o => o.id === path[0])?.trophicLevel !== 'producer') return 'no_producer';
  if (path.length < target.length) return 'too_short';
  if (path.length > target.length) return 'too_long';
  return undefined;
}

/**
 * The whole-web check (`complete_web`, the primitive's original task), as the legacy component judged it: every
 * feeding relation drawn and no other arrow. Misses: `backwards_arrows` (an arrow is a real relation turned round),
 * `wrong_arrows` (an arrow between living things that do not feed each other), `missing_arrows`.
 */
export type FoodWebMiss = 'backwards_arrows' | 'wrong_arrows' | 'missing_arrows';
export const FOOD_WEB_MISSES: readonly FoodWebMiss[] = ['backwards_arrows', 'wrong_arrows', 'missing_arrows'];

export function foodWebMiss(connections: readonly Connection[], arrows: readonly Arrow[]): FoodWebMiss | undefined {
  const wrong = arrows.filter(a => !feeds(connections, a.fromId, a.toId));
  if (wrong.some(a => feeds(connections, a.toId, a.fromId))) return 'backwards_arrows';
  if (wrong.length) return 'wrong_arrows';
  if (connections.some(c => !arrows.some(a => a.fromId === c.fromId && a.toId === c.toId))) return 'missing_arrows';
  return undefined;
}

// ── Targets, written by code ─────────────────────────────────────────────────

/** The ask states the target: how many living things, and which one the chain ends at. It is the task, not a leak. */
export const chainAsk = (length: number, endName: string) => `Make a food chain with ${length} living things that ends at the ${endName}.`;

/** Chain lengths a grade band builds, shorter first. */
export const CHAIN_LENGTHS: Record<'3-5' | '6-8', readonly number[]> = { '3-5': [3, 4], '6-8': [4, 5] };

/**
 * The session's targets: distinct (end, length) pairs the lesson's own feeding relations can make, preferring
 * pairs that more than one chain makes (many builds pass) and different ends, shorter chains first.
 */
export function pickChainTargets(
  organisms: readonly Organism[], connections: readonly Connection[], gradeBand: '3-5' | '6-8', count = 3,
  random: () => number = Math.random,
): FoodWebChallenge[] {
  const lengths = CHAIN_LENGTHS[gradeBand] ?? CHAIN_LENGTHS['3-5'];
  const level = new Map(organisms.map(o => [o.id, o.trophicLevel]));
  const byTarget = new Map<string, { endId: string; length: number; ways: number }>();
  // A shallow web makes few chains of the band's lengths: a chain of 3 fills in after them (below).
  for (const chain of feedingChains(organisms, connections, Math.max(...lengths))) {
    const endId = chain[chain.length - 1];
    if ((!lengths.includes(chain.length) && chain.length !== 3) || level.get(endId) === 'decomposer') continue;
    const k = `${endId}|${chain.length}`;
    const t = byTarget.get(k) ?? { endId, length: chain.length, ways: 0 };
    t.ways++;
    byTarget.set(k, t);
  }
  const pool = Array.from(byTarget.values()).map(t => ({ ...t, r: random() }))
    .sort((a, b) => Number(b.ways > 1) - Number(a.ways > 1) || a.r - b.r);
  const picked: typeof pool = [];
  const take = (ok: (t: (typeof pool)[number]) => boolean) => {
    const t = pool.find(x => !picked.includes(x) && ok(x));
    if (t) picked.push(t);
    return !!t;
  };
  // Round-robin the lengths with a new end each time (every length at least once, even at an end already asked);
  // then any new end; then anything left.
  for (let i = 0; picked.length < count && i < count * 2; i++) {
    const length = lengths[i % lengths.length];
    if (!take(t => t.length === length && !picked.some(p => p.endId === t.endId)) && !picked.some(p => p.length === length)) {
      take(t => t.length === length);
    }
  }
  const inBand = (t: (typeof pool)[number]) => lengths.includes(t.length);
  while (picked.length < count && take(t => inBand(t) && !picked.some(p => p.endId === t.endId)));
  while (picked.length < count && take(inBand));
  while (picked.length < count && take(t => !picked.some(p => p.endId === t.endId)));
  while (picked.length < count && take(() => true));
  const name = (id: string) => organisms.find(o => o.id === id)?.name ?? id;
  return picked.sort((a, b) => a.length - b.length)
    .map((t, i) => ({ id: `chain-${i + 1}`, type: 'build_chain' as const, length: t.length, endId: t.endId, instruction: chainAsk(t.length, name(t.endId)) }));
}

// ── Assignment, work, scene ──────────────────────────────────────────────────

/** What the component reads off the screen for the check, the description and the scene. */
export interface FoodWebView {
  mode: FoodWebChallengeType;
  ecosystem: string;
  organisms: readonly Organism[];
  /** build_chain: the living things the learner put in the scene, in the order they were put in. complete_web: all of them. */
  placed: readonly string[];
  arrows: readonly Arrow[];
}

/** The legacy whole-web task. */
export const webAsk = (ecosystem: string) => `Draw an arrow for every feeding relationship to build the whole ${ecosystem} food web.`;

/** The smaller web a simplify lever opens: the same task on the living things shown. */
export const smallerWebAsk = (count: number) => `Draw an arrow for every feeding relationship among these ${count} living things.`;

export function workspaceAssignment(challenge: FoodWebChallenge, ecosystem: string): TeachingAssignment {
  const task = challenge.type === 'build_chain' ? challenge.instruction
    : challenge.only ? smallerWebAsk(challenge.only.length) : webAsk(ecosystem);
  return { id: challenge.id, task, response: 'gesture' };
}

const nameOf = (view: FoodWebView, id: string) => view.organisms.find(o => o.id === id)?.name ?? id;
const arrowWords = (view: FoodWebView) => view.arrows.map(a => `${nameOf(view, a.fromId)} → ${nameOf(view, a.toId)}`).join(', ');

/** The learner's work in their own terms, never the key or a verdict. */
export function describeFoodWebWork(view: FoodWebView): string {
  if (view.mode === 'complete_web') return view.arrows.length ? `Drew ${view.arrows.length} arrows: ${arrowWords(view)}` : 'No arrows drawn yet';
  if (!view.placed.length) return 'Nothing in the scene yet';
  const placed = `Put in ${view.placed.map(id => nameOf(view, id)).join(', ')}`;
  return view.arrows.length ? `${placed}. Arrows: ${arrowWords(view)}` : `${placed}. No arrows yet`;
}

/** What is drawn and asked. No feeding relation, trophic level (on build) or chain is published. */
export function workspaceScene(challenge: FoodWebChallenge, view: FoodWebView): WorkspaceScene {
  if (challenge.type === 'build_chain') {
    const s = chainShape(view.placed, view.arrows);
    return { objects: [], facts: {
      kind: 'build_chain', ecosystem: view.ecosystem,
      livingThingsListed: [...view.organisms].map(o => o.name).sort().join(', '),
      scene: 'an empty scene; the learner taps a living thing in the list to put it in (again to take it out), then taps one '
        + 'living thing in the scene and then another to draw an arrow from the first to the second; tapping an arrow removes it',
      // The made chain as numbers, so the shared work history records a revision (`chainLength 0 → 4 → 3`).
      livingThingsPlaced: s.placed, arrowsDrawn: s.arrows, chainLength: s.longest,
      learnerWork: describeFoodWebWork(view),
      constraints: 'The learner builds the chain and presses "I\'m done!"; the activity checks every arrow against the '
        + 'lesson\'s feeding relations. You cannot tap, place or draw for the learner.',
    } };
  }
  return { objects: [], facts: {
    kind: 'complete_web', ecosystem: view.ecosystem,
    livingThings: view.organisms.map(o => `${o.name} (${o.trophicLevel.replace('-', ' ')})`).join(', '),
    arrowsDrawn: view.arrows.length,
    learnerWork: describeFoodWebWork(view),
    constraints: 'The learner taps one living thing and then another to draw an arrow and presses Check; the activity checks '
      + 'the web itself. You cannot tap or draw for the learner.',
  } };
}

// ── The build watcher's leak rules ───────────────────────────────────────────

/** Words that would judge an arrow or name the way food goes. */
const WATCH_NEVER_SAY = ['eat', 'eaten', 'eating', 'eater', 'food', 'energy', 'prey', 'predator', 'hunt', 'hunting', 'chain', 'link',
  'point', 'pointing', 'toward', 'towards', 'backward', 'backwards', 'direction', 'wrong', 'correct'];

/**
 * What the build watcher may never say on a food chain (`useBuildWatcher` `neverSay`, filtered in code by
 * `keepWatchLine`): any word that judges an arrow or names the way food goes, and the name of every living thing not
 * yet in the scene, which would hand over a missing link.
 */
export const watchNeverSay = (organisms: readonly Organism[], placed: readonly string[]) =>
  [...WATCH_NEVER_SAY, ...organisms.filter(o => !placed.includes(o.id)).map(o => o.name)];

// ── The journey's learner (liveJourneySpec row, the dry sweep, the browser drive) ──

export type FoodWebHarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string } | { type: 'check' };

/**
 * Real-control inputs for one item. build_chain: clear a kept scene, put in the living things of the first chain the
 * lesson's relations make to the asked end and length, draw its arrows (wrong: every arrow turned round, the classic
 * "eats" arrow, `arrow_backwards`), press I'm done!. complete_web: tap each feeding relation's food then eater (wrong:
 * the first one turned round, `backwards_arrows`; tapping it the right way later turns it back), then Check.
 */
export function foodWebHarnessInputs(data: { organisms: Organism[]; correctConnections: Connection[] },
  challenge: FoodWebChallenge, wrong: boolean, demand?: Record<string, unknown> | null): FoodWebHarnessInput[] {
  const touch = (target: string): FoodWebHarnessInput => ({ type: 'touch', target });
  if (challenge.type === 'complete_web') {
    // A smaller web (simplify practice) asks only the relations among its living things.
    const only = challenge.only;
    const web = only ? data.correctConnections.filter(c => only.includes(c.fromId) && only.includes(c.toId)) : data.correctConnections;
    return [...web.flatMap((c, i) => (wrong && i === 0 ? [touch(`web-${c.toId}`), touch(`web-${c.fromId}`)]
      : [touch(`web-${c.fromId}`), touch(`web-${c.toId}`)])), { type: 'check' }];
  }
  const relations = feedingRelations(data.organisms, data.correctConnections);
  const chain = feedingChains(data.organisms, relations, challenge.length)
    .find(p => p.length === challenge.length && p[p.length - 1] === challenge.endId);
  if (!chain) throw new Error(`food-web-builder build_chain: no chain of ${challenge.length} ends at ${challenge.endId}`);
  const clear: FoodWebHarnessInput[] = Number(demand?.livingThingsPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear the scene' }] : [];
  const links = chain.slice(1).flatMap((to, i) => (wrong ? [touch(`scene-${to}`), touch(`scene-${chain[i]}`)]
    : [touch(`scene-${chain[i]}`), touch(`scene-${to}`)]));
  return [...clear, ...chain.map(id => touch(`list-${id}`)), ...links, { type: 'choose', label: "I'm done!" }];
}
