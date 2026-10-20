/**
 * telescope-simulator on the shared tutor/JEV teaching workspace (W1, plain shape; R2 batch B1, rebuilt 2026-10-16
 * under the 10-15 ruling).
 *
 * Code builds every item and its key from a fixed table of real sky objects (`SKY_OBJECTS`, `DETAILS`); Gemini writes
 * only the title and a one-sentence overview. No object wears a name, ring or badge before the learner answers, and
 * nothing is scored for exploring. Each mode is one task:
 * - find_by_look: 3-4 unnamed objects in a telescope view; the ask describes one object's look ("a yellow ball with a
 *   ring around it") and the learner taps it. The key is the one object whose drawn look has every clue.
 *   easy: 3 objects, none sharing a clue with the ask; medium: 4, one with the same shape; hard: 4, one that shows
 *   every clue but one.
 * - brightest: 2-4 unnamed objects seen through binoculars, each drawn as bright as it shines (from its magnitude);
 *   the learner taps the brightest. easy: 2 dots far apart in brightness; medium: 3 dots, closer; hard: 4 objects with
 *   a big faint patch that is drawn bigger than the brightest one.
 * - object_type: one unnamed object in the middle of the view; the learner says or taps its kind. easy: 2 kinds from
 *   different families; medium: 3; hard: 4 with both look-alike kinds, through binoculars where the cues are smaller.
 * - pick_instrument: a named detail ("Saturn's rings"); the learner says or taps the least powerful instrument that
 *   shows it. The key comes from `DETAILS`, never from a model. easy: 2 instruments; medium: 3; hard: 4.
 * object_type and pick_instrument are sayable closed choices (a `SpokenKey`, tap also checked); find_by_look and
 * brightest are taps on unnamed objects, checked by code. The wiring is `telescopeSimulator.card.ts` +
 * `telescopeSimulator.boss.ts`.
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import {
  TELESCOPE_MISSES, type BrightMiss, type FindMiss, type InstrumentMiss, type TelescopeMiss, type TypeMiss,
} from './telescopeSimulator.card';

export { TELESCOPE_MISSES };
export type { BrightMiss, FindMiss, InstrumentMiss, TelescopeMiss, TypeMiss };

export type TelescopeMode = 'find_by_look' | 'brightest' | 'object_type' | 'pick_instrument';
export const TELESCOPE_MODES: TelescopeMode[] = ['find_by_look', 'brightest', 'object_type', 'pick_instrument'];
export type TelescopeTier = 'easy' | 'medium' | 'hard';

// ── Instruments ──────────────────────────────────────────────────────────────────────────

export type Scope = 'eyes' | 'binoculars' | 'small' | 'large' | 'space';
export const SCOPES: Scope[] = ['eyes', 'binoculars', 'small', 'large', 'space'];
/** `say`: other ways to say an instrument, beside its button label. */
export const SCOPE_TEXT: Record<Scope, { button: string; with: string; power: string; say: readonly string[] }> = {
  eyes: { button: 'Just your eyes', with: 'with just your eyes', power: 'no magnifying: things look their normal size', say: ['no telescope', 'my eyes'] },
  binoculars: { button: 'Binoculars', with: 'through binoculars', power: 'makes things look about 10 times bigger', say: [] },
  small: { button: 'Small telescope', with: 'through a small telescope', power: 'makes things look about 50 times bigger', say: ['a small telescope', 'the small telescope'] },
  large: { button: 'Large telescope', with: 'through a large telescope', power: 'makes things look about 200 times bigger', say: ['a large telescope', 'a big telescope', 'the large telescope'] },
  space: { button: 'Space telescope', with: 'through a space telescope', power: 'flies above the air, so its view is the sharpest of all', say: ['a space telescope', 'the space telescope'] },
};
export const scopeRank = (s: Scope) => SCOPES.indexOf(s);

// ── Kinds ────────────────────────────────────────────────────────────────────────────────

export type Kind = 'moon' | 'planet' | 'star' | 'cluster' | 'nebula' | 'galaxy';
export const KINDS: Kind[] = ['moon', 'planet', 'star', 'cluster', 'nebula', 'galaxy'];
export const KIND_TEXT: Record<Kind, string> = { moon: 'Moon', planet: 'Planet', star: 'Star', cluster: 'Star cluster', nebula: 'Nebula', galaxy: 'Galaxy' };
/** Other ways to say a kind, beside its button label. */
const KIND_SAY: Record<Kind, readonly string[]> = {
  moon: ['the Moon', 'a moon'], planet: ['a planet'], star: ['a star'],
  cluster: ['a star cluster', 'a cluster', 'a group of stars'], nebula: ['a nebula'], galaxy: ['a galaxy'],
};
/** Sharp-edged objects (moon, planet, star) and fuzzy ones (cluster, nebula, galaxy): the look-alike families. */
export const FAMILY: Record<Kind, 'sharp' | 'fuzzy'> = { moon: 'sharp', planet: 'sharp', star: 'sharp', cluster: 'fuzzy', nebula: 'fuzzy', galaxy: 'fuzzy' };

