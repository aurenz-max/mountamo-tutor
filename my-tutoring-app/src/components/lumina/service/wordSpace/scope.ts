/**
 * Letter scope (service/wordSpace): which words a reading or spelling lesson may use, read from the
 * objective text. Code only; no model.
 *
 * A scope is a set of taught grapheme/phoneme pairs (GPCs), never a set of letters. "s a t i p n" admits
 * sat, pin and snap. It does not admit is (s says /z/), pain (ai) or pass (ss), although every letter is
 * taught. A word is decodable under a scope when every GPC in it is `known`. `focus` is what this lesson
 * is about: a letter group's new letters, a named short vowel, the silent-e pairs, the digraphs.
 *
 * Ported from the 2026-10-13 lab (`scripts/word-space-lab/scope.mjs`), which recalled the published
 * example lists: K short a/e/o/u 8/8, G1 CVC 10/10, silent e 9/10 (the miss was cute, read as a consonant
 * shape; `shapeOf` fixes it). The group order comes from `literacy/letterGroups.ts`, the one source.
 */
import { LETTER_GROUPS, NEW_LETTERS, lettersNamedIn, type LetterGroup } from '../literacy/letterGroups';
import { VOWEL_PHONES as VOWELS, WORDS, knownByForGrade, lexWord, shapeOf, type LexWord } from './lexicon';

/** The most common sound of each letter, as letter-sound lessons teach it (q is taught as qu). */
export const BASIC_SOUND: Readonly<Record<string, readonly string[]>> = {
  s: ['S'], a: ['AE'], t: ['T'], i: ['IH'], p: ['P'], n: ['N'], c: ['K'], k: ['K'], e: ['EH'], h: ['HH'], r: ['R'], m: ['M'],
  d: ['D'], g: ['G'], o: ['AA', 'AO'], u: ['AH'], l: ['L'], f: ['F'], b: ['B'], j: ['JH'], z: ['Z'], w: ['W'], v: ['V'],
  y: ['Y'], x: ['K S'], qu: ['K W'],
};
export const ALPHABET: readonly string[] = Object.keys(BASIC_SOUND);
const SHORT_GPC: Readonly<Record<string, readonly string[]>> = { a: ['a/AE'], e: ['e/EH'], i: ['i/IH'], o: ['o/AA', 'o/AO'], u: ['u/AH'] };
export const SPLIT_DIGRAPHS: readonly string[] = ['a_e/EY', 'i_e/AY', 'o_e/OW', 'u_e/UW', 'u_e/Y UW', 'e_e/IY'];
export const DIGRAPHS: readonly string[] = ['sh/SH', 'ch/CH', 'th/TH', 'th/DH', 'wh/W'];
/** Double letters and ck: taught with their single letter in every K-1 sequence (bell, kiss, duck). */
const DOUBLES: readonly string[] = ['ck/K', 'ss/S', 'll/L', 'ff/F', 'zz/Z'];
export const VOWEL_TEAMS: readonly string[] = ['ai/EY', 'ay/EY', 'ee/IY', 'ea/IY', 'oa/OW', 'ow/OW', 'oo/UW', 'oo/UH', 'ou/AW', 'ow/AW', 'oi/OY', 'oy/OY', 'aw/AO', 'au/AO', 'ew/UW', 'igh/AY'];
export const R_CONTROLLED: readonly string[] = ['ar/AA R', 'or/AO R', 'er/ER', 'ir/ER', 'ur/ER'];
const INITIAL_BLENDS = ['bl', 'cl', 'fl', 'gl', 'pl', 'sl', 'br', 'cr', 'dr', 'fr', 'gr', 'tr', 'st', 'sp', 'sn', 'sw', 'sk', 'sm'];
const FINAL_BLENDS = ['nd', 'nk', 'nt', 'mp', 'lt', 'lk', 'ft', 'sk', 'st', 'sp', 'lp', 'ld', 'pt', 'ct'];

