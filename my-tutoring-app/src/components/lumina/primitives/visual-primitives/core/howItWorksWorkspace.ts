/**
 * how-it-works's domain: the items, checks, keys, misses and scene (the wiring is `howItWorks.card.ts` +
 * `howItWorks.boss.ts`).
 *
 * The learner reads a process (4-6 steps a model wrote, or 3-4 picture steps for a pre-reader), then answers questions
 * that code builds from those steps and keys from their order. The model writes the words; it never writes a question
 * or picks a right answer. Four kinds of item, by eval mode:
 * - guided (identify): a step's description with its own title words blanked out; which step is it? The numbered step
 *   list stays on screen. easy: three choices, none next to the right step; medium: four, one of them a neighbour;
 *   hard: four, both neighbours among them.
 * - sequence: put the step cards in order (easy three in a row, medium four, hard every step written as its blanked
 *   description), then identify items with no step list on screen.
 * - predict: the first steps are shown; what happens next? easy: the wrong choices are far from it; medium: one is the
 *   step after it; hard: both wrong choices come later in the process. Plus explain items (when the model wrote each
 *   step's purpose): why does this step matter? The choices are what each step makes possible.
 * Choice items whose answer is a step's name are said aloud or tapped (J14); orders and purposes are tapped.
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { askLeaks, containsPhrase, type SpokenKey } from '../../../components/live-activity/spokenKey';
import { CHOICE_MISSES, NEXT_MISSES, ORDER_MISSES, type ChoiceMiss, type HowMiss, type NextMiss, type OrderMiss } from './howItWorks.card';

export { CHOICE_MISSES, NEXT_MISSES, ORDER_MISSES };
export type { ChoiceMiss, HowMiss, NextMiss, OrderMiss } from './howItWorks.card';

export type HowMode = 'guided' | 'sequence' | 'predict';
export const HOW_MODES: HowMode[] = ['guided', 'sequence', 'predict'];
export type HowKind = 'identify' | 'sequence' | 'predict' | 'explain';
export type HowTier = 'easy' | 'medium' | 'hard';

/** One step of the process as the items use it. */
export interface ProcessStep {
  /** A reader's step title, or a pre-reader's picture caption. */
  title: string;
  /** A reader's step description, or the sentence the tutor reads for a picture. */
  clue: string;
  /** What this step makes possible, one sentence (readers; the explain items). */
  purpose?: string;
  /** Pre-reader steps only: the picture. */
  emoji?: string;
}

/** The lesson fields the items are built from. */
export interface HowSource {
  title?: string;
  steps?: Array<{ title?: string; description?: string; purpose?: string }>;
  preReader?: { question?: string; steps?: Array<{ id?: string; emoji?: string; label?: string; spoken?: string }> };
  /** The eval modes this session asks, in order; absent: one item of each kind (or the picture order). */
  modes?: string[];
  difficulty?: string;
  items?: HowItem[];
  /** Legacy generations (model-written questions): read only for their kinds. */
  challenges?: Array<{ type?: string }>;
}

interface ItemBase { id: string; mode: HowMode }
export interface IdentifyItem extends ItemBase { kind: 'identify'; target: number; options: number[]; strip: boolean }
export interface SequenceItem extends ItemBase {
  kind: 'sequence';
  /** Step indices in the right order. */
  cards: number[];
  /** The same cards in the order the tray shows them. */
  bank: number[];
  /** The cards show each step's blanked description instead of its title. */
  asClues: boolean;
}
/** The first `shown` steps are on screen; the right answer is step `shown`. */
export interface PredictItem extends ItemBase { kind: 'predict'; shown: number; options: number[] }
export interface ExplainItem extends ItemBase { kind: 'explain'; target: number; options: number[] }
export type HowItem = IdentifyItem | SequenceItem | PredictItem | ExplainItem;
export type ChoiceItem = IdentifyItem | PredictItem | ExplainItem;

