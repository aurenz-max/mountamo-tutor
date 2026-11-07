/**
 * Wonder Walk math world (agent-primitive invariants, `.claude/skills/agent-primitive/SKILL.md`).
 *
 * The author does not pick a task from a list. It describes a small world and a goal:
 * - places: a group, a pile, a basket, plates (a colour rim for sorting), a ten-frame (two frames past 10), a cup that
 *   hides what is under it;
 * - what is in each place: picture words, counts, an optional colour (a counter disc behind the picture);
 * - events the tutor tells and the screen shows: some join a place, some leave it;
 * - the answer: tap a place (by a rule: has N, the most, the fewest, the same as / one more / one fewer than another
 *   place), tap a number, or move objects until a goal holds (counts, sums of places, a full frame, only red ones).
 *
 * Code derives the key from the world (the author never says what is right), names the eval mode and standards from
 * the structure, blocks shortcuts a child could use instead of the skill, and scores difficulty from the structure.
 * The old tasks are worlds: find-number = tap "has N"; compare = tap "most"; count-out = move "basket has N".
 *
 * Standards the world can build (K math, counting and operations; shapes and measuring are other primitives):
 * K.CC.A.2 count on (cup), K.CC.A.3 numerals (number answers), K.CC.B.4a-c, K.CC.B.5, K.CC.C.6-7, K.OA.A.1-2 (join,
 * leave), K.OA.A.3 (decompose onto two plates), K.OA.A.4 (fill the frame to 10), K.OA.A.5 (within 5), K.NBT.A.1 (teens on
 * two frames), K.MD.B.3 (sort by colour or kind, then count).
 */
import type { WonderWalkStopType, WonderWalkTrap } from '../../../primitives/visual-primitives/core/wonder-walk/WonderWalk';
import { countIn, goalHolds, solveMove, type Arrangement, type CounterColor, type GoalDraft, type PlaceKind, type TapRule, type World, type WorldAnswer, type WorldObject, type WorldPlace } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWorld';

export type { Arrangement, CounterColor, GoalDraft, PlaceKind, TapRule, World } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWorld';
import { saysNumber } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalk.boss';
import { pictureOf } from './pictures';

export type SupportTier = 'easy' | 'medium' | 'hard';

export const PLACE_KINDS: PlaceKind[] = ['group', 'pile', 'basket', 'plate', 'ten-frame', 'cup'];
export const ARRANGEMENTS: Arrangement[] = ['line', 'rows', 'scattered', 'ten-frame'];
export const COLORS: CounterColor[] = ['red', 'blue', 'yellow', 'green'];
export const TAP_RULES: TapRule[] = ['has', 'most', 'fewest', 'same-as', 'one-more-than', 'one-fewer-than'];

/** The largest count each arrangement can draw (K.CC.B.5: scattered up to 10; a line fits 10; two frames hold 20). */
export const ARRANGEMENT_MAX: Record<Arrangement, number> = { line: 10, rows: 20, scattered: 10, 'ten-frame': 20 };

// ── What the author writes ───────────────────────────────────────────

export interface Contents { word: string; count: number; color?: CounterColor }
export interface PlaceDraft { id: string; kind: PlaceKind; color?: CounterColor; arrangement: Arrangement; contents: Contents[] }
export interface EventDraft { kind: 'join' | 'leave'; place: string; word: string; count: number; color?: CounterColor }
export interface AnswerDraft {
  kind: 'tap' | 'number' | 'move';
  /** tap: the rule, its number (has) or reference place (same-as, one-more-than, one-fewer-than), and the places to choose among. */
  rule?: TapRule; number?: number; ref?: string; among?: string[];
  /** number: which places to count after the events, optionally only one colour or word. */
  countPlaces?: string[]; countColor?: CounterColor; countWord?: string;
  /** move: every condition must hold when the child taps Done. */
  goal?: GoalDraft[];
}
export interface WorldDraft { places: PlaceDraft[]; events: EventDraft[]; answer: AnswerDraft }

