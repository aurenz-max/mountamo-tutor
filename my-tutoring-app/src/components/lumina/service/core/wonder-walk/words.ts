/**
 * Wonder Walk language world (agent-primitive invariants, `.claude/skills/agent-primitive/SKILL.md`).
 *
 * The author does not pick a task. It describes a small world and a condition:
 * - refs the scene shows and the tutor names (a cat, a sun basket label, a capital M);
 * - things the child acts on: pictures from the word library (code reads their sounds, syllables, kind and spelling
 *   from it), letter tiles, a picture drawn once or as many, or drawn in, on, under or next to a landmark;
 * - a story (who did what, where) the tutor tells;
 * - an answer: tap the one thing a condition holds for, sort things into baskets by conditions, or put things on a
 *   track in order (the story's order, or a word's spelling).
 *
 * Code derives every key from the library's facts, says the sounds for the tutor (the author writes [sound] or
 * [sounds] and code fills them, so a phoneme is never mis-said), names the eval mode and standards from the structure,
 * blocks shortcuts (pick by meaning instead of sound, the odd one out, the only thing heard, the first sound alone),
 * and scores difficulty from the structure.
 *
 * Standards it builds (K language arts, listening-first): RF.K.1d letters, RF.K.2a rhyme, RF.K.2b syllables,
 * RF.K.2b-d blending, RF.K.2d first, last and middle sounds, RF.K.2e change a sound, RF.K.3a-b letter sounds,
 * L.K.2c-d spell a CVC word, L.K.1b doing-words, L.K.1c one and many, L.K.1e in/on/under/next to, L.K.5a sort by kind,
 * RL.K.1-3 and SL.K.2 key details and story order. Not built here: opposites (L.K.5b), word meanings with more than
 * one sense (L.K.4a), sight words (RF.K.3c), print concepts beyond letters (RF.K.1a-c).
 */
import type { WonderWalkStopType } from '../../../primitives/visual-primitives/core/wonder-walk/WonderWalk';
import {
  LETTER_SOUNDS, SAME_SHAPE, VOWELS, lookAlike, orderKey, rimeOf, ruleHolds, soundAt, sortKey, tapKey,
  type Relation, type SoundAt, type StoryEvent, type StoryRole, type WordAnswer, type WordRule, type WordThing, type WordTrap, type WordWorld,
} from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWords';
import { lexWord, soundSaid, WORDS } from '../../wordSpace/lexicon';
import { wordPictureOf } from './pictures';
import { bandOf, type Difficulty, type SupportTier } from './world';

// ── What the author writes ───────────────────────────────────────────

export interface ThingDraft { id: string; word?: string; letter?: string; count?: number; rel?: Relation; landmark?: string }
export interface RuleDraft {
  type: string; at?: SoundAt; sound?: string; ref?: string; n?: number; word?: string; parts?: 'phonemes' | 'onset-rime';
  to?: string; letter?: string; kind?: string; number?: 'one' | 'many'; rel?: Relation; event?: number; role?: StoryRole;
}
export interface WordDraft {
  refs: ThingDraft[];
  things: ThingDraft[];
  story?: StoryEvent[];
  answer: { kind: 'tap' | 'sort' | 'order'; among?: string[]; rule?: RuleDraft; baskets?: Array<{ id: string; label: string; rule: RuleDraft }>; by?: 'story' | 'spelling'; of?: string };
}

export const RULE_TYPES = ['sound', 'same-sound', 'rhymes', 'syllables', 'blend', 'change', 'letter-sound', 'first-letter', 'letter-name', 'same-letter', 'kind', 'number', 'where', 'story'] as const;
export const RELATIONS: Relation[] = ['in', 'on', 'under', 'next-to'];
export const LANDMARKS = ['box', 'bed', 'chair', 'tree', 'basket', 'table', 'car', 'house', 'cup', 'bag'];

export const WORD_MODES: WonderWalkStopType[] = ['rhyme', 'first-sound', 'last-sound', 'middle-sound', 'syllables', 'blend', 'change-sound',
  'letter-name', 'letter-sound', 'spell-word', 'word-kinds', 'one-many', 'where-is', 'story-detail', 'story-order'];

export const WORD_STANDARDS: Record<string, string> = {
  rhyme: 'RF.K.2a', 'first-sound': 'RF.K.2d', 'last-sound': 'RF.K.2d', 'middle-sound': 'RF.K.2d', syllables: 'RF.K.2b',
  blend: 'RF.K.2b-d', 'change-sound': 'RF.K.2e', 'letter-name': 'RF.K.1d', 'letter-sound': 'RF.K.3a-b', 'spell-word': 'L.K.2c-d, RF.K.3a',
  'word-kinds': 'L.K.5a, L.K.1b', 'one-many': 'L.K.1c', 'where-is': 'L.K.1e', 'story-detail': 'RL.K.1, RL.K.3, SL.K.2', 'story-order': 'RL.K.2',
};

// ── Sounds the author names, sounds the tutor says ───────────────────

/** The sound labels the author writes ("s", "sh", "a" = short a) and the sound each one is. */
export const SOUND_OF: Readonly<Record<string, string>> = {
  b: 'B', ch: 'CH', d: 'D', f: 'F', g: 'G', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', ng: 'NG', p: 'P', r: 'R', s: 'S',
  sh: 'SH', t: 'T', th: 'TH', v: 'V', w: 'W', y: 'Y', z: 'Z', a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH',
};
const LABEL_OF: Record<string, string> = Object.fromEntries(Object.entries(SOUND_OF).map(([k, v]) => [v, k]));
LABEL_OF.AO = 'o';
export const soundLabelOf = (phone: string) => LABEL_OF[phone] ?? phone.toLowerCase();

const VOWEL_SAID: Record<string, string> = { AE: 'aaa', EH: 'ehh', IH: 'ihh', AA: 'ahh', AO: 'ahh', AH: 'uhh' };
/** How the tutor says one sound on its own (stretched continuants, a light vowel after stops). */
export const saySound = (phone: string): string | null => VOWEL_SAID[phone] ?? soundSaid(phone) ?? (phone === 'NG' ? 'nng' : null);

