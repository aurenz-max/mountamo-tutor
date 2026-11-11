/**
 * The language world a wonder-walk stop draws, and its pure rules (agent-primitive invariants,
 * `.claude/skills/agent-primitive/SKILL.md`). Shared by the component, the workspace module, the boss and the author's
 * checks (`service/core/wonder-walk/words.ts`), so there is one definition of "right".
 *
 * A word world holds:
 * - refs: what the scene shows and the tutor names (a cat to rhyme with, a sun basket label, a letter M);
 * - things: the pictures or letter tiles the child acts on. Each picture carries the facts code read from the word
 *   library when the stop was built (sounds, syllables, kind, spelling), so this module never needs the library;
 * - a story (who did what, where), told by the tutor;
 * - an answer: tap the one thing a condition holds for, sort things into baskets by their conditions, or put things on
 *   a track in order (the story's order, or a word's spelling).
 *
 * A condition is a fact about one thing, checked against the stored facts: a sound at a position, the same sound as a
 * ref, rhymes with a ref, a number of syllables, is the word the tutor says in parts, is a ref's word with one sound
 * changed, a letter for a sound, a ref's first letter, a letter's name, the same letter in the other case, a kind of
 * thing, one or many, where it is, or a part of the story. There is no task list: a task is a composition.
 *
 * A sentence (USER 2026-11-10, K grammar) is a list of tokens, each with a role (who, does, what, where, describes,
 * joins, a small word, an end mark). A token may be a card: a word tile the child acts on. Three conditions compose
 * over it: order the cards to make the sentence (tokens with no card are already on the track), tap the card that
 * fills the one token left out, or tap the card that is a named part of a sentence the child heard.
 */

export type SoundAt = 'first' | 'last' | 'middle';
export type Relation = 'in' | 'on' | 'under' | 'next-to';
export type StoryRole = 'who' | 'what' | 'where';
export type SentenceRole = 'who' | 'does' | 'what' | 'where' | 'describes' | 'joins' | 'small' | 'end';
export const SENTENCE_ROLES: readonly SentenceRole[] = ['who', 'does', 'what', 'where', 'describes', 'joins', 'small', 'end'];
/** One word of a sentence as it is said and printed, its role, and the card that is this word (when it is a card). */
export interface SentenceToken { say: string; role: SentenceRole; card?: string }
export const MARKS: readonly string[] = ['.', '?', '!'];
const MARK_NAME: Record<string, string> = { '.': 'a period', '?': 'a question mark', '!': 'an exclamation mark' };
export const isMark = (tile?: string) => !!tile && MARKS.includes(tile);
export const markName = (tile: string) => MARK_NAME[tile] ?? tile;
/** The grammar class of a word tile, from closed classes code knows and the library's kind for a pictured word. */
export type TileClass = 'mark' | 'join' | 'small' | 'action' | 'describing' | 'thing' | 'other';
const JOINS = new Set(['and', 'but', 'or', 'so', 'because']);
const SMALL = new Set(['the', 'a', 'an', 'is', 'are', 'am', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'can', 'will', 'do', 'does', 'did', 'to', 'in', 'on', 'at']);
export function tileClass(t: Pick<WordThing, 'tile' | 'category'>): TileClass {
  const x = (t.tile ?? '').toLowerCase();
  if (isMark(x)) return 'mark';
  if (JOINS.has(x)) return 'join';
  if (SMALL.has(x)) return 'small';
  if (!t.category || t.category === 'other') return 'other';
  if (t.category === 'action') return 'action';
  return DESCRIBING.has(t.category) ? 'describing' : 'thing';
}
const DESCRIBING = new Set(['describing', 'color', 'feeling', 'shape', 'number']);
/** The class a sentence word has by its role. The author's role decides for a word of the sentence (run can be a
 *  doing-word or a thing); the library's kind only classes the cards that are not in it. */
