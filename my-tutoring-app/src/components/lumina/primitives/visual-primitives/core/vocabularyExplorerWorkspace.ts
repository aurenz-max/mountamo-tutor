/**
 * vocabulary-explorer's domain: the code that builds and keys its items, the checks, misses and scene (the wiring is
 * `vocabularyExplorer.card.ts` + `vocabularyExplorer.boss.ts`).
 *
 * Gemini writes the word bank only: each word's meaning, an example sentence (on its card), a second sentence that
 * uses it (`clozeSentence`) and a short situation where it applies without naming it (`scenario`). Code builds every
 * item from that bank, from the eval-mode pin (its challenge types) and `config.difficulty`, and keys it by the word's
 * id, so no model picks an answer or an option list.
 * - match: tap a word, then its meaning. easy 3 pairs; medium 4; hard 4 with one extra meaning that goes with none.
 * - fill_blank: a sentence with the word blanked; choose the word. easy 3 choices whose other words are another kind of
 *   word (noun, verb ...); medium 4; hard 4 whose other words are related to the answer or the same kind of word.
 * - context: a situation that never names the word; choose the word. Choices built as fill_blank.
 * The word cards (meaning, example, related words) are studied before the check and close when it starts.
 * fill_blank and context are one word, said aloud or tapped (J14); match is a gesture checked by code.
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { CHOICE_MISSES, MATCH_MISSES, type ChoiceMiss, type VocabMiss } from './vocabularyExplorer.card';

export { CHOICE_MISSES, MATCH_MISSES };
export type { ChoiceMiss, MatchMiss, VocabMiss } from './vocabularyExplorer.card';

export interface VocabTerm {
  id: string;
  word: string;
  pronunciation?: string;
  partOfSpeech: string;
  definition: string;
  exampleSentence: string;
  relatedWords: string[];
  wordOrigin?: string;
  /** A second sentence using the word exactly once, for fill_blank (never shown on the card). */
  clozeSentence?: string;
  /** One or two sentences of a situation where the word applies, never naming it, for context. */
  scenario?: string;
}

export type VocabKind = 'match' | 'fill_blank' | 'context';
export const VOCAB_KINDS: VocabKind[] = ['match', 'fill_blank', 'context'];
export type VocabMode = 'explore' | 'recall' | 'apply';
export type VocabTier = 'easy' | 'medium' | 'hard';

/** Words in the order the word column shows; meanings (term ids) in the order the meaning column shows. */
export interface MatchItem { id: string; kind: 'match'; terms: string[]; defs: string[] }
export type ChoiceClue = 'sentence' | 'example' | 'scenario' | 'definition';
/** The answer's term id, and the choices (term ids) in the order shown. */
export interface ChoiceItem { id: string; kind: 'fill_blank' | 'context'; term: string; options: string[]; clue: ChoiceClue }
export type VocabItem = MatchItem | ChoiceItem;

// ── Text helpers ─────────────────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactWord = (w: string) => new RegExp(`(?<![A-Za-z])${esc(w.trim())}(?![A-Za-z])`, 'gi');

/** The kind of word ("noun", "verb"), from the bank's free-text part of speech. */
export const posOf = (t: Pick<VocabTerm, 'partOfSpeech'>) => (t.partOfSpeech ?? '').toLowerCase().match(/[a-z]+/)?.[0] ?? '';

/** The stems that give a word away: each part of the word, cut to 55% (at least 4 letters; short parts whole), so "condense" gives away "condensation". */
function stems(word: string): string[] {
  return word.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3)
    .map(w => (w.length < 5 ? w : w.slice(0, Math.max(4, Math.ceil(w.length * 0.55)))));
}

/** Whether a text uses the word or a form of it ("evaporates" for "evaporation"). */
export function namesWord(text: string, word: string): boolean {
  const t = ` ${(text ?? '').toLowerCase()}`;
  return stems(word).some(s => new RegExp(`[^a-z]${esc(s)}`).test(t));
}

/** A text with every form of the given words blanked out. */
export function maskWords(text: string, words: string[]): string {
  let out = text;
  for (const s of words.flatMap(stems)) out = out.replace(new RegExp(`(?<![A-Za-z])${esc(s)}[A-Za-z]*`, 'gi'), '___');
  return out;
}