// ── The sky objects (real objects; magnitudes rounded) ──────────────────────────────────

export type Feature = 'patches' | 'craters' | 'moons' | 'stripes' | 'spot' | 'ring' | 'crescent' | 'cap' | 'partner'
  | 'many' | 'four' | 'gap' | 'middle' | 'lanes';

export interface SkyObjectDef {
  id: string;
  name: string;
  kind: Kind;
  color: string;
  colorWord: string;
  /** Apparent magnitude: lower is brighter. */
  mag: number;
  /** Each look feature, from the weakest instrument that shows it. */
  features: Partial<Record<Feature, Scope>>;
}

const obj = (id: string, name: string, kind: Kind, color: string, colorWord: string, mag: number,
  features: Partial<Record<Feature, Scope>> = {}): SkyObjectDef => ({ id, name, kind, color, colorWord, mag, features });

export const SKY_OBJECTS: SkyObjectDef[] = [
  obj('moon', 'the Moon', 'moon', '#d6d3cb', 'grey', -12.7, { patches: 'eyes', craters: 'binoculars' }),
  obj('venus', 'Venus', 'planet', '#fff6dc', 'bright white', -4.2, { crescent: 'small' }),
  obj('jupiter', 'Jupiter', 'planet', '#d9b38c', 'tan', -2.5, { moons: 'binoculars', stripes: 'small', spot: 'large' }),
  obj('saturn', 'Saturn', 'planet', '#f2d36b', 'yellow', 0.5, { ring: 'small' }),
  obj('mars', 'Mars', 'planet', '#ff6b4a', 'reddish-orange', 1.0, { cap: 'large' }),
  obj('sirius', 'Sirius', 'star', '#cfe6ff', 'blue-white', -1.5, { partner: 'large' }),
  obj('vega', 'Vega', 'star', '#cfe6ff', 'blue-white', 0.0),
  obj('betelgeuse', 'Betelgeuse', 'star', '#ff6b4a', 'reddish-orange', 0.5),
  obj('aldebaran', 'Aldebaran', 'star', '#ffb347', 'orange', 0.9),
  obj('deneb', 'Deneb', 'star', '#ffffff', 'white', 1.25),
  obj('polaris', 'Polaris', 'star', '#fff3b0', 'pale yellow', 2.0),
  obj('pleiades', 'the Pleiades', 'cluster', '#9ec9ff', 'blue', 1.6, { many: 'binoculars' }),
  obj('beehive', 'the Beehive Cluster', 'cluster', '#fff1c9', 'yellow-white', 3.7, { many: 'binoculars' }),
  obj('orion-nebula', 'the Orion Nebula', 'nebula', '#ff7eb6', 'pink', 4.0, { four: 'small' }),
  obj('lagoon-nebula', 'the Lagoon Nebula', 'nebula', '#ff9ec4', 'pink', 6.0, { gap: 'small' }),
  obj('andromeda', 'the Andromeda Galaxy', 'galaxy', '#ddd3ee', 'pale grey', 3.4, { middle: 'binoculars', lanes: 'large' }),
  obj('triangulum', 'the Triangulum Galaxy', 'galaxy', '#ddd3ee', 'pale grey', 5.7),
];
export const objectDef = (id: string): SkyObjectDef | undefined => SKY_OBJECTS.find(o => o.id === id);
export const shows = (o: SkyObjectDef, f: Feature, scope: Scope) => o.features[f] !== undefined && scopeRank(scope) >= scopeRank(o.features[f]!);
/** Aldebaran's orange is too close to reddish-orange to tell apart on screen: it is left out of find_by_look. */
const FIND_POOL = SKY_OBJECTS.filter(o => o.id !== 'aldebaran');
/** Brightness on screen, 0.1-1, from magnitude. The Moon is left out of brightest (it outshines everything). */
export const brightness = (o: SkyObjectDef) => Math.max(0.1, Math.min(1, 0.6 - 0.12 * o.mag));
const BRIGHT_POOL = SKY_OBJECTS.filter(o => o.kind !== 'moon' && o.mag <= 4);
export const isPointLike = (o: SkyObjectDef) => o.kind === 'star' || o.kind === 'planet';
/** How big an object is drawn in the brightest view (binoculars): a dot's glow grows with its brightness. */
export const brightFootprint = (o: SkyObjectDef) => (isPointLike(o) ? 3 + 12 * brightness(o) : o.kind === 'cluster' ? 20 : o.kind === 'nebula' ? 24 : 28);

// ── Looks: what is drawn, in words ───────────────────────────────────────────────────────

