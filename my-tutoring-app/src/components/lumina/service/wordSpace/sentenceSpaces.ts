/**
 * Sentence spaces for di-sentence-reading (service/wordSpace): every printed sentence a mode may ask a K-1 reader
 * to read aloud inside a lesson's letter scope, its difficulty computed from the sentence's words.
 *
 * Measured before (2026-10-14, `qa/word-space-lab/2026-10-13/di-sentence-reading/before.txt`, 2 runs per tier): the
 * tiers already separated by sentence length (the L4 word-count band), but run 1 and run 2 of a tier gave the same
 * four sentences in every mode, and "Letter-Sound Group 1: s, a, t, i, p, n" served "The red hen ran" and "The dog
 * is hot" (r, e, h, d, o, g untaught). The 52-sentence menu held no sentence a group-1 reader could decode.
 *
 * The sentences are not written at lesson time. The hand menu (`diSentenceReadingMenu.ts`, ten of it benched live)
 * and a bank drafted once at build time (`sentenceBank.json`, `scripts/word-space-lab/build-sentences.mjs`) are both
 * checked here, word by word, against the lesson's scope from the word library: a word is readable when every
 * letter-sound pair in it is taught (`scope.known`), or it is one of the scope's tricky words, or a decodable name.
 *
 * Features (beta, logits; refit from first-try results). Length is the main one: each word is one more chance to
 * drop, swap or add a word, the error the tutor judges (and the L4 band's axis). Tricky words a reader must recall
 * whole (said, you, was) add load beyond a, the and I; a question or exclamation asks for the end punctuation to be
 * read too; words known only from grade 1 add a little; a repeated word ("We go up and we go down") is easier,
 * the pattern predictable texts are built on. Key: the first content word, so a session does not open three
 * sentences on "the cat".
 */