/** The word in parts, as the tutor says them ("kuh - aaa - tuh", or "kuh - at"). */
export function sayParts(x: { phones: string[]; letters?: string[] }, parts: 'phonemes' | 'onset-rime'): string | null {
  if (parts === 'phonemes') {
    const said = x.phones.map(saySound);
    return said.every(Boolean) ? said.join(' - ') : null;
  }
  const v = x.phones.findIndex(p => VOWELS.has(p));
  if (v <= 0 || !x.letters) return null;
  const onset = x.phones.slice(0, v).map(saySound);
  if (!onset.every(Boolean)) return null;
  return `${onset.join(' ')} - ${x.letters.slice(v).join('')}`;
}

// ── Reading a draft against the word library ────────────────────────

/** Spelling as single letters when every sound is spelled by one K letter (c-a-t, not sh-i-p or k-n-ee). */
function lettersOf(word: string): string[] | undefined {
  const x = lexWord(word);
  if (!x?.gpcs) return undefined;
  const out: string[] = [];
  for (const pair of x.gpcs) {
    const [g, p] = pair.split('/');
    if (g.length !== 1 || p.includes(' ') || !(LETTER_SOUNDS[g] ?? []).includes(p)) return undefined;
    out.push(g);
  }
  return out;
}

const plural = (w: string) => (/[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(w) ? `${w}es` : w === 'fish' || w === 'sheep' ? w : `${w}s`);

/** A drafted thing with the library's facts (or an error the author can act on). */
export function resolveThing(t: ThingDraft): WordThing | { error: string } {
  if (!t.id) return { error: 'every thing and ref needs an id' };
  if (!!t.word === !!t.letter) return { error: `${t.id}: give a word (a picture) or a letter, not both` };
  if (t.letter) {
    if (!/^[A-Za-z]$/.test(t.letter) || !LETTER_SOUNDS[t.letter.toLowerCase()]) return { error: `${t.id}: "${t.letter}" is not a K letter tile (a-z, not q or x)` };
    return { id: t.id, letter: t.letter, sounds: [...LETTER_SOUNDS[t.letter.toLowerCase()]] };
  }
  const pic = wordPictureOf(t.word!);
  if (!pic) return { error: `${t.id}: no picture for "${t.word}"; pick a word from the picture list` };
  const lex = lexWord(pic.word)!;
  const out: WordThing = { id: t.id, word: pic.word, emoji: pic.emoji, phones: [...lex.phones], syllables: lex.syllables, category: lex.category };
  const letters = lettersOf(pic.word);
  if (letters) out.letters = letters;
  if (t.count !== undefined) {
    if (!(Number.isInteger(t.count) && t.count >= 1 && t.count <= 5)) return { error: `${t.id}: count is 1-5` };
    if (t.count > 1) out.count = t.count;
  }
  if (t.rel) {
    if (!RELATIONS.includes(t.rel)) return { error: `${t.id}: rel is ${RELATIONS.join(', ')}` };
    const lm = wordPictureOf(t.landmark ?? '');
    if (!lm) return { error: `${t.id}: rel needs a landmark picture (${LANDMARKS.join(', ')})` };
    out.rel = t.rel;
    out.landmark = lm;
  }
  return out;
}

/** A drafted condition as code reads it: sound labels become sounds. */
export function resolveRule(r: RuleDraft | undefined): WordRule | { error: string } {
  if (!r?.type) return { error: `a condition needs a type: ${RULE_TYPES.join(', ')}` };
  const at = r.at ?? 'first';
  const sound = (label?: string) => (label ? SOUND_OF[label.toLowerCase().replace(/[/]/g, '')] : undefined);
  switch (r.type) {
    case 'sound': { const is = sound(r.sound); return is ? { type: 'sound', at, is } : { error: `sound: "${r.sound}" is not a sound label (${Object.keys(SOUND_OF).join(' ')})` }; }
    case 'same-sound': return r.ref ? { type: 'same-sound', at, as: r.ref } : { error: 'same-sound needs ref' };
    case 'rhymes': return r.ref ? { type: 'rhymes', with: r.ref } : { error: 'rhymes needs ref' };
    case 'syllables': return Number.isInteger(r.n) && r.n! >= 1 && r.n! <= 4 ? { type: 'syllables', n: r.n! } : { error: 'syllables needs n (1-4)' };
    case 'blend': { const p = wordPictureOf(r.word ?? ''); return p ? { type: 'blend', word: p.word, parts: r.parts === 'onset-rime' ? 'onset-rime' : 'phonemes' } : { error: `blend needs word: a picture word (not "${r.word}")` }; }
    case 'change': { const to = sound(r.to); return r.ref && to ? { type: 'change', from: r.ref, at, to } : { error: 'change needs ref and to (a sound label)' }; }
    case 'letter-sound': { const is = sound(r.sound); return is ? { type: 'letter-sound', is } : { error: `letter-sound: "${r.sound}" is not a sound label` }; }
    case 'first-letter': return r.ref ? { type: 'first-letter', of: r.ref } : { error: 'first-letter needs ref (a picture)' };
    case 'letter-name': return r.letter && /^[A-Za-z]$/.test(r.letter) ? { type: 'letter-name', is: r.letter } : { error: 'letter-name needs letter' };
    case 'same-letter': return r.ref ? { type: 'same-letter', as: r.ref } : { error: 'same-letter needs ref (a letter)' };
    case 'kind': return r.kind ? { type: 'kind', is: r.kind.toLowerCase() } : { error: 'kind needs kind' };
    case 'number': { const p = wordPictureOf(r.word ?? ''); return p && (r.number === 'one' || r.number === 'many') ? { type: 'number', is: r.number, word: p.word } : { error: 'number needs number (one or many) and word' }; }
    case 'where': return r.rel && RELATIONS.includes(r.rel) ? { type: 'where', rel: r.rel } : { error: `where needs rel: ${RELATIONS.join(', ')}` };
    case 'story': return Number.isInteger(r.event) && (r.role === 'who' || r.role === 'what' || r.role === 'where') ? { type: 'story', event: r.event!, role: r.role } : { error: 'story needs event (0-based) and role (who, what, where)' };
    default: return { error: `unknown condition "${r.type}": ${RULE_TYPES.join(', ')}` };
  }
}

/** The draft read into a world (no ids remapped, nothing shuffled), or the errors the author must fix. */
export function readWords(d: WordDraft): { world: WordWorld; errors: string[] } {
  const errors: string[] = [];
  const things: WordThing[] = [];
  const refs: WordThing[] = [];
  for (const [list, out] of [[d.refs ?? [], refs], [d.things ?? [], things]] as const)
    for (const t of list) { const r = resolveThing(t); if ('error' in r) errors.push(r.error); else out.push(r); }
  const story = (d.story ?? []).map(e => {
    const norm = (w?: string) => (w ? wordPictureOf(w)?.word : undefined);
    for (const [role, w] of [['who', e.who], ['what', e.what], ['where', e.where]] as const) if (w && !wordPictureOf(w)) errors.push(`story: no picture for ${role} "${w}"`);
    return { who: norm(e.who) ?? e.who, did: (e.did ?? '').trim(), ...(e.what ? { what: norm(e.what) ?? e.what } : {}), ...(e.where ? { where: norm(e.where) ?? e.where } : {}) };
  });
  const a = d.answer ?? ({} as WordDraft['answer']);
  let answer: WordAnswer;
  if (a.kind === 'sort') {
    const baskets = (a.baskets ?? []).map(b => { const r = resolveRule(b.rule); if ('error' in r) errors.push(`basket ${b.id}: ${r.error}`); return { id: b.id, label: b.label, rule: 'error' in r ? ({ type: 'kind', is: '?' } as WordRule) : r }; });
    answer = { kind: 'sort', baskets, things: things.map(t => t.id) };
  } else if (a.kind === 'order') {
    answer = { kind: 'order', by: a.by === 'spelling' ? 'spelling' : 'story', ...(a.of ? { of: a.of } : {}), things: things.map(t => t.id) };
  } else {
    const r = resolveRule(a.rule);
    if ('error' in r) errors.push(r.error);
    if (a.kind !== 'tap') errors.push('answer.kind is tap, sort or order');
    answer = { kind: 'tap', among: a.among?.length ? a.among : things.map(t => t.id), rule: 'error' in r ? ({ type: 'kind', is: '?' } as WordRule) : r, traps: {} };
  }
  return { world: { refs, things, ...(story.length ? { story } : {}), answer }, errors };
}

// ── Mode and standards, from the structure ───────────────────────────

const ruleOfWorld = (w: WordWorld): WordRule | undefined => (w.answer.kind === 'tap' ? w.answer.rule : w.answer.kind === 'sort' ? w.answer.baskets[0]?.rule : undefined);

/** The eval mode a word world is (fixed precedence: the most specific skill wins). */
export function wordModeOf(w: WordWorld): WonderWalkStopType {
  if (w.answer.kind === 'order') return w.answer.by === 'spelling' ? 'spell-word' : 'story-order';
  const r = ruleOfWorld(w);
  switch (r?.type) {
    case 'story': return 'story-detail';
    case 'change': return 'change-sound';
    case 'blend': return 'blend';
    case 'letter-sound': case 'first-letter': return 'letter-sound';
    case 'letter-name': case 'same-letter': return 'letter-name';
    case 'rhymes': return 'rhyme';
    case 'sound': case 'same-sound': return r.at === 'middle' ? 'middle-sound' : r.at === 'last' ? 'last-sound' : 'first-sound';
    case 'syllables': return 'syllables';
    case 'where': return 'where-is';
    case 'number': return 'one-many';
    default: return 'word-kinds';
  }
}

// ── The words the tutor says ─────────────────────────────────────────

/** Fill the author's [sound], [sounds], [from] and [to] with the sounds code says. */
export function fillSounds(text: string, w: WordWorld, needed = true): { text: string; say?: string; error?: string } {
  const r = ruleOfWorld(w);
  // A sort's baskets each have their own sound: the ask names none, so no token is required there.
  const need = needed && w.answer.kind === 'tap';
  const refOf = (id: string) => w.refs.find(x => x.id === id) ?? w.things.find(x => x.id === id);
  let say: string | undefined;
  let out = text;
  const put = (token: string, value: string | null | undefined, need: boolean): string | undefined => {
    if (!out.includes(token)) return need ? `write ${token} in the ask where the tutor says it; code fills in the sound` : undefined;
    if (!value) return `code cannot say ${token} for this condition`;
    out = out.split(token).join(value);
    return undefined;
  };
  let error: string | undefined;
  if (r?.type === 'sound' || r?.type === 'letter-sound') { say = saySound(r.is) ?? undefined; error = put('[sound]', say, need); }
  else if (r?.type === 'blend') {
    const t = w.things.find(x => x.word === r.word) ?? { phones: lexWord(r.word)?.phones ?? [], letters: lettersOf(r.word) };
    say = sayParts({ phones: t.phones ?? [], letters: t.letters }, r.parts) ?? undefined;
    error = put('[sounds]', say, need);
  } else if (r?.type === 'change') {
    const from = refOf(r.from);
    const fromSound = from?.phones ? soundAt(from.phones, r.at) : undefined;
    const a = fromSound ? saySound(fromSound) : null;
    const b = saySound(r.to);
    error = put('[from]', a, need) ?? put('[to]', b, need);
    if (a && b) say = `${a} to ${b}`;
  }
  if (!error && /\[(sound|sounds|from|to)\]/.test(out)) error = 'the ask has a sound token this condition does not use';
  return { text: out, ...(say ? { say } : {}), ...(error ? { error } : {}) };
}

// ── Checks ───────────────────────────────────────────────────────────

export interface WordContext { ask: string; why: string; narration: string; openModes: WonderWalkStopType[] }

const KIND_WORDS: Record<string, RegExp> = {
  animal: /\banimals?\b/, food: /\b(food|eat|eats)\b/, clothing: /\b(wear|clothes)\b/, vehicle: /\b(ride|rides|go|goes|vehicles?)\b/,
  toy: /\b(toys?|play)\b/, body: /\bbody\b/, weather: /\b(weather|sky)\b/, home: /\b(home|house)\b/, tool: /\btools?\b/,
  nature: /\b(outside|nature)\b/, action: /\b(do|doing|action)\b/, person: /\b(person|people)\b/, sport: /\b(sports?|play)\b/,
  music: /\b(music|sounds?)\b/, plant: /\b(plants?|grow|grows)\b/, school: /\bschool\b/, place: /\bplaces?\b/, drink: /\b(drink|drinks)\b/,
};
const REL_WORDS: Record<Relation, RegExp> = { in: /\bin\b/i, on: /\bon\b/i, under: /\bunder\b/i, 'next-to': /\b(next to|beside)\b/i };
const QUANTITY = /\b(many|lots?|bunch|several|some|all|more|one|two|three|four|five)\b/i;
const SORTS_ON_SOUND = new Set(['sound', 'same-sound', 'rhymes', 'syllables', 'blend', 'change']);
/** Words a narration says about the activity itself (look at the letter, the picture), never a missing scene. */
const TALK = new Set(['letter', 'letters', 'picture', 'pictures', 'word', 'words', 'card', 'cards', 'basket', 'baskets', 'sound', 'sounds', 'story']);
/** Modes that can be built as a sort (their conditions are sortable). */
const SORT_MODES = new Set<WonderWalkStopType>(['rhyme', 'first-sound', 'last-sound', 'middle-sound', 'syllables', 'word-kinds']);
/** Conditions a sort can use: the basket's label is an example, never the answer itself. */
const SORTABLE = new Set(['sound', 'same-sound', 'rhymes', 'syllables', 'kind']);

export const namesWord = (text: string, word: string) => {
  const w = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${w}(e?s)?\\b`, 'i').test(text) || new RegExp(`\\b${w.replace(/y$/, 'ies')}\\b`, 'i').test(text);
};

/** The wrong things' traps: what draws a child to each (code-computed). */
export function trapsOf(w: WordWorld, key: string | null): Record<string, WordTrap | null> {
  const a = w.answer;
  if (a.kind !== 'tap') return {};
  const right = w.things.find(t => t.id === key);
  const r = a.rule;
  const refId = r.type === 'same-sound' ? r.as : r.type === 'rhymes' ? r.with : r.type === 'change' ? r.from : undefined;
  const ref = refId ? w.refs.find(x => x.id === refId) ?? w.things.find(x => x.id === refId) : undefined;
  const out: Record<string, WordTrap | null> = {};
  for (const id of a.among) {
    const t = w.things.find(x => x.id === id);
    if (!t) continue;
    if (id === key) { out[id] = null; continue; }
    const at: SoundAt = r.type === 'sound' || r.type === 'same-sound' ? r.at : 'first';
    const near = (x?: string, y?: string) => !!x && !!y && (NEAR[x] === y || NEAR[y] === x || (NEAR_V[x] ?? []).includes(y));
    const target = r.type === 'sound' ? r.is : r.type === 'letter-sound' ? r.is : right ? soundAt(right.phones, at) : undefined;
    out[id] = t.letter && right?.letter && lookAlike(t.letter, right.letter) ? 'look_alike'
      : r.type === 'story' ? (w.story?.some(e => e.who === t.word || e.what === t.word || e.where === t.word) ? 'in_story' : 'not_heard')
      : near(t.letter ? t.sounds?.[0] : soundAt(t.phones, at), target) ? 'near_sound'
      : ref?.category && t.category === ref.category ? 'meaning'
      : 'other';
  }
  return out;
}
const NEAR: Record<string, string> = { P: 'B', T: 'D', K: 'G', M: 'N', F: 'V', S: 'Z', CH: 'JH', SH: 'CH' };
const NEAR_V: Record<string, string[]> = { EH: ['IH', 'AE'], IH: ['EH'], AE: ['EH'], AA: ['AH'], AO: ['AH'], AH: ['AA', 'AO'] };

export function wordChecks(d: WordDraft, ctx: WordContext): { blocking: string[]; advisory: string[]; key?: string | Record<string, string | null> | string[]; mode?: WonderWalkStopType; world?: WordWorld; ask?: string } {
  const blocking: string[] = [];
  const advisory: string[] = [];
  const { world: w, errors } = readWords(d);
  blocking.push(...errors);
  const ids = [...w.refs, ...w.things].map(t => t.id);
  if (new Set(ids).size !== ids.length) blocking.push('ids of refs and things must all be different');
  if (w.refs.length > 3) blocking.push('at most 3 refs');
  if (w.things.length < 2 || w.things.length > 6) blocking.push(`2-6 things, not ${w.things.length}`);
  if ((w.story ?? []).length > 3) blocking.push('a story has at most 3 events: the child must hold it');
  const faces = new Map<string, string>();
  for (const t of [...w.refs, ...w.things]) if (t.emoji) {
    const other = faces.get(t.emoji);
    if (other && other !== t.word) blocking.push(`"${other}" and "${t.word}" share one picture (${t.emoji}); pick words that look different`);
    faces.set(t.emoji, t.word!);
  }
  if (blocking.length) return { blocking, advisory };

  const a = w.answer;
  const refOf = (id: string) => w.refs.find(x => x.id === id) ?? w.things.find(x => x.id === id);
  const rule = ruleOfWorld(w);
  const refIds = rule ? [rule.type === 'same-sound' ? rule.as : rule.type === 'rhymes' ? rule.with : rule.type === 'change' ? rule.from : rule.type === 'first-letter' ? rule.of : rule.type === 'same-letter' ? rule.as : undefined].filter(Boolean) as string[] : [];
  if (a.kind === 'sort') for (const b of a.baskets) { if (!refOf(b.label)) blocking.push(`basket ${b.id}: label "${b.label}" is not a ref id`); }
  if (a.kind === 'order' && a.by === 'spelling' && (!a.of || !refOf(a.of))) blocking.push('a spelling order needs of: the ref whose word the letters spell');
  for (const id of refIds) if (!refOf(id)) blocking.push(`the condition names "${id}", which is not a ref or thing`);
  if (a.kind === 'tap') for (const id of a.among) if (!w.things.some(t => t.id === id)) blocking.push(`among names "${id}", which is not a thing`);
  if (blocking.length) return { blocking, advisory };

  const filled = fillSounds(ctx.ask, w);
  if (filled.error) blocking.push(filled.error);
  // The narration and why-card may say the sound too ([sound] there is filled the same way); a token code cannot fill blocks.
  for (const [f, text] of [['narration', ctx.narration], ['why', ctx.why]] as const) {
    const e = fillSounds(text, w, false).error;
    if (e) blocking.push(`${f}: ${e}`);
  }

  // A card that shows what a ref shows is matched by sight, not by the skill (a cat card into the cat basket, m onto m).
  const face = (t: WordThing) => t.letter ?? t.word;
  for (const t of w.things) if (w.refs.some(r => face(r) === face(t) && !(w.story && r.word === w.story[0]?.who))) blocking.push(`card ${t.id} shows the same ${t.letter ? 'letter' : 'picture'} as a ref (${face(t)}): a child can match it by sight; use another ${t.letter ? 'letter' : 'word'}`);
  if (a.kind === 'sort') {
    if (!a.baskets.every(b => SORTABLE.has(b.rule.type))) blocking.push(`a sort by ${a.baskets[0]?.rule.type} lets a child match each card to its basket's picture; sort by sound, same-sound, rhymes, syllables or kind, or make it a tap`);
    const labels = a.baskets.map(b => { const r = refOf(b.label); return r ? face(r) : b.label; });
    if (new Set(labels).size !== labels.length) blocking.push('two baskets show the same label: a child cannot tell them apart');
  }
  // "Look at the tree" with no tree on screen.
  const shown = new Set([...w.refs, ...w.things].flatMap(t => [t.word, t.landmark?.word]).filter(Boolean) as string[]);
  const look = Array.from(ctx.narration.matchAll(/\b(?:look at|see|here is|here are|this is)(?: the| a| an| two| some)?((?: [a-z]+){1,3})/gi))
    .map(m => m[1].trim().toLowerCase().split(' ').filter(x => !TALK.has(x)).map(x => wordPictureOf(x)?.word).find(Boolean)).filter(Boolean) as string[];
  for (const x of look) if (!shown.has(x)) blocking.push(`the narration says to look at the ${x}, which the screen does not show: show it as a ref or talk about what is there`);
  const ask = filled.text;
  const mode = wordModeOf(w);
  if (!ctx.openModes.includes(mode)) blocking.push(`this world is a ${mode} stop (${WORD_STANDARDS[mode]}), which is not open in this walk (open: ${ctx.openModes.join(', ')})`);
  const heard = `${ctx.narration} ${ask}`;

  // ── Keys ──
  let key: string | Record<string, string | null> | string[] | undefined;
  if (a.kind === 'tap') {
    if (a.among.length < 2 || a.among.length > 4) blocking.push(`a tap chooses among 2-4 things, not ${a.among.length}`);
    const hits = a.among.filter(id => ruleHolds(w, w.things.find(t => t.id === id)!, a.rule));
    if (hits.length !== 1) blocking.push(hits.length ? `${hits.length} things fit (${hits.map(id => w.things.find(t => t.id === id)!.word ?? w.things.find(t => t.id === id)!.letter).join(', ')}); exactly one may` : 'no thing fits the condition: check the sounds, letters or story');
    else key = hits[0];
  } else if (a.kind === 'sort') {
    const k = sortKey(w);
    if ('error' in k) blocking.push(String(k.error));
    else {
      key = k;
      if (a.baskets.length < 2 || a.baskets.length > 3) blocking.push('a sort has 2-3 baskets');
      for (const b of a.baskets) if (Object.values(k).filter(x => x === b.id).length < 1) blocking.push(`basket ${b.id} gets nothing`);
      if (Object.values(k).filter(x => x === null).length > 1) blocking.push('at most one thing fits no basket');
      // A card that belongs nowhere is only fair when the child was told one may stay out.
      if (Object.values(k).includes(null) && !/\b(neither|none|no basket|leave|left out|stays? out|does not go|doesn't go)\b/i.test(`${ctx.narration} ${ctx.ask}`))
        blocking.push('one card fits no basket: say so in the narration or ask ("one picture goes in neither basket"), or the child will force it into one');
      if (new Set(a.baskets.map(b => b.rule.type)).size > 1) blocking.push('every basket sorts on the same kind of condition (all by first sound, all by kind)');
      for (const b of a.baskets) {
        const lab = refOf(b.label)!;
        // A letter can mark a first-sound basket (s for sock and sun): the label is the letter for the sound.
        const letterLabel = !!lab.letter && b.rule.type === 'sound' && (lab.sounds ?? []).includes(b.rule.is);
        if (!ruleHolds(w, lab, b.rule) && !letterLabel && b.rule.type !== 'same-sound' && b.rule.type !== 'rhymes') blocking.push(`basket ${b.id}'s label does not fit its own condition`);
      }
    }
  } else {
    const k = orderKey(w);
    if (!Array.isArray(k)) blocking.push(k.error);
    else {
      key = k;
      if (a.by === 'story') {
        if (!w.story || w.story.length < 2) blocking.push('a story order needs a story of 2-3 events');
        if (k.length !== w.things.length) blocking.push('every thing on a story track comes from the story');
      } else {
        const extra = w.things.length - k.length;
        if (extra > 1) blocking.push('a spelling track gives the word\'s letters and at most one more');
        if (k.length < 2 || k.length > 4) blocking.push('spell a word of 2-4 letters');
      }
    }
  }
  if (blocking.length) return { blocking, advisory };

  // ── What the child must hear ──
  for (const id of refIds) {
    const r = refOf(id)!;
    if (r.word && !namesWord(heard, r.word)) blocking.push(`the narration or ask must say "${r.word}": the child compares with a word they hear`);
  }
  if (rule?.type === 'letter-name' && !new RegExp(`\\b${rule.is}\\b`, 'i').test(ask)) blocking.push(`the ask must say the letter ${rule.is}`);
  if (rule?.type === 'kind' && a.kind === 'tap' && !(KIND_WORDS[rule.is] ?? new RegExp(`\\b${rule.is}s?\\b`)).test(ask.toLowerCase())) blocking.push(`the ask must say what kind (${rule.is})`);
  if (rule?.type === 'where' && !REL_WORDS[rule.rel].test(ask)) blocking.push(`the ask must say "${rule.rel.replace('-', ' ')}": hearing it is the skill`);
  if (rule?.type === 'number') {
    const want = rule.is === 'many' ? plural(rule.word) : rule.word;
    if (!new RegExp(`\\b${want}\\b`, 'i').test(ask)) blocking.push(`the ask must say "${want}"`);
    if (QUANTITY.test(ask.replace(/\bwhich one\b/i, ''))) blocking.push('the ask says how many (many, some, one, two...): the child must hear the -s, so ask only "Where are the cats?" or "Where is the cat?"');
  }
  if (rule?.type === 'story') {
    const e = w.story?.[rule.event];
    if (!e) blocking.push(`the story has no event ${rule.event}`);
    else {
      const verb = e.did.split(/\s+/)[0]?.replace(/(ed|s)$/, '');
      if (verb && !new RegExp(`\\b${verb}`, 'i').test(ask) && !/\b(first|last|then|end|start)\b/i.test(ask)) blocking.push(`the ask must point at the event: say "${e.did}" or first/last`);
      if (!e[rule.role]) blocking.push(`event ${rule.event} has no ${rule.role}`);
    }
  }
  if (w.story?.length) {
    // The story said aloud is the story the structure holds: every event's pictures, in order.
    let from = 0;
    const lower = ctx.narration.toLowerCase();
    for (const e of w.story) {
      for (const word of [e.who, e.what, e.where].filter(Boolean) as string[]) if (!namesWord(ctx.narration, word)) blocking.push(`the narration must tell the story: it never says "${word}"`);
      const at = [e.what, e.where].filter(Boolean).map(x => lower.search(new RegExp(`\\b${x}`))).filter(i => i >= 0);
      if (at.length && Math.min(...at) < from) blocking.push('the narration tells the events out of order');
      if (at.length) from = Math.min(...at);
    }
  }

  // ── Leaks ──
  if (a.kind === 'tap' && typeof key === 'string') {
    const right = w.things.find(t => t.id === key)!;
    const said: Array<[string, string]> = [['ask', ask], ['why', ctx.why], ...(rule?.type === 'story' ? [] : [['narration', ctx.narration]] as Array<[string, string]>)];
    // Cards that all show one picture (one or many, where it sits) are told apart by something else: saying it is not a leak.
    const shared = a.among.filter(id => id !== key).some(id => w.things.find(t => t.id === id)?.word === right.word);
    if (right.word && !shared) for (const [f, text] of said) if (namesWord(text, right.word)) blocking.push(`the ${f} says "${right.word}", the answer`);
    if (right.word && w.refs.some(r => r.word === right.word)) blocking.push('the scene shows the right picture');
    if (rule?.type === 'blend' && namesWord(heard, rule.word)) blocking.push(`the narration or ask says "${rule.word}" whole: the child must blend the parts`);
  }
  if (rule?.type === 'change') {
    const r = refOf(rule.from)!;
    const res = a.kind === 'tap' && typeof key === 'string' ? w.things.find(t => t.id === key) : undefined;
    if (res?.word && namesWord(`${heard} ${ctx.why}`, res.word)) blocking.push(`the new word "${res.word}" is said aloud`);
    if (r.phones && soundAt(r.phones, rule.at) === rule.to) blocking.push('the change keeps the same sound');
  }

  // ── Shortcuts: get it right without the skill ──
  if (a.kind === 'tap' && typeof key === 'string') {
    const right = w.things.find(t => t.id === key)!;
    const wrongs = a.among.filter(id => id !== key).map(id => w.things.find(t => t.id === id)!);
    const ref = refIds.map(refOf).find(x => x?.category);
    if (rule && SORTS_ON_SOUND.has(rule.type) && ref?.category && right.category === ref.category && !wrongs.some(t => t.category === ref.category))
      blocking.push(`the right picture is the only ${ref.category} like the ${ref.word}: a child can pick what goes with it, not what sounds like it; make a wrong picture a ${ref.category} too, or the right one another kind`);
    if (rule && rule.type !== 'kind' && right.category && wrongs.length >= 2 && wrongs.every(t => t.category && t.category === wrongs[0].category) && right.category !== wrongs[0].category)
      blocking.push(`the right picture is the only one that is not a ${wrongs[0].category}: a child can pick the odd one out; mix the kinds`);
    if (rule?.type === 'blend' && right.phones && !wrongs.some(t => t.phones?.[0] === right.phones![0]))
      blocking.push(`only the right picture starts with ${soundLabelOf(right.phones[0])}: a child can match the first sound without blending the rest; add a wrong picture with the same first sound`);
    if (rule?.type === 'story') {
      const inStory = (t: WordThing) => !!w.story?.some(e => e.who === t.word || e.what === t.word || e.where === t.word);
      if (!wrongs.some(inStory)) blocking.push('no wrong picture is from the story: a child can pick the only thing they heard; offer another thing from the story');
      if (right.category && !wrongs.some(t => t.category === right.category)) blocking.push(`the right picture is the only ${right.category}: a child can pick by kind without remembering the story; offer another ${right.category}`);
    }
    if (rule?.type === 'number' && !wrongs.some(t => t.word === right.word)) blocking.push(`only the right card shows a ${right.word}: a child can pick by the word, not by one or many; show the ${right.word} both ways`);
    if (rule?.type === 'where') {
      const all = [right, ...wrongs];
      if (!all.every(t => t.word === right.word && t.landmark?.word === right.landmark?.word)) blocking.push('every card shows the same picture and landmark, only in a different place: then only the position word tells them apart');
    }
    if (rule?.type === 'syllables' && wrongs.every(t => Math.abs((t.syllables ?? 0) - rule.n) >= 2)) advisory.push('every wrong picture is 2+ claps away: an easy item');
    if ((rule?.type === 'sound' || rule?.type === 'same-sound') && rule.at === 'middle' && [right, ...wrongs].some(t => !soundAt(t.phones, 'middle')))
      blocking.push('a middle-sound stop uses words with one vowel between two sounds (cat, sun, pig)');
    if ((rule?.type === 'letter-sound' || rule?.type === 'first-letter' || rule?.type === 'letter-name' || rule?.type === 'same-letter') && !wrongs.every(t => t.letter))
      blocking.push('a letter stop chooses among letter tiles');
    if (rule?.type === 'first-letter' && !refOf(rule.of)?.letters) blocking.push(`"${refOf(rule.of)?.word}" does not start with one letter for one sound (choose a word like sun, map, dog)`);
  }
  if (a.kind === 'sort' && typeof key === 'object' && !Array.isArray(key) && SORTS_ON_SOUND.has(a.baskets[0].rule.type)) {
    const kinds = a.baskets.map(b => new Set(w.things.filter(t => key[t.id] === b.id).map(t => t.category)));
    if (kinds.every(k => k.size === 1) && new Set(kinds.map(k => Array.from(k)[0])).size === kinds.length)
      blocking.push('each basket holds one kind of thing (all animals, all food): a child can sort by kind, not by sound; mix the kinds');
  }
  if (a.kind === 'order' && a.by === 'spelling') {
    const r = refOf(a.of!)!;
    if (w.refs.length && namesWord(ctx.why, r.word ?? '~')) advisory.push('the why-card says the word: fine for spelling, the picture shows it anyway');
  }
  if (!ask.trim()) blocking.push('ask is empty');
  return { blocking, advisory, key, mode, world: w, ask };
}

// ── Difficulty (agent-primitive I6) ───────────────────────────────────

const STOPS = new Set(['B', 'D', 'G', 'K', 'P', 'T']);

/** A stop's difficulty from its world: each term is a reason a Kindergartner finds it harder. */
export function wordDifficulty(d: WordDraft): Difficulty {
  const reasons: string[] = [];
  let score = 0;
  const add = (x: number, why: string) => { if (x) { score += x; reasons.push(`${why} (${x > 0 ? '+' : ''}${x})`); } };
  const { world: w } = readWords(d);
  const a = w.answer;
  const rule = ruleOfWorld(w);
  const key = a.kind === 'tap' ? tapKey(w) : null;
  const traps = trapsOf(w, key);
  const choices = a.kind === 'tap' ? a.among.length : 0;
  if (choices === 3) add(0.5, 'three choices');
  if (choices >= 4) add(1, 'four choices');
  if (Object.values(traps).includes('near_sound')) add(1, 'a wrong choice sounds close');
  if (Object.values(traps).includes('meaning')) add(0.5, 'a wrong choice goes with the word');
  if (Object.values(traps).includes('look_alike')) add(1, 'a letter that looks alike');
  switch (rule?.type) {
    case 'sound': case 'same-sound': {
      add(rule.at === 'last' ? 1 : rule.at === 'middle' ? 2 : 0, `the ${rule.at} sound`);
      const s = rule.type === 'sound' ? rule.is : soundAt((w.refs.find(r => r.id === rule.as) ?? w.things.find(t => t.id === rule.as))?.phones, rule.at);
      if (s && STOPS.has(s)) add(0.5, 'a quick sound that cannot be stretched');
      if (rule.type === 'same-sound') add(0.5, 'find the sound in a heard word first');
      break;
    }
    case 'rhymes': add(0.5, 'hear the ending'); break;
    case 'syllables': add(rule.n >= 3 ? 1 : 0.5, `${rule.n} claps`); break;
    case 'blend': {
      add(rule.parts === 'phonemes' ? 1.5 : 0.5, rule.parts === 'phonemes' ? 'blend every sound' : 'blend a start and an ending');
      const n = lexWord(rule.word)?.phones.length ?? 3;
      if (n >= 4) add(1, `${n} sounds to hold`);
      break;
    }
    case 'change': add(2 + (rule.at === 'middle' ? 1 : rule.at === 'last' ? 0.5 : 0), `change the ${rule.at} sound`); break;
    case 'letter-name': add(/[a-z]/.test(rule.is) ? 0.5 : 0, /[a-z]/.test(rule.is) ? 'a small letter' : 'a capital letter'); break;
    case 'same-letter': {
      const r = w.refs.find(x => x.id === rule.as);
      add(r?.letter && SAME_SHAPE.has(r.letter.toLowerCase()) ? -0.5 : 1, r?.letter && SAME_SHAPE.has(r.letter.toLowerCase()) ? 'both cases one shape' : 'the two cases look different');
      break;
    }
    case 'letter-sound': add(1, 'the letter for a sound'); break;
    case 'first-letter': add(1.5, 'hear the first sound, then find its letter'); break;
    case 'kind': add(rule.is === 'action' ? 0.5 : 0, rule.is === 'action' ? 'doing-words' : ''); break;
    case 'number': add(/(s|x|ch|sh)$/.test(rule.word) ? 0.5 : 0, 'the plural sounds -es'); if (rule.is === 'one') add(0.5, 'find the one, not the many'); break;
    case 'where': if (a.kind === 'tap') { const rels = a.among.map(id => w.things.find(t => t.id === id)?.rel); if (rels.includes('in') && rels.includes('on')) add(0.5, 'in and on side by side'); } break;
    case 'story': {
      const n = w.story?.length ?? 0;
      add(n >= 3 ? 1 : 0.5, `a story of ${n} events`);
      if (rule.event < n - 1) add(0.5, 'not the last thing heard');
      if (rule.role === 'where') add(0.5, 'where it happened');
      break;
    }
  }
  if (a.kind === 'sort') {
    const n = a.things.length;
    add(n >= 6 ? 1.5 : n >= 5 ? 1 : 0.5, `${n} things to sort`);
    const k = sortKey(w);
    if (!('error' in k) && Object.values(k).includes(null)) add(1, 'one fits no basket');
    if (a.baskets.length === 3) add(1, 'three baskets');
  }
  if (a.kind === 'order') {
    const n = a.things.length;
    if (a.by === 'story') add(n >= 4 ? 2 : 1, `put ${n} story events in order`);
    else {
      const k = orderKey(w);
      const len = Array.isArray(k) ? k.length : n;
      add(len >= 4 ? 2.5 : 1.5, `spell ${len} sounds`);
      if (n > len) add(0.5, 'a spare letter');
    }
  }
  return { band: bandOf(score), score, reasons: reasons.length ? reasons : ['two choices, a first sound, recognise only'] };
}

// ── Walk-level variety and tier ──────────────────────────────────────

export function wordWalkChecks(drafts: WordDraft[], opts: { tier?: SupportTier; openModes: WonderWalkStopType[] }): string[] {
  const blocking: string[] = [];
  const worlds = drafts.map(d => readWords(d).world);
  const sig = worlds.map(w => { const r = ruleOfWorld(w); return JSON.stringify({ m: wordModeOf(w), r, t: w.things.map(t => t.word ?? t.letter).sort() }); });
  sig.forEach((s, i) => { const j = sig.indexOf(s); if (j !== i) blocking.push(`language stops ${j} and ${i} are the same item`); });
  const rights = worlds.map(w => { const k = tapKey(w); return k ? w.things.find(t => t.id === k)?.word ?? w.things.find(t => t.id === k)?.letter : undefined; }).filter(Boolean);
  const dup = rights.find((r, i) => rights.indexOf(r) !== i);
  if (dup) blocking.push(`"${dup}" is the answer at two stops; every stop needs its own`);
  if (worlds.length >= 3) {
    const open = opts.openModes.filter(m => WORD_MODES.includes(m));
    const modes = new Set(worlds.map(wordModeOf));
    const kinds = new Set(worlds.map(w => w.answer.kind));
    if (open.length >= 2 && modes.size < 2) blocking.push(`every language stop is ${Array.from(modes)[0]}; use at least two of: ${open.join(', ')}`);
    // One open mode: a mode that can sort mixes in a sort; a tap-only mode varies what it asks for instead.
    if (open.length < 2 && kinds.size < 2 && SORT_MODES.has(open[0])) blocking.push('every stop is a tap: make one a sort (baskets)');
  }
  // No two stops ask for the same thing (the same sound, letter, position word, kind or clap count).
  const asks = worlds.map(w => { const r = ruleOfWorld(w); if (!r) return undefined; const { type, ...rest } = r as Record<string, unknown> & { type: string };
    return `${type}:${JSON.stringify(Object.fromEntries(Object.entries(rest).filter(([k]) => !['as', 'with', 'from', 'of'].includes(k))))}`; });
  asks.forEach((x, i) => { const j = asks.indexOf(x); if (x && x.includes(':{"') && j !== i && !x.startsWith('same-') && !x.startsWith('rhymes') && !x.startsWith('first-letter'))
    blocking.push(`language stops ${j} and ${i} ask for the same thing (${x.replace(/[{}"]/g, '')}); ask for a different sound, letter or word`); });
  if (opts.tier) {
    const order: SupportTier[] = ['easy', 'medium', 'hard'];
    drafts.forEach((d, i) => {
      const df = wordDifficulty(d);
      const off = order.indexOf(df.band) - order.indexOf(opts.tier!);
      if (off === 0 || (i === 0 && off === -1)) return;
      blocking.push(`language stop ${i} is ${df.band} (score ${df.score}: ${df.reasons.join(', ')}); this walk is ${opts.tier}: ${off < 0 ? 'make it harder' : 'make it easier'}`);
    });
  }
  return blocking;
}

// ── Building the world the child meets ───────────────────────────────

/** The world as drawn: ids code owns (r1, t1...), things in a seeded order, traps, and the sounds the tutor says. */
export function buildWordWorld(d: WordDraft, ask: string, rand: () => number): WordWorld {
  const { world } = readWords(d);
  const filled = fillSounds(ask, world);
  const map = new Map<string, string>();
  world.refs.forEach((r, i) => map.set(r.id, `r${i + 1}`));
  const order = world.things.map((t, i) => ({ t, i }));
  for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  order.forEach(({ t }, i) => map.set(t.id, `t${i + 1}`));
  const id = (x: string) => map.get(x) ?? x;
  const remapRule = (r: WordRule): WordRule => {
    switch (r.type) {
      case 'same-sound': return { ...r, as: id(r.as) };
      case 'rhymes': return { ...r, with: id(r.with) };
      case 'change': return { ...r, from: id(r.from) };
      case 'first-letter': return { ...r, of: id(r.of) };
      case 'same-letter': return { ...r, as: id(r.as) };
      default: return r;
    }
  };
  const things = order.map(({ t }) => ({ ...t, id: id(t.id) }));
  const refs = world.refs.map(r => ({ ...r, id: id(r.id) }));
  const a = world.answer;
  let answer: WordAnswer;
  if (a.kind === 'tap') {
    const among = things.map(t => t.id).filter(x => a.among.map(id).includes(x));
    answer = { kind: 'tap', among, rule: remapRule(a.rule), traps: {} };
  } else if (a.kind === 'sort') answer = { kind: 'sort', baskets: a.baskets.map(b => ({ id: b.id, label: id(b.label), rule: remapRule(b.rule) })), things: things.map(t => t.id) };
  else answer = { kind: 'order', by: a.by, ...(a.of ? { of: id(a.of) } : {}), things: things.map(t => t.id) };
  const built: WordWorld = { refs, things, ...(world.story ? { story: world.story } : {}), answer, ...(filled.say ? { say: filled.say } : {}) };
  if (answer.kind === 'tap') answer.traps = trapsOf(built, tapKey(built));
  // A track never starts in its own order.
  if (answer.kind === 'order') {
    const k = orderKey(built);
    if (Array.isArray(k) && k.length === things.length && k.every((x, i) => x === things[i].id)) things.reverse();
  }
  return built;
}

// ── Words a child could say on a say-any stop ────────────────────────

/**
 * Library words a Kindergartner knows that the stop's rule holds for, other than the cards and the refs and any word the
 * narration or ask already says (a word the child just heard is an echo, not a word they thought of). These are the
 * judge's examples on a `say-any` stop (`wonderWalkSpoken.ts`); the accept rule covers words beyond them.
 */
export function sayAnyExamples(w: WordWorld, heard: string, limit = 8): string[] {
  if (w.answer.kind !== 'tap') return [];
  const rule = w.answer.rule;
  const onCards = new Set([...w.refs, ...w.things].map(t => t.word).filter(Boolean));
  const out: string[] = [];
  for (const x of WORDS) {
    if (out.length >= limit) break;
    if (x.knownBy !== 'K' || onCards.has(x.w) || !/^[a-z]+$/.test(x.w) || namesWord(heard, x.w)) continue;
    const thing: WordThing = { id: `say-${x.w}`, word: x.w, phones: [...x.phones], syllables: x.syllables, category: x.category };
    if (ruleHolds(w, thing, rule)) out.push(x.w);
  }
  return out;
}

export const __words = { lettersOf, plural, KIND_WORDS, rimeOf };