export interface LetterScope {
  /** Every pair a word may use. */
  known: ReadonlySet<string>;
  /** The pairs this lesson is about; null when the lesson has no focus beyond `known`. */
  focus: ReadonlySet<string> | null;
  /** every: each word uses a focus pair. most: two thirds of a draw do (a letter group: new + review). */
  focusRule: 'every' | 'most' | null;
  /** Allowed spelling shapes (`shapeOf`); null = any one-syllable shape. */
  shapes: readonly string[] | null;
  /** One letter per sound (CVC spelling tiles); doubles and ck are out. */
  singleLetters: boolean;
  /** Short vowels the lesson names, when it names some. */
  vowels: readonly string[] | null;
  onsetClusters: readonly string[] | null;
  codaClusters: readonly string[] | null;
  /** A word family's rime spelling ("at" for "-at: cat, hat"). */
  family: string | null;
  group: LetterGroup | null;
  knownLetters: readonly string[] | null;
  focusLetters: readonly string[] | null;
  /** One line for logs: what the parser read. */
  label: string;
}

export const gpcsForLetters = (letters: readonly string[]): Set<string> => {
  const out = new Set<string>();
  for (const l of letters) for (const p of BASIC_SOUND[l] ?? []) out.add(`${l}/${p}`);
  // ck is taught with c and k (group 2). Doubles (ss, ll) are not: a group-1 lesson has no "pass".
  if (letters.includes('c') && letters.includes('k')) out.add('ck/K');
  return out;
};
/** Every basic letter sound plus ck and the doubles: the known set of a pattern lesson (short e, CVC). */
const ALL_BASIC: ReadonlySet<string> = new Set([...Array.from(gpcsForLetters(ALPHABET)), ...DOUBLES]);

const lettersOf = (s: string): string[] => {
  const out: string[] = [];
  for (const m of Array.from(s.toLowerCase().matchAll(/\b(qu|[a-z])\b/g))) {
    const l = m[1] === 'q' ? 'qu' : m[1];
    if (!out.includes(l)) out.push(l);
  }
  return out;
};

/** The letters of a letter-group objective: the cumulative practice set and the new letters. */
function readLetters(text: string): { known: string[]; focus: string[]; group: LetterGroup | null } | null {
  const t = text.toLowerCase();
  const groupM = /\bgroup\s*([1-4])\b/.exec(t);
  const group = groupM ? (Number(groupM[1]) as LetterGroup) : /\bsatpin\b/.test(t) ? 1 : null;
  const cumulative = /cumulative\)?\**:?\**\s*\n?\s*([a-z][a-z ,]*)/i.exec(text);
  const fresh = /new letters introduced:?\**\s*\n?\s*([a-z][a-z ,]*)/i.exec(text);
  if (group) {
    return {
      known: cumulative ? lettersOf(cumulative[1]) : [...LETTER_GROUPS[group]],
      focus: fresh ? lettersOf(fresh[1]) : [...NEW_LETTERS[group]],
      group,
    };
  }
  // A list of three or more letters ("s, a, t, i, p, n" / "s a t i p n"), never one quoted letter.
  const named = lettersNamedIn(text).map((l) => (l === 'q' ? 'qu' : l));
  return named.length >= 3 ? { known: named, focus: named, group: null } : null;
}