// ── Reading a world ──────────────────────────────────────────────────

const matches = (o: { word: string; color?: CounterColor }, f: { color?: CounterColor; word?: string }) =>
  (!f.color || o.color === f.color) && (!f.word || pictureOf(f.word)?.word === o.word || o.word === f.word);
void ({} as WorldObject | WorldPlace);

interface Item { word: string; color?: CounterColor; place: string; event?: 'join' | 'leave' }

/** Every object the draft describes, after its events (leavers kept and marked). */
function itemsOf(w: WorldDraft): Item[] {
  const items: Item[] = [];
  for (const p of w.places) for (const c of p.contents) for (let k = 0; k < c.count; k++) items.push({ word: pictureOf(c.word)?.word ?? c.word, color: c.color, place: p.id });
  for (const e of w.events) {
    const word = pictureOf(e.word)?.word ?? e.word;
    if (e.kind === 'join') for (let k = 0; k < e.count; k++) items.push({ word, color: e.color, place: e.place, event: 'join' });
    else {
      let left = e.count;
      for (let i = items.length - 1; i >= 0 && left > 0; i--)
        if (items[i].place === e.place && !items[i].event && items[i].word === word && (!e.color || items[i].color === e.color)) { items[i] = { ...items[i], event: 'leave' }; left--; }
    }
  }
  return items;
}

// ── Key ──────────────────────────────────────────────────────────────

export type WorldKey = { place: string } | { number: number } | { goal: true };

const STEP: Partial<Record<TapRule, number>> = { 'same-as': 0, 'one-more-than': 1, 'one-fewer-than': -1 };

export function amongOf(w: WorldDraft): string[] {
  const a = w.answer;
  if (a.among?.length) return a.among;
  return w.places.filter(p => p.id !== a.ref && p.kind !== 'cup').map(p => p.id);
}

export function worldKey(w: WorldDraft): WorldKey | { error: string } {
  const items = itemsOf(w);
  const a = w.answer;
  if (a.kind === 'tap') {
    const among = amongOf(w);
    if (among.length < 2 || among.length > 3) return { error: `a tap answer chooses among 2-3 places, not ${among.length}` };
    const counts = among.map(p => countIn(items, [p]));
    let want: number | undefined;
    if (a.rule === 'has') want = a.number;
    else if (a.rule === 'most') want = Math.max(...counts);
    else if (a.rule === 'fewest') want = Math.min(...counts);
    else if (a.rule && STEP[a.rule] !== undefined) {
      if (!a.ref || !w.places.some(p => p.id === a.ref)) return { error: `${a.rule} needs ref: the place to compare with` };
      want = countIn(items, [a.ref]) + STEP[a.rule]!;
    } else return { error: 'a tap answer needs a rule: has, most, fewest, same-as, one-more-than or one-fewer-than' };
    const at = among.filter((_, i) => counts[i] === want);
    if (at.length !== 1) return { error: at.length ? `${at.length} places have ${want}; exactly one may` : `no place has ${want}` };
    return { place: at[0] };
  }
  if (a.kind === 'number') {
    if (!a.countPlaces?.length) return { error: 'a number answer needs countPlaces: the places to count' };
    return { number: countIn(items, a.countPlaces, { color: a.countColor, word: a.countWord }) };
  }
  if (a.kind === 'move') {
    if (!a.goal?.length) return { error: 'a move answer needs a goal' };
    return { goal: true };
  }
  return { error: 'answer.kind is tap, number or move' };
}

// ── Mode and standards, from the structure ───────────────────────────