import { WORDS, lexWord, knownByForGrade, shapeOf, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { basicScope, gpcsForLetters, hitsFocus, isInflected, type LetterScope } from './scope';
import { citationGpcs, sightWordSpace } from './diWordReadingSpaces';
import { SENTENCE_MENU, spokenForm } from '../../primitives/visual-primitives/direct-instruction/diSentenceReadingMenu';
import bank from './sentenceBank.json';

export type SentenceMode = 'decodable_sentence' | 'read_sentence' | 'sight_phrase_sentence' | 'sentence_review';

export interface SentencePayload {
  /** The menu key for a menu sentence (its challenge id keeps the key); absent for a bank sentence. */
  menuId?: string;
  text: string;
  wordCount: number;
  vowels?: string[];
  emoji?: string;
  asrAliases: string[];
}

/** a, the and I: in every decodable text from the first lesson. */
const FIRST_TRICKY = new Set(['a', 'i', 'the']);
/** Tricky words a decodable sentence may hold once a scope is past the first two letter groups. */
const DECODABLE_TRICKY = new Set([...Array.from(FIRST_TRICKY), 'is', 'to', 'has', 'his', 'as']);
/** Small decodable words a sentence needs whatever its pattern (a short-a lesson still says "on" and "in"). */
const FUNCTION_DECODABLE = new Set(['in', 'on', 'up', 'it', 'at', 'an', 'and', 'can', 'had', 'but', 'not', 'if', 'us', 'am']);
/** Names that spell their sounds; readable when every letter is in scope. */
const NAMES = new Set(['sam', 'pat', 'tim', 'nan', 'pam', 'tam', 'dan', 'ben', 'meg', 'ted', 'kim', 'jim', 'tom', 'bob', 'gus',
  'jan', 'max', 'ron', 'mom', 'dad', 'pip', 'nat', 'tad', 'deb', 'ken', 'rex', 'liz', 'meg', 'viv', 'peg']);

const tokens = (text: string): string[] => spokenForm(text).split(' ').filter(Boolean);

/** Sight words a sentence may hold at a grade (the Dolch words the grade cannot decode, plus a, the, I). */
const sightSet = (grade: string): ReadonlySet<string> => new Set([...Array.from(FIRST_TRICKY), ...sightWordSpace(grade).map((it) => it.words[0])]);

/**
 * Does this word decode with the scope's pairs? One syllable, no ending, a familiar word at the grade, and a CVC or
 * VC shape: the catalog keeps this pack to short-vowel words with no blend or digraph (frog, ship, black are out).
 * At K one letter spells each sound (no ck, ll, ss), as in di-word-reading.
 */
function decodes(w: string, scope: LetterScope, grade: string): boolean {
  if (NAMES.has(w)) return Array.from(gpcsForLetters(w.split(''))).every((g) => scope.known.has(g));
  const x = lexWord(w);
  const gpcs = x && citationGpcs(x);
  if (!x || !gpcs || x.syllables !== 1 || isInflected(x) || !knownByForGrade(grade).has(x.knownBy)) return false;
  // The small words a sentence needs (and, in, up) keep only the pair rule: "and" ends in nd.
  if (!FUNCTION_DECODABLE.has(w) && !['VC', 'CVC'].includes(shapeOf(x) ?? '')) return false;
  if (grade === 'K' && gpcs.some((g) => g.split('/')[0].length > 1)) return false;
  return gpcs.every((g) => scope.known.has(g));
}

interface Reading { ok: boolean; tricky: string[]; decoded: LexWord[]; hitsFocus: boolean }

/** Read a sentence against a scope: which words are tricky, whether every other word decodes. */
function readSentence(text: string, scope: LetterScope, grade: string, allowed: ReadonlySet<string>): Reading {
  const tricky: string[] = [];
  const decoded: LexWord[] = [];
  let focus = false;
  for (const w of tokens(text)) {
    if (decodes(w, scope, grade)) {
      const x = lexWord(w);
      if (x) {
        decoded.push(x);
        // A pattern lesson's every-word rule binds the content words; "on", "in" are exempt.
        if (scope.focusRule === 'every' && scope.focus && !FUNCTION_DECODABLE.has(w) && !hitsFocus(scope, x)) return { ok: false, tricky, decoded, hitsFocus: false };
        if (scope.focus && hitsFocus(scope, x)) focus = true;
      } else {
        // A name follows the pattern rule like any content word: a short-a lesson says Sam and Pat, not Kim.
        const hits = !!scope.focus && Array.from(gpcsForLetters(w.split(''))).some((g) => scope.focus!.has(g));
        if (scope.focusRule === 'every' && scope.focus && !hits) return { ok: false, tricky, decoded, hitsFocus: false };
        if (hits) focus = true;
      }
    } else if (allowed.has(w)) tricky.push(w);
    else return { ok: false, tricky, decoded, hitsFocus: false };
  }
  return { ok: true, tricky, decoded, hitsFocus: focus || !scope.focus };
}

/** Never a tutor verdict opener ("Yes", "my turn"), and one clause: a comma splice ("I sat, Pat sat.") is two. */
const isSentinelSafe = (text: string) => !/^yes\b/i.test(text.trim()) && !/\bmy turn\b/i.test(text) && !text.includes(',');

/** Every candidate sentence: the hand menu, then the build-time bank (deduplicated by spoken form). */
const CANDIDATES: ReadonlyArray<{ menuId?: string; text: string; emoji?: string; extraAliases?: string[]; benched?: boolean }> = (() => {
  const seen = new Set<string>();
  const out: Array<{ menuId?: string; text: string; emoji?: string; extraAliases?: string[]; benched?: boolean }> = [];
  for (const e of [...Object.entries(SENTENCE_MENU).map(([menuId, m]) => ({ ...m, menuId })), ...(bank as { sentences: Array<{ text: string }> }).sentences]) {
    const key = spokenForm(e.text);
    if (seen.has(key) || !isSentinelSafe(e.text)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
})();

const SHORT_OF: Readonly<Record<string, string>> = { AE: 'a', EH: 'e', IH: 'i', AA: 'o', AO: 'o', AH: 'u' };

function itemFor(c: (typeof CANDIDATES)[number], r: Reading): WordSpaceItem<SentencePayload> {
  const words = tokens(c.text);
  const hard = r.tricky.filter((w) => !FIRST_TRICKY.has(w));
  const content = words.filter((w) => !FIRST_TRICKY.has(w) && !FUNCTION_DECODABLE.has(w));
  const repeated = new Set(content).size < content.length;
  const g1 = r.decoded.filter((x) => x.knownBy !== 'K').length;
  const punct = /[?!]\s*$/.test(c.text);
  const beta = 0.35 * (words.length - 3) + 0.25 * Math.min(3, hard.length) + (punct ? 0.3 : 0) + 0.2 * Math.min(2, g1)
    + (repeated ? -0.2 : 0);
  // The short vowels the content words drill (the menu's `vowels`): on, in and up do not count.
  const vowels = Array.from(new Set(r.decoded.filter((x) => !FUNCTION_DECODABLE.has(x.w))
    .map((x) => SHORT_OF[x.phones.find((p) => SHORT_OF[p]) ?? '']).filter(Boolean)));
  return {
    beta: +beta.toFixed(2),
    structure: `${words.length <= 4 ? 'short' : words.length <= 6 ? 'mid' : 'long'}:${hard.length ? 'tricky' : 'plain'}${punct ? ':ask' : ''}`,
    key: content[0] ?? words[0],
    words: [spokenForm(c.text)],
    payload: { ...(c.menuId ? { menuId: c.menuId } : {}), text: c.text, wordCount: words.length, ...(vowels.length ? { vowels } : {}), ...(c.emoji ? { emoji: c.emoji } : {}),
      asrAliases: [spokenForm(c.text), ...(c.extraAliases ?? [])] },
  };
}

/** The tricky words a mode's sentences may hold inside a scope. */
function trickyFor(mode: SentenceMode, scope: LetterScope | null, grade: string): ReadonlySet<string> {
  if (mode === 'decodable_sentence') return scope?.group && scope.group <= 2 ? FIRST_TRICKY : DECODABLE_TRICKY;
  return sightSet(grade);
}

const CACHE = new Map<string, WordSpaceItem<SentencePayload>[]>();

/**
 * Every sentence one mode allows at a grade inside a scope, at most `ceiling` words (the benched 3-8 window,
 * narrowed by grade or objective). decodable_sentence: every word decodes, or is a, the, I (plus is, to, has, his
 * past letter group 2). read_sentence: any word is a decodable word or a sight word of the grade.
 * sight_phrase_sentence: two or more sight words beyond a, the and I. sentence_review reads the whole basic code.
 */
export function sentenceSpace(mode: SentenceMode, grade: string, parsed: LetterScope | null, ceiling: number): readonly WordSpaceItem<SentencePayload>[] {
  const scope = mode === 'sentence_review' || !parsed
    ? basicScope()
    : { ...parsed, family: null, shapes: null };
  const cacheKey = `${mode}|${grade}|${ceiling}|${mode === 'sentence_review' ? '' : parsed?.label ?? ''}`;
  if (!CACHE.has(cacheKey)) {
    const allowed = trickyFor(mode, parsed, grade);
    const items: WordSpaceItem<SentencePayload>[] = [];
    for (const c of CANDIDATES) {
      const n = tokens(c.text).length;
      if (n < 3 || n > ceiling) continue;
      const r = readSentence(c.text, scope, grade, allowed);
      if (!r.ok) continue;
      // A letter-group lesson's sentence uses at least one of its new letter-sounds.
      if (scope.focusRule === 'most' && !r.hitsFocus) continue;
      if (mode === 'sight_phrase_sentence' && r.tricky.filter((w) => !FIRST_TRICKY.has(w)).length < 2) continue;
      items.push(itemFor(c, r));
    }
    CACHE.set(cacheKey, items);
  }
  return CACHE.get(cacheKey)!;
}

const bandDistance = (n: number, [lo, hi]: readonly [number, number]) => (n < lo ? lo - n : n > hi ? n - hi : 0);

/** `n` sentences from a space, inside the band first (nearest lengths fill a thin band), at random, no two opening
 *  on the same content word while another is left. */
function bandPick(space: readonly WordSpaceItem<SentencePayload>[], band: readonly [number, number], n: number, rand: () => number,
  used: Set<string>, target?: number): WordSpaceItem<SentencePayload>[] {
  const ranked = space.filter((it) => !it.words.some((w) => used.has(w)))
    .map((it) => ({ it, d: bandDistance(it.payload.wordCount, band), r: rand() }))
    .sort((a, b) => a.d - b.d || a.r - b.r).map((x) => x.it);
  const picks: WordSpaceItem<SentencePayload>[] = [];
  const keys = new Set<string>();
  const take = (ok: (it: WordSpaceItem<SentencePayload>) => boolean) => {
    for (const it of ranked) if (picks.length < n && !picks.includes(it) && ok(it)) { picks.push(it); keys.add(it.key ?? ''); }
  };
  const inBand = (it: WordSpaceItem<SentencePayload>) => bandDistance(it.payload.wordCount, band) === 0;
  if (target !== undefined) take((it) => it.payload.wordCount === target && !keys.has(it.key ?? '')); // the tier's own length
  take((it) => inBand(it) && !keys.has(it.key ?? '')); // in the band, a new opening word
  take(inBand); // in the band
  take(() => true); // the nearest lengths
  picks.forEach((it) => it.words.forEach((w) => used.add(w)));
  return picks;
}

/**
 * The length a tier's sentences should have when the L4 bands overlap. Under the K ceiling of 6 the bands are
 * easy 3-4, medium 4-5, hard 5-6, so a 4-word sentence fits easy and medium alike and the same seed drew the same
 * session for both (10-14 sample). The target is the band's one length no other tier holds (easy 3, hard 6), or for
 * a band with none, the length the easier tier lacks (medium 5). No target when the band owns two lengths (grade 1).
 */
export function bandTarget(bands: ReadonlyArray<readonly [number, number]>, tier: number): number | undefined {
  const lengths = (b: readonly [number, number]) => Array.from({ length: b[1] - b[0] + 1 }, (_, i) => b[0] + i);
  const own = lengths(bands[tier]);
  const others = new Set(bands.flatMap((b, i) => (i === tier ? [] : lengths(b))));
  const exclusive = own.filter((n) => !others.has(n));
  if (exclusive.length >= 2) return undefined;
  if (exclusive.length === 1) return exclusive[0];
  const easier = tier > 0 ? new Set(lengths(bands[tier - 1])) : new Set<number>();
  return own.find((n) => !easier.has(n));
}

/**
 * One mode's picks at a tier, sharing the session's `used` set. The tier is the L4 word-count band
 * (`resolveProblemShape`, a contract other code reads), and the space supplies everything inside it: the lesson's
 * scope, the variety, the beta stamp. Review is cumulative: up to two anchors from the lesson's scoped
 * read_sentence space, the rest from the whole basic code. Sorted shortest first, the order the bench ran.
 */
export function drawSentences(mode: SentenceMode, n: number, grade: string, parsed: LetterScope | null, ceiling: number,
  band: readonly [number, number], rand: () => number, used: Set<string>, target?: number): WordSpaceItem<SentencePayload>[] {
  const sorted = (picks: WordSpaceItem<SentencePayload>[]) => picks.sort((a, b) => a.payload.wordCount - b.payload.wordCount);
  if (mode !== 'sentence_review') return sorted(bandPick(sentenceSpace(mode, grade, parsed, ceiling), band, n, rand, used, target));
  const anchors = parsed ? bandPick(sentenceSpace('read_sentence', grade, parsed, ceiling), band, Math.min(2, n - 1), rand, used, target) : [];
  return sorted([...anchors, ...bandPick(sentenceSpace('sentence_review', grade, null, ceiling), band, n - anchors.length, rand, used, target)]);
}

export const SENTENCE_SPACE_GRADES: readonly string[] = ['K', '1'];

/**
 * Would this sentence enter the mode's space? The build script (`build-sentences.mjs`) keeps a drafted sentence
 * only when this holds for the scope it was drafted for, and tells the model which words to use with
 * `scopeVocabulary`, so the draft and the runtime read one rule.
 */
export function sentenceFits(text: string, mode: SentenceMode, grade: string, parsed: LetterScope | null, ceiling = 8): boolean {
  const n = tokens(text).length;
  if (n < 3 || n > ceiling || !isSentinelSafe(text)) return false;
  const scope = mode === 'sentence_review' || !parsed ? basicScope() : { ...parsed, family: null, shapes: null };
  const r = readSentence(text, scope, grade, trickyFor(mode, parsed, grade));
  if (!r.ok || (scope.focusRule === 'most' && !r.hitsFocus)) return false;
  return mode !== 'sight_phrase_sentence' || r.tricky.filter((w) => !FIRST_TRICKY.has(w)).length >= 2;
}

/** The words a scope lets a sentence use: decodable library words, tricky words, decodable names. */
export function scopeVocabulary(mode: SentenceMode, grade: string, parsed: LetterScope | null): { words: string[]; tricky: string[]; names: string[] } {
  const scope = !parsed ? basicScope() : { ...parsed, family: null, shapes: null };
  // A pattern lesson (short a) offers only its pattern's words, and the small words every sentence needs.
  const words = WORDS.filter((x) => decodes(x.w, scope, grade) && !NAMES.has(x.w)
    && (scope.focusRule !== 'every' || !scope.focus || FUNCTION_DECODABLE.has(x.w) || hitsFocus(scope, x))).map((x) => x.w);
  return { words, tricky: Array.from(trickyFor(mode, parsed, grade)), names: Array.from(NAMES).filter((w) => decodes(w, scope, grade)) };
}