export const isRelated = (a: VocabTerm, b: VocabTerm) =>
  (a.relatedWords ?? []).some(r => norm(r) === norm(b.word)) || (b.relatedWords ?? []).some(r => norm(r) === norm(a.word));

// ── Clues ────────────────────────────────────────────────────────────────────────────────

const BLANK = /_{2,}/g;

/**
 * fill_blank: the clozeSentence (else the card's example) with the word blanked, when it names it exactly once. A
 * clozeSentence the model already blanked (one run of underscores, and no form of the word) is taken as it is: the
 * model did that in every payload of 2026-10-16 although asked to write the word.
 */
export function clozeOf(t: VocabTerm): { text: string; clue: 'sentence' | 'example' } | null {
  const sources: Array<[string | undefined, 'sentence' | 'example']> = [[t.clozeSentence, 'sentence'], [t.exampleSentence, 'example']];
  for (const [src, clue] of sources) {
    if (!src?.trim()) continue;
    const blanks = src.match(BLANK)?.length ?? 0;
    const hits = src.match(exactWord(t.word))?.length ?? 0;
    const text = blanks === 1 && hits === 0 ? src.replace(BLANK, '_____').trim()
      : blanks === 0 && hits === 1 ? src.replace(exactWord(t.word), '_____').trim() : null;
    if (!text || namesWord(text, t.word)) continue;
    return { text, clue };
  }
  return null;
}

/** context: the scenario (else the meaning, for a bank written before scenarios), when it never names the word. */
export function situationOf(t: VocabTerm): { text: string; clue: 'scenario' | 'definition' } | null {
  if (t.scenario?.trim() && !namesWord(t.scenario, t.word)) return { text: t.scenario.trim(), clue: 'scenario' };
  if (t.definition?.trim() && !namesWord(t.definition, t.word)) return { text: t.definition.trim(), clue: 'definition' };
  return null;
}

export function clueText(item: ChoiceItem, bank: readonly VocabTerm[]): string {
  const t = bank.find(x => x.id === item.term);
  if (!t) return '';
  return (item.kind === 'fill_blank' ? clozeOf(t)?.text : situationOf(t)?.text) ?? '';
}

// ── Asks ─────────────────────────────────────────────────────────────────────────────────

export const extraMeaning = (item: MatchItem) => item.defs.find(d => !item.terms.includes(d)) ?? null;