/** The eval mode a world is, read from what it holds (precedence: the most specific skill wins). */
export function modeOf(w: WorldDraft): WonderWalkStopType {
  const items = itemsOf(w);
  const a = w.answer;
  if (w.places.some(p => p.kind === 'cup')) return 'count-on';
  if (w.events.length) return 'add-take';
  const framed = w.places.filter(p => p.arrangement === 'ten-frame' || p.kind === 'ten-frame').map(p => p.id);
  const goalCounts = (a.goal ?? []).flatMap(g => [g.count ?? 0]);
  if (framed.length && (countIn(items, framed) > 10 || goalCounts.some(n => n > 10) || (a.kind === 'number' && (a.countPlaces ?? []).some(p => framed.includes(p)) && countIn(items, a.countPlaces!) > 10))) return 'teens';
  if ((a.goal ?? []).some(g => g.only || g.color || g.word) || a.countColor || a.countWord) return 'sort-count';
  if (a.kind === 'move' && (a.goal ?? []).some(g => g.places.length > 1 || g.full)) return 'parts';
  if (a.kind === 'move') return 'count-out';
  if (a.kind === 'tap' && a.rule !== 'has') return 'more-fewer';
  return 'how-many';
}

export const MATH_MODES: WonderWalkStopType[] = ['how-many', 'more-fewer', 'count-out', 'add-take', 'parts', 'teens', 'sort-count', 'count-on'];

export const STANDARDS: Record<string, string> = {
  'how-many': 'K.CC.B.4-5', 'more-fewer': 'K.CC.B.4c, K.CC.C.6', 'count-out': 'K.CC.B.4a, K.CC.B.5', 'add-take': 'K.OA.A.1-2',
  parts: 'K.OA.A.3-4', teens: 'K.NBT.A.1', 'sort-count': 'K.MD.B.3', 'count-on': 'K.CC.A.2',
};

// ── Checks (structure and shortcuts; the spoken words are checked in checks.ts) ──

export interface WorldContext { max: number; ask: string; why: string; narration: string; openModes: WonderWalkStopType[] }

const MORE = /\b(more|most)\b/i;
const FEWER = /\b(fewer|fewest|less|least)\b/i;
const extent = (count: number, arrangement: Arrangement) => (arrangement === 'line' ? count : arrangement === 'rows' ? Math.min(5, count) : arrangement === 'ten-frame' ? 5 : 4);