export const roleClass = (role: SentenceRole): TileClass =>
  (role === 'does' ? 'action' : role === 'describes' ? 'describing' : role === 'joins' ? 'join' : role === 'small' ? 'small' : role === 'end' ? 'mark' : 'thing');
/** A card's class: its role when it is a word of the sentence, else what the library says of its word. */
export function cardClass(w: WordWorld, t: WordThing): TileClass {
  const k = w.sentence?.find(x => x.card === t.id);
  return k ? roleClass(k.role) : tileClass(t);
}

export interface WordThing {
  id: string;
  /** A picture: the library word and its emoji. */
  word?: string;
  emoji?: string;
  /** CMU sounds, stress removed ("K AE T"); pictures only. */
  phones?: string[];
  syllables?: number;
  /** The library's kind (animal, food, clothing, vehicle, action...). */
  category?: string;
  /** Spelling as single letters, when every sound is spelled by one letter (c-a-t); else absent. */
  letters?: string[];
  /** A letter tile: the letter as shown (case matters) and the K sounds it spells. */
  letter?: string;
  sounds?: string[];
  /** One or many: how many of the picture the card draws (default 1). */
  count?: number;
  /** Where the picture sits, relative to a landmark drawn with it. */
  rel?: Relation;
  landmark?: { word: string; emoji: string };
  /** A word tile: the word as printed and said ("runs", "and"), or an end mark (. ? !). A tile whose word has a library
   *  picture carries its emoji and kind too. */
  tile?: string;
}

export type WordRule =
  | { type: 'sound'; at: SoundAt; is: string }
  | { type: 'same-sound'; at: SoundAt; as: string }
  | { type: 'rhymes'; with: string }
  | { type: 'syllables'; n: number }
  | { type: 'blend'; word: string; parts: 'phonemes' | 'onset-rime' }
  | { type: 'change'; from: string; at: SoundAt; to: string }
  | { type: 'letter-sound'; is: string }
  | { type: 'first-letter'; of: string }
  | { type: 'letter-name'; is: string }
  | { type: 'same-letter'; as: string }
  | { type: 'kind'; is: string }
  | { type: 'number'; is: 'one' | 'many'; word: string }
  | { type: 'where'; rel: Relation }
  | { type: 'story'; event: number; role: StoryRole }
  /** The card that is the one token the sentence leaves out. */
  | { type: 'fills' }
  /** The card that is the sentence's token with this role (who it is about, what they do). */
  | { type: 'part'; role: SentenceRole };

export interface StoryEvent { who: string; did: string; what?: string; where?: string }

export interface WordBasket { id: string; label: string; rule: WordRule }

export type WordAnswer =
  | { kind: 'tap'; among: string[]; rule: WordRule; traps: Record<string, WordTrap | null> }
  | { kind: 'sort'; baskets: WordBasket[]; things: string[] }
  | { kind: 'order'; by: 'story' | 'spelling' | 'sentence'; of?: string; things: string[] };

/** How a wrong thing can draw a child in (computed by code). */
export type WordTrap = 'near_sound' | 'meaning' | 'look_alike' | 'in_story' | 'not_heard' | 'other'
  /** Sentences: a word of a kind that cannot go in that place; the other joining word. */
  | 'wrong_kind' | 'other_join';

export interface WordWorld {
  refs: WordThing[];
  things: WordThing[];
  story?: StoryEvent[];
  /** The sentence the stop is about, in order. */
  sentence?: SentenceToken[];
  answer: WordAnswer;
  /** The sounds the tutor says, made by code from the rule ("kuh... aaa... tuh"); never the answer word. */
  say?: string;
}

// ── Sounds ───────────────────────────────────────────────────────────

export const VOWELS: ReadonlySet<string> = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
const isVowel = (p: string) => VOWELS.has(p);

