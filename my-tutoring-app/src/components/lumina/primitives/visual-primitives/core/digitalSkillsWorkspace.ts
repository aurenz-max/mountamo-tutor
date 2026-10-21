/**
 * digital-skills-sim on the shared tutor/JEV teaching workspace (W1, plain shape).
 *
 * Every item is built and keyed by code from a picture theme the generator picks. Each mode is a task with one right
 * action among wrong ones:
 * - click: pictures spread across a play area; the ask names one ("Click the cow."). easy 2 pictures, medium 3,
 *   hard 4, each step smaller.
 * - drag: one picture and some boxes, each box a different picture (basket, box, bucket); the ask names the box. The
 *   learner presses on the picture, holds, moves it and lets go over the named box. easy 2 boxes, medium 3, hard 4
 *   smaller.
 * - type: an on-screen keyboard of capital letters, and a letter or word card. easy a capital letter, medium a small
 *   letter whose capital looks different (the key shows the capital), hard a three-letter word typed in order.
 * Every answer is an action on the screen (a press, a drag, a key), so every item is a gesture checked by code; saying
 * the letter aloud is letter naming, not finding the key.
 *
 * The arena (click, drag) is one SVG in viewBox units; a press and release on it is read in those units, so the
 * checks below are pure geometry. Pure: the component, the generator, the boss and the tests read the same items,
 * checks, misses and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SkillMiss } from './digitalSkillsSim.card';

export { SKILL_MISSES, type ClickMiss, type DragMiss, type SkillMiss, type TypeMiss } from './digitalSkillsSim.card';

export type SkillMode = 'click' | 'drag' | 'type';
export const SKILL_MODES: SkillMode[] = ['click', 'drag', 'type'];
export type SkillTier = 'easy' | 'medium' | 'hard';

export interface Thing { name: string; emoji: string }
export type ThemeId = 'farm' | 'ocean' | 'space' | 'food' | 'school' | 'toys';
export const THEME_IDS: ThemeId[] = ['farm', 'ocean', 'space', 'food', 'school', 'toys'];
const t = (name: string, emoji: string): Thing => ({ name, emoji });
export const THEMES: Record<ThemeId, Thing[]> = {
  farm: [t('cow', '🐄'), t('pig', '🐖'), t('hen', '🐔'), t('horse', '🐴'), t('sheep', '🐑'), t('duck', '🦆'), t('tractor', '🚜')],
  ocean: [t('fish', '🐟'), t('octopus', '🐙'), t('crab', '🦀'), t('whale', '🐳'), t('turtle', '🐢'), t('shell', '🐚'), t('sailboat', '⛵')],
  space: [t('rocket', '🚀'), t('moon', '🌙'), t('star', '⭐'), t('planet', '🪐'), t('sun', '☀️'), t('alien', '👽'), t('comet', '☄️')],
  food: [t('apple', '🍎'), t('banana', '🍌'), t('carrot', '🥕'), t('cookie', '🍪'), t('grapes', '🍇'), t('pizza', '🍕'), t('cheese', '🧀')],
  school: [t('pencil', '✏️'), t('book', '📕'), t('scissors', '✂️'), t('crayon', '🖍️'), t('ruler', '📏'), t('paint', '🎨'), t('globe', '🌍')],
  toys: [t('ball', '⚽'), t('teddy bear', '🧸'), t('kite', '🪁'), t('toy car', '🚗'), t('drum', '🥁'), t('yo-yo', '🪀'), t('blocks', '🧱')],
};
/** The boxes a drag item goes into: the same five in every theme. */
export const HOMES: Thing[] = [t('basket', '🧺'), t('box', '📦'), t('bucket', '🪣'), t('cart', '🛒'), t('bowl', '🥣')];

export interface ClickItem { id: string; mode: 'click'; theme: ThemeId; things: Thing[]; target: number }
export interface DragItem { id: string; mode: 'drag'; theme: ThemeId; thing: Thing; homes: Thing[]; target: number }
export interface TypeItem {
  id: string; mode: 'type';
  /** Capital letters: one letter, or a word typed in order. */
  text: string;
  /** The card shows the small letter (the key shows the capital). */
  lower: boolean;
}
export type SkillItem = ClickItem | DragItem | TypeItem;
type Unkeyed<T> = T extends unknown ? Omit<T, 'id'> : never;
/** An item before the session numbers it. */
export type NewSkillItem = Unkeyed<SkillItem>;

