/**
 * The kit's answer surfaces (USER 2026-11-08): what a child does with an item, built once and shared by every agent
 * primitive. An agent assembles an item from a surface (choose, categorize, order, make), displays (`displays.ts`) and its
 * own content; code owns everything here: the item's structure, how an answer is scored, the shortcut checks that need
 * no model, the difficulty computed from structure, and the order the options are shown in.
 *
 * Pure (no React, no model): the component, the boss, the author loop and the tests read the same definitions.
 * Evidence for the shape: `scripts/agent-surface-probe.mjs`, `qa/agent-surfaces/2026-11-07-v2`.
 */
import type { Display } from './displays';
import { POINT_KINDS, displayAxis, displayErrors, displayLoad, displayParts, displayPartsError, displayReading, patternFill, sameValue, statedValues } from './displays';
import { optionsTooClose } from '../insets/chartView';
import type { AuthoredLever } from './levers';
import { systemShortcuts } from './system';
import { setApply, setControls, setErrors, setHint, setSolve, setSteps, setUnmet, type ControlSpec, type Derive, type SetGoal } from './setting';

/** The surfaces where the child picks among ready-made cards. */
export const CARD_SURFACES = ['choose', 'categorize', 'order'] as const;
/**
 * `make` (2026-11-09): the child puts pieces on a tray until a goal holds, and any set that meets the goal is right.
 * Evidence for it: `qa/evidence-spec/2026-11-09.json`, where an author asked to collect "the child's own set of coins"
 * built a tray out of categorize, and its fixed key marked an equally right set wrong on 2 of 3 items.
 */
/**
 * `set` (2026-11-09): the child changes a kit display (the board) until a goal holds: cut a circle into three equal
 * parts, build 34 from tens and ones, make one bar 3 taller than another. Any board that meets the goal is right. Every
 * display is a board: the author says which of its values the child changes, and `setting.ts` does the rest.
 */
/**
 * `point` (2026-11-09): the child taps one part of a kit display (the board): a bar, a point on a line, an event, a
 * step, a place. There are no option cards, so there are no wrong options to write and none to give the answer away;
 * the wrong answers are the display's other parts. Any display that names its parts (`displayParts`) is a board.
 */
export const SURFACES = [...CARD_SURFACES, 'make', 'set', 'point'] as const;
export type CardSurface = typeof CARD_SURFACES[number];
export type Surface = typeof SURFACES[number];
export type Tier = 'easy' | 'medium' | 'hard';
export const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];

/** A card the child picks, sorts, orders or puts on the tray: a label, a display, or both. `value` is a make piece's worth when no display states it. */
export interface SurfaceOption { id: string; label?: string; display?: Display; value?: number }

/** make only: what the tray must come to. The pieces' values add to `total`, and/or there are exactly `count` pieces. */
export interface MakeGoal { total?: number; count?: number }

export interface SurfaceItem {
  id: string;
  surface: Surface;
  /** What the tutor asks; never the answer. */
  prompt: string;
  /** Shown above the options. */
  stimulus: Display[];
  /** Stored in the order the child sees them (`shownOrder` at assembly), never the key's order. */
  options: SurfaceOption[];
  /** categorize only: 2-3 category names. */
  categories?: string[];
  /** make only: the condition an answer is judged by. */
  goal?: MakeGoal;
  /** set: the display the child changes, in the state it starts in. point: the display whose parts the child taps. */
  board?: Display;
  /** set only: what the child can change on the board; a clock and a shape to cut come with their own. */
  controls?: ControlSpec[];
  /** set only: sums and differences of the board's numbers that the goal can name. */
  derive?: Derive;
  /** set only: what must hold at the end (`setting.ts`), which is how an answer is judged. */
  setGoal?: SetGoal;
  /** point: the name of the right part; choose: the right option id; order: option ids in order; categorize: option id to category name; make: one set that meets the goal, computed by code for the harness (an answer is judged by the goal, never by this). */
  key: string | string[] | Record<string, string>;
  /** The wrong idea that picks each wrong option (choose), or puts a card in the wrong place; shown as a hint after a miss. */
  misconceptions?: Record<string, string>;
  /** The tier the author aimed at. */
  tier: Tier;
  difficulty: Difficulty;
  levers?: AuthoredLever<SurfaceItem>[];
}