/** The sound at a position: first, last, or the vowel of a one-vowel word (the medial vowel of a CVC word). */
export function soundAt(phones: string[] | undefined, at: SoundAt): string | undefined {
  if (!phones?.length) return undefined;
  if (at === 'first') return phones[0];
  if (at === 'last') return phones[phones.length - 1];
  const vs = phones.map((p, i) => ({ p, i })).filter(x => isVowel(x.p));
  // A middle sound is a vowel with a sound on each side.
  return vs.length === 1 && vs[0].i > 0 && vs[0].i < phones.length - 1 ? vs[0].p : undefined;
}

/** o in hot (AA) and o in dog (AO) are one short o at K. */
const same = (a?: string, b?: string) => !!a && !!b && (a === b || (['AA', 'AO'].includes(a) && ['AA', 'AO'].includes(b)));

export function rimeOf(phones: string[] | undefined): string {
  if (!phones) return '';
  const i = phones.findIndex(isVowel);
  return i < 0 ? '' : phones.slice(i).map(p => (p === 'AO' ? 'AA' : p)).join(' ');
}

/** A ref's sounds with the one at `at` replaced. */
export function changed(phones: string[] | undefined, at: SoundAt, to: string): string[] | undefined {
  if (!phones?.length) return undefined;
  const i = at === 'first' ? 0 : at === 'last' ? phones.length - 1 : phones.findIndex(isVowel);
  if (i < 0) return undefined;
  return phones.map((p, k) => (k === i ? to : p));
}

/** The K letter-sound table (RF.K.3a-b): each letter's sound; vowels their short sound. */
export const LETTER_SOUNDS: Readonly<Record<string, readonly string[]>> = {
  a: ['AE'], b: ['B'], c: ['K'], d: ['D'], e: ['EH'], f: ['F'], g: ['G'], h: ['HH'], i: ['IH'], j: ['JH'], k: ['K'], l: ['L'],
  m: ['M'], n: ['N'], o: ['AA', 'AO'], p: ['P'], r: ['R'], s: ['S'], t: ['T'], u: ['AH'], v: ['V'], w: ['W'], y: ['Y'], z: ['Z'],
};

/** Letters a child mixes up by shape. */
export const LOOK_ALIKE: readonly string[][] = [['b', 'd', 'p', 'q'], ['m', 'w'], ['n', 'u', 'h'], ['i', 'l', 'j'], ['M', 'W'], ['E', 'F'], ['O', 'Q', 'C', 'G'], ['N', 'Z']];
export const lookAlike = (a: string, b: string) => a !== b && LOOK_ALIKE.some(g => g.includes(a) && g.includes(b));
/** Letters whose capital and small forms are one shape, only bigger (c C, o O, s S...): matching them needs no knowledge. */
export const SAME_SHAPE = new Set(['c', 'k', 'o', 'p', 's', 'u', 'v', 'w', 'x', 'z']);

// ── Conditions ───────────────────────────────────────────────────────

const ref = (w: WordWorld, id: string) => w.refs.find(r => r.id === id) ?? w.things.find(t => t.id === id);

/** Does the condition hold for this thing? Every key in a word world is this, applied to the stored facts. */
export function ruleHolds(w: WordWorld, t: WordThing, rule: WordRule): boolean {
  const pic = !!t.word && !t.letter;
  switch (rule.type) {
    case 'sound': return pic && same(soundAt(t.phones, rule.at), rule.is);
    case 'same-sound': { const r = ref(w, rule.as); return pic && !!r && r.id !== t.id && same(soundAt(t.phones, rule.at), soundAt(r.phones, rule.at)); }
    case 'rhymes': { const r = ref(w, rule.with); return pic && !!r && r.word !== t.word && !!rimeOf(t.phones) && rimeOf(t.phones) === rimeOf(r.phones); }
    case 'syllables': return pic && t.syllables === rule.n;
    case 'blend': return pic && t.word === rule.word;
    case 'change': {
      const r = ref(w, rule.from);
      const want = changed(r?.phones, rule.at, rule.to);
      return pic && !!want && !!t.phones && t.phones.length === want.length && t.phones.every((p, i) => same(p, want[i]));
    }
    case 'letter-sound': return !!t.letter && (t.sounds ?? []).some(s => same(s, rule.is));
    case 'first-letter': { const r = ref(w, rule.of); return !!t.letter && !!r?.letters?.length && t.letter.toLowerCase() === r.letters[0]; }
    case 'letter-name': return !!t.letter && t.letter === rule.is;
    case 'same-letter': { const r = ref(w, rule.as); return !!t.letter && !!r?.letter && t.letter !== r.letter && t.letter.toLowerCase() === r.letter.toLowerCase(); }
    case 'kind': return pic && t.category === rule.is;
    case 'number': return pic && t.word === rule.word && (rule.is === 'many' ? (t.count ?? 1) > 1 : (t.count ?? 1) === 1);
    case 'where': return pic && t.rel === rule.rel;
    case 'story': { const e = w.story?.[rule.event]; return pic && !!e && e[rule.role] === t.word; }
    case 'fills': return !!t.tile && !!w.sentence?.some(k => k.card === t.id);
    case 'part': return !!t.tile && !!w.sentence?.some(k => k.card === t.id && k.role === rule.role);
  }
}