export interface LookTag { id: string; slot: 'size' | 'color' | 'noun' | 'with' | 'how'; text: string }
const NOUN: Record<string, string> = {
  ball: 'ball', dot: 'dot of light', crescent: 'crescent', group: 'group of tiny dots', cloud: 'cloud', oval: 'oval smudge', smudge: 'faint fuzzy smudge',
};
const WITH: Partial<Record<Feature, string>> = {
  patches: 'with dark patches', craters: 'with craters all over it', moons: 'with a line of tiny dots beside it',
  stripes: 'with stripes across it', spot: 'with a reddish spot on it', ring: 'with a ring around it',
  cap: 'with a white spot at its top', partner: 'with a tiny faint dot right beside it',
  four: 'with four bright dots in its middle', gap: 'with a dark gap across it', middle: 'with a bright middle',
  lanes: 'with dark lines along it',
};

export function nounOf(o: SkyObjectDef, scope: Scope): string {
  const r = scopeRank(scope);
  if (o.kind === 'moon') return 'ball';
  if (o.kind === 'planet') return r === 0 ? 'dot' : shows(o, 'crescent', scope) ? 'crescent' : 'ball';
  if (o.kind === 'star') return 'dot';
  if (o.kind === 'cluster') return 'group';
  if (o.kind === 'nebula') return r === 0 ? 'smudge' : 'cloud';
  return r === 0 ? 'smudge' : 'oval';
}

/** The look of an object through an instrument, as tags in phrase order. `still` leaves out twinkling. */
export function lookOf(o: SkyObjectDef, scope: Scope, still = false): LookTag[] {
  const tags: LookTag[] = [];
  if (o.kind === 'moon') tags.push({ id: 'size:big', slot: 'size', text: 'big' });
  tags.push({ id: `color:${COLOR_GROUP[o.colorWord] ?? o.colorWord}`, slot: 'color', text: o.colorWord });
  const noun = nounOf(o, scope);
  tags.push({ id: `noun:${noun}`, slot: 'noun', text: NOUN[noun] });
  for (const f of Object.keys(WITH) as Feature[]) if (shows(o, f, scope)) tags.push({ id: `with:${f}`, slot: 'with', text: WITH[f]! });
  if (!still && o.kind === 'star') tags.push({ id: 'how:twinkles', slot: 'how', text: 'that twinkles' });
  // The Moon and the planets are drawn without twinkling: either fits "shines steadily".
  if (!still && (o.kind === 'planet' || o.kind === 'moon')) tags.push({ id: 'how:steady', slot: 'how', text: 'that shines steadily without twinkling' });
  return tags;
}

/**
 * Colours a child can tell apart on screen. A colour clue is keyed by its group, so two objects whose colours look
 * alike (white and blue-white, tan and yellow) share the clue, and code never builds an ask that only they separate.
 */
const COLOR_GROUP: Record<string, string> = {
  white: 'white', 'bright white': 'white', 'blue-white': 'white', 'pale yellow': 'white', 'yellow-white': 'white', blue: 'white',
  grey: 'grey', 'pale grey': 'grey', tan: 'yellowish', yellow: 'yellowish', 'reddish-orange': 'reddish', orange: 'reddish', pink: 'pink',
};

const SLOT_ORDER: LookTag['slot'][] = ['size', 'color', 'noun', 'with', 'how'];
const article = (s: string) => (/^[aeiou]/i.test(s) ? 'an' : 'a');
/** A look in words: "a yellow ball with a ring around it". */
export function describeTags(tags: readonly LookTag[]): string {
  const ordered = [...tags].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const withs = ordered.filter(t => t.slot === 'with').map(t => t.text);
  const words = [
    ...ordered.filter(t => t.slot === 'size' || t.slot === 'color' || t.slot === 'noun').map(t => t.text),
    ...(withs.length ? [withs.join(' and ')] : []),
    ...ordered.filter(t => t.slot === 'how').map(t => t.text),
  ].join(' ');
  return `${article(words)} ${words}`;
}
export const lookPhrase = (o: SkyObjectDef, scope: Scope, still = false) => describeTags(lookOf(o, scope, still));
/** The brightest view draws every star and planet as a still dot whose glow follows its brightness, and the patches
 *  without their details: its looks say only that. */
export const brightLook = (o: SkyObjectDef) => {
  const noun = isPointLike(o) ? 'dot of light' : o.kind === 'cluster' ? 'group of tiny dots' : o.kind === 'nebula' ? 'cloud' : 'oval smudge';
  return `${article(o.colorWord)} ${o.colorWord} ${noun}`;
};
/** An object's look as the item's view draws it. */
export const viewLook = (item: TelescopeItem, o: SkyObjectDef, scope: Scope) => (item.mode === 'brightest' ? brightLook(o) : lookPhrase(o, scope));

/** Every tag id a clue list can name, with its words (a clue is one look tag). */
export function clueTags(clues: readonly string[], target: SkyObjectDef | undefined, scope: Scope): LookTag[] {
  const look = target ? lookOf(target, scope) : [];
  return clues.map(c => look.find(t => t.id === c)).filter((t): t is LookTag => !!t);
}

// ── Details for pick_instrument (the key table) ──────────────────────────────────────────

