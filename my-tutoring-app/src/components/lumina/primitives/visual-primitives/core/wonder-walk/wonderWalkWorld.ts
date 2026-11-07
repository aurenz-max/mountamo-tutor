/**
 * The math world a wonder-walk stop draws, and its pure rules: what a place holds, whether a move goal holds, a
 * sequence of moves that reaches the goal (the journey harness and the author's checks use it). Shared by the
 * component, the workspace module, the boss and the author's checks (`service/core/wonder-walk/world.ts`).
 */
import type { WonderWalkTrap } from './WonderWalk';

export type PlaceKind = 'group' | 'pile' | 'basket' | 'plate' | 'ten-frame' | 'cup';
export type Arrangement = 'line' | 'rows' | 'scattered' | 'ten-frame';
export type CounterColor = 'red' | 'blue' | 'yellow' | 'green';
export type TapRule = 'has' | 'most' | 'fewest' | 'same-as' | 'one-more-than' | 'one-fewer-than';

/** A condition on the final world: the count in some places (filtered by colour or word), at least, a full frame, or only. */
export interface GoalDraft { places: string[]; count?: number; atLeast?: number; full?: boolean; only?: boolean; color?: CounterColor; word?: string }

export interface WorldPlace { id: string; kind: PlaceKind; color?: CounterColor; arrangement: Arrangement; choosable: boolean; droppable: boolean }
export interface WorldObject {
  id: string; word: string; emoji: string; color?: CounterColor;
  /** Where it starts (after the story's events are shown). */
  place: string;
  /** join: arrived in the story; leave: left in the story (drawn as a ghost, never counted or moved). */
  event?: 'join' | 'leave';
  /** scattered places: its centre as fractions of the place box. */
  position?: [number, number];
}
export type WorldAnswer =
  | { kind: 'tap'; rule: TapRule; number?: number; ref?: string; traps: Record<string, WonderWalkTrap | null> }
  | { kind: 'number'; countPlaces: string[]; countColor?: CounterColor; countWord?: string; choices: number[]; answer: number }
  | { kind: 'move'; goal: GoalDraft[] };
export interface World { places: WorldPlace[]; objects: WorldObject[]; answer: WorldAnswer }

type Located = { place: string; event?: string; word: string; color?: CounterColor };

const fits = (o: { word: string; color?: CounterColor }, f: { color?: CounterColor; word?: string }) =>
  (!f.color || o.color === f.color) && (!f.word || o.word === f.word || o.word === f.word.replace(/e?s$/, ''));

/** How many are in the places now (leavers gone), optionally filtered. */
export const countIn = (items: Located[], places: string[], f: { color?: CounterColor; word?: string } = {}) =>
  items.filter(o => places.includes(o.place) && o.event !== 'leave' && fits(o, f)).length;

/** Which goal fails first, or null when every condition holds. */
export function goalFailure(goal: GoalDraft[], items: Located[], kindOf: (id: string) => PlaceKind | undefined): { g: GoalDraft; n: number } | null {
  for (const g of goal) {
    const f = { color: g.color, word: g.word };
    const n = countIn(items, g.places, g.only ? {} : f);
    const fail =
      (g.only && (n === 0 || items.some(o => g.places.includes(o.place) && o.event !== 'leave' && !fits(o, f))))
      || (g.count !== undefined && n !== g.count)
      || (g.atLeast !== undefined && n < g.atLeast)
      || (g.full && (() => { const frames = g.places.filter(p => kindOf(p) === 'ten-frame'); const c = countIn(items, frames); return !frames.length || c === 0 || c % 10 !== 0; })());
    if (fail) return { g, n };
  }
  return null;
}

export const goalHolds = (goal: GoalDraft[], items: Located[], kindOf: (id: string) => PlaceKind | undefined) => goalFailure(goal, items, kindOf) === null;

/** Places an object can be moved to from where it is now. */
export const targetsFor = (world: World, at: string) => world.places.filter(p => p.droppable && p.id !== at).map(p => p.id);

/**
 * A sequence of single moves that reaches a move goal from the start, or null. Greedy, in the order a child would:
 * fill "only" places with what belongs, then single-place counts and "at least", then sums across places, then a full
 * frame. Used by the author's checks (a goal no sequence reaches is blocked) and by the journey harness.
 */
export function solveMove(world: World): Array<{ object: string; to: string }> | null {
  if (world.answer.kind !== 'move') return null;
  const goal = world.answer.goal;
  const kindOf = (id: string) => world.places.find(p => p.id === id)?.kind;
  const at = new Map(world.objects.map(o => [o.id, o.place]));
  const state = () => world.objects.map(o => ({ ...o, place: at.get(o.id)! }));
  const moves: Array<{ object: string; to: string }> = [];
  const goalPlaces = new Set(goal.flatMap(g => g.places));
  const free = (f: { color?: CounterColor; word?: string }, exclude: string[]) =>
    world.objects.filter(o => o.event !== 'leave' && !exclude.includes(at.get(o.id)!) && !goalPlaces.has(at.get(o.id)!) && fits(o, f));
  const move = (id: string, to: string) => { moves.push({ object: id, to }); at.set(id, to); };
  const order = (g: GoalDraft) => (g.only ? 0 : g.places.length === 1 && (g.count !== undefined || g.atLeast !== undefined) ? 1 : g.places.length > 1 ? 2 : 3);
  for (const g of [...goal].sort((a, b) => order(a) - order(b))) {
    const f = { color: g.color, word: g.word };
    const target = g.places[0];
    const have = () => countIn(state(), g.places, g.only ? {} : f);
    if (g.only) {
      // Take out what does not belong, then bring what does (all of it, unless a count says how many).
      for (const o of world.objects) if (g.places.includes(at.get(o.id)!) && o.event !== 'leave' && !fits(o, f)) {
        const back = world.objects.find(x => x.id === o.id)!.place;
        move(o.id, g.places.includes(back) ? world.places.find(p => p.droppable && !g.places.includes(p.id))?.id ?? back : back);
      }
      const want = g.count ?? free(f, g.places).length + have();
      for (const o of free(f, g.places)) { if (have() >= want) break; move(o.id, target); }
      continue;
    }
    const want = g.count ?? g.atLeast ?? (g.full ? Math.ceil(Math.max(1, countIn(state(), g.places)) / 10) * 10 : 0);
    for (const o of free(f, g.places)) {
      if (have() >= want) break;
      // A sum across places: top up any place another goal still needs first, else the first place.
      const needy = g.places.find(p => goal.some(h => h !== g && h.places.length === 1 && h.places[0] === p && h.atLeast !== undefined && countIn(state(), [p]) < h.atLeast));
      move(o.id, needy ?? target);
    }
  }
  return goalHolds(goal, state(), kindOf) ? moves : null;
}

/** The harness's taps for one move: the object, then the place when there is more than one place it could go. */
export function moveTaps(world: World, plan: Array<{ object: string; to: string }>): string[] {
  const at = new Map(world.objects.map(o => [o.id, o.place]));
  return plan.flatMap(m => {
    const many = targetsFor(world, at.get(m.object)!).length > 1;
    at.set(m.object, m.to);
    return many ? [`obj-${m.object}`, `place-${m.to}`] : [`obj-${m.object}`];
  });
}