// ── The arena, in viewBox units ──────────────────────────────────────────────────────────

export const ARENA = { w: 600, h: 300 };
export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

/** Where n click pictures sit (centres), and their radius. Fixed per count; the target's place is the item's. */
export const SPOTS: Record<number, Point[]> = {
  2: [{ x: 160, y: 150 }, { x: 440, y: 150 }],
  3: [{ x: 110, y: 95 }, { x: 300, y: 205 }, { x: 490, y: 95 }],
  4: [{ x: 90, y: 90 }, { x: 240, y: 210 }, { x: 380, y: 90 }, { x: 520, y: 210 }],
};
export const RADIUS: Record<number, number> = { 2: 52, 3: 40, 4: 30 };
/** big_targets: every picture's radius times this. */
export const BIG = 1.4;
export const radiusOf = (n: number, big: boolean) => Math.round(RADIUS[n] * (big ? BIG : 1));

/** Where the drag picture starts, and the drop boxes for n boxes. */
export const DRAG_START: Point = { x: 90, y: 150 };
export const DRAG_GRAB = 34;
export const BOXES: Record<number, Box[]> = {
  2: [{ x: 400, y: 30, w: 150, h: 100 }, { x: 400, y: 170, w: 150, h: 100 }],
  3: [{ x: 420, y: 30, w: 120, h: 80 }, { x: 420, y: 190, w: 120, h: 80 }, { x: 260, y: 110, w: 110, h: 80 }],
  4: [{ x: 260, y: 40, w: 90, h: 70 }, { x: 260, y: 190, w: 90, h: 70 }, { x: 450, y: 40, w: 90, h: 70 }, { x: 450, y: 190, w: 90, h: 70 }],
};
/** big_boxes: every box's catch area grows by this much on each side. */
export const PAD = 18;
export const boxOf = (b: Box, big: boolean): Box => (big ? { x: b.x - PAD, y: b.y - PAD, w: b.w + 2 * PAD, h: b.h + 2 * PAD } : b);
const inBox = (p: Point, b: Box) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// ── Keyboard ─────────────────────────────────────────────────────────────────────────────

export const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const ROW_SHIFT = [0, 0.5, 1.2];
const keyAt = (k: string): Point | null => {
  for (let r = 0; r < KEY_ROWS.length; r++) { const i = KEY_ROWS[r].indexOf(k); if (i >= 0) return { x: ROW_SHIFT[r] + i, y: r }; }
  return null;
};
export const rowOf = (k: string) => KEY_ROWS.findIndex(r => r.includes(k.toUpperCase()));
/** Two keys that touch on the keyboard. */
export function neighbours(a: string, b: string): boolean {
  const p = keyAt(a.toUpperCase()), q = keyAt(b.toUpperCase());
  if (!p || !q || a.toUpperCase() === b.toUpperCase()) return false;
  return p.y === q.y ? Math.abs(p.x - q.x) === 1 : Math.abs(p.y - q.y) === 1 && Math.abs(p.x - q.x) <= 0.8;
}
/** Small letters that are each other's mirror image. */
export const MIRRORS: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };

// ── Work, checks and misses ──────────────────────────────────────────────────────────────

/**
 * The learner's work on the current item: where the press was let go (click, drag; null until then) and the keys
 * pressed so far (type).
 */
export interface SkillWork { release: Point | null; keys: string[] }
export const emptyWork = (): SkillWork => ({ release: null, keys: [] });

/** Which picture a release lands on (click), or null. */
export function thingHit(item: ClickItem, p: Point, big: boolean): number | null {
  const n = item.things.length, r = radiusOf(n, big);
  const spots = SPOTS[n];
  let best: number | null = null;
  for (let i = 0; i < n; i++) if (dist(p, spots[i]) <= r && (best === null || dist(p, spots[i]) < dist(p, spots[best]))) best = i;
  return best;
}
/** Which box a release lands in (drag), or null. */
export function boxHit(item: DragItem, p: Point, big: boolean): number | null {
  const boxes = BOXES[item.homes.length];
  for (let i = 0; i < boxes.length; i++) if (inBox(p, boxOf(boxes[i], big))) return i;
  return null;
}
/** A drag starts only on the picture. */
export const onGrab = (p: Point) => dist(p, DRAG_START) <= DRAG_GRAB;