export interface DetailDef { id: string; object: string; text: string; min: Scope }
export const DETAILS: DetailDef[] = [
  { id: 'moon-craters', object: 'moon', text: 'craters on the Moon', min: 'binoculars' },
  { id: 'jupiter-moons', object: 'jupiter', text: "Jupiter's four biggest moons", min: 'binoculars' },
  { id: 'pleiades-many', object: 'pleiades', text: 'dozens of stars in the Pleiades, not just six or seven', min: 'binoculars' },
  { id: 'saturn-ring', object: 'saturn', text: "Saturn's rings", min: 'small' },
  { id: 'jupiter-stripes', object: 'jupiter', text: 'the stripes across Jupiter', min: 'small' },
  { id: 'venus-crescent', object: 'venus', text: 'the crescent shape of Venus', min: 'small' },
  { id: 'orion-four', object: 'orion-nebula', text: 'the four bright stars in the middle of the Orion Nebula', min: 'small' },
  { id: 'jupiter-spot', object: 'jupiter', text: "Jupiter's Great Red Spot", min: 'large' },
  { id: 'mars-cap', object: 'mars', text: 'the white ice cap on Mars', min: 'large' },
  { id: 'andromeda-lanes', object: 'andromeda', text: 'the dark dust lanes across the Andromeda Galaxy', min: 'large' },
  { id: 'sirius-partner', object: 'sirius', text: 'the faint partner star right beside Sirius', min: 'large' },
];
export const detailDef = (id: string) => DETAILS.find(d => d.id === id);

// ── Items ────────────────────────────────────────────────────────────────────────────────

/** An object placed in the eyepiece, in its 400 x 400 view (centre 200, 200; radius 190). */
export interface Placed { object: string; x: number; y: number }
export interface FindItem { id: string; mode: 'find_by_look'; scope: Scope; objects: Placed[]; /** Look tag ids the ask names. */ clues: string[] }
export interface BrightItem { id: string; mode: 'brightest'; scope: Scope; objects: Placed[] }
export interface TypeItem { id: string; mode: 'object_type'; scope: Scope; object: string; choices: Kind[] }
export interface InstrumentItem { id: string; mode: 'pick_instrument'; detail: string; choices: Scope[] }
export type TelescopeItem = FindItem | BrightItem | TypeItem | InstrumentItem;
export type TapItem = FindItem | BrightItem;
export type ChoiceItem = TypeItem | InstrumentItem;
export const isTapItem = (i: TelescopeItem): i is TapItem => i.mode === 'find_by_look' || i.mode === 'brightest';

const defsOf = (item: TapItem) => item.objects.map(p => objectDef(p.object)!);

/** The objects whose look through `scope` shows every clue. */
export function findMatches(item: FindItem, scope: Scope = item.scope): number[] {
  return item.objects.map((p, i) => ({ o: objectDef(p.object), i }))
    .filter(({ o }) => !!o && item.clues.every(c => lookOf(o, scope).some(t => t.id === c))).map(({ i }) => i);
}

/** The key: the one object matching the clues, or the brightest object. -1 when an item has none. */
export function tapKey(item: TapItem): number {
  if (item.mode === 'find_by_look') { const m = findMatches(item); return m.length === 1 ? m[0] : -1; }
  const bs = defsOf(item).map(brightness);
  const top = Math.max(...bs);
  return bs.filter(b => b === top).length === 1 ? bs.indexOf(top) : -1;
}
export const choiceKey = (item: ChoiceItem): string => (item.mode === 'object_type' ? objectDef(item.object)!.kind : detailDef(item.detail)!.min);
export const choiceLabel = (item: ChoiceItem, c: string) => (item.mode === 'object_type' ? KIND_TEXT[c as Kind] : SCOPE_TEXT[c as Scope].button);

/** The learner's work: the object tapped (find, brightest), or the choice (kind, instrument). */
export interface TelescopeWork { pick: number | null; choice: string | null }
export const emptyWork = (): TelescopeWork => ({ pick: null, choice: null });
export const workComplete = (item: TelescopeItem, w: TelescopeWork) => (isTapItem(item) ? w.pick !== null : w.choice !== null);

export function telescopeCorrect(item: TelescopeItem | undefined, w: TelescopeWork): boolean {
  if (!item) return false;
  if (isTapItem(item)) return w.pick !== null && w.pick === tapKey(item);
  return w.choice !== null && w.choice === choiceKey(item);
}

// ── Misses (what the check observes) ─────────────────────────────────────────────────────

// The miss ids and lists are the card's (`telescopeSimulator.card.ts`).

/** How many of the ask's clues an object's look shows. */
export function cluesShown(item: FindItem, index: number, scope: Scope = item.scope): number {
  const o = objectDef(item.objects[index]?.object ?? '');
  if (!o) return 0;
  const ids = lookOf(o, scope).map(t => t.id);
  return item.clues.filter(c => ids.includes(c)).length;
}