export function worldChecks(w: WorldDraft, ctx: WorldContext): { blocking: string[]; advisory: string[]; key?: WorldKey; mode?: WonderWalkStopType } {
  const blocking: string[] = [];
  const advisory: string[] = [];
  const ids = new Set<string>();
  if (w.places.length < 1 || w.places.length > 4) blocking.push(`a world has 1-4 places, not ${w.places.length}`);
  for (const p of w.places) {
    if (!p.id || ids.has(p.id)) blocking.push(`place ids must be distinct and set ("${p.id}")`);
    ids.add(p.id);
    if (!PLACE_KINDS.includes(p.kind)) blocking.push(`place ${p.id}: kind must be one of ${PLACE_KINDS.join(', ')}`);
    if (!ARRANGEMENTS.includes(p.arrangement)) blocking.push(`place ${p.id}: arrangement must be one of ${ARRANGEMENTS.join(', ')}`);
    for (const c of p.contents) {
      if (!pictureOf(c.word)) blocking.push(`place ${p.id}: no picture for "${c.word}"; pick a word from the picture list`);
      if (!(Number.isInteger(c.count) && c.count >= 0)) blocking.push(`place ${p.id}: count ${c.count} is not a whole number`);
      if (c.color && !COLORS.includes(c.color)) blocking.push(`place ${p.id}: colour must be ${COLORS.join(', ')}`);
    }
  }
  for (const e of w.events) {
    if (!ids.has(e.place)) blocking.push(`event: no place "${e.place}"`);
    if (!pictureOf(e.word)) blocking.push(`event: no picture for "${e.word}"`);
    if (!(Number.isInteger(e.count) && e.count >= 1 && e.count <= 5)) blocking.push('an event moves 1-5 things');
  }
  if (w.events.length > 2) blocking.push('at most 2 events per stop: the child must hold the story');
  const a = w.answer;
  for (const id of [...(a.among ?? []), ...(a.ref ? [a.ref] : []), ...(a.countPlaces ?? []), ...(a.goal ?? []).flatMap(g => g.places)])
    if (!ids.has(id)) blocking.push(`answer names place "${id}", which is not in the world`);
  if (blocking.length) return { blocking, advisory };

  const items = itemsOf(w);
  const placeOf = (id: string) => w.places.find(p => p.id === id)!;
  const now = (id: string) => countIn(items, [id]);
  for (const p of w.places) {
    const n = items.filter(o => o.place === p.id).length;
    if (n > ctx.max && p.kind !== 'pile') blocking.push(`place ${p.id} holds ${n}; this lesson counts to ${ctx.max}`);
    if (n > ARRANGEMENT_MAX[p.arrangement]) blocking.push(`place ${p.id}: ${p.arrangement} draws at most ${ARRANGEMENT_MAX[p.arrangement]}`);
    if (n > 20) blocking.push(`place ${p.id} holds ${n}; at most 20`);
  }
  if (w.events.some(e => e.kind === 'leave') && items.filter(o => o.event === 'leave').length < w.events.filter(e => e.kind === 'leave').reduce((s, e) => s + e.count, 0))
    blocking.push('a leave event takes more than the place holds of that thing');

  const key = worldKey(w);
  if ('error' in key) { blocking.push(key.error); return { blocking, advisory }; }
  const mode = modeOf(w);
  if (!ctx.openModes.includes(mode)) blocking.push(`this world is a ${mode} stop (${STANDARDS[mode]}), which is not open in this walk (open: ${ctx.openModes.join(', ')})`);

  const numbersSaid = (text: string, ns: number[]) => Array.from(new Set(ns)).filter(n => saysNumber(text, n));
  const said = `${ctx.ask} ${ctx.why}`;

  if (a.kind === 'tap') {
    const among = amongOf(w);
    const counts = among.map(now);
    const right = (key as { place: string }).place;
    const rc = now(right);
    if (new Set(counts).size < counts.length) blocking.push('two places to choose from hold the same count');
    if (a.rule === 'has') {
      if (!(Number.isInteger(a.number) && a.number! >= 1)) blocking.push('rule "has" needs number');
      else if (!saysNumber(ctx.ask, a.number!)) blocking.push(`the ask must say the number ${a.number}`);
      const other = numbersSaid(ctx.ask, counts).filter(n => n !== a.number);
      if (other.length) blocking.push(`the ask says ${other.join(', ')} too; say only ${a.number}`);
      if (w.places.some(p => !among.includes(p.id) && now(p.id) === a.number)) blocking.push(`a place the child does not choose shows ${a.number}, the answer: show a different number there`);
    } else {
      const leak = numbersSaid(said, counts);
      if (leak.length) blocking.push(`the ask or why-card says how many a place has (${leak.join(', ')}); the child finds it by counting`);
      if (a.rule === 'most' && (!MORE.test(ctx.ask) || FEWER.test(ctx.ask))) blocking.push('rule "most" asks for more or the most, and not fewer');
      if (a.rule === 'fewest' && (!FEWER.test(ctx.ask) || MORE.test(ctx.ask))) blocking.push('rule "fewest" asks for fewer or the fewest, and not more');
      if ((a.rule === 'most' || a.rule === 'fewest') && among.length === 3 && !/\b(most|fewest|least)\b/i.test(ctx.ask)) blocking.push(`three places: ask which has the ${a.rule === 'most' ? 'most' : 'fewest'}`);
      if (a.rule === 'same-as' && !/\b(same|as many)\b/i.test(ctx.ask)) blocking.push('rule "same-as": the ask says "the same" or "as many"');
      if (a.rule === 'one-more-than' && !/\bone more\b/i.test(ctx.ask)) blocking.push('rule "one-more-than": the ask says "one more"');
      if (a.rule === 'one-fewer-than' && !/\bone (fewer|less)\b/i.test(ctx.ask)) blocking.push('rule "one-fewer-than": the ask says "one fewer"');
    }
    // Shortcuts: get it right without counting.
    const wrong = among.filter(p => p !== right);
    const nearest = Math.min(...wrong.map(p => Math.abs(now(p) - rc)));
    const extreme = rc === Math.max(...counts) || rc === Math.min(...counts);
    if (a.rule !== 'most' && a.rule !== 'fewest' && ((a.rule === 'has' && extreme) || a.rule !== 'has') && nearest >= 3)
      blocking.push(`the right place (${rc}) is ${nearest} away from every other choice: a child can pick it by how big it looks; put a choice within 2 of it`);
    const arr = (id: string) => placeOf(id).arrangement;
    if (among.length >= 3 && wrong.every(p => arr(p) === arr(wrong[0])) && arr(right) !== arr(wrong[0]))
      blocking.push(`the right place is the only ${arr(right)} one: a child can pick the odd one out; vary the arrangements`);
    if (a.ref && arr(right) === arr(a.ref) && wrong.every(p => arr(p) !== arr(a.ref!)))
      blocking.push(`only the right place is drawn like the reference (${arr(right)}): a child can match the shape, not the count`);
    const words = new Set(among.flatMap(p => items.filter(o => o.place === p).map(o => o.word)));
    if (words.size > 1) for (const word of Array.from(words)) if (new RegExp(`\\b${word}(e?s)?\\b`, 'i').test(ctx.ask) && a.rule !== 'has') blocking.push(`the ask names "${word}", which points at one place; ask about "the group"`);
    if (a.rule === 'has' && words.size > 1) blocking.push('rule "has": every place to choose from draws the same thing, so the ask\'s word does not point at one');
  }

  if (a.kind === 'number') {
    const n = (key as { number: number }).number;
    if (n < 0 || n > 20) blocking.push(`the answer ${n} is outside 0-20`);
    if (n > ctx.max) blocking.push(`the answer ${n} is past this lesson's ${ctx.max}`);
    if (saysNumber(`${ctx.ask} ${ctx.why}`, n)) blocking.push(`the ask or why-card says ${n}, the answer`);
    if (saysNumber(ctx.narration, n) && !w.places.some(p => p.kind === 'cup' && countIn(items, [p.id]) === n)) blocking.push(`the narration says ${n}, the answer: tell the story with the parts, not the total`);
    // The narration may say a hidden cup's count and the story's parts (the start, what joins or leaves), never the
    // count of a visible group the child is to count, or a teen frame's ones (ten and THREE more counts it for them).
    const changed = new Set(w.events.map(e => e.place));
    const visible = a.countPlaces!.filter(p => placeOf(p).kind !== 'cup' && !changed.has(p));
    const filter = { color: a.countColor, word: a.countWord };
    const told = visible.flatMap(p => {
      const k = countIn(items, [p], filter);
      const framed = placeOf(p).kind === 'ten-frame' || placeOf(p).arrangement === 'ten-frame';
      return [k, ...(framed && k > 10 ? [k - 10] : [])];
    }).filter(k => k > 0 && saysNumber(ctx.narration, k));
    if (told.length) blocking.push(`the narration says ${Array.from(new Set(told)).join(', ')}, which the child is to count: describe the group without its number`);
  }

  if (a.kind === 'move') {
    const kindOf = (id: string) => w.places.find(p => p.id === id)?.kind;
    if (goalHolds(a.goal!, items, kindOf)) blocking.push('the goal already holds before the child moves anything');
    // Enough of the right things to move.
    for (const g of a.goal!) {
      const pool = items.filter(o => o.event !== 'leave' && matches(o, { color: g.color, word: g.word }));
      const need = g.count ?? g.atLeast ?? (g.full ? 10 : 1);
      if (pool.length < need) blocking.push(`the goal needs ${need} ${g.color ?? ''} ${g.word ?? 'things'} and the world has ${pool.length}`);
      if (g.count !== undefined && !saysNumber(`${ctx.ask} ${ctx.narration}`, g.count) && !g.full) blocking.push(`the ask must say ${g.count}, the number the child makes`);
      if ((g.color || g.word) && g.only && !new RegExp(`\\b(${g.color ?? ''}${g.word ? `|${g.word}` : ''})`, 'i').test(ctx.ask)) blocking.push(`the ask must say what goes in (${g.color ?? g.word})`);
    }
    const piles = w.places.filter(p => items.some(o => o.place === p.id) && !(a.goal ?? []).some(g => g.places.includes(p.id)));
    if (a.goal!.some(g => g.count !== undefined && g.places.length === 1) && piles.length && Math.max(...piles.map(p => now(p.id))) < (Math.max(...a.goal!.map(g => g.count ?? 0)) + 2) && !a.goal!.some(g => g.places.length > 1))
      blocking.push('count out from a pile at least 2 bigger than the number, so the child has to stop');
    if (a.goal!.some(g => g.full) && !w.places.some(p => p.kind === 'ten-frame' || p.arrangement === 'ten-frame')) blocking.push('a full-frame goal needs a ten-frame place');
    if (!blocking.length && !solveMove(buildWorld(w, key, () => 0.5, 0))) blocking.push('no way to reach this goal by moving things from where they start: check the counts and the places');
  }

  if (!/\bcount|\bhow many\b|\btouch\b|\bput\b|\bmove\b/i.test(`${ctx.narration} ${ctx.why} ${ctx.ask}`)) advisory.push('nothing in the narration, ask or why-card says to count');
  return { blocking, advisory, key, mode };
}