/** Big levers change what counts as on a picture or in a box, so the checks take them. */
export interface Reach { big: boolean }

/** The typed text so far is a right start of the word, and the last key is wrong. */
const typedWrong = (item: TypeItem, keys: string[]) => keys.some((k, i) => k !== item.text[i]);
export function workComplete(item: SkillItem, w: SkillWork): boolean {
  if (item.mode === 'type') return typedWrong(item, w.keys) || w.keys.length >= item.text.length;
  return w.release !== null;
}

export function skillCorrect(item: SkillItem | undefined, w: SkillWork, reach: Reach = { big: false }): boolean {
  if (!item || !workComplete(item, w)) return false;
  if (item.mode === 'click') return thingHit(item, w.release!, reach.big) === item.target;
  if (item.mode === 'drag') return boxHit(item, w.release!, reach.big) === item.target;
  return w.keys.join('') === item.text;
}

export function skillMiss(item: SkillItem | undefined, w: SkillWork, reach: Reach = { big: false }): SkillMiss | undefined {
  if (!item || !workComplete(item, w) || skillCorrect(item, w, reach)) return undefined;
  if (item.mode === 'click') return thingHit(item, w.release!, reach.big) === null ? 'missed_picture' : 'wrong_picture';
  if (item.mode === 'drag') return boxHit(item, w.release!, reach.big) === null ? 'let_go_outside' : 'wrong_box';
  const at = w.keys.findIndex((k, i) => k !== item.text[i]);
  const want = item.text[at], got = w.keys[at];
  if (item.lower && MIRRORS[want.toLowerCase()] === got.toLowerCase()) return 'mirror_letter';
  if (neighbours(want, got)) return 'neighbour_key';
  return 'wrong_key';
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const shownText = (item: TypeItem) => (item.lower ? item.text.toLowerCase() : item.text);
export function askOf(item: SkillItem): string {
  if (item.mode === 'click') return `Click the ${item.things[item.target].name}.`;
  if (item.mode === 'drag') return `Drag the ${item.thing.name} into the ${item.homes[item.target].name}.`;
  if (item.text.length > 1) return `Type the word ${item.text}: press its letters in order.`;
  return `Find the letter ${shownText(item)} on the keyboard and press it.`;
}

// ── Item space ───────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
export const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export const COUNT_BY_TIER: Record<SkillTier, number> = { easy: 2, medium: 3, hard: 4 };
/** Small letters whose capital has another shape: the medium tier's letters. */
export const SHAPE_CHANGING = 'abdefghijlmnqrty';
/** Three-letter words a K-1 reader meets, each with three different letters. */
export const WORDS = ['CAT', 'DOG', 'SUN', 'HAT', 'PIG', 'BUS', 'CUP', 'BED', 'FOX', 'HEN', 'MAP', 'JAM', 'BOX', 'RUG', 'NET', 'VAN', 'WEB', 'ZIP', 'LOG', 'MOP'];

export function buildClick(theme: ThemeId, n: number, rng: Rng, avoid?: string): Omit<ClickItem, 'id'> {
  const things = shuffle(THEMES[theme].filter(x => x.name !== avoid), rng).slice(0, n);
  return { mode: 'click', theme, things, target: Math.floor(rng() * n) };
}
export function buildDrag(theme: ThemeId, n: number, rng: Rng, avoid?: { thing: string; home: string }): Omit<DragItem, 'id'> {
  const thing = shuffle(THEMES[theme].filter(x => x.name !== avoid?.thing), rng)[0];
  const homes = shuffle(HOMES, rng).slice(0, n);
  let target = Math.floor(rng() * n);
  if (avoid && homes[target].name === avoid.home) target = (target + 1) % n;
  return { mode: 'drag', theme, thing, homes, target };
}

export const ITEM_COUNT: Record<SkillMode, [number, number]> = { click: [5, 3], drag: [5, 3], type: [5, 3] };

/** The items of one mode at one tier: distinct targets, the target's place varying. */
export function buildModeItems(mode: SkillMode, tier: SkillTier, theme: ThemeId, count: number, rng: Rng): NewSkillItem[] {
  const n = COUNT_BY_TIER[tier];
  const out: NewSkillItem[] = [];
  if (mode === 'type') {
    const pool = tier === 'hard' ? shuffle(WORDS, rng)
      : shuffle(tier === 'medium' ? SHAPE_CHANGING.toUpperCase().split('') : KEY_ROWS.join('').split(''), rng);
    for (const text of pool.slice(0, count)) out.push({ mode: 'type', text, lower: tier === 'medium' });
    return out;
  }
  const used = new Set<string>();
  const places = shuffle(Array.from({ length: Math.max(count, n) }, (_, i) => i % n), rng);
  for (let k = 0; k < count; k++) {
    let item: Omit<ClickItem, 'id'> | Omit<DragItem, 'id'> | null = null;
    for (let tries = 0; tries < 20 && !item; tries++) {
      const c = mode === 'click' ? buildClick(theme, n, rng) : buildDrag(theme, n, rng);
      const name = c.mode === 'click' ? c.things[c.target].name : `${c.thing.name}>${c.homes[c.target].name}`;
      if (!used.has(name) || tries === 19) { used.add(name); item = c; }
    }
    // The target's place cycles through every spot, so no place is always right.
    const it = item!, want = places[k];
    if (it.mode === 'click') { const tg = it.things[it.target]; it.things.splice(it.target, 1); it.things.splice(want, 0, tg); it.target = want; }
    else { const tg = it.homes[it.target]; it.homes.splice(it.target, 1); it.homes.splice(want, 0, tg); it.target = want; }
    out.push(it);
  }
  return out;
}

export function buildSkillItems(opts: { modes: SkillMode[]; tier: SkillTier; theme: ThemeId; rng: Rng }): SkillItem[] {
  const out: NewSkillItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, opts.theme, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }) as SkillItem);
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface SkillItemsSource {
  title?: string;
  theme?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: SkillItem[];
  /** Legacy generations (model-written challenges, before 2026-10-16): read only for their modes. */
  challenges?: Array<{ type?: string }>;
}