/** "-at: cat, hat" / "the -ig family": a word family's rime spelling. */
const familyIn = (t: string): string | null =>
  /\bfamil(?:y|ies)\b/.test(t) || /-[aeiou][a-z]{1,2}\s*:/.test(t)
    ? (/(?:^|[\s(])-([aeiou][a-z]{1,2})\b/.exec(t)?.[1] ?? null)
    : null;

/**
 * Read a lesson's letter scope from its objective texts (objective, intent, topic). Returns null when the
 * texts name no letters and no spelling pattern; the caller then has no reading scope to hold.
 */
export function scopeFromObjective(texts: ReadonlyArray<string | null | undefined>): LetterScope | null {
  const text = texts.filter(Boolean).join('\n');
  const t = text.toLowerCase();
  const letters = readLetters(text);
  const vowelsNamed = Array.from(new Set(Array.from(t.matchAll(/short\s*['‘’"]?([aeiou])\b/g)).map((m) => m[1])));
  const mixed = /mixed short vowels|all (?:five|5) short vowels|any of the five short vowel/.test(t);
  const scope: LetterScope = {
    known: ALL_BASIC, focus: null, focusRule: null, shapes: null, singleLetters: false, vowels: null,
    onsetClusters: null, codaClusters: null, family: familyIn(t), group: letters?.group ?? null,
    knownLetters: letters?.known ?? null, focusLetters: letters?.focus ?? null, label: '',
  };
  const parts: string[] = [];

  if (letters) {
    scope.known = gpcsForLetters(letters.known);
    scope.focus = gpcsForLetters(letters.focus);
    scope.focusRule = 'most';
    scope.shapes = ['VC', 'CVC', 'CCVC', 'CVCC'];
    parts.push(`letters ${letters.known.join('')} (new ${letters.focus.join('')})`);
  }
  const silentE = /silent[- ]e|magic[- ]e|\bcvce\b|vowel[- ]consonant[- ]e/.test(t);
  const cvc = /\bcvc\b/.test(t);
  if (/minimal pairs between short and long/.test(t)) {
    scope.known = new Set([...Array.from(scope.known), ...SPLIT_DIGRAPHS]);
    scope.shapes = ['CVC', 'CVCe'];
    parts.push('short/long pairs');
  } else if (silentE) {
    scope.known = new Set([...Array.from(scope.known), ...SPLIT_DIGRAPHS]);
    scope.focus = new Set(SPLIT_DIGRAPHS);
    scope.focusRule = cvc ? 'most' : 'every';
    scope.shapes = cvc ? ['CVC', 'CVCe'] : ['CVCe'];
    parts.push(cvc ? 'CVC + silent e' : 'silent e');
  }
  if (/initial (?:consonant )?blends|beginning blends/.test(t)) {
    const named = Array.from((/blends\s*\(([^)]*)\)/.exec(t)?.[1] ?? '').matchAll(/\b([a-z]{2})\b/g)).map((m) => m[1]);
    scope.onsetClusters = named.length ? named : INITIAL_BLENDS;
    scope.shapes = ['CCVC', 'CCVCC'];
    scope.focusRule = null;
    parts.push(`initial blends ${scope.onsetClusters.join(',')}`);
  }
  if (/final (?:consonant )?blends|ending blends/.test(t)) {
    const named = Array.from((/final blends including ([^.\n]*)/.exec(t)?.[1] ?? '').matchAll(/\b([a-z]{2})\b/g)).map((m) => m[1]);
    scope.codaClusters = named.length ? named : FINAL_BLENDS;
    scope.shapes = ['CVCC', 'VCC'];
    parts.push(`final blends ${scope.codaClusters.join(',')}`);
  }
  if (/digraph/.test(t)) {
    scope.known = new Set([...Array.from(scope.known), ...DIGRAPHS]);
    scope.focus = new Set(DIGRAPHS);
    scope.focusRule = 'every';
    scope.shapes = scope.shapes ?? ['VC', 'CVC', 'CVCC', 'CCVC'];
    parts.push('digraphs');
  }
  if (/r-controlled|bossy r|vowel teams?|long vowel teams|diphthong/.test(t)) {
    const teams = [...(/r-controlled|bossy r/.test(t) ? R_CONTROLLED : []), ...(/vowel teams?|diphthong/.test(t) ? VOWEL_TEAMS : [])];
    scope.known = new Set([...Array.from(scope.known), ...DIGRAPHS, ...teams]);
    scope.focus = new Set(teams);
    scope.focusRule = 'every';
    scope.shapes = null;
    parts.push(teams === R_CONTROLLED ? 'r-controlled' : 'vowel teams');
  }
  if (cvc && !silentE && !letters) {
    scope.shapes = ['CVC'];
    // K CVC spells one letter per sound (the tiles); grade-1 CVC lists include duck and bell.
    scope.singleLetters = !/\bck\b|double/.test(t);
    parts.push('CVC');
  } else if (cvc && letters) {
    scope.shapes = ['CVC'];
  }
  if (vowelsNamed.length || mixed) {
    const vowels = mixed || !vowelsNamed.length ? ['a', 'e', 'i', 'o', 'u'] : vowelsNamed;
    scope.vowels = vowels;
    if (!silentE && !scope.focus) {
      scope.focus = new Set(vowels.flatMap((v) => SHORT_GPC[v]));
      scope.focusRule = vowels.length === 1 ? 'every' : null;
    }
    parts.push(`short ${vowels.join('')}`);
  }
  if (scope.family) parts.push(`family -${scope.family}`);
  if (!parts.length) return null;
  scope.label = parts.join(', ');
  return scope;
}

/** Does this word use one of the scope's focus pairs? */
export const hitsFocus = (scope: LetterScope, x: LexWord): boolean => !!scope.focus && !!x.gpcs?.some((g) => scope.focus!.has(g));

/**
 * Words spelled one way and said two ways (dove the bird / dove the verb, bow, wind): a reader cannot know
 * which sound the item means, and the picture may show the other one.
 */
const HETERONYMS: ReadonlySet<string> = new Set(['dove', 'bow', 'bows', 'wind', 'live', 'read', 'lead', 'tear', 'bass', 'close', 'sow', 'row', 'rows', 'does', 'wound', 'use', 'house']);

/** A base word plus an ending (cats, sits, jumped, going): a morphology item, not a decoding one. */
export const isInflected = (x: LexWord): boolean => {
  const w = x.w;
  const base = (b: string) => b.length >= 2 && !!lexWord(b);
  const doubled = (stem: string) => /([b-df-hj-np-tv-z])\1$/.test(stem) && base(stem.slice(0, -1));
  // A consonant then s said /s/ or /z/ (snorts, joints) is a plural even when its base is not in the library.
  const consonantS = /[^aeiousy]s$/.test(w) && ['S', 'Z'].includes(x.phones[x.phones.length - 1]) && !VOWELS.has(x.phones[x.phones.length - 2]);
  return consonantS || (/[^s]s$/.test(w) && base(w.slice(0, -1))) || (/(sh|ch|x|ss|z)es$/.test(w) && base(w.slice(0, -2)))
    || (/ed$/.test(w) && w.length >= 5 && (base(w.slice(0, -2)) || base(w.slice(0, -1)) || doubled(w.slice(0, -2))))
    // -ing: plain (going), e dropped (gaming = game), or a doubled consonant (letting = let).
    || (/ing$/.test(w) && w.length >= 5 && (base(w.slice(0, -3)) || base(`${w.slice(0, -3)}e`) || doubled(w.slice(0, -3))));
};

/** Does every pair of this word sit inside the scope, in an allowed shape? */
export function isDecodable(scope: LetterScope, x: LexWord): boolean {
  if (!x.gpcs || x.syllables !== 1 || HETERONYMS.has(x.w) || isInflected(x)) return false;
  // Silent e after r is r-controlled (fire, here, care), not the long-vowel rule.
  if (x.gpcs.some((g) => g.includes('_e')) && /re$/.test(x.w)) return false;
  if (!x.gpcs.every((g) => scope.known.has(g))) return false;
  const shape = shapeOf(x);
  if (scope.shapes && (!shape || !scope.shapes.includes(shape))) return false;
  if (scope.singleLetters && !x.gpcs.every((g) => g.split('/')[0].length === 1)) return false;
  if (scope.focusRule === 'every' && !hitsFocus(scope, x)) return false;
  if (scope.onsetClusters && !scope.onsetClusters.includes(x.w.slice(0, 2))) return false;
  if (scope.codaClusters && !scope.codaClusters.includes(x.w.slice(-2))) return false;
  if (scope.family && !(x.w.endsWith(scope.family) && x.w.length === scope.family.length + 1)) return false;
  return true;
}

/**
 * Every word the scope admits at a grade: one syllable, every pair known, the grade's familiar words.
 * `needPicture` keeps only words whose picture a rater judged shows the word (pre-readers reach words
 * through pictures).
 */
export function decodableWords(scope: LetterScope, opts: { grade: string; needPicture?: boolean }): LexWord[] {
  const allowed = knownByForGrade(opts.grade);
  return WORDS.filter((x) => allowed.has(x.knownBy) && (!opts.needPicture || !!x.emoji) && isDecodable(scope, x));
}

/** A scope with no letter limit beyond the basic sounds: the default when the objective names nothing. */
export const basicScope = (shapes: readonly string[] = ['CVC']): LetterScope => ({
  known: ALL_BASIC, focus: null, focusRule: null, shapes, singleLetters: shapes.length === 1 && shapes[0] === 'CVC', vowels: null,
  onsetClusters: null, codaClusters: null, family: null, group: null, knownLetters: null, focusLetters: null, label: `basic ${shapes.join('/')}`,
});