export function tapMiss(item: TapItem, pick: number): FindMiss | BrightMiss | undefined {
  const key = tapKey(item);
  if (pick === key || !item.objects[pick]) return undefined;
  if (item.mode === 'find_by_look') {
    const n = cluesShown(item, pick);
    return n === item.clues.length - 1 ? 'near_match' : n > 0 ? 'shares_clue' : 'other_object';
  }
  const ds = defsOf(item);
  return brightFootprint(ds[pick]) > brightFootprint(ds[key]) ? 'picked_biggest' : 'picked_dimmer';
}

export function choiceMiss(item: ChoiceItem, choice: string): TypeMiss | InstrumentMiss | undefined {
  const key = choiceKey(item);
  if (choice === key) return undefined;
  if (item.mode === 'pick_instrument') return scopeRank(choice as Scope) < scopeRank(key as Scope) ? 'too_weak' : 'too_strong';
  const a = FAMILY[key as Kind], b = FAMILY[choice as Kind];
  return a !== b ? 'other_family' : a === 'sharp' ? 'sharp_mixup' : 'fuzzy_mixup';
}

export function telescopeMiss(item: TelescopeItem | undefined, w: TelescopeWork): TelescopeMiss | undefined {
  if (!item || !workComplete(item, w)) return undefined;
  return isTapItem(item) ? tapMiss(item, w.pick!) : choiceMiss(item, w.choice!);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

export function askOf(item: TelescopeItem): string {
  if (item.mode === 'find_by_look') return `Find ${describeTags(clueTags(item.clues, objectDef(item.objects[tapKey(item)]?.object ?? ''), item.scope))}.`;
  if (item.mode === 'brightest') return 'Which of these objects shines the brightest?';
  if (item.mode === 'object_type') return 'What kind of object is in the middle of the view?';
  return `Which is the least powerful instrument that lets you see ${detailDef(item.detail)!.text}?`;
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

/** Four quadrant spots, jittered; objects never overlap and their order on screen is random. */
const SLOTS: Array<[number, number]> = [[125, 130], [275, 128], [128, 272], [276, 270]];
function place(ids: string[], rng: Rng): Placed[] {
  const slots = shuffle(SLOTS, rng);
  return ids.map((object, i) => ({ object, x: Math.round(slots[i][0] + (rng() - 0.5) * 24), y: Math.round(slots[i][1] + (rng() - 0.5) * 24) }));
}

const FIND_SCOPE: Scope = 'small';

function buildFind(tier: TelescopeTier, rng: Rng, avoid: Set<string>): FindItem | null {
  const n = tier === 'easy' ? 3 : 4;
  for (let t = 0; t < 400; t++) {
    const target = pickOne(FIND_POOL, rng);
    if (avoid.has(target.id)) continue;
    const look = lookOf(target, FIND_SCOPE);
    const noun = look.find(x => x.slot === 'noun')!;
    const others = look.filter(x => x.slot !== 'noun');
    const size = tier === 'hard' && others.length >= 2 && rng() < 0.5 ? 3 : 2;
    const clues = [noun.id, ...shuffle(others, rng).slice(0, size - 1).map(x => x.id)];
    if (clues.length !== size) continue;
    const has = (o: SkyObjectDef) => { const ids = lookOf(o, FIND_SCOPE).map(x => x.id); return clues.filter(c => ids.includes(c)).length; };
    const pool = shuffle(FIND_POOL.filter(o => o.id !== target.id && has(o) < clues.length), rng);
    let ds: SkyObjectDef[];
    if (tier === 'easy') {
      ds = pool.filter(o => has(o) === 0 && o.kind !== target.kind).slice(0, n - 1);
    } else {
      const lead = tier === 'medium'
        ? pool.find(o => lookOf(o, FIND_SCOPE).some(x => x.id === noun.id))
        : pool.find(o => has(o) === clues.length - 1);
      if (!lead) continue;
      ds = [lead, ...pool.filter(o => o !== lead)].slice(0, n - 1);
    }
    if (ds.length !== n - 1) continue;
    const item: FindItem = { id: '', mode: 'find_by_look', scope: FIND_SCOPE, clues, objects: place(shuffle([target.id, ...ds.map(o => o.id)], rng), rng) };
    if (findMatches(item).length === 1) return item;
  }
  return null;
}

export const BRIGHT_GAP: Record<TelescopeTier, number> = { easy: 0.35, medium: 0.2, hard: 0.12 };

function buildBright(tier: TelescopeTier, rng: Rng, avoid: Set<string>): BrightItem | null {
  const n = tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4;
  const points = BRIGHT_POOL.filter(isPointLike);
  const fuzzy = BRIGHT_POOL.filter(o => !isPointLike(o));
  for (let t = 0; t < 400; t++) {
    const set = tier === 'hard' ? [pickOne(fuzzy, rng), ...shuffle(points, rng).slice(0, n - 1)] : shuffle(points, rng).slice(0, n);
    const byB = [...set].sort((a, b) => brightness(b) - brightness(a));
    if (avoid.has(byB[0].id) && t < 300) continue;
    if (brightness(byB[0]) - brightness(byB[1]) < BRIGHT_GAP[tier] - 1e-9) continue;
    if (tier === 'hard') {
      const biggest = [...set].sort((a, b) => brightFootprint(b) - brightFootprint(a))[0];
      if (biggest === byB[0]) continue;
    }
    return { id: '', mode: 'brightest', scope: 'binoculars', objects: place(shuffle(set.map(o => o.id), rng), rng) };
  }
  return null;
}

function buildType(tier: TelescopeTier, rng: Rng, avoid: Set<string>): TypeItem | null {
  for (let t = 0; t < 400; t++) {
    const o = pickOne(SKY_OBJECTS, rng);
    if (avoid.has(o.kind) && t < 300) continue;
    const key = o.kind;
    const near = KINDS.filter(k => k !== key && FAMILY[k] === FAMILY[key]);
    const far = KINDS.filter(k => FAMILY[k] !== FAMILY[key]);
    const others = tier === 'easy' ? [pickOne(far, rng)]
      : tier === 'medium' ? shuffle([...near, ...far], rng).slice(0, 2)
        : [...near, pickOne(far, rng)];
    const choices = KINDS.filter(k => k === key || others.includes(k));
    return { id: '', mode: 'object_type', scope: tier === 'hard' ? 'binoculars' : 'small', object: o.id, choices };
  }
  return null;
}

function buildInstrument(tier: TelescopeTier, rng: Rng, avoid: Set<string>): InstrumentItem | null {
  const n = tier === 'easy' ? 2 : tier === 'medium' ? 3 : 4;
  const fresh = DETAILS.filter(d => !avoid.has(d.id));
  const d = pickOne(fresh.length ? fresh : DETAILS, rng);
  const k = scopeRank(d.min);
  const starts = Array.from({ length: SCOPES.length - n + 1 }, (_, s) => s).filter(s => s <= k && k <= s + n - 1);
  const s = pickOne(starts, rng);
  return { id: '', mode: 'pick_instrument', detail: d.id, choices: SCOPES.slice(s, s + n) };
}

export const ITEM_COUNT = { single: 4, blend: 2 };

/** The items of one mode at one tier, each different from the others (target, brightest, kind or detail). */
export function buildModeItems(mode: TelescopeMode, tier: TelescopeTier, count: number, rng: Rng): TelescopeItem[] {
  const out: TelescopeItem[] = [];
  const avoid = new Set<string>();
  for (let i = 0; i < count; i++) {
    const item = mode === 'find_by_look' ? buildFind(tier, rng, avoid) : mode === 'brightest' ? buildBright(tier, rng, avoid)
      : mode === 'object_type' ? buildType(tier, rng, avoid) : buildInstrument(tier, rng, avoid);
    if (!item) continue;
    if (item.mode === 'find_by_look') avoid.add(item.objects[tapKey(item)].object);
    else if (item.mode === 'brightest') avoid.add(item.objects[tapKey(item)].object);
    else if (item.mode === 'object_type') avoid.add(objectDef(item.object)!.kind);
    else avoid.add(item.detail);
    out.push(item);
  }
  return out;
}

export function buildTelescopeItems(opts: { modes: TelescopeMode[]; tier: TelescopeTier; rng: Rng }): TelescopeItem[] {
  const count = opts.modes.length === 1 ? ITEM_COUNT.single : ITEM_COUNT.blend;
  const out: TelescopeItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, count, opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface TelescopeItemsSource {
  title?: string;
  gradeLevel?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: TelescopeItem[];
}

export const resolveTier = (d: TelescopeItemsSource): TelescopeTier => {
  const t = (d.difficulty ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The modes a session asks when nothing pins them, by the grade rung (2 is this primitive's floor). */
export function defaultModes(grade?: string): TelescopeMode[] {
  const g = parseInt(String(grade ?? '').replace(/\D/g, ''), 10);
  if (!g || g <= 2) return ['find_by_look', 'brightest'];
  if (g === 3) return ['find_by_look', 'brightest', 'object_type'];
  return [...TELESCOPE_MODES];
}

/** The modes a lesson asks: its pin, else by grade. A legacy payload (sky objects and targets) has no modes. */
export function resolveTelescopeModes(d: TelescopeItemsSource): TelescopeMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is TelescopeMode => (TELESCOPE_MODES as string[]).includes(m));
  return asked.length ? TELESCOPE_MODES.filter(m => asked.includes(m)) : defaultModes(d.gradeLevel);
}

const inView = (p: Placed) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.hypot(p.x - 200, p.y - 200) <= 150;

/** False when a stored item is not one code could have built (its key must be computable, and only one). */
export function validTelescopeItem(i: TelescopeItem | undefined): i is TelescopeItem {
  if (!i || typeof i.id !== 'string' || !i.id) return false;
  if (i.mode === 'find_by_look' || i.mode === 'brightest') {
    if (!(SCOPES as string[]).includes(i.scope) || !Array.isArray(i.objects) || i.objects.length < 2 || i.objects.length > 4) return false;
    if (!i.objects.every(p => inView(p) && !!objectDef(p.object)) || new Set(i.objects.map(p => p.object)).size !== i.objects.length) return false;
    if (i.mode === 'find_by_look') return Array.isArray(i.clues) && i.clues.length > 0 && tapKey(i) >= 0;
    const bs = defsOf(i).map(brightness).sort((a, b) => b - a);
    return i.objects.every(p => objectDef(p.object)!.kind !== 'moon') && bs[0] - bs[1] >= 0.1 - 1e-9;
  }
  if (i.mode === 'object_type') {
    const o = objectDef(i.object);
    return !!o && ['binoculars', 'small', 'large'].includes(i.scope) && Array.isArray(i.choices) && i.choices.length >= 2 && i.choices.length <= 4
      && i.choices.every(c => (KINDS as string[]).includes(c)) && new Set(i.choices).size === i.choices.length && i.choices.includes(o.kind);
  }
  if (i.mode === 'pick_instrument') {
    const d = detailDef(i.detail);
    if (!d || !Array.isArray(i.choices) || i.choices.length < 2 || i.choices.length > 4 || !i.choices.includes(d.min)) return false;
    const s = scopeRank(i.choices[0]);
    return s >= 0 && i.choices.every((c, k) => SCOPES[s + k] === c);
  }
  return false;
}

/** Every item of the session: the stored, code-built items when all are valid, else built from the lesson's fields. */
export function telescopeItems(d: TelescopeItemsSource): TelescopeItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validTelescopeItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  const tier = resolveTier(d);
  return buildTelescopeItems({ modes: resolveTelescopeModes(d), tier, rng: seededRng(`${d.title ?? 'telescope'}:${d.gradeLevel ?? ''}:${tier}`) });
}

// ── Spoken answers ───────────────────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth'];

/**
 * The key a spoken reply is judged against: the choice's label, the other ways to say it and its place in the row
 * ("the second one"). A tap item has none: the activity checks the tapped object.
 */
export function telescopeKey(item: TelescopeItem): SpokenKey | null {
  if (isTapItem(item)) return null;
  const key = choiceKey(item), at = (item.choices as string[]).indexOf(key), label = choiceLabel(item, key);
  const others = (item.choices as string[]).filter(c => c !== key).map(c => `"${choiceLabel(item, c)}"`);
  const says = item.mode === 'object_type' ? KIND_SAY[key as Kind] : SCOPE_TEXT[key as Scope].say;
  return {
    answer: label,
    alsoAccept: [...says.filter(s => s.toLowerCase() !== label.toLowerCase()), `the ${ORDINAL[at]} one`],
    signatureError: `${others.join(', ')} ${others.length > 1 ? 'are' : 'is'} wrong, and so is naming two choices or hedging between them.`,
  };
}

const MISS_WORDS: Record<TypeMiss | InstrumentMiss, string> = {
  sharp_mixup: 'names another sharp-edged kind',
  fuzzy_mixup: 'names another fuzzy kind',
  other_family: 'names a kind from the other family (sharp-edged for a fuzzy one, or fuzzy for a sharp-edged one)',
  too_weak: 'names a less powerful instrument, which cannot show it',
  too_strong: 'names a more powerful instrument, which shows it but is not the least powerful one',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function telescopeSpokenMisses(item: ChoiceItem): KnownMiss[] {
  const key = choiceKey(item);
  const groups = new Map<TelescopeMiss, string[]>();
  for (const c of item.choices as string[]) if (c !== key) {
    const m = choiceMiss(item, c)!;
    groups.set(m, [...(groups.get(m) ?? []), choiceLabel(item, c)]);
  }
  const out: KnownMiss[] = [];
  for (const m of TELESCOPE_MISSES[item.mode]) {
    const xs = groups.get(m);
    if (!xs) continue;
    out.push({ id: m, pattern: `The right answer is "${choiceLabel(item, key)}". The learner's answer ${MISS_WORDS[m as TypeMiss | InstrumentMiss]}: ${xs.map(x => `"${x}"`).join(', ')}.`, examples: xs });
  }
  return out;
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface TelescopeView {
  work: TelescopeWork;
  /** The answer has been credited: names and the detail are on screen. */
  solved: boolean;
  /** The instrument the view is drawn through now (a lever can change it). */
  scope: Scope;
}

const listLooks = (item: TapItem, scope: Scope) =>
  Array.from(new Set(item.objects.map(p => viewLook(item, objectDef(p.object)!, scope)))).sort().join('; ');

export function describeTelescopeWork(item: TelescopeItem | undefined, w: TelescopeWork, scope?: Scope): string {
  if (!item) return 'Nothing chosen yet';
  if (isTapItem(item)) {
    const o = w.pick === null ? undefined : objectDef(item.objects[w.pick]?.object ?? '');
    return o ? `Picked one object: ${viewLook(item, o, scope ?? item.scope)}` : 'Nothing picked yet';
  }
  return w.choice ? `Chose "${choiceLabel(item, w.choice)}"` : 'Nothing chosen yet';
}

/** After any miss, in every mode. */
const AFTER_MISS = 'After a miss, never say what the wrong pick was or why it was wrong.';
/** Each mode's never-say rules (the old catalog guidance's, kept per item); each under the 500-character fact cap. */
const CONSTRAINTS: Record<TelescopeMode, string> = {
  find_by_look: 'No object in the view is named until the answer is credited. Until then, never say which object matches '
    + `the ask or where it is; ask what the learner notices about each clue and each object. ${AFTER_MISS}`,
  brightest: 'No object in the view is named until the answer is credited. Until then, never say which object is the '
    + 'brightest or where it is, or that the big one is not the brightest; ask what the learner notices about how each '
    + `object shines. ${AFTER_MISS}`,
  object_type: 'Never say this object\'s kind or its name, never say what a look means or which kind has it ("twinkling '
    + 'like a star", "a cloud like a nebula", "planets shine steadily"), and never rule a kind in or out; describe only '
    + `what is drawn and ask about its shape, its edges and its light. ${AFTER_MISS}`,
  pick_instrument: 'Never say which instrument, what any instrument shows of this object, or how much magnifying the '
    + 'detail needs, and never point at a choice by its place in the order ("the least powerful one on your list", '
    + `"one step up from your eyes"). ${AFTER_MISS}`,
};

/** What is drawn and asked. Looks listed in word order, never by position; names and keys only once credited. */
export function workspaceScene(item: TelescopeItem, view: TelescopeView): SceneOf {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  if (item.mode === 'find_by_look') {
    facts.shown = `A telescope view ${SCOPE_TEXT[view.scope].with} with ${item.objects.length} objects, none named. Their looks, in word order: ${listLooks(item, view.scope)}.`;
    if (view.solved) { const o = objectDef(item.objects[tapKey(item)].object)!; facts.credited = `The learner found ${o.name}; its name is now shown under it.`; }
  } else if (item.mode === 'brightest') {
    facts.shown = `${item.objects.length} objects ${SCOPE_TEXT[view.scope].with}, none named, each drawn as bright as it shines in the night sky. Their looks, in word order: ${listLooks(item, view.scope)}.`;
    if (view.solved) { const o = objectDef(item.objects[tapKey(item)].object)!; facts.credited = `The brightest is ${o.name}; every object's name is now shown.`; }
  } else if (item.mode === 'object_type') {
    const o = objectDef(item.object)!;
    facts.shown = `One object in the middle of the view, seen ${SCOPE_TEXT[view.scope].with}, not named. It is drawn as ${lookPhrase(o, view.scope)}.`;
    facts.choices = item.choices.map((c, i) => `${i + 1}) ${KIND_TEXT[c]}`).join('  ');
    if (view.solved) facts.credited = `It is ${o.name}, a ${KIND_TEXT[o.kind].toLowerCase()}; its name is now shown.`;
  } else {
    const d = detailDef(item.detail)!, o = objectDef(d.object)!;
    facts.shown = `${capital(o.name)} seen ${SCOPE_TEXT[view.scope].with}: ${lookPhrase(o, view.scope)}.`;
    facts.choices = item.choices.map((c, i) => `${i + 1}) ${SCOPE_TEXT[c].button}`).join('  ');
    if (view.solved) facts.credited = `The view now shows ${o.name} ${SCOPE_TEXT[d.min].with}, where ${d.text} can be seen.`;
  }
  facts.learnerWork = describeTelescopeWork(item, view.work, view.scope);
  facts.constraints = CONSTRAINTS[item.mode];
  return { objects: [], facts };
}
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and the wrong answer showing the mode's first-listed miss it can. */
export function telescopeHarnessAnswers(item: TelescopeItem): { correct: TelescopeWork; plainWrong: TelescopeWork } {
  const order: readonly TelescopeMiss[] = TELESCOPE_MISSES[item.mode];
  if (isTapItem(item)) {
    const key = tapKey(item);
    const wrongs = item.objects.map((_, i) => i).filter(i => i !== key)
      .sort((a, b) => order.indexOf(tapMiss(item, a)!) - order.indexOf(tapMiss(item, b)!));
    return { correct: { pick: key, choice: null }, plainWrong: { pick: wrongs[0], choice: null } };
  }
  const key = choiceKey(item);
  const wrongs = (item.choices as string[]).filter(c => c !== key)
    .sort((a, b) => order.indexOf(choiceMiss(item, a)!) - order.indexOf(choiceMiss(item, b)!));
  return { correct: { pick: null, choice: key }, plainWrong: { pick: null, choice: wrongs[0] } };
}

/** An object's tap target in the view (`data-pip-object`). */
export const skyTarget = (index: number) => `sky-${index + 1}`;