/** What the child has done on an item. */
export interface SurfaceAnswer { /** point: the part the child tapped. */ part?: string | null; choice?: string | null; order?: string[]; placed?: Record<string, string>; made?: string[]; /** set: the board as the child left it. */ board?: Display }

export type SurfaceMiss = 'wrong_choice' | 'misplaced' | 'out_of_order' | 'off_goal';
export const SURFACE_MISSES: readonly SurfaceMiss[] = ['wrong_choice', 'misplaced', 'out_of_order', 'off_goal'];

// ── make: a goal over the pieces on the tray ────────────────────────────────

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** What a piece is worth: the value its display shows when code can read one, else the author's number. */
export const pieceValue = (o: SurfaceOption): number | undefined => displayReading(o.display)?.value ?? (num(o.value) ? o.value : undefined);

/** Which part of the goal a set of pieces misses, or null when it meets the goal. */
export function goalMiss(item: SurfaceItem, ids: readonly string[]): 'count' | 'total' | null {
  const g = item.goal ?? {};
  const on = item.options.filter(o => ids.includes(o.id));
  if (!on.length) return num(g.count) ? 'count' : 'total';
  if (num(g.count) && on.length !== g.count) return 'count';
  if (num(g.total) && !sameValue(on.reduce((sum, o) => sum + (pieceValue(o) ?? NaN), 0), g.total)) return 'total';
  return null;
}

/** Every set of pieces that meets the goal (the solver, I5), fewest pieces first. At most 12 pieces, so 4096 sets. */
export function makeSolutions(item: SurfaceItem): string[][] {
  const opts = (item.options ?? []).slice(0, 12);
  const out: string[][] = [];
  for (let mask = 1; mask < 1 << opts.length; mask++) {
    const ids = opts.filter((_, i) => mask & (1 << i)).map(o => o.id);
    if (!goalMiss(item, ids)) out.push(ids);
  }
  return out.sort((a, b) => a.length - b.length);
}