// ── Difficulty (agent-primitive I6) ───────────────────────────────────

export interface Difficulty { band: SupportTier; score: number; reasons: string[] }
export const bandOf = (score: number): SupportTier => (score < 1.5 ? 'easy' : score < 3 ? 'medium' : 'hard');

/**
 * A stop's difficulty from its world. Each term is a reason a Kindergartner finds it harder: a bigger number, a
 * scattered group, a story to hold (things join; things leave is harder), counting on from a hidden group, a filter
 * (only the red ones), making something (moving) rather than recognising it, splitting into parts, distractors one
 * away, three choices, and a length cue that points the wrong way.
 */
export function worldDifficulty(w: WorldDraft): Difficulty {
  const reasons: string[] = [];
  let score = 0;
  const add = (x: number, why: string) => { if (x) { score += x; reasons.push(`${why} (${x > 0 ? '+' : ''}${x})`); } };
  const items = itemsOf(w);
  const a = w.answer;
  const key = worldKey(w);
  const sizes = [
    // The story's biggest moment counts: seven birds before three leave is a seven.
    ...w.places.map(p => items.filter(o => o.place === p.id).length),
    ...(a.goal ?? []).map(g => g.count ?? 0),
    ...('number' in key ? [key.number] : []),
    a.number ?? 0,
  ];
  const size = Math.max(0, ...sizes);
  add(size > 10 ? 2 : size > 5 ? 1 : 0, `numbers to ${size}`);
  const used = w.places.filter(p => items.some(o => o.place === p.id));
  if (used.some(p => p.arrangement === 'scattered')) add(1, 'a scattered group');
  else if (used.length && used.every(p => p.arrangement === 'ten-frame')) add(-0.5, 'ten-frames');
  if (w.events.some(e => e.kind === 'join')) add(1, 'a story: some join');
  if (w.events.some(e => e.kind === 'leave')) add(1.5, 'a story: some leave');
  if (w.places.some(p => p.kind === 'cup')) add(1, 'count on from a hidden group');
  if (a.countColor || a.countWord || (a.goal ?? []).some(g => g.color || g.word)) add(0.5, 'only some of them count');
  if (a.kind === 'move') add(1, 'the child makes it');
  if (a.kind === 'number') add(0.5, 'say the number');
  if ((a.goal ?? []).some(g => g.places.length > 1)) add(0.5, 'two parts make the whole');
  if ((a.goal ?? []).some(g => g.full)) add(0.5, 'fill to ten');
  if (a.kind === 'tap' && 'place' in key) {
    const among = amongOf(w);
    const rc = countIn(items, [key.place]);
    const wrong = among.filter(p => p !== key.place);
    const nearest = Math.min(...wrong.map(p => Math.abs(countIn(items, [p]) - rc)));
    add(nearest === 1 ? 1 : nearest === 2 ? 0.5 : 0, `nearest wrong choice ${nearest} away`);
    if (among.length === 3) add(0.5, 'three choices');
    if (a.rule === 'same-as') add(0.5, 'the same as another group');
    if (a.rule === 'one-more-than' || a.rule === 'one-fewer-than') add(1, a.rule.replace(/-/g, ' '));
    if (a.rule === 'most' || a.rule === 'fewest') {
      const placeArr = (id: string) => w.places.find(p => p.id === id)!.arrangement;
      const ext = (id: string) => extent(countIn(items, [id]), placeArr(id));
      if (wrong.some(p => (a.rule === 'most' ? ext(p) > ext(key.place) : ext(p) < ext(key.place)))) add(1, `the group that looks ${a.rule === 'most' ? 'longer' : 'shorter'} is not the answer`);
    }
  }
  if (a.kind === 'move') {
    const piles = w.places.filter(p => !(a.goal ?? []).some(g => g.places.includes(p.id)));
    const spare = piles.reduce((s, p) => s + countIn(items, [p.id]), 0) - (a.goal ?? []).reduce((s, g) => s + (g.count ?? 0), 0);
    if (spare >= 4) add(0.5, 'many left over to stop before');
  }
  return { band: bandOf(score), score, reasons: reasons.length ? reasons : ['small numbers, in order, recognise only'] };
}