export const resolveTheme = (d: SkillItemsSource): ThemeId => ((THEME_IDS as string[]).includes(d.theme ?? '') ? d.theme as ThemeId : 'toys');
export const resolveTier = (d: SkillItemsSource): SkillTier => {
  const x = (d.difficulty ?? '').toLowerCase();
  return x === 'easy' || x === 'hard' ? x : 'medium';
};
export function resolveSkillModes(d: SkillItemsSource): SkillMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is SkillMode => (SKILL_MODES as string[]).includes(m));
  if (asked.length) return SKILL_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is SkillMode => (SKILL_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return SKILL_MODES.filter(m => legacy.includes(m));
  return [...SKILL_MODES];
}

const isThing = (x: Thing | undefined) => !!x && typeof x.name === 'string' && !!x.name && typeof x.emoji === 'string' && !!x.emoji;
/** False when a stored item is not one code could have built (its key would not be computable). */
export function validSkillItem(i: SkillItem | undefined): i is SkillItem {
  if (!i || typeof i.id !== 'string' || !i.id) return false;
  if (i.mode === 'click') {
    return Array.isArray(i.things) && !!SPOTS[i.things.length] && i.things.every(isThing)
      && new Set(i.things.map(x => x.name)).size === i.things.length && Number.isInteger(i.target) && i.target >= 0 && i.target < i.things.length;
  }
  if (i.mode === 'drag') {
    return isThing(i.thing) && Array.isArray(i.homes) && !!BOXES[i.homes.length] && i.homes.every(isThing)
      && new Set(i.homes.map(x => x.name)).size === i.homes.length && Number.isInteger(i.target) && i.target >= 0 && i.target < i.homes.length;
  }
  if (i.mode === 'type') return typeof i.text === 'string' && /^[A-Z]{1,5}$/.test(i.text) && typeof i.lower === 'boolean';
  return false;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function skillItems(d: SkillItemsSource): SkillItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validSkillItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildSkillItems({ modes: resolveSkillModes(d), tier: resolveTier(d), theme: resolveTheme(d),
    rng: seededRng(`${d.title ?? 'digital'}:${resolveTheme(d)}`) });
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const an = (s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`);

/** The learner's work in words, never the key. */
export function describeSkillWork(item: SkillItem | undefined, w: SkillWork, reach: Reach = { big: false }): string {
  if (!item) return 'Nothing done yet';
  if (item.mode === 'type') return w.keys.length ? `Pressed ${w.keys.join(', ')}` : 'No key pressed yet';
  if (!w.release) return 'Nothing done yet';
  if (item.mode === 'click') {
    const hit = thingHit(item, w.release, reach.big);
    return hit === null ? 'Clicked an empty part of the play area, on no picture' : `Clicked the ${item.things[hit].name}`;
  }
  const hit = boxHit(item, w.release, reach.big);
  return hit === null ? `Let go of the ${item.thing.name} outside every box` : `Dropped the ${item.thing.name} into the ${item.homes[hit].name}`;
}

/** This primitive's own facts: the answer is a place on screen, so where a picture, box or key sits is never said. */
const CONSTRAINTS: Record<SkillMode, string> = {
  click: 'No picture is marked, labelled or highlighted. Where the named picture sits in the play area is part of the answer.',
  drag: 'No box is marked. Where the named box sits in the play area is part of the answer.',
  type: 'No key is marked or highlighted. Where the key sits on the keyboard is part of the answer, and so is the capital of a small letter.',
};

export interface SkillView { work: SkillWork; reach: Reach }

/** What is drawn and asked. Never where the target is or which key is right. */
/** How the hand does the move, which is the skill taught: teaching it is help, never the answer. */
const HAND_COACHING: Record<SkillItem['mode'], string> = {
  click: 'Teaching the move is fine: move the pointer onto a picture first, keep the hand still, then click.',
  drag: 'Teaching the move is fine: press and hold the button on the picture, keep holding while you move, let go only over a box.',
  type: 'Teaching the move is fine: look across the keys for the letter, then press it once.',
};

export function workspaceScene(item: SkillItem, view: SkillView): SceneOf {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  if (item.mode === 'click') {
    facts.shown = `${item.things.length} pictures spread across a play area, with no words: ${list(item.things.map(x => an(x.name)))}.`;
  } else if (item.mode === 'drag') {
    facts.shown = `A picture of ${an(item.thing.name)} at one side of the play area, and ${item.homes.length} boxes drawn as pictures with no words: `
      + `${list(item.homes.map(x => an(x.name)))}.`;
  } else {
    facts.shown = `An on-screen keyboard of capital letters in the usual three rows. Above it, a card shows ${item.text.length > 1 ? `the word ${item.text}` : `the letter ${shownText(item)}`}`
      + `${item.lower ? ' as a small letter; the keys show capital letters' : ''}.`;
    if (item.text.length > 1) facts.typed = view.work.keys.length ? `Typed so far: ${view.work.keys.join('')}` : 'Nothing typed yet';
  }
  facts.learnerWork = describeSkillWork(item, view.work, view.reach);
  facts.constraints = CONSTRAINTS[item.mode];
  // The motor skill is what this primitive teaches; coaching the hand never names which picture, box or key.
  facts.handCoaching = HAND_COACHING[item.mode];
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** A one-point press and release (a click), or a stroke from the picture to a point (a drag), in viewBox units. */
export type Stroke = Point[];

/** The journey's answers: the right action, and a wrong one showing the mode's first-listed miss. */
export function skillHarnessAnswers(item: SkillItem): { correct: Stroke | string[]; plainWrong: Stroke | string[] } {
  if (item.mode === 'click') {
    const spots = SPOTS[item.things.length];
    const other = spots.findIndex((_, i) => i !== item.target);
    return { correct: [spots[item.target]], plainWrong: [spots[other]] };
  }
  if (item.mode === 'drag') {
    const boxes = BOXES[item.homes.length];
    const centre = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    const other = boxes.findIndex((_, i) => i !== item.target);
    const path = (to: Point): Stroke => [DRAG_START, { x: (DRAG_START.x + to.x) / 2, y: (DRAG_START.y + to.y) / 2 }, to];
    return { correct: path(centre(boxes[item.target])), plainWrong: path(centre(boxes[other])) };
  }
  const letters = item.text.split('');
  const want = item.text[0];
  const wrong = KEY_ROWS.join('').split('').find(k => k !== want && !neighbours(k, want) && MIRRORS[want.toLowerCase()] !== k.toLowerCase())!;
  return { correct: letters, plainWrong: [wrong] };
}

/** The aria-label of a keyboard key. "Tap" marks it as an action, not an answer to say. */
export const keyLabel = (k: string) => `Tap ${k}`;