export const thingOf = (w: WordWorld, id: string) => w.things.find(t => t.id === id);

// ── Keys and grading ─────────────────────────────────────────────────

/** Tap: the one thing among the choices the condition holds for (null when none or more than one does). */
export function tapKey(w: WordWorld): string | null {
  if (w.answer.kind !== 'tap') return null;
  const a = w.answer;
  const hits = a.among.filter(id => { const t = thingOf(w, id); return !!t && ruleHolds(w, t, a.rule); });
  return hits.length === 1 ? hits[0] : null;
}

/** Sort: where each thing belongs (a basket id, or null when it fits none and stays out). */
export function sortKey(w: WordWorld): Record<string, string | null> | { error: string } {
  if (w.answer.kind !== 'sort') return { error: 'not a sort' };
  const out: Record<string, string | null> = {};
  for (const id of w.answer.things) {
    const t = thingOf(w, id);
    if (!t) return { error: `no thing ${id}` };
    const fits = w.answer.baskets.filter(b => ruleHolds(w, t, b.rule));
    if (fits.length > 1) return { error: `${t.word ?? t.letter} fits ${fits.length} baskets` };
    out[id] = fits[0]?.id ?? null;
  }
  return out;
}

/** Order: the things in the order they go on the track (story order, or the word's spelling). */
export function orderKey(w: WordWorld): string[] | { error: string } {
  if (w.answer.kind !== 'order') return { error: 'not an order' };
  const a = w.answer;
  if (a.by === 'story') {
    const firstAt = (t: WordThing) => (w.story ?? []).findIndex(e => e.who === t.word || e.what === t.word || e.where === t.word);
    const ts = a.things.map(id => thingOf(w, id)!).filter(Boolean);
    const at = ts.map(firstAt);
    if (at.some(i => i < 0)) return { error: 'a thing on the track is not in the story' };
    if (new Set(at).size !== at.length) return { error: 'two things on the track come from one story event' };
    return ts.map((t, i) => ({ t, i: at[i] })).sort((x, y) => x.i - y.i).map(x => x.t.id);
  }
  if (a.by === 'sentence') {
    const seq = (w.sentence ?? []).map(k => k.card).filter((id): id is string => !!id && a.things.includes(id));
    return seq.length >= 2 ? seq : { error: 'a sentence order needs a sentence with 2 or more of its words as cards' };
  }
  const r = a.of ? ref(w, a.of) : undefined;
  if (!r?.letters?.length) return { error: 'spelling order needs `of`: a ref whose word is spelled one letter per sound' };
  const pool = a.things.map(id => thingOf(w, id)!).filter(t => t?.letter);
  const used = new Set<string>();
  const seq: string[] = [];
  for (const l of r.letters) {
    const t = pool.find(x => !used.has(x.id) && x.letter!.toLowerCase() === l);
    if (!t) return { error: `no tile for the letter ${l}` };
    used.add(t.id);
    seq.push(t.id);
  }
  return seq;
}