export const isChoice = (i: HowItem): i is ChoiceItem => i.kind !== 'sequence';
/** The step a choice item is keyed to. */
export const keyStep = (i: ChoiceItem): number => (i.kind === 'predict' ? i.shown : i.target);
/** Spoken or tapped: a step's name. Tapped only: an order, or a purpose sentence. */
export const isSpoken = (i: HowItem) => i.kind === 'identify' || i.kind === 'predict';

// ── Steps ────────────────────────────────────────────────────────────────────────────────

export const isPictures = (d: HowSource) => !!d.preReader?.steps?.length;

/** The steps the items read, titles made distinct. */
export function processSteps(d: HowSource): ProcessStep[] {
  const raw: ProcessStep[] = isPictures(d)
    ? (d.preReader!.steps ?? []).map(s => ({ title: (s.label ?? '').trim(), clue: (s.spoken || s.label || '').trim(), emoji: (s.emoji ?? '').trim() || undefined }))
    : (d.steps ?? []).map((s, i) => ({ title: (s.title ?? '').trim() || `Step ${i + 1}`, clue: (s.description ?? '').trim(),
      ...(s.purpose?.trim() ? { purpose: s.purpose.trim() } : {}) }));
  const seen = new Set<string>();
  return raw.map((s, i) => {
    const t = seen.has(s.title.toLowerCase()) ? `${s.title} (${i + 1})` : s.title;
    seen.add(t.toLowerCase());
    return { ...s, title: t };
  });
}

// ── Blanking a step's own title out of its words ─────────────────────────────────────────

const STOP = new Set(['the', 'and', 'with', 'from', 'into', 'onto', 'that', 'this', 'your', 'their', 'then', 'when', 'what',
  'how', 'step', 'steps', 'for', 'over', 'under', 'through', 'about', 'after', 'before', 'they', 'them', 'there', 'where',
  'which', 'while', 'each', 'some', 'more', 'most', 'very', 'also', 'just', 'makes', 'make', 'gets', 'goes', 'come', 'comes']);
export const BLANK = '___';

/** A title's telling words: four letters or more, not a filler word. */
export function titleWords(title: string): string[] {
  return (title.toLowerCase().match(/[a-z]+/g) ?? []).filter(w => w.length >= 4 && !STOP.has(w));
}
const stemHit = (w: string, t: string) => { const k = Math.min(5, w.length, t.length); return k >= 4 && w.slice(0, k) === t.slice(0, k); };
const hits = (word: string, title: string) => titleWords(title).some(t => stemHit(word.toLowerCase(), t));

/** The text with every word that shares a stem with the title's telling words blanked ("push" for "Pushing"). */
export function blankTitle(text: string, title: string, fill = BLANK): string {
  return text.replace(/[A-Za-z]+/g, w => (w.length >= 4 && hits(w, title) ? fill : w));
}
/** The share of a text's longer words the blanking removes. */
export function blankedShare(text: string, title: string): number {
  const words = (text.match(/[A-Za-z]+/g) ?? []).filter(w => w.length >= 4);
  return words.length ? words.filter(w => hits(w, title)).length / words.length : 1;
}
/** The first sentences of a text, at most `max` characters. */
export function firstSentences(text: string, count: number, max = 240): string {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [];
  let out = '';
  for (const p of parts.slice(0, count)) { const next = `${out}${out ? ' ' : ''}${p.trim()}`; if (next.length > max && out) break; out = next; }
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/** What an identify item shows: the step's description (two sentences), its own title words blanked. */
export const clueOf = (steps: ProcessStep[], i: number, pictures: boolean): string =>
  (pictures ? steps[i].clue : blankTitle(firstSentences(steps[i].clue, 2), steps[i].title));
/** What a step makes possible, one sentence. */
export const purposeOf = (steps: ProcessStep[], i: number): string => firstSentences(steps[i].purpose ?? '', 1, 180);
/** A sequence card's words. */
export const cardText = (steps: ProcessStep[], item: SequenceItem, i: number): string =>
  (item.asClues ? blankTitle(firstSentences(steps[i].clue, 1, 160), steps[i].title) : steps[i].title);
/** A choice button's words. */
export const choiceText = (steps: ProcessStep[], item: ChoiceItem, i: number): string =>
  // An explain choice blanks the asked step's title words in every choice alike (the question names that step), so a
  // blank never marks the key.
  (item.kind === 'explain' ? blankTitle(purposeOf(steps, i), steps[item.target].title) : steps[i].title);

const usableClue = (steps: ProcessStep[], i: number, pictures: boolean) =>
  // A picture's sentence that names the picture's own title would answer itself (and fall back to tap-only).
  pictures ? !!steps[i].clue && !containsPhrase(steps[i].clue, steps[i].title) : steps[i].clue.length >= 20 && blankedShare(firstSentences(steps[i].clue, 2), steps[i].title) <= 0.4;
const usablePurpose = (steps: ProcessStep[], i: number) => (steps[i].purpose ?? '').length >= 12;

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
const range = (lo: number, hi: number) => (hi < lo ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));

