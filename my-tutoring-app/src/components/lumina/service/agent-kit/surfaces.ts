/**
 * The kit's answer surfaces (USER 2026-11-08): what a child does with an item, built once and shared by every agent
 * primitive. An agent assembles an item from a surface (choose, categorize, order), displays (`displays.ts`) and its
 * own content; code owns everything here: the item's structure, how an answer is scored, the shortcut checks that need
 * no model, the difficulty computed from structure, and the order the options are shown in.
 *
 * Pure (no React, no model): the component, the boss, the author loop and the tests read the same definitions.
 * Evidence for the shape: `scripts/agent-surface-probe.mjs`, `qa/agent-surfaces/2026-11-07-v2`.
 */
import type { Display } from './displays';
import { displayErrors, displayLoad, displayReading, patternFill, sameValue, statedValues } from './displays';
import type { AuthoredLever } from './levers';

export const SURFACES = ['choose', 'categorize', 'order'] as const;
export type Surface = typeof SURFACES[number];
export type Tier = 'easy' | 'medium' | 'hard';
export const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];

/** A card the child picks, sorts or orders: a label, a display, or both. */
export interface SurfaceOption { id: string; label?: string; display?: Display }

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
  /** choose: the right option id; order: option ids in order; categorize: option id to category name. */
  key: string | string[] | Record<string, string>;
  /** The wrong idea that picks each wrong option (choose), or puts a card in the wrong place; shown as a hint after a miss. */
  misconceptions?: Record<string, string>;
  /** The tier the author aimed at. */
  tier: Tier;
  difficulty: Difficulty;
  levers?: AuthoredLever<SurfaceItem>[];
}

/** What the child has done on an item. */
export interface SurfaceAnswer { choice?: string | null; order?: string[]; placed?: Record<string, string> }

export type SurfaceMiss = 'wrong_choice' | 'misplaced' | 'out_of_order';
export const SURFACE_MISSES: readonly SurfaceMiss[] = ['wrong_choice', 'misplaced', 'out_of_order'];

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
  if (item.surface === 'choose') {
    const correct = !!a.choice && a.choice === item.key;
    return correct ? { correct } : { correct, miss: 'wrong_choice' };
  }
  if (item.surface === 'order') {
    const key = item.key as string[];
    const correct = Array.isArray(a.order) && a.order.length === key.length && a.order.every((id, i) => id === key[i]);
    return correct ? { correct } : { correct, miss: 'out_of_order' };
  }
  const key = item.key as Record<string, string>;
  const correct = item.options.every(o => a.placed?.[o.id] === key[o.id]);
  return correct ? { correct } : { correct, miss: 'misplaced' };
}

/** The answer that is right (the harness plays it), and one that is wrong. */
export function rightAnswer(item: SurfaceItem): SurfaceAnswer {
  if (item.surface === 'choose') return { choice: item.key as string };
  if (item.surface === 'order') return { order: [...(item.key as string[])] };
  return { placed: { ...(item.key as Record<string, string>) } };
}
export function wrongAnswer(item: SurfaceItem): SurfaceAnswer {
  if (item.surface === 'choose') return { choice: item.options.find(o => o.id !== item.key)?.id ?? null };
  if (item.surface === 'order') { const k = [...(item.key as string[])]; [k[0], k[1]] = [k[1], k[0]]; return { order: k }; }
  const key = item.key as Record<string, string>, cats = item.categories ?? [];
  const first = item.options[0];
  return { placed: { ...key, [first.id]: cats.find(c => c !== key[first.id]) ?? key[first.id] } };
}

/** True when the child has given a whole answer, so Check can run. */
export function answerReady(item: SurfaceItem, a: SurfaceAnswer): boolean {
  if (item.surface === 'choose') return !!a.choice;
  if (item.surface === 'order') return (a.order?.length ?? 0) === item.options.length;
  return item.options.every(o => a.placed?.[o.id]);
}

/** The taps that make an answer on `SurfaceBoard`, then the host's check button. */
export function surfaceTaps(item: SurfaceItem, a: SurfaceAnswer, checkLabel: string): Array<{ type: 'touch'; target: string } | { type: 'choose'; label: string }> {
  const touch = (target: string) => ({ type: 'touch' as const, target });
  const taps: Array<{ type: 'touch'; target: string } | { type: 'choose'; label: string }> = [];
  if (item.surface === 'choose' && a.choice) taps.push(touch(`card-${a.choice}`));
  if (item.surface === 'order') for (const id of a.order ?? []) taps.push(touch(`card-${id}`));
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
  if (opts.length >= 3 && lone.length === 1) flags.push(`one option is drawn as "${lone[0]}" and the others are not: an odd one out`);
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
  flags.push(...readingChecks(item), ...patternChecks(item));
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
  if (item.surface === 'order') add(0.5 + 0.5 * Math.max(0, n - 2), `${n} to order`);
  if (item.surface === 'categorize') {
    add(0.25 * n, `${n} cards to sort`);
    if ((item.categories?.length ?? 0) >= 3) add(0.5, '3 categories');
  }
  const wrongIds = new Set(item.surface === 'choose' ? item.options.filter(o => o.id !== item.key).map(o => o.id) : item.options.map(o => o.id));
  const traps = Object.keys(item.misconceptions ?? {}).filter(id => wrongIds.has(id)).length;
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