// ── Walk-level variety and tier ──────────────────────────────────────

export function worldWalkChecks(worlds: WorldDraft[], opts: { tier?: SupportTier; openModes: WonderWalkStopType[] }): string[] {
  const blocking: string[] = [];
  const keys = worlds.map(w => JSON.stringify({ m: modeOf(w), k: worldKey(w), p: w.places.map(p => p.contents.map(c => c.count)) }));
  keys.forEach((k, i) => { const j = keys.indexOf(k); if (j !== i) blocking.push(`math stops ${j} and ${i} are the same item; change the numbers or the world`); });
  if (worlds.length >= 3) {
    const arrs = new Set(worlds.flatMap(w => w.places.map(p => p.arrangement)));
    if (arrs.size < 2) blocking.push(`every place in the walk is drawn as ${Array.from(arrs)[0]}: vary the arrangement`);
    const modes = new Set(worlds.map(modeOf));
    const openMath = opts.openModes.filter(m => MATH_MODES.includes(m));
    if (openMath.length >= 2 && modes.size < 2) blocking.push(`every math stop is ${Array.from(modes)[0]}; use at least two of: ${openMath.join(', ')}`);
  }
  if (opts.tier) {
    const order: SupportTier[] = ['easy', 'medium', 'hard'];
    worlds.forEach((w, i) => {
      const d = worldDifficulty(w);
      const off = order.indexOf(d.band) - order.indexOf(opts.tier!);
      if (off === 0 || (i === 0 && off === -1)) return;
      blocking.push(`math stop ${i} is ${d.band} (score ${d.score}: ${d.reasons.join(', ')}); this walk is ${opts.tier}: ${off < 0 ? 'make it harder' : 'make it easier'}`);
    });
  }
  return blocking;
}