/** Choices for a step-keyed item: the key and `size - 1` others chosen by the tier, shown in a seeded order. */
function choiceSet(key: number, pool: number[], tier: HowTier, size: number, rng: Rng): number[] | null {
  const others = shuffle(pool.filter(j => j !== key), rng);
  const near = others.filter(j => Math.abs(j - key) === 1);
  const far = others.filter(j => Math.abs(j - key) >= 2).sort((a, b) => Math.abs(b - key) - Math.abs(a - key));
  const order = tier === 'easy' ? [...far, ...near] : tier === 'medium' ? [...near.slice(0, 1), ...far, ...near.slice(1)] : [...near, ...far];
  const foils = order.slice(0, size - 1);
  if (foils.length < size - 1) return null;
  if (tier === 'hard' && near.length && !near.every(j => foils.includes(j))) return null;
  return shuffle([key, ...foils], rng);
}
const sizeFor = (tier: HowTier, n: number, pictures: boolean) => Math.min(pictures ? 3 : tier === 'easy' ? 3 : 4, n);

function identifyItems(steps: ProcessStep[], tier: HowTier, pictures: boolean, strip: boolean, count: number, rng: Rng, avoid: Set<number>): IdentifyItem[] {
  const n = steps.length;
  const middle = (t: number) => (t > 0 && t < n - 1 ? 0 : 1);
  const targets = shuffle(range(0, n - 1).filter(t => usableClue(steps, t, pictures) && !avoid.has(t)), rng)
    .sort((a, b) => (tier === 'hard' ? middle(a) - middle(b) : 0));
  const out: IdentifyItem[] = [];
  for (const target of targets) {
    if (out.length >= count) break;
    const options = choiceSet(target, range(0, n - 1), pictures ? 'easy' : tier, sizeFor(tier, n, pictures), rng);
    if (options) { out.push({ id: '', mode: 'guided', kind: 'identify', target, options, strip }); avoid.add(target); }
  }
  return out;
}

function predictItems(steps: ProcessStep[], tier: HowTier, pictures: boolean, count: number, rng: Rng): PredictItem[] {
  const n = steps.length;
  const out: PredictItem[] = [];
  for (const shown of shuffle(range(1, n - 1), rng)) {
    if (out.length >= count) break;
    let options: number[] | null;
    if (tier === 'hard' && !pictures) {
      options = shown + 2 <= n - 1 ? shuffle([shown, shown + 1, shown + 2], rng) : null;
    } else if (tier === 'medium' && !pictures) {
      const far = range(0, n - 1).filter(j => Math.abs(j - shown) >= 2).sort((a, b) => Math.abs(b - shown) - Math.abs(a - shown));
      options = shown + 1 <= n - 1 && far.length ? shuffle([shown, shown + 1, far[0]], rng) : null;
    } else {
      options = choiceSet(shown, range(0, n - 1), 'easy', 3, rng) ?? (n >= 3 ? choiceSet(shown, range(0, n - 1), 'hard', 3, rng) : null);
    }
    if (options) out.push({ id: '', mode: 'predict', kind: 'predict', shown, options });
  }
  return out.sort((a, b) => a.shown - b.shown);
}