/** How many slots the track has. */
export const trackLength = (w: WordWorld) => {
  const k = orderKey(w);
  return Array.isArray(k) ? k.length : 0;
};

/** Sort graded: every thing where it belongs (things that fit no basket stay in the tray). */
export function sortHolds(w: WordWorld, at: Record<string, string | null>): boolean {
  const key = sortKey(w);
  if ('error' in key) return false;
  return Object.entries(key).every(([id, b]) => (at[id] ?? null) === b);
}

/** Order graded: the track's things spell or tell the same as the key (letters compare by letter, so two o tiles swap freely). */
export function orderHolds(w: WordWorld, track: string[]): boolean {
  const key = orderKey(w);
  if (!Array.isArray(key) || track.length !== key.length) return false;
  const face = (id: string) => { const t = thingOf(w, id); return t?.letter?.toLowerCase() ?? t?.tile ?? t?.word ?? id; };
  return key.every((id, i) => face(id) === face(track[i]));
}

/** The harness's taps: a tap is one target; a sort is thing then basket; an order is the things in turn; then Done. */
export function wordHarnessTaps(w: WordWorld, correctId: string): { correct: string[]; wrong: string[] | null } {
  const a = w.answer;
  if (a.kind === 'tap') {
    const wrong = a.among.find(id => `thing-${id}` !== correctId);
    return { correct: [correctId], wrong: wrong ? [`thing-${wrong}`] : null };
  }
  if (a.kind === 'sort') {
    const key = sortKey(w);
    if ('error' in key) return { correct: [], wrong: null };
    const moves = Object.entries(key).filter(([, b]) => b).flatMap(([id, b]) => [`thing-${id}`, `basket-${b}`]);
    return { correct: [...moves, 'done'], wrong: ['done'] };
  }
  const key = orderKey(w);
  if (!Array.isArray(key)) return { correct: [], wrong: null };
  return { correct: [...key.map(id => `thing-${id}`), 'done'], wrong: [...[...key].reverse().map(id => `thing-${id}`), 'done'] };
}

/** Is a world playable and is its key what its facts say? (the boss re-derives it; it never trusts a stored key). */
export function wordWorldError(w: WordWorld, correctOptionId: string): string | null {
  if (!Array.isArray(w.things) || !w.things.length || !Array.isArray(w.refs)) return 'its word world is not drawn';
  if (w.things.some(t => !(t.emoji || t.letter || t.tile))) return 'a thing has no picture, letter or word';
  if (w.sentence?.some(k => k.card && !w.things.some(t => t.id === k.card))) return 'a sentence card is not a thing';
  const a = w.answer;
  if (a.kind === 'tap') {
    if (a.among.length < 2 || a.among.length > 4) return 'a tap needs 2-4 things to choose from';
    const k = tapKey(w);
    if (!k || correctOptionId !== `thing-${k}`) return 'its key is not the one thing the condition holds for';
    return null;
  }
  if (correctOptionId) return 'a sort or order has no answer option';
  if (a.kind === 'sort') {
    const k = sortKey(w);
    if ('error' in k) return k.error;
    if (!a.baskets.every(b => Object.values(k).includes(b.id))) return 'a basket gets nothing';
    return null;
  }
  const k = orderKey(w);
  return Array.isArray(k) ? (k.length >= 2 ? null : 'a track needs 2 or more things') : k.error;
}

// ── Sentences ────────────────────────────────────────────────────────

/** The sentence in words. `hide` leaves out the cards (a fill says "blank" there; an order says nothing of them). */
export function sentenceText(w: WordWorld, hide: 'none' | 'blank' = 'none'): string {
  const toks = w.sentence ?? [];
  const words = toks.filter(k => k.role !== 'end').map(k => (hide === 'blank' && k.card ? 'blank' : k.say));
  const end = toks.find(k => k.role === 'end');
  return `${words.join(' ')}${end && !(hide === 'blank' && end.card) ? end.say : ''}`.trim();
}