// ── Building the world the child meets ───────────────────────────────

/** Seeded positions for a scattered place, one object per cell of a 4×4 grid, jittered. */
export function scatter(count: number, rand: () => number): Array<[number, number]> {
  const cells = Array.from({ length: 16 }, (_, i) => i);
  for (let k = cells.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [cells[k], cells[j]] = [cells[j], cells[k]]; }
  return cells.slice(0, count).map(c => [+(((c % 4) + 0.5 + (rand() - 0.5) * 0.4) / 4).toFixed(3), +((Math.floor(c / 4) + 0.5 + (rand() - 0.5) * 0.4) / 4).toFixed(3)]);
}

/** The world as drawn: objects with ids and positions, which places can be chosen or dropped into, the number choices. */
export function buildWorld(w: WorldDraft, key: WorldKey, rand: () => number, stopIndex: number): World {
  const items = itemsOf(w);
  const a = w.answer;
  const among = a.kind === 'tap' ? amongOf(w) : [];
  const goalPlaces = new Set((a.goal ?? []).flatMap(g => g.places));
  const places: WorldPlace[] = w.places.map(p => ({
    id: p.id, kind: p.kind, arrangement: p.arrangement, ...(p.color ? { color: p.color } : {}),
    choosable: among.includes(p.id),
    // A move world: the goal's places take drops, and so does every place things start in (to put one back).
    droppable: a.kind === 'move' && p.kind !== 'cup' && (goalPlaces.has(p.id) || items.some(o => o.place === p.id)),
  }));
  const objects: WorldObject[] = [];
  for (const p of w.places) {
    const here = items.filter(o => o.place === p.id);
    const pos = p.arrangement === 'scattered' ? scatter(here.length, rand) : [];
    here.forEach((o, k) => {
      const pic = pictureOf(o.word)!;
      objects.push({ id: `s${stopIndex}-${p.id}-${k}`, word: pic.word, emoji: pic.emoji, place: p.id,
        ...(o.color ? { color: o.color } : {}), ...(o.event ? { event: o.event } : {}), ...(pos[k] ? { position: pos[k] } : {}) });
    });
  }
  let answer: WorldAnswer;
  if (a.kind === 'tap') {
    const right = (key as { place: string }).place;
    const rc = countIn(items, [right]);
    const counts = among.map(p => countIn(items, [p]));
    const traps: Record<string, WonderWalkTrap | null> = {};
    for (const p of among) {
      const c = countIn(items, [p]);
      traps[p] = p === right ? null
        : (a.rule === 'most' && c === Math.min(...counts)) || (a.rule === 'fewest' && c === Math.max(...counts)) ? 'reversed'
        : Math.abs(c - rc) === 1 ? 'one_off' : 'far_off';
    }
    answer = { kind: 'tap', rule: a.rule!, ...(a.number !== undefined ? { number: a.number } : {}), ...(a.ref ? { ref: a.ref } : {}), traps };
  } else if (a.kind === 'number') {
    const n = (key as { number: number }).number;
    // Wrong numbers a child says: one off, and a part of the story (the start, or the hidden group).
    const parts = w.places.map(p => countIn(items.filter(o => o.event !== 'join'), [p.id])).filter(x => x !== n && x > 0);
    const pool = [n + 1, n - 1, ...parts, n + 2, n - 2].filter(x => x >= 0 && x <= 20 && x !== n);
    const wrong = Array.from(new Set(pool)).slice(0, 2);
    const choices = [n, ...wrong];
    for (let k = choices.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [choices[k], choices[j]] = [choices[j], choices[k]]; }
    answer = { kind: 'number', countPlaces: a.countPlaces!, ...(a.countColor ? { countColor: a.countColor } : {}), ...(a.countWord ? { countWord: pictureOf(a.countWord)?.word ?? a.countWord } : {}), choices, answer: n };
  } else answer = { kind: 'move', goal: a.goal! };
  return { places, objects, answer };
}

/** The largest count the lesson asks for ("Counting to 5", "numbers within 10", "1-20"); 10 when it names none. */
const WORD_NUMBERS: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
export function countMax(...texts: Array<string | undefined>): number {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  const m = text.match(/\b(?:to|within|up to|through|and|0\s*-\s*|1\s*-\s*)\s*(\d{1,3}|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/);
  // Teen numbers are 11-19 by definition, whatever range the lesson names.
  const n = /\bteens?\b/.test(text) ? 20 : m ? (WORD_NUMBERS[m[1]] ?? Number(m[1])) : 10;
  return Math.max(3, Math.min(20, Number.isFinite(n) ? n : 10));
}