export function askOf(item: VocabItem, bank: readonly VocabTerm[]): string {
  if (item.kind === 'match') {
    return `Match each word to its meaning: tap a word, then the meaning that goes with it.${extraMeaning(item) ? ' One meaning goes with none of the words.' : ''}`;
  }
  const clue = clueText(item, bank);
  if (item.kind === 'fill_blank') return `Which word completes the sentence? "${clue}"`;
  return item.clue === 'scenario' ? `Which word fits what is happening here? "${clue}"` : `Which word means this? "${clue}"`;
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
export const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** A meaning that names its own word, or another chosen word, gives a pair away. */
const meaningOk = (t: VocabTerm) => !!t.definition?.trim() && !namesWord(t.definition, t.word);

/** Greedy: words whose meanings name none of the chosen words, and are named by none of the chosen meanings. */
export function pickPairs(pool: VocabTerm[], k: number): VocabTerm[] {
  const out: VocabTerm[] = [];
  for (const t of pool) {
    if (out.length >= k) break;
    if (!meaningOk(t)) continue;
    if (out.some(o => namesWord(t.definition, o.word) || namesWord(o.definition, t.word) || norm(o.word) === norm(t.word))) continue;
    out.push(t);
  }
  return out;
}

/** The meaning column's order: never every meaning on its word's row. */
export function meaningOrder(terms: string[], defs: string[], rng: Rng): string[] {
  for (let tries = 0; tries < 12; tries++) {
    const order = shuffle(defs, rng);
    if (terms.length < 2 || !terms.every((t, i) => order[i] === t)) return order;
  }
  return [...defs.slice(1), defs[0]];
}

const PAIRS: Record<VocabTier, number> = { easy: 3, medium: 4, hard: 4 };

function buildMatch(bank: readonly VocabTerm[], used: Set<string>, tier: VocabTier, rng: Rng): MatchItem | null {
  const fresh = shuffle(bank.filter(t => !used.has(t.id)), rng), seen = shuffle(bank.filter(t => used.has(t.id)), rng);
  const want = PAIRS[tier] + (tier === 'hard' ? 1 : 0);
  let picks = pickPairs([...fresh, ...seen], want);
  let extra: VocabTerm | null = null;
  if (tier === 'hard' && picks.length === want) { extra = picks[picks.length - 1]; picks = picks.slice(0, -1); }
  else picks = picks.slice(0, PAIRS[tier]);
  if (picks.length < 3) return null;
  picks.forEach(t => used.add(t.id));
  const terms = shuffle(picks.map(t => t.id), rng);
  return { id: '', kind: 'match', terms, defs: meaningOrder(terms, [...terms, ...(extra ? [extra.id] : [])], rng) };
}

/** The other choices: easy 2 of another kind of word, unrelated; medium 3 at random; hard 3 related or the same kind. */
/** A word that also fits a clue (a judge's reading at generation): never offered beside that key in that kind. */
export type Avoid = (kind: 'fill_blank' | 'context', key: string, foil: string) => boolean;

export function pickFoils(key: VocabTerm, bank: readonly VocabTerm[], tier: VocabTier, clue: string, rng: Rng,
  avoid: (foil: string) => boolean = () => false): VocabTerm[] {
  const n = tier === 'easy' ? 2 : 3;
  const others = shuffle(bank.filter(t => t.id !== key.id && t.word.trim() && norm(t.word) !== norm(key.word) && !avoid(t.id)
    && !namesWord(t.word, key.word) && !namesWord(key.word, t.word) && !namesWord(clue, t.word)), rng);
  const score = (t: VocabTerm) => tier === 'easy' ? (posOf(t) === posOf(key) ? 1 : 0) + (isRelated(key, t) ? 2 : 0)
    : tier === 'hard' ? (isRelated(key, t) ? 0 : 2) + (posOf(t) === posOf(key) ? 0 : 1) : 0;
  const picked: VocabTerm[] = [];
  for (const t of [...others].sort((a, b) => score(a) - score(b))) {
    if (picked.length >= n) break;
    if (picked.some(p => namesWord(p.word, t.word) || namesWord(t.word, p.word))) continue;
    picked.push(t);
  }
  return picked;
}

function buildChoice(kind: 'fill_blank' | 'context', bank: readonly VocabTerm[], keyed: Set<string>, used: Set<string>,
  tier: VocabTier, rng: Rng, avoid?: Avoid): ChoiceItem | null {
  const rank = (t: VocabTerm) => (keyed.has(t.id) ? 2 : 0) + (used.has(t.id) ? 1 : 0);
  const keys = shuffle(bank, rng).sort((a, b) => rank(a) - rank(b));
  for (const key of keys) {
    const clue = kind === 'fill_blank' ? clozeOf(key) : situationOf(key);
    if (!clue) continue;
    const foils = pickFoils(key, bank, tier, clue.text, rng, avoid ? f => avoid(kind, key.id, f) : undefined);
    if (foils.length < (tier === 'easy' ? 2 : 3)) continue;
    keyed.add(key.id); used.add(key.id);
    return { id: '', kind, term: key.id, options: shuffle([key.id, ...foils.map(f => f.id)], rng), clue: clue.clue };
  }
  return null;
}

/** The session's items from the pinned challenge types: explore 2 match; recall match + 2 fill; apply fill + 2 context. */
export function composition(kinds: VocabKind[]): VocabKind[] {
  const has = (k: VocabKind) => kinds.includes(k);
  const ks = VOCAB_KINDS.filter(has);
  if (ks.length === 1) return ks[0] === 'match' ? ['match', 'match'] : [ks[0], ks[0], ks[0]];
  if (has('match') && has('fill_blank') && !has('context')) return ['match', 'fill_blank', 'fill_blank'];
  if (!has('match') && has('fill_blank') && has('context')) return ['fill_blank', 'context', 'context'];
  return ks.length ? ks : ['match', 'fill_blank', 'context'];
}

export function buildVocabItems(opts: { bank: readonly VocabTerm[]; kinds: VocabKind[]; tier: VocabTier; rng: Rng; avoid?: Avoid }): VocabItem[] {
  const used = new Set<string>(), keyed = new Set<string>(), out: VocabItem[] = [];
  for (const kind of composition(opts.kinds)) {
    const item = kind === 'match' ? buildMatch(opts.bank, used, opts.tier, opts.rng)
      : buildChoice(kind, opts.bank, keyed, used, opts.tier, opts.rng, opts.avoid);
    if (item) out.push(item);
  }
  return out.map((item, i) => ({ ...item, id: `${item.kind}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface VocabItemsSource {
  title?: string;
  terms?: VocabTerm[];
  /** The pinned mode's challenge types (`match`, `fill_blank`, `context`). */
  challengeTypes?: string[];
  difficulty?: string;
  items?: VocabItem[];
  /** Legacy generations (before 2026-10-16, model-written challenges): read only for their types. */
  challenges?: Array<{ type?: string }>;
}

export const resolveTier = (d: Pick<VocabItemsSource, 'difficulty'>): VocabTier => {
  const t = (d.difficulty ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The kinds a lesson asks: its pin's challenge types, else the legacy challenges' types, else all three. */
export function resolveKinds(d: VocabItemsSource): VocabKind[] {
  const pick = (xs: Array<string | undefined>) => VOCAB_KINDS.filter(k => xs.includes(k));
  const pinned = pick(d.challengeTypes ?? []);
  if (pinned.length) return pinned;
  const legacy = pick((d.challenges ?? []).map(c => c?.type));
  return legacy.length ? legacy : [...VOCAB_KINDS];
}

/** False when a stored item is not one code could have built from this bank (its key would not be computable). */
export function validVocabItem(i: VocabItem | undefined, bank: readonly VocabTerm[]): i is VocabItem {
  if (!i || typeof i.id !== 'string' || !i.id) return false;
  const ids = new Set(bank.map(t => t.id));
  const unique = (xs: unknown) => Array.isArray(xs) && xs.every(x => typeof x === 'string' && ids.has(x)) && new Set(xs).size === xs.length;
  if (i.kind === 'match') {
    return unique(i.terms) && unique(i.defs) && i.terms.length >= 2 && i.terms.every(t => i.defs.includes(t))
      && i.defs.length <= i.terms.length + 1;
  }
  if (i.kind === 'fill_blank' || i.kind === 'context') {
    const t = bank.find(x => x.id === i.term);
    return !!t && unique(i.options) && i.options.length >= 2 && i.options.includes(i.term)
      && (i.kind === 'fill_blank' ? !!clozeOf(t) : !!situationOf(t));
  }
  return false;
}

/** Every item of the session: the stored, code-built items when all valid, else built from the bank. */
export function vocabItems(d: VocabItemsSource): VocabItem[] {
  const bank = d.terms ?? [];
  const stored = Array.isArray(d.items) ? d.items.filter(i => validVocabItem(i, bank)) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildVocabItems({ bank, kinds: resolveKinds(d), tier: resolveTier(d), rng: seededRng(`${d.title ?? 'vocabulary'}:${bank.map(t => t.id).join(',')}`) });
}

// ── Work, keys, checks, misses ───────────────────────────────────────────────────────────

/** The learner's work: match pairs (word id → meaning id) or the choice picked. */
export interface VocabWork { pairs: Record<string, string>; picked: string | null }
export const emptyWork = (): VocabWork => ({ pairs: {}, picked: null });

export const workComplete = (item: VocabItem, w: VocabWork) =>
  item.kind === 'match' ? item.terms.every(t => !!w.pairs[t]) : w.picked !== null;

export function vocabCorrect(item: VocabItem | undefined, w: VocabWork): boolean {
  if (!item) return false;
  if (item.kind === 'match') return item.terms.every(t => w.pairs[t] === t);
  return w.picked === item.term;
}

export const VOCAB_MISSES: Record<VocabMode, readonly VocabMiss[]> = {
  explore: MATCH_MISSES,
  recall: [...MATCH_MISSES, ...CHOICE_MISSES],
  apply: CHOICE_MISSES,
};

/** A wrong choice: a word related to the answer, a word of another kind, or another word on screen. */
export function choiceMiss(key: VocabTerm, picked: VocabTerm): ChoiceMiss {
  if (isRelated(key, picked)) return 'related_word';
  if (posOf(key) && posOf(picked) && posOf(key) !== posOf(picked)) return 'wrong_kind_of_word';
  return 'other_word';
}

export function vocabMiss(item: VocabItem | undefined, w: VocabWork, bank: readonly VocabTerm[]): VocabMiss | undefined {
  if (!item || !workComplete(item, w) || vocabCorrect(item, w)) return undefined;
  if (item.kind === 'match') {
    if (item.terms.some(t => !item.terms.includes(w.pairs[t]))) return 'extra_meaning';
    const wrong = item.terms.filter(t => w.pairs[t] !== t);
    if (wrong.length === 2 && w.pairs[wrong[0]] === wrong[1] && w.pairs[wrong[1]] === wrong[0]) return 'swapped_pair';
    return 'several_wrong';
  }
  const key = bank.find(t => t.id === item.term), picked = bank.find(t => t.id === w.picked);
  return key && picked ? choiceMiss(key, picked) : 'other_word';
}

// ── The session's check items, spoken keys ──────────────────────────────────────────────

const wordOf = (bank: readonly VocabTerm[], id: string) => bank.find(t => t.id === id)?.word ?? id;

/**
 * A check item as the boss and the component carry it: the item, the eval mode it belongs to, and the lesson's word
 * bank (so the ask, the key and the levers read the words without the lesson).
 */
export type VocabCheck = VocabItem & { mode: VocabMode; bank: readonly VocabTerm[] };

/** The eval mode an item kind belongs to in a session of these kinds (a match sits in recall beside sentences). */
export function modeOfKind(kind: VocabKind, kinds: readonly VocabKind[]): VocabMode {
  if (kind === 'match') return kinds.includes('fill_blank') ? 'recall' : 'explore';
  if (kind === 'context') return 'apply';
  return kinds.includes('match') ? 'recall' : 'apply';
}

/** An item as a check of this lesson. */
export const asCheck = (item: VocabItem, mode: VocabMode, bank: readonly VocabTerm[]): VocabCheck => ({ ...item, mode, bank });

/** Every check item of the session (`vocabItems`), carrying its mode and the word bank. */
export function vocabChecks(d: VocabItemsSource): VocabCheck[] {
  const bank = d.terms ?? [], kinds = resolveKinds(d);
  return vocabItems(d).map(i => asCheck(i, modeOfKind(i.kind, kinds), bank));
}

/** The key of a sentence or situation item: the word. Null on a match: the activity checks the pairs. */
export function vocabKey(check: VocabCheck): SpokenKey | null {
  if (check.kind === 'match') return null;
  const answer = wordOf(check.bank, check.term).trim();
  if (!answer) return null;
  return {
    answer, alsoAccept: [],
    acceptRule: 'The word said alone or in the sentence counts, and so does another form of the same word (a plural, a past tense).',
    signatureError: 'Naming two words, or hedging between them, is not an answer.',
  };
}

const MISS_WHAT: Record<ChoiceMiss, string> = {
  related_word: 'a word related to it whose meaning is different',
  wrong_kind_of_word: 'another kind of word',
  other_word: 'another of the words on screen',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function vocabSpokenMisses(item: ChoiceItem, bank: readonly VocabTerm[]): KnownMiss[] {
  const key = bank.find(t => t.id === item.term);
  if (!key) return [];
  const groups = new Map<ChoiceMiss, VocabTerm[]>();
  for (const o of item.options) {
    const t = bank.find(x => x.id === o);
    if (!t || t.id === key.id) continue;
    const m = choiceMiss(key, t);
    groups.set(m, [...(groups.get(m) ?? []), t]);
  }
  return CHOICE_MISSES.filter(m => groups.has(m)).map(m => ({
    id: m,
    pattern: `The right word is "${key.word}". The learner's answer is ${MISS_WHAT[m]}: ${groups.get(m)!.map(t => `"${t.word}"`).join(', ')}.`,
    examples: groups.get(m)!.map(t => t.word).slice(0, 6),
  }));
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface VocabView {
  /** The word cards are open (before the check starts). */
  studying: boolean;
  /** The card on screen while studying. */
  card: number;
  /** How many cards the learner has opened. */
  viewed: number;
  work: VocabWork;
  /** Credited: the answer is shown as right. */
  solved: boolean;
  /** The work was checked and is shown wrong (until Try again). */
  checkedWrong?: boolean;
}

const cap = (s: string, n = 480) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const letter = (i: number) => String.fromCharCode(65 + i);

export function describeVocabWork(item: VocabItem | undefined, w: VocabWork, bank: readonly VocabTerm[]): string {
  if (!item) return 'Nothing chosen yet';
  if (item.kind === 'match') {
    const pairs = item.terms.filter(t => w.pairs[t]).map(t => `"${wordOf(bank, t)}" with meaning ${letter(item.defs.indexOf(w.pairs[t]))}`);
    return pairs.length ? `Paired ${pairs.join(', ')}` : 'No pairs made yet';
  }
  return w.picked ? `Chose "${wordOf(bank, w.picked)}"` : 'Nothing chosen yet';
}

/**
 * This word set's own rules for each part of the session (the shared doctrine already forbids saying the answer,
 * ruling a choice out and doing the step): what is hidden, and the facts about the words that would answer the item.
 */
const CONSTRAINTS_STUDY = 'Nothing is asked yet: talk about the words freely while the learner reads, but do not ask the questions '
  + 'of the check. The cards close for good when the learner presses Start the check.';
const CONSTRAINTS_MATCH = 'The word cards are closed. Never retell a meaning so it points to one word, and never name an idea '
  + 'from one meaning for the learner to look for ("warming up into a gas"), in the meanings or in example sentences.';
const CONSTRAINTS_CHOICE = 'The word cards are closed. Never say the first sound or letter of the word. Never put what is happening '
  + 'into the words of the right meaning ("liquid turning into a gas"): read the sentence or situation as written and ask '
  + 'what is happening in it and which words are clues. Never say what kind of word the blank needs (an action word, a '
  + 'thing), even when the choices are labeled. Never say what a choice means unless the meanings are on screen; then the '
  + 'learner reads them (read them aloud only when asked, every one in order), and never point to one.';

/** What is drawn and asked. Words and meanings as on screen, never which goes with which; the answer only once credited. */
export function workspaceScene(item: VocabItem, view: VocabView, bank: readonly VocabTerm[]): SceneOf {
  if (view.studying) {
    const t = bank[Math.max(0, Math.min(view.card, bank.length - 1))];
    return { objects: [], facts: {
      kind: 'study',
      words: bank.map(x => x.word).join(', '),
      card: t ? cap(`Card ${view.card + 1} of ${bank.length}: "${t.word}" (${t.partOfSpeech}). It means: ${t.definition} Example: "${t.exampleSentence}"`) : 'No card',
      cardsOpened: `${view.viewed} of ${bank.length}`,
      constraints: CONSTRAINTS_STUDY,
    } } as SceneOf;
  }
  const facts: Record<string, string> = { kind: item.kind, question: cap(askOf(item, bank)) };
  if (item.kind === 'match') {
    facts.words = item.terms.map(t => wordOf(bank, t)).join(', ');
    item.defs.forEach((d, i) => { facts[`meaning${letter(i)}`] = cap(bank.find(t => t.id === d)?.definition ?? ''); });
    if (view.solved) facts.result = 'Every pair is checked right; the pairs are shown on screen.';
    else if (view.checkedWrong) facts.pairsRight = `${item.terms.filter(t => view.work.pairs[t] === t).length} of ${item.terms.length} pairs are right.`;
  } else {
    facts.choices = item.options.map((o, i) => `${i + 1}) ${wordOf(bank, o)}`).join('  ');
    if (view.solved) facts.result = `Credited: "${wordOf(bank, item.term)}" is shown as the answer.`;
  }
  facts.learnerWork = describeVocabWork(item, view.work, bank);
  facts.constraints = item.kind === 'match' ? CONSTRAINTS_MATCH : CONSTRAINTS_CHOICE;
  return { objects: [], facts } as SceneOf;
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and a wrong answer showing the most telling miss the item can. */
export function vocabHarnessAnswers(item: VocabItem, bank: readonly VocabTerm[]): { correct: VocabWork; plainWrong: VocabWork } {
  if (item.kind === 'match') {
    const correct: VocabWork = { pairs: Object.fromEntries(item.terms.map(t => [t, t])), picked: null };
    const [a, b] = item.terms;
    return { correct, plainWrong: { pairs: { ...correct.pairs, [a]: b, [b]: a }, picked: null } };
  }
  const key = bank.find(t => t.id === item.term)!;
  const foils = item.options.filter(o => o !== item.term)
    .sort((x, y) => CHOICE_MISSES.indexOf(choiceMiss(key, bank.find(t => t.id === x)!)) - CHOICE_MISSES.indexOf(choiceMiss(key, bank.find(t => t.id === y)!)));
  return { correct: { pairs: {}, picked: item.term }, plainWrong: { pairs: {}, picked: foils[0] } };
}