function explainItems(steps: ProcessStep[], tier: HowTier, count: number, rng: Rng): ExplainItem[] {
  const n = steps.length;
  const pool = range(0, n - 1).filter(i => usablePurpose(steps, i));
  const out: ExplainItem[] = [];
  for (const target of shuffle(pool, rng)) {
    if (out.length >= count) break;
    const options = choiceSet(target, pool, tier, sizeFor(tier, pool.length, false), rng);
    if (options) out.push({ id: '', mode: 'predict', kind: 'explain', target, options });
  }
  return out;
}

/** Neighbouring steps side by side in the tray, either way round (a run forwards or backwards reads as the order). */
const linked = (bank: number[]) => bank.reduce((k, s, i) => k + (i > 0 && Math.abs(s - bank[i - 1]) === 1 ? 1 : 0), 0);
/** The tray order: never the order or its reverse, with as few neighbouring steps side by side as the cards allow. */
export function bankFor(cards: number[], rng: Rng): number[] {
  if (cards.length === 2) return [cards[1], cards[0]];
  const same = (b: number[], c: number[]) => b.every((s, i) => s === c[i]);
  const reversed = [...cards].reverse();
  let best: number[] | null = null;
  for (let tries = 0; tries < 60; tries++) {
    const b = shuffle(cards, rng);
    if (same(b, cards) || same(b, reversed)) continue;
    if (!best || linked(b) < linked(best)) best = b;
    if (linked(best) === 0) break;
  }
  return best ?? [cards[1], cards[0], ...cards.slice(2).reverse()];
}

function sequenceItem(steps: ProcessStep[], tier: HowTier, pictures: boolean, rng: Rng): SequenceItem | null {
  const n = steps.length;
  if (n < 3) return null;
  const size = pictures || tier === 'hard' ? n : tier === 'easy' ? 3 : Math.min(4, n);
  const start = Math.floor(rng() * (n - size + 1));
  const cards = range(start, start + size - 1);
  const asClues = !pictures && tier === 'hard' && cards.every(i => usableClue(steps, i, false));
  return { id: '', mode: 'sequence', kind: 'sequence', cards, bank: bankFor(cards, rng), asClues };
}