/** How many different sets work, counting two sets with the same kinds of piece once. */
export function makeWays(item: SurfaceItem): number {
  const kind = (id: string) => { const o = item.options.find(x => x.id === id)!; return String(pieceValue(o) ?? o.label ?? o.id); };
  return new Set(makeSolutions(item).map(ids => ids.map(kind).sort().join('+'))).size;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const saysNumber = (heard: string, n: number) => new RegExp(`(?<![0-9.])${n}(?![0-9])`).test(heard) || (NUMBER_WORDS[n] ? new RegExp(`(^|[^a-z])${NUMBER_WORDS[n]}([^a-z]|$)`, 'i').test(heard) : false);

// ── Structure ───────────────────────────────────────────────────────────────

const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Why an item cannot run, as sentences the author can act on. Empty when it can. */
export function itemErrors(item: SurfaceItem): string[] {
  const e: string[] = [];
  if (!item || !SURFACES.includes(item.surface)) return [`surface must be one of ${SURFACES.join(', ')}`];
  if (!text(item.prompt)) e.push('the item needs a prompt');
  const opts = item.options ?? [];
  const ids = opts.map(o => o.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !text(id))) e.push('every option needs a distinct id');
  for (const o of opts) {
    if (!text(o.label) && !o.display) e.push(`option ${o.id} needs a label or a display`);
    if (o.display) e.push(...displayErrors(o.display).map(x => `option ${o.id}: ${x}`));
  }
  for (const d of item.stimulus ?? []) e.push(...displayErrors(d));
  const range = (lo: number, hi: number, what: string) => { if (opts.length < lo || opts.length > hi) e.push(`${what}: ${lo}-${hi} options (it has ${opts.length})`); };
  if (item.surface === 'choose') {
    range(2, 5, 'choose');
    if (typeof item.key !== 'string' || !ids.includes(item.key)) e.push('choose: the key is one option id');
  }
  if (item.surface === 'order') {
    range(3, 6, 'order');
    const k = item.key;
    if (!Array.isArray(k) || k.length !== ids.length || new Set(k).size !== k.length || !k.every(id => ids.includes(id)))
      e.push('order: the key lists every option id once, in order');
  }
  if (item.surface === 'set') {
    if (opts.length) e.push('set: the child changes the board, so the item has no option cards');
    e.push(...setErrors(item));
  }
  if (item.surface === 'point') {
    if (opts.length) e.push('point: the child taps the board, so the item has no option cards');
    if (!item.board) e.push('point: the item needs a board, the display whose parts the child taps');
    else if (displayErrors(item.board).length) e.push(...displayErrors(item.board).map(x => `board: ${x}`));
    else {
      const parts = displayParts(item.board);
      if (!parts.length) e.push(`point: a ${item.board.kind} display has no parts to tap. Use one of ${POINT_KINDS.join(', ')}`);
      else if (parts.length < 3) e.push(`point: the board has ${parts.length} part${parts.length === 1 ? '' : 's'} to tap; it needs at least 3, or the child can guess`);
      else if (new Set(parts).size !== parts.length) e.push('point: two parts of the board share a name, so a tap cannot tell them apart');
      else if (displayPartsError(item.board)) e.push(`point: ${displayPartsError(item.board)}`);
      else if (typeof item.key !== 'string' || !parts.includes(item.key)) e.push(`point: the key is the name of one part of the board (${parts.join(', ')})`);
      if ((item.board as { highlight?: unknown }).highlight !== undefined) e.push('point: the board must not start with a highlight; it would mark a part before the child taps');
    }
  }
  if (item.surface === 'make') {
    range(3, 12, 'make');
    const g = item.goal ?? {};
    const okTotal = g.total === undefined || (num(g.total) && g.total > 0), okCount = g.count === undefined || (Number.isInteger(g.count) && g.count > 0);
    if (!okTotal || !okCount || (g.total === undefined && g.count === undefined)) e.push('make: the goal needs a total, a count, or both, as positive numbers');
    else {
      const blank = num(g.total) ? opts.filter(o => pieceValue(o) === undefined) : [];
      if (blank.length) e.push(`make: piece ${blank.map(o => o.id).join(', ')} has no value. Give it a display code can read (coins, base ten, a ten frame) or a number in "value"`);
      else if (!makeSolutions(item).length) e.push('make: no set of these pieces meets the goal');
      else if (!Array.isArray(item.key) || !item.key.length || goalMiss(item, item.key)) e.push('make: the stored key is not a set that meets the goal');
    }
  }
  if (item.surface === 'categorize') {
    range(2, 8, 'categorize');
    const cats = item.categories ?? [];
    if (cats.length < 2 || cats.length > 3 || new Set(cats).size !== cats.length || !cats.every(text)) e.push('categorize: 2-3 distinct category names');
    const k = item.key;
    if (!k || typeof k !== 'object' || Array.isArray(k) || !ids.every(id => cats.includes((k as Record<string, string>)[id])))
      e.push('categorize: the key puts every option id in one of the categories');
    else if (cats.some(c => !ids.some(id => (k as Record<string, string>)[id] === c))) e.push('categorize: every category gets at least one card');
  }
  return e;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/** The surface's one definition of right, and the miss a wrong answer is. */
export function gradeAnswer(item: SurfaceItem, a: SurfaceAnswer): { correct: boolean; miss?: SurfaceMiss } {
  if (item.surface === 'point') {
    const correct = !!a.part && a.part === item.key;
    return correct ? { correct } : { correct, miss: 'wrong_choice' };
  }
  if (item.surface === 'choose') {
    const correct = !!a.choice && a.choice === item.key;
    return correct ? { correct } : { correct, miss: 'wrong_choice' };
  }
  if (item.surface === 'order') {
    const key = item.key as string[];
    const correct = Array.isArray(a.order) && a.order.length === key.length && a.order.every((id, i) => id === key[i]);
    return correct ? { correct } : { correct, miss: 'out_of_order' };
  }
  if (item.surface === 'make') {
    const correct = !goalMiss(item, a.made ?? []);
    return correct ? { correct } : { correct, miss: 'off_goal' };
  }
  if (item.surface === 'set') {
    const correct = !!item.board && !setUnmet(item, a.board ?? item.board);
    return correct ? { correct } : { correct, miss: 'off_goal' };
  }
  const key = item.key as Record<string, string>;
  const correct = item.options.every(o => a.placed?.[o.id] === key[o.id]);
  return correct ? { correct } : { correct, miss: 'misplaced' };
}

/** The answer that is right (the harness plays it), and one that is wrong. */
export function rightAnswer(item: SurfaceItem): SurfaceAnswer {
  if (item.surface === 'point') return { part: item.key as string };
  if (item.surface === 'choose') return { choice: item.key as string };
  if (item.surface === 'order') return { order: [...(item.key as string[])] };
  if (item.surface === 'make') return { made: [...(item.key as string[])] };
  if (item.surface === 'set') return { board: setSolve(item) ?? item.board };
  return { placed: { ...(item.key as Record<string, string>) } };
}
export function wrongAnswer(item: SurfaceItem): SurfaceAnswer {
  if (item.surface === 'point') return { part: displayParts(item.board).find(p => p !== item.key) ?? null };
  if (item.surface === 'choose') return { choice: item.options.find(o => o.id !== item.key)?.id ?? null };
  if (item.surface === 'order') { const k = [...(item.key as string[])]; [k[0], k[1]] = [k[1], k[0]]; return { order: k }; }
  if (item.surface === 'set') {
    // One tap from the start that does not land on the goal.
    const start = item.board!, tries = setControls(item, start).map(c => setApply(item, start, { id: c.id, dir: 1 }));
    return { board: tries.find(b => b !== start && setUnmet(item, b)) ?? start };
  }
  if (item.surface === 'make') {
    // The key with one piece taken off, or with one more put on: the nearest set that misses the goal.
    const k = item.key as string[], spare = item.options.find(o => !k.includes(o.id));
    const tries = [k.slice(1), ...(spare ? [[...k, spare.id]] : []), [item.options[0].id]];
    return { made: tries.find(t => t.length && goalMiss(item, t)) ?? [] };
  }
  const key = item.key as Record<string, string>, cats = item.categories ?? [];
  const first = item.options[0];
  return { placed: { ...key, [first.id]: cats.find(c => c !== key[first.id]) ?? key[first.id] } };
}

/** A set control's tap target: a toggle by its id, a step by its id and direction. */
export const setTarget = (id: string, dir?: 1 | -1) => `set-${id}${dir ? (dir > 0 ? '-up' : '-down') : ''}`;

/** A part's tap target on a point board. */
export const pointTarget = (part: string) => `part-${part}`;

/** True when the child has given a whole answer, so Check can run. */
export function answerReady(item: SurfaceItem, a: SurfaceAnswer): boolean {
  if (item.surface === 'point') return !!a.part;
  if (item.surface === 'choose') return !!a.choice;
  if (item.surface === 'order') return (a.order?.length ?? 0) === item.options.length;
  if (item.surface === 'make') return (a.made?.length ?? 0) > 0;
  if (item.surface === 'set') return !!a.board && JSON.stringify(a.board) !== JSON.stringify(item.board);
  return item.options.every(o => a.placed?.[o.id]);
}

/** The taps that make an answer on `SurfaceBoard`, then the host's check button. */
export function surfaceTaps(item: SurfaceItem, a: SurfaceAnswer, checkLabel: string): Array<{ type: 'touch'; target: string } | { type: 'choose'; label: string }> {
  const touch = (target: string) => ({ type: 'touch' as const, target });
  const taps: Array<{ type: 'touch'; target: string } | { type: 'choose'; label: string }> = [];
  if (item.surface === 'point' && a.part) taps.push(touch(pointTarget(a.part)));
  if (item.surface === 'choose' && a.choice) taps.push(touch(`card-${a.choice}`));
  if (item.surface === 'order') for (const id of a.order ?? []) taps.push(touch(`card-${id}`));
  if (item.surface === 'make') for (const id of a.made ?? []) taps.push(touch(`card-${id}`));
  if (item.surface === 'set' && item.board && a.board) for (const s of setSteps(item, item.board, a.board)) taps.push(touch(setTarget(s.id, s.dir)));
  if (item.surface === 'categorize') for (const o of item.options) {
    const ci = (item.categories ?? []).indexOf(a.placed?.[o.id] ?? '');
    if (ci >= 0) taps.push(touch(`card-${o.id}`), touch(`category-${ci}`));
  }
  taps.push({ type: 'choose', label: checkLabel });
  return taps;
}

/** A hint after a miss: the misconception behind what the child did, in the author's words. Never the answer. */
export function missHint(item: SurfaceItem, a: SurfaceAnswer): string | undefined {
  const m = item.misconceptions ?? {};
  if (item.surface === 'set') { const off = item.board && setUnmet(item, a.board ?? item.board); return off ? setHint(item, off) : undefined; }
  // A make miss is a fact about the tray, so code can say which part of the goal to look at without giving a set away.
  if (item.surface === 'make') return goalMiss(item, a.made ?? []) === 'count' ? 'Count how many pieces are on the tray.' : 'Work out what the pieces on the tray come to.';
  if (item.surface === 'point') return a.part ? m[a.part] : undefined;
  if (item.surface === 'choose') return a.choice ? m[a.choice] : undefined;
  if (item.surface === 'categorize') {
    const key = item.key as Record<string, string>;
    const wrong = item.options.find(o => a.placed?.[o.id] && a.placed[o.id] !== key[o.id]);
    return wrong ? m[wrong.id] : undefined;
  }
  return Object.values(m)[0];
}

// ── Shortcuts code can see without a model (I5) ─────────────────────────────

const SEQ = /\b(first|next|then|after that|finally|at last|in the end|at the end)\b/gi;
const words = (s: unknown) => new Set(String(s ?? '').toLowerCase().match(/[a-z]{4,}/g) ?? []);
const optionSize = (o: SurfaceOption) => (o.display?.kind === 'svg' ? o.display.svg.length : o.display ? 400 : 0) + (o.label?.length ?? 0) * 8;

/** Shortcuts a child could use without the skill, as sentences the author can act on. */
export function shortcutChecks(item: SurfaceItem): string[] {
  const flags: string[] = [];
  const opts = item.options ?? [];
  const heard = [item.prompt, ...(item.stimulus ?? []).filter(d => d.kind === 'text').map(d => (d as { text: string }).text)].join(' ');
  if (item.surface === 'order' && (heard.match(SEQ) ?? []).length >= 2)
    flags.push('the words the child hears use order words (first, next, then...), so they give the order away');
  const kinds = opts.map(o => o.display?.kind ?? 'none');
  const lone = Array.from(new Set(kinds)).filter(k => kinds.filter(x => x === k).length === 1);
  if (item.surface !== 'make' && opts.length >= 3 && lone.length === 1) flags.push(`one option is drawn as "${lone[0]}" and the others are not: an odd one out`);
  if (item.surface === 'choose') {
    const right = opts.find(o => o.id === item.key), others = opts.filter(o => o !== right);
    const mean = others.reduce((s, o) => s + optionSize(o), 0) / Math.max(1, others.length);
    if (right && mean > 0 && optionSize(right) > 1.6 * mean) flags.push('the right option is drawn or written in much more detail than the others');
    if (right && mean > 0 && optionSize(right) < 0.5 * mean) flags.push('the right option is drawn or written much more simply than the others (an odd one out)');
    if (right?.label && opts.length >= 3) {
      const lens = others.map(o => o.label?.length ?? 0), maxOther = Math.max(...lens);
      if (right.label.length > 1.5 * maxOther && maxOther > 0) flags.push('the right option\'s label is much longer than the others');
    }
  }
  if (item.surface === 'categorize') {
    const key = item.key as Record<string, string>;
    for (const o of opts) {
      const cat = key?.[o.id];
      if (cat && Array.from(words(cat)).some(w => words(o.label).has(w))) flags.push(`option "${o.label}" shares a word with its category "${cat}"`);
      else if (cat && o.label && o.label.trim().toLowerCase() === cat.trim().toLowerCase()) flags.push(`option "${o.label}" is labeled with its own category, so the child can match the words`);
    }
  }
  if (item.surface === 'make') flags.push(...makeChecks(item));
  if (item.surface === 'point' && typeof item.key === 'string') {
    // The part's name is drawn on the board, so a prompt that says it asks the child only to find a word.
    const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (plain(item.key) && ` ${plain(heard)} `.includes(` ${plain(item.key)} `)) flags.push(`the prompt says "${item.key}", the name written on the part to tap, so the child can match the word. Ask for what the part shows or does`);
  }
  if (item.surface === 'point' && item.board?.kind === 'passage' && typeof item.key === 'string') {
    const { sentences } = item.board, at = displayParts(item.board).indexOf(item.key);
    const others = sentences.filter((_, i) => i !== at), mean = others.reduce((sum, t) => sum + t.length, 0) / Math.max(1, others.length);
    if (at >= 0 && sentences[at].length > 1.6 * mean) flags.push('the right sentence is much longer than the others, so a child can pick it by its length');
    // A sentence's name is its number, so the name check above cannot see a prompt that repeats the sentence itself.
    const asked = words(heard), restated = (t: string) => { const w = Array.from(words(t)); return w.length >= 2 && w.filter(x => asked.has(x)).length / w.length >= 0.6; };
    if (at >= 0 && restated(sentences[at]) && !others.some(restated)) flags.push('the prompt repeats the words of the right sentence, so the child can match them. Ask what the sentence does or shows');
  }
  if (item.surface === 'set' && item.board) {
    const solved = setSolve(item);
    if ((item.stimulus ?? []).some(d => d.kind === item.board!.kind && !setUnmet(item, d))) flags.push('a picture above the board already shows a finished answer, so the child can copy it');
    const marks = solved ? setControls(item, solved) : [];
    if (marks.length > 1 && marks.every(c => c.kind === 'toggle' && c.on)) flags.push('the goal needs every mark turned on, so the child can tap them all without working anything out. Give the board more marks than the answer uses');
    if (item.board.kind === 'system') flags.push(...systemShortcuts(item.board, Object.keys(item.setGoal ?? {})));
  }
  flags.push(...readingChecks(item), ...patternChecks(item));
  return flags;
}

/** make: the child must have a set to work out. Code runs the solver and reads what the prompt says. */
function makeChecks(item: SurfaceItem): string[] {
  const flags: string[] = [];
  const g = item.goal ?? {}, all = makeSolutions(item);
  if (!all.length) return flags;
  if (all.length === 1 && all[0].length === item.options.length) flags.push('the only set that works is every piece, so the child can put them all on without working anything out. Add pieces that do not belong');
  if (!num(g.count) && all.some(set => set.length === 1)) flags.push('one piece alone meets the goal, so the child picks a card instead of making a set. Add a piece count to the goal or take that piece out');
  const heard = [item.prompt, ...(item.stimulus ?? []).filter(d => d.kind === 'text').map(d => (d as { text: string }).text)].join(' ');
  if (num(g.total) && !saysNumber(heard, g.total)) flags.push(`the prompt never says the total the child must make (${g.total})`);
  if (num(g.count) && !saysNumber(heard, g.count)) flags.push(`the prompt never says how many pieces the child must use (${g.count})`);
  return flags;
}

const FILLS = /\b(fill|fills|cover|covers|make|makes|build|builds|complete|completes|fit|fits)\b/i;

/**
 * Code knows each pattern block's size, so it can check "fills the shape": the key is the card whose blocks fill the
 * outline (the empty part of it, when some blocks are already placed), and no other card does.
 */
function patternChecks(item: SurfaceItem): string[] {
  if (item.surface !== 'choose' || !FILLS.test(item.prompt) || /\bnot\b/i.test(item.prompt)) return [];
  const opts = item.options ?? [];
  const right = opts.find(o => o.id === item.key);
  if (!right) return [];
  const flags: string[] = [];

  const placed = opts.map(o => patternFill(o.display));
  if (placed.every(f => f && f.target > 0) && placed.some(f => f!.covered > 0)) {
    const fills = opts.filter((_, i) => placed[i]!.covered === placed[i]!.target);
    if (!fills.includes(right)) flags.push('the key card does not fill its shape');
    else if (fills.length > 1) flags.push(`more than one card fills its shape (${fills.map(o => o.id).join(', ')})`);
    return flags;
  }

  const outline = (item.stimulus ?? []).map(patternFill).find(f => f && f.target > 0);
  if (outline && placed.every(f => f && f.tray > 0)) {
    const empty = outline.target - outline.covered;
    const fills = opts.filter((_, i) => placed[i]!.tray === empty);
    if (!fills.includes(right)) flags.push(`the key card's blocks do not add up to the empty part of the shape (${empty} small triangles)`);
    else if (fills.length > 1) flags.push(`more than one card's blocks add up to the empty part of the shape (${fills.map(o => o.id).join(', ')})`);
  }
  return flags;
}

/** A prompt that asks for something other than the value shown ("how many more", "one hour later"): code cannot check it. */
const DERIVED = /\b(more|less|fewer|make|makes|after|before|later|earlier|until|since|ago|from now|add|plus|minus|take|left|remain\w*|need\w*|another|differ\w*|between|total|altogether|together|double|rows?|columns?|groups?|each|tens|ones|hundreds|empty|blank|missing|not)\b/i;

/**
 * The checks a code-drawn display makes possible (roadmap rules 3 and 5): a card's label must not state what its own
 * display shows, and where the prompt simply asks for the value shown, the key must be the card that shows it.
 */
function readingChecks(item: SurfaceItem): string[] {
  const flags: string[] = [];
  const opts = item.options ?? [];
  for (const o of opts) {
    const shown = displayReading(o.display);
    if (shown && statedValues(o.label, shown.unit).some(v => sameValue(v, shown.value)))
      flags.push(`card "${o.label}" states in words the value its own display shows, so the child can read the label instead of the display`);
  }
  if (item.surface !== 'choose') return flags;
  const axis = (item.stimulus ?? []).map(displayAxis).find(Boolean);
  const named = opts.find(o => o.id === item.key)?.label;
  if (axis && named && !opts.some(o => o.display)) {
    const close = optionsTooClose(axis.values, axis.step, opts.map(o => o.label ?? ''), named);
    if (close) flags.push(close);
  }
  const heard = [item.prompt, ...(item.stimulus ?? []).filter(d => d.kind === 'text').map(d => (d as { text: string }).text)].join(' ');
  if (DERIVED.test(heard)) return flags;
  const right = opts.find(o => o.id === item.key);
  if (!right) return flags;

  const cardValues = opts.map(o => displayReading(o.display));
  const unit = cardValues[0]?.unit;
  if (unit && cardValues.every(r => r?.unit === unit)) {
    const rightReading = displayReading(right.display)!;
    const rightValue = rightReading.value;
    const twins = opts.filter(o => {
      if (o === right) return false;
      const other = displayReading(o.display)!;
      return sameValue(other.value, rightValue) && other.identity === rightReading.identity;
    });
    if (twins.length) flags.push(`two cards show the same value as the key (${[right, ...twins].map(o => o.id).join(', ')}), so more than one card is right`);
    const asked = statedValues(item.prompt, unit);
    if (asked.length === 1 && !sameValue(asked[0], rightValue)) flags.push('the prompt asks for one value but the key card shows another');
    return flags;
  }

  const stimulusValues = (item.stimulus ?? []).map(d => displayReading(d)).filter((r): r is NonNullable<typeof r> => !!r);
  if (stimulusValues.length !== 1 || opts.some(o => o.display)) return flags;
  const [shown] = stimulusValues;
  const labelValues = opts.map(o => statedValues(o.label, shown.unit));
  if (!labelValues.every(v => v.length === 1)) return flags;
  const matching = opts.filter((_, i) => sameValue(labelValues[i][0], shown.value));
  if (!matching.includes(right)) flags.push('the key label does not match the value the display shows');
  else if (matching.length > 1) flags.push(`more than one card states the value the display shows (${matching.map(o => o.id).join(', ')})`);
  return flags;
}

// ── Difficulty from structure (I6) ──────────────────────────────────────────

export interface Difficulty { band: Tier; score: number; reasons: string[] }
export const bandOf = (score: number): Tier => (score < 1.5 ? 'easy' : score < 2.5 ? 'medium' : 'hard');

export function difficultyOf(item: SurfaceItem): Difficulty {
  const reasons: string[] = [];
  let score = 0;
  const add = (v: number, why: string) => { if (v) { score += v; reasons.push(`${why} +${Math.round(v * 100) / 100}`); } };
  const n = item.options?.length ?? 0;
  if (item.surface === 'choose') add([0, 0, 0.3, 0.8, 1.2, 1.5][Math.min(n, 5)], `${n} options`);
  if (item.surface === 'point' && item.board) {
    const parts = displayParts(item.board).length, load = displayLoad(item.board);
    add(Math.min(1.8, 0.3 * Math.max(0, parts - 1)), `${parts} parts to choose from`);
    if (load) add(load.score, load.why);
  }
  if (item.surface === 'order') add(0.5 + 0.5 * Math.max(0, n - 2), `${n} to order`);
  if (item.surface === 'set' && item.board) {
    const goal = item.setGoal ?? {}, solved = setSolve(item);
    const taps = solved ? setSteps(item, item.board, solved).length : 0, facts = Object.keys(goal).length;
    add(Math.min(1.5, 0.25 * taps), `${taps} change${taps === 1 ? '' : 's'} to make`);
    add(0.4 * Math.max(0, facts - 1), `${facts} facts to meet at once`);
    if (goal.equal === true) add(0.5, 'the parts have to come out the same size');
    const loads = [item.board, solved].map(d => displayLoad(d ?? undefined)).filter((l): l is NonNullable<typeof l> => !!l);
    if (loads.length) { const most = loads.reduce((a, b) => (b.score > a.score ? b : a)); add(most.score, most.why); }
  }
  if (item.surface === 'make') {
    add(0.15 * n, `${n} pieces to choose from`);
    if (num(item.goal?.total) && num(item.goal?.count)) add(0.6, 'a total and a piece count to meet together');
    const kinds = new Set(item.options.map(o => pieceValue(o) ?? o.label ?? o.id)).size;
    add(0.2 * Math.max(0, kinds - 1), `${kinds} kinds of piece`);
    if (makeWays(item) === 1) add(0.3, 'only one set works');
  }
  if (item.surface === 'categorize') {
    add(0.25 * n, `${n} cards to sort`);
    if ((item.categories?.length ?? 0) >= 3) add(0.5, '3 categories');
  }
  const wrongIds = new Set(item.surface === 'point' ? displayParts(item.board).filter(p => p !== item.key)
    : item.surface === 'choose' ? item.options.filter(o => o.id !== item.key).map(o => o.id) : item.options.map(o => o.id));
  const traps = item.surface === 'make' ? 0 : Object.keys(item.misconceptions ?? {}).filter(id => wrongIds.has(id)).length;
  add(Math.min(traps, 4) * 0.25, `${traps} wrong option${traps === 1 ? '' : 's'} from a named misconception`);
  const loads = (item.stimulus ?? []).map(displayLoad).filter((l): l is NonNullable<typeof l> => !!l);
  if (loads.length) { const most = loads.reduce((a, b) => (b.score > a.score ? b : a)); add(most.score, most.why); }
  const cardLoads = item.options.map(o => displayLoad(o.display)).filter((l): l is NonNullable<typeof l> => !!l);
  if (cardLoads.length >= 2) add(Math.max(0.4, ...cardLoads.map(l => l.score)), 'comparing representations');
  score = Math.round(score * 100) / 100;
  return { band: bandOf(score), score, reasons };
}

// ── Shown order ─────────────────────────────────────────────────────────────

/**
 * True when the cards are shown in an order that gives the answer away: an order item in its key's order, or a sort
 * whose cards already sit together by category (all the Hard cards, then all the Soft ones).
 */
export function inAnswerOrder(item: SurfaceItem): boolean {
  const ids = item.options.map(o => o.id);
  if (ids.length < 2) return false;
  if (item.surface === 'order') return Array.isArray(item.key) && ids.join('|') === item.key.join('|');
  if (item.surface === 'categorize') {
    const key = item.key as Record<string, string>;
    const cats = ids.map(id => key?.[id]);
    // One card per category gives nothing away, however it is placed.
    if (new Set(cats).size === cats.length) return false;
    const runs = cats.filter((c, i, a) => i === 0 || c !== a[i - 1]);
    return new Set(runs).size === runs.length;
  }
  return false;
}

/** Options in a seeded shuffle whose order does not give the answer away (`inAnswerOrder`). */
export function shownOrder(item: SurfaceItem, seed: number): SurfaceOption[] {
  let s = seed >>> 0 || 1;
  let out = [...item.options];
  for (let tries = 0; tries < 48; tries++) {
    out = [...item.options];
    for (let i = out.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = (s >>> 16) % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    if (!inAnswerOrder({ ...item, options: out })) break;
  }
  return out;
}