/** The items of a session: per pinned mode, or one of each kind when no mode is pinned. */
export function buildHowItems(opts: { steps: ProcessStep[]; modes: HowMode[] | null; tier: HowTier; pictures: boolean; rng: Rng }): HowItem[] {
  const { steps, tier, pictures, rng } = opts;
  if (steps.length < 3) return [];
  const out: HowItem[] = [];
  const used = new Set<number>();
  const withMode = <T extends HowItem>(xs: T[], mode: HowMode): T[] => xs.map(x => ({ ...x, mode }));
  if (!opts.modes) {
    const seq = sequenceItem(steps, tier, pictures, rng);
    if (pictures) return seq ? [{ ...seq, id: 'sequence-1' }] : [];
    out.push(...identifyItems(steps, tier, false, true, 1, rng, used));
    if (seq) out.push(seq);
    out.push(...predictItems(steps, tier, false, 1, rng), ...explainItems(steps, tier, 1, rng));
  }
  for (const mode of opts.modes ?? []) {
    if (mode === 'guided') out.push(...withMode(identifyItems(steps, tier, pictures, true, 3, rng, used), mode));
    if (mode === 'sequence') {
      const seq = sequenceItem(steps, tier, pictures, rng);
      if (seq) out.push({ ...seq, mode });
      if (!pictures) out.push(...withMode(identifyItems(steps, tier, false, false, 2, rng, used), mode));
    }
    if (mode === 'predict') {
      const why = pictures ? [] : explainItems(steps, tier, 2, rng);
      out.push(...withMode(predictItems(steps, tier, pictures, why.length >= 2 ? 2 : Math.min(3, steps.length - 1), rng), mode));
      if (why.length >= 2) out.push(...withMode(why, mode));
    }
  }
  return out.map((item, i) => ({ ...item, id: `${item.kind}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

const KIND_MODE: Record<string, HowMode> = { identify: 'guided', sequence: 'sequence', predict: 'predict', explain: 'predict' };

export const resolveTier = (d: Pick<HowSource, 'difficulty'>): HowTier => {
  const t = (d.difficulty ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
/** The modes a lesson asks: its pin, else the legacy questions' kinds, else none (one of each kind). */
export function resolveHowModes(d: Pick<HowSource, 'modes' | 'challenges'>): HowMode[] | null {
  const asked = (d.modes ?? []).filter((m): m is HowMode => (HOW_MODES as string[]).includes(m));
  if (asked.length) return HOW_MODES.filter(m => asked.includes(m));
  const legacy = new Set((d.challenges ?? []).map(c => KIND_MODE[c?.type ?? '']).filter(Boolean));
  return legacy.size ? HOW_MODES.filter(m => legacy.has(m)) : null;
}

const inRange = (n: number) => (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < n;
const distinct = (xs: number[]) => new Set(xs).size === xs.length;

/** False when a stored item is not one code could have built over these steps (its key would not be computable). */
export function validHowItem(i: HowItem | undefined, steps: ProcessStep[]): i is HowItem {
  const n = steps.length, ok = inRange(n);
  if (!i || typeof i.id !== 'string' || !(HOW_MODES as string[]).includes(i.mode)) return false;
  if (i.kind === 'sequence') {
    return Array.isArray(i.cards) && i.cards.length >= 2 && i.cards.every(ok) && distinct(i.cards) && i.cards.every((c, k) => k === 0 || c > i.cards[k - 1])
      && Array.isArray(i.bank) && i.bank.length === i.cards.length && [...i.bank].sort((a, b) => a - b).every((c, k) => c === i.cards[k]);
  }
  if (!Array.isArray(i.options) || i.options.length < 2 || !i.options.every(ok) || !distinct(i.options)) return false;
  if (i.kind === 'predict') return ok(i.shown) && i.shown >= 1 && i.options.includes(i.shown);
  if (i.kind === 'explain') return ok(i.target) && i.options.includes(i.target) && i.options.every(o => usablePurpose(steps, o));
  return i.kind === 'identify' && ok(i.target) && i.options.includes(i.target);
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function howItems(d: HowSource): HowItem[] {
  const steps = processSteps(d);
  const stored = Array.isArray(d.items) ? d.items.filter(i => validHowItem(i, steps)) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildHowItems({ steps, modes: resolveHowModes(d), tier: resolveTier(d), pictures: isPictures(d),
    rng: seededRng(`${d.title ?? 'process'}:${steps.map(s => s.title).join('|')}`) });
}

// ── Checks and misses ────────────────────────────────────────────────────────────────────

/** The learner's work: one choice (a step index), or the cards placed so far, first slot first. */
export interface HowWork { choice: number | null; placed: number[] }
export const emptyWork = (): HowWork => ({ choice: null, placed: [] });
export const workComplete = (item: HowItem, w: HowWork) => (item.kind === 'sequence' ? w.placed.length === item.cards.length : w.choice !== null);

export function howCorrect(item: HowItem | undefined, w: HowWork): boolean {
  if (!item) return false;
  if (item.kind === 'sequence') return w.placed.length === item.cards.length && w.placed.every((s, k) => s === item.cards[k]);
  return w.choice === keyStep(item);
}

export const HOW_MISSES: Record<HowMode, readonly HowMiss[]> = {
  guided: CHOICE_MISSES,
  sequence: [...ORDER_MISSES, ...CHOICE_MISSES],
  predict: [...NEXT_MISSES, ...CHOICE_MISSES],
};
export const missesOf = (item: HowItem): readonly HowMiss[] =>
  (item.kind === 'sequence' ? ORDER_MISSES : item.kind === 'predict' ? NEXT_MISSES : CHOICE_MISSES);

/** The miss a chosen step shows, against the item's key. */
export function choiceMiss(item: ChoiceItem, chose: number): ChoiceMiss | NextMiss {
  const key = keyStep(item);
  if (item.kind === 'predict') return chose > key ? 'skipped_ahead' : 'went_back';
  return Math.abs(chose - key) === 1 ? 'neighbour_step' : 'far_step';
}

/** What a wrong order shows, read from the placed order alone (as life-cycle-sequencer's `cycleMiss`). */
export function orderMiss(item: SequenceItem, placed: number[]): OrderMiss | undefined {
  const seq = placed.map(s => item.cards.indexOf(s));
  if (seq.length !== item.cards.length || seq.some(p => p < 0) || seq.every((p, i) => p === i)) return undefined;
  const n = seq.length;
  if (seq.every((p, i) => p === n - 1 - i)) return 'reversed';
  const off = seq.flatMap((p, i) => (p === i ? [] : [i]));
  if (off.length === 2 && seq[off[0]] === off[1] && seq[off[1]] === off[0]) return off[1] - off[0] === 1 ? 'adjacent_swap' : 'two_swapped';
  if (seq.some((_, k) => seq.filter((__, i) => i !== k).every((p, i, rest) => i === 0 || p > rest[i - 1]))) return 'one_moved';
  return 'mixed_order';
}

export function howMiss(item: HowItem | undefined, w: HowWork): HowMiss | undefined {
  if (!item || !workComplete(item, w) || howCorrect(item, w)) return undefined;
  return item.kind === 'sequence' ? orderMiss(item, w.placed) : choiceMiss(item, w.choice!);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

export function askOf(steps: ProcessStep[], item: HowItem, pictures: boolean, question?: string): string {
  if (item.kind === 'identify') {
    return pictures ? `Which picture shows this? "${clueOf(steps, item.target, true)}"`
      : `Which step does this describe? "${clueOf(steps, item.target, false)}" (The step's own name is blanked out.)`;
  }
  if (item.kind === 'sequence') {
    if (pictures) return question?.trim() || 'Put the pictures in order, from first to last.';
    return item.asClues ? `Put these ${item.cards.length} parts of the process in order, from first to last.`
      : `Put these ${item.cards.length} steps in order, from first to last.`;
  }
  if (item.kind === 'predict') {
    const first = item.shown === 1 ? 'Here is the first step' : `Here are the first ${item.shown} steps`;
    return `${first} of the process${pictures ? ', in pictures' : ''}. What happens next?`;
  }
  return `Why does step ${item.target + 1}, "${steps[item.target].title}", matter? Choose what it makes possible.`;
}

const ORDINAL = ['first', 'second', 'third', 'fourth'];

const MISS_SAYS: Record<ChoiceMiss | NextMiss, string> = {
  neighbour_step: 'names a step right before or after it',
  far_step: 'names a step further away in the process',
  skipped_ahead: 'names a step that comes later, not next',
  went_back: 'names a step that already happened',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function howSpokenMisses(steps: ProcessStep[], item: IdentifyItem | PredictItem): KnownMiss[] {
  const key = keyStep(item);
  const groups = new Map<ChoiceMiss | NextMiss, string[]>();
  for (const o of item.options) if (o !== key) { const m = choiceMiss(item, o); groups.set(m, [...(groups.get(m) ?? []), steps[o].title]); }
  return missesOf(item).filter(m => groups.has(m as ChoiceMiss | NextMiss)).map(m => {
    const ex = groups.get(m as ChoiceMiss | NextMiss)!;
    return { id: m, pattern: `The right answer is "${steps[key].title}". The learner ${MISS_SAYS[m as ChoiceMiss | NextMiss]}: ${ex.map(x => `"${x}"`).join(', ')}.`, examples: ex };
  });
}

// ── The session's check items, spoken keys ──────────────────────────────────────────────

/**
 * An item as the boss and the component carry it: the item, the lesson's steps, whether they are pictures, and a
 * pre-reader's own order question (so the ask, the key and the levers read the process without the lesson).
 */
export type HowCheck = HowItem & { steps: ProcessStep[]; pictures: boolean; question?: string };

/** An item as a check of this lesson. */
export const asCheck = (item: HowItem, steps: ProcessStep[], pictures: boolean, question?: string): HowCheck =>
  ({ ...item, steps, pictures, ...(question ? { question } : {}) });

/** Every check item of the session (`howItems`), carrying the steps. */
export function howChecks(d: HowSource): HowCheck[] {
  const steps = processSteps(d), pictures = isPictures(d), question = d.preReader?.question;
  return howItems(d).map(i => asCheck(i, steps, pictures, question));
}

/** The check's ask. */
export const askOfCheck = (c: HowCheck): string => askOf(c.steps, c, c.pictures, c.question);

/**
 * The key of an item whose answer is a step's name (identify, predict): the step's name, its place among the choices,
 * and on an identify with the step list on screen its step number. Null on an order or a purpose (the activity checks
 * it), and on an item whose ask would say the name (a picture sentence that names its own picture): that one is only
 * tapped.
 */
export function howKey(c: HowCheck): SpokenKey | null {
  if (c.kind !== 'identify' && c.kind !== 'predict') return null;
  const at = keyStep(c), step = c.steps[at], answer = step?.title.trim();
  if (!answer) return null;
  const key: SpokenKey = {
    answer,
    alsoAccept: [...(c.kind === 'identify' && c.strip ? [`step ${at + 1}`] : []), `the ${ORDINAL[c.options.indexOf(at)]} one`],
    acceptRule: `Words that clearly mean that step${c.pictures && step.emoji ? ` (the ${step.emoji} picture)` : ''} and no other choice also count.`,
    signatureError: 'Naming two choices, or hedging between them, is not an answer.',
  };
  return askLeaks(askOfCheck(c), key).length ? null : key;
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface HowView {
  /** Reading the process before the questions open (the first item only). */
  reading: boolean;
  work: HowWork;
  /** Credited: the screen marks the answer. */
  solved: boolean;
  /** Choices crossed out by a lever. */
  crossed: readonly number[];
  /** show_why is on screen: under each card, what its step makes possible. */
  why?: boolean;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const titleList = (steps: ProcessStep[], idx: number[]) => idx.map(i => `${i + 1}) ${steps[i].title}`).join('  ');

export function describeHowWork(steps: ProcessStep[], item: HowItem | undefined, w: HowWork, pictures = false): string {
  if (!item) return 'Nothing chosen yet';
  if (item.kind === 'sequence') {
    if (!w.placed.length) return 'No card placed yet';
    return `Placed: ${w.placed.map((s, k) => `slot ${k + 1} "${pictures || !item.asClues ? steps[s].title : clip(cardText(steps, item, s), 60)}"`).join(', ')}`
      + (w.placed.length < item.cards.length ? `; ${item.cards.length - w.placed.length} still in the tray` : '');
  }
  return w.choice === null ? 'Nothing chosen yet' : `Chose "${clip(choiceText(steps, item, w.choice), 120)}"`;
}

/**
 * This process's own rules for each kind of question (the shared doctrine already forbids saying the answer and doing
 * the learner's step): what would answer the question, said or hinted.
 */
const NO_RETELL = 'Never retell the steps in order.';
const ASK_AROUND = 'You may ask what has to happen before or after a step the learner names.';
const KIND_RULES: Record<HowKind, string> = {
  identify: `Never say which step the description tells of, its number, or the blanked words. ${ASK_AROUND}`,
  sequence: 'Never say or imply which card comes first, next or last, what comes before or after any card, or that two '
    + 'cards are swapped, even as a question ("what happens after your foot pushes down?").',
  predict: `Never say or describe what the next step does, or hint with a word from the name of a choice. ${ASK_AROUND}`,
  explain: 'Never say in your own words what the asked step makes possible, carries or connects (that is the answer), or '
    + `which choice fits. ${ASK_AROUND}`,
};
const AFTER = 'After a miss, never say why the wrong choice was chosen. Describe a lever only by what the scene says it shows.';

/** What is drawn and asked. The steps' order is listed only where the screen shows it in order. */
export function workspaceScene(c: HowCheck, view: HowView, meta: { title: string }): SceneOf {
  const { steps, pictures } = c;
  const facts: Record<string, string> = { process: meta.title };
  if (view.reading) {
    facts.phase = 'reading';
    facts.reading = pictures
      ? 'The picture steps are on screen in order, each with a short caption. The questions open when the learner presses Start; nothing is asked until then.'
      : 'The steps are on screen in order with their descriptions. The questions open when the learner presses "Start the questions"; nothing is asked until then.';
    steps.forEach((s, i) => { facts[`step${i + 1}`] = clip(`${s.emoji ? `${s.emoji} ` : ''}${s.title}: ${firstSentences(s.clue, 2, 300)}`, 360); });
    facts.constraints = pictures
      ? 'The learner cannot read yet: read the picture steps aloud, in order, word for word, then invite them to press Start.'
      : 'Nothing is asked yet: talk about the steps freely while the learner reads.';
    return { objects: [], facts } as SceneOf;
  }
  facts.phase = 'question';
  facts.kind = c.kind;
  facts.question = askOfCheck(c);
  if (c.kind === 'sequence') {
    facts.cards = `${c.cards.length} cards shown mixed up, not in order: ${c.bank.map(s => `"${clip(cardText(steps, c, s), 90)}"`).join('; ')}`;
    facts.slots = `${c.cards.length} numbered slots, first to last`;
    facts.shown = 'No step list is on screen.';
    if (view.why) c.bank.forEach((s, k) => { facts[`why${k + 1}`] = `Under "${clip(cardText(steps, c, s), 80)}": ${purposeOf(steps, s)}`; });
  } else {
    const choices = c.options.map((o, k) => `${k + 1}) ${choiceText(steps, c, o)}${view.crossed.includes(o) ? ' (crossed out)' : ''}`);
    if (c.kind === 'explain') choices.forEach((ch, k) => { facts[`choice${k + 1}`] = clip(ch, 220); });
    else facts.choices = choices.join('  ');
    facts.shown = c.kind === 'predict' ? `Steps 1 to ${c.shown} are on screen in order: ${titleList(steps, range(0, c.shown - 1))}. The later steps are hidden.`
      : c.kind === 'explain' || c.strip ? `The step list is on screen, in order: ${titleList(steps, range(0, steps.length - 1))}.`
        : 'No step list is on screen: the learner answers from what they read.';
  }
  facts.learnerWork = describeHowWork(steps, c, view.work, pictures);
  if (view.solved) facts.answered = 'The answer is credited and marked on screen.';
  facts.constraints = `${howKey(c) ? '' : 'This item is answered only on screen, and you are not told its answer. '}${NO_RETELL} `
    + `${KIND_RULES[c.kind]} ${AFTER}`;
  return { objects: [], facts } as SceneOf;
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and a wrong answer showing the item's first-listed miss it can. */
export function howHarnessAnswers(item: HowItem): { correct: HowWork; plainWrong: HowWork } {
  if (item.kind === 'sequence') {
    const wrong = [...item.cards]; [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
    return { correct: { choice: null, placed: [...item.cards] }, plainWrong: { choice: null, placed: wrong } };
  }
  const key = keyStep(item), rank = missesOf(item);
  const wrongs = item.options.filter(o => o !== key).sort((a, b) => rank.indexOf(choiceMiss(item, a)) - rank.indexOf(choiceMiss(item, b)));
  return { correct: { choice: key, placed: [] }, plainWrong: { choice: wrongs[0], placed: [] } };
}

/** The button labels the journey presses for a piece of work. */
export function howPresses(steps: ProcessStep[], item: HowItem, w: HowWork): string[] {
  if (item.kind === 'sequence') return w.placed.map(s => cardText(steps, item, s));
  return w.choice === null ? [] : [choiceText(steps, item, w.choice)];
}
