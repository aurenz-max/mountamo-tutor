/**
 * Word spaces for spelling-pattern-explorer (service/wordSpace): every one-syllable word a spelling pattern
 * spells, from the library's letter-sound pairs, with a beta for spelling it from dictation. One session is
 * one pattern: six pattern words to look at, a rule, then four dictation words the child spells. The tier
 * picks the dictation words; the pattern words are the easiest of the rest (examples to induce from).
 *
 * Measured before (2026-10-14, `qa/word-space-lab/2026-10-13/spelling-pattern-explorer/before.txt`, G1-2,
 * 2 runs per tier): short_vowel gave cat man pig bug hat (mop/hop/top) at every tier, mixed vowels under a
 * "CVC" highlight that marks no letters; CVCe was a_e only, cake first every run, "baker" as a dictation
 * word; vowel teams repeated rain inside one list; r-controlled put bird (ir) in an ar/or/er set and a rule
 * with Tamil text; silent letters converged on knee knot write wrist.
 *
 * A pattern word is the pattern's own pair (ai/EY, never the ai of said), so the letters always make the
 * pattern's sound. Every other pair is a basic letter sound, a double or ck, or a digraph (sh ch th wh tch
 * dge): a spelling lesson does not test a second pattern.
 *
 * Difficulty features for spelling a word whose pattern is given (logits; refit from first-try results):
 * - size: each sound past three (4: frog, 5: splash); two sounds (knee) is easiest;
 * - consonant clusters: a blend at either end (stop, nest) hides a sound when spelling;
 * - more letters than sounds outside the pattern (duck ck, ship sh, catch tch) tempts one letter per sound;
 * - /k/ spelled c or k is a choice (cat, kit); short e and i are the vowels K-1 children confuse;
 * - familiarity: the word's known-by grade.
 */
import { isVowel, type LexWord } from './lexicon';
import { tierPick, type WordSpaceItem } from './pick';
import type { SupportTier } from '../generation/generationContext';
import { DIGRAPHS, R_CONTROLLED, SPLIT_DIGRAPHS, VOWEL_TEAMS, basicScope, decodableWords, type LetterScope } from './scope';

export type SpellingPatternKind = 'short-vowel' | 'long-vowel' | 'r-controlled' | 'silent-letter';

/** A session's pattern: what the card highlights (`patternRegex` reads it) and the pairs that spell it. */
export interface SpellingPatternDef {
  id: string;
  kind: SpellingPatternKind;
  /** highlightPattern: "a", "-at", "a_e", "ai", "ar", "kn". */
  shown: string;
  gpcs: readonly string[];
  /** A rime spelling for a word family ("at"): the word must be onset + rime. */
  family?: string;
  title: string;
  ruleTemplate: string;
  correctRule: string;
}

const SHORT_NAME: Readonly<Record<string, string>> = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u' };
const SHORT_KEY: Readonly<Record<string, string>> = { a: 'apple', e: 'elephant', i: 'insect', o: 'octopus', u: 'umbrella' };
const SHORT_GPCS: Readonly<Record<string, readonly string[]>> = { a: ['a/AE'], e: ['e/EH'], i: ['i/IH'], o: ['o/AA', 'o/AO'], u: ['u/AH'] };
const LONG_OF: Readonly<Record<string, string>> = {
  a_e: 'long a', i_e: 'long i', o_e: 'long o', ai: 'long a', ay: 'long a', ee: 'long e', ea: 'long e', oa: 'long o', igh: 'long i',
};
const R_SOUND: Readonly<Record<string, string>> = { ar: '/ar/ as in car', or: '/or/ as in corn', er: '/er/ as in her', ir: '/er/ as in bird', ur: '/er/ as in fur' };
const SILENT: Readonly<Record<string, { gpc: string; silent: string; heard: string }>> = {
  kn: { gpc: 'kn/N', silent: 'k', heard: '/n/' }, wr: { gpc: 'wr/R', silent: 'w', heard: '/r/' },
};
const gpcsOf = (list: readonly string[], g: string) => list.filter((p) => p.startsWith(`${g}/`));

export function shortVowelPattern(v: string): SpellingPatternDef {
  return {
    id: v, kind: 'short-vowel', shown: v, gpcs: SHORT_GPCS[v], title: `Short ${SHORT_NAME[v]} Words`,
    ruleTemplate: 'In all of these words, the vowel ___ makes its ___ sound.',
    correctRule: `The vowel ${v} makes its short sound, /${v}/, as in ${SHORT_KEY[v]}.`,
  };
}

export function familyPattern(rime: string): SpellingPatternDef | null {
  const v = rime[0];
  if (!SHORT_GPCS[v]) return null;
  return {
    id: `-${rime}`, kind: 'short-vowel', shown: `-${rime}`, gpcs: SHORT_GPCS[v], family: rime, title: `The -${rime} Family`,
    ruleTemplate: 'All of these words end with the same letters, ___, so they all ___.',
    correctRule: `They all end in -${rime}, so they rhyme. Only the first sound changes.`,
  };
}

export function patternDef(id: string): SpellingPatternDef | null {
  if (SHORT_GPCS[id]) return shortVowelPattern(id);
  if (id.startsWith('-')) return familyPattern(id.slice(1));
  if (id.endsWith('_e') && LONG_OF[id]) {
    const v = id[0];
    return {
      id, kind: 'long-vowel', shown: id, gpcs: gpcsOf(SPLIT_DIGRAPHS, id), title: `${LONG_OF[id][0].toUpperCase()}${LONG_OF[id].slice(1)} with Silent E`,
      ruleTemplate: 'When a word ends in ___, the vowel before it says its ___.',
      correctRule: `When a word ends in a silent e, the ${v} before it says its name, the ${LONG_OF[id]} sound.`,
    };
  }
  if (LONG_OF[id]) {
    return {
      id, kind: 'long-vowel', shown: id, gpcs: gpcsOf(VOWEL_TEAMS, id), title: `${LONG_OF[id][0].toUpperCase()}${LONG_OF[id].slice(1)} Spelled ${id}`,
      ruleTemplate: 'In these words, the letters ___ spell the ___ sound.',
      correctRule: `The letters ${id.split('').join(' and ')} together spell the ${LONG_OF[id]} sound.`,
    };
  }
  if (R_SOUND[id]) {
    return {
      id, kind: 'r-controlled', shown: id, gpcs: gpcsOf(R_CONTROLLED, id), title: `Bossy R: ${id}`,
      ruleTemplate: 'When r comes right after the vowel ___, the two letters make the ___ sound.',
      correctRule: `When r comes right after ${id[0]}, the ${id} together make the ${R_SOUND[id]}.`,
    };
  }
  // kn and wr together: the library holds about 8 kn and 7 wr words, too few for one pattern's ten.
  if (id === 'kn/wr') {
    return {
      id, kind: 'silent-letter', shown: 'kn/wr', gpcs: [SILENT.kn.gpc, SILENT.wr.gpc], title: 'Silent Letters: kn and wr',
      ruleTemplate: 'In kn and wr, the ___ letter is silent, so you only hear the ___ letter.',
      correctRule: 'In kn the k is silent and in wr the w is silent: you write them, but you only hear /n/ and /r/.',
    };
  }
  if (SILENT[id]) {
    const s = SILENT[id];
    return {
      id, kind: 'silent-letter', shown: id, gpcs: [s.gpc], title: `Silent ${s.silent.toUpperCase()} in ${id}`,
      ruleTemplate: `In these words, the ___ in ${id} is silent, so you only hear ___.`,
      correctRule: `The ${s.silent} in ${id} is silent: you write it, but you only hear ${s.heard}.`,
    };
  }
  return null;
}

/** The patterns each kind may draw when the objective names none. */
export const PATTERNS_BY_KIND: Readonly<Record<SpellingPatternKind, readonly string[]>> = {
  'short-vowel': ['a', 'e', 'i', 'o', 'u'],
  'long-vowel': ['a_e', 'i_e', 'o_e', 'ai', 'ay', 'ee', 'ea', 'oa', 'igh'],
  'r-controlled': ['ar', 'or', 'ir', 'ur', 'er'],
  'silent-letter': ['kn/wr'],
};

/** Pairs a word may use besides its pattern: basic letter sounds, doubles and ck, digraphs, tch and dge. */
const OTHER_PAIRS: readonly string[] = [...Array.from(basicScope().known), ...DIGRAPHS, 'ng/NG', 'n/NG', 'tch/CH', 'dge/JH'];
/** A silent-letter lesson (G2) tests the silent letter; the vowel may be any common long or r pattern (knee, write). */
const ANY_VOWEL_PATTERN: readonly string[] = [...SPLIT_DIGRAPHS, ...VOWEL_TEAMS, ...R_CONTROLLED];

function scopeFor(p: SpellingPatternDef): LetterScope {
  const base = basicScope();
  // A short-vowel pattern keeps every short vowel known (one syllable means the word has just one); the
  // focus pairs make the pattern's own vowel required.
  return {
    ...base, shapes: null, singleLetters: false, family: null,
    known: new Set([...OTHER_PAIRS, ...p.gpcs, ...(p.kind === 'silent-letter' ? ANY_VOWEL_PATTERN : [])]), focus: new Set(p.gpcs), focusRule: 'every',
    label: `pattern ${p.shown}`,
  };
}

export interface SpellingWordPayload { word: string }

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const VOWEL_BETA: Readonly<Record<string, number>> = { a: 0, o: 0.15, u: 0.2, i: 0.3, e: 0.45 };

/** Consonant runs at the word's two ends, in sounds (stop = 2 onset, nest = 2 coda). */
const clusters = (x: LexWord): number => {
  const first = x.phones.findIndex(isVowel);
  let last = -1;
  x.phones.forEach((ph, i) => { if (isVowel(ph)) last = i; });
  if (first < 0) return 0;
  return (first >= 2 ? 1 : 0) + (x.phones.length - 1 - last >= 2 ? 1 : 0);
};

function wordBeta(p: SpellingPatternDef, x: LexWord): { beta: number; structure: string } {
  const own = new Set(p.gpcs);
  const others = (x.gpcs ?? []).filter((g) => !own.has(g));
  const extraLetters = others.filter((g) => g.split('/')[0].length > 1).length;
  const kChoice = others.some((g) => g === 'c/K' || g === 'k/K');
  // The r of ar/or (one pair, two phonemes) belongs to the vowel: it is neither a sound to count nor a cluster.
  const phones = p.kind === 'r-controlled' ? x.phones.filter((ph, i) => !(ph === 'R' && i > 0 && isVowel(x.phones[i - 1]))) : x.phones;
  const cl = clusters({ ...x, phones });
  const size = phones.length;
  const beta = 0.3 + Math.max(-0.4, (size - 3) * 0.45) + cl * 0.35 + extraLetters * 0.35 + (kChoice ? 0.15 : 0)
    + (p.kind === 'short-vowel' ? VOWEL_BETA[p.shown.replace('-', '')[0]] ?? 0 : 0) + famBeta(x);
  const structure = `${p.shown}:${size}s${cl ? `+${cl}cl` : ''}${extraLetters ? `+${extraLetters}xl` : ''}`;
  return { beta: +beta.toFixed(2), structure };
}

/** Does the word end in the family's rime, its vowel the pattern's short vowel (cat, that, back; not "what")? */
function inFamily(p: SpellingPatternDef, x: LexWord): boolean {
  let letters = '';
  let at = x.gpcs!.length;
  while (at > 0 && letters.length < p.family!.length) letters = x.gpcs![--at].split('/')[0] + letters;
  return letters === p.family && p.gpcs.includes(x.gpcs![at]);
}

const cache = new Map<string, WordSpaceItem<SpellingWordPayload>[]>();

/**
 * Every word of the pattern at a grade. `words` carries the rime (except in a family, where every word
 * shares it), so two dictation words never differ by their first letter alone (cat, then hat).
 */
export function spellingPatternSpace(p: SpellingPatternDef, grade: string): WordSpaceItem<SpellingWordPayload>[] {
  const k = `${p.id}|${grade}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const items = decodableWords(scopeFor(p), { grade })
    // The letters on the card must be the pattern's letters: a word that spells the pattern twice (ee in
    // "eerie") or carries a second vowel letter (a silent u in "guess") reads as another pattern.
    .filter((x) => x.gpcs!.filter((g) => p.gpcs.includes(g)).length === 1)
    // Grade 1 spells one-syllable words of up to five sounds (frog, stamp); strength and splash wait for grade 2.
    .filter((x) => grade === '2' || x.phones.length <= 5)
    // A family is onset + the rime's letters and sounds (cat, that, flat; not "what").
    .filter((x) => !p.family || inFamily(p, x))
    // A long vowel before r is said another way (ear, deer, fair): not the pattern's sound.
    .filter((x) => p.kind !== 'long-vowel' || x.phones[x.phones.findIndex(isVowel) + 1] !== 'R')
    .map((x) => {
      const { beta, structure } = wordBeta(p, x);
      const vowelAt = x.phones.findIndex(isVowel);
      const rime = x.phones.slice(vowelAt).join(' ');
      // With two spellings (kn and wr) the key names the item's own, so a draw can take half from each.
      const key = p.gpcs.length > 1 && p.kind === 'silent-letter' ? x.gpcs!.find((g) => p.gpcs.includes(g)) : undefined;
      return { beta, structure, ...(key ? { key } : {}), words: p.family ? [x.w] : [x.w, `rime:${rime}`], payload: { word: x.w } };
    });
  cache.set(k, items);
  return items;
}

/** Pattern words (6) plus dictation words (4) need ten distinct words, and two more for tiers to differ. */
export const MIN_PATTERN_WORDS = 12;

export interface SpellingPatternSession {
  def: SpellingPatternDef;
  dictation: WordSpaceItem<SpellingWordPayload>[];
  examples: WordSpaceItem<SpellingWordPayload>[];
}

/**
 * Which patterns a session of this kind may draw. `named` are the spellings the objective names (ai, a_e, kn);
 * `family` and `vowels` come from the letter scope. A named spelling the library cannot serve (mb, gn) leaves
 * nothing, so the lesson keeps the model path rather than teach a pattern it did not ask for.
 */
export function candidatePatterns(kind: SpellingPatternKind, named: readonly string[], family: string | null, vowels: readonly string[] | null): string[] {
  if (kind === 'short-vowel') {
    if (family) return [`-${family}`];
    return vowels?.length ? [...vowels] : [...PATTERNS_BY_KIND['short-vowel']];
  }
  if (kind === 'silent-letter') {
    const silent = named.filter((id) => ['kn', 'wr', 'mb', 'gn', 'gh'].includes(id));
    return silent.some((id) => id !== 'kn' && id !== 'wr') ? [] : ['kn/wr'];
  }
  const ofKind = named.filter((id) => patternDef(id)?.kind === kind);
  return ofKind.length ? ofKind : [...PATTERNS_BY_KIND[kind]];
}

/**
 * One session: a pattern drawn from the candidates that can fill it, four dictation words at the tier, then
 * up to six pattern words from the easiest of the rest. No pattern word is a dictation word or shares its
 * rime. Null when no candidate holds enough words.
 */
export function drawSpellingSession(candidates: readonly string[], grade: string, tier: SupportTier, rand: () => number, nDictation = 4): SpellingPatternSession | null {
  const usable = candidates.map(patternDef).filter((d): d is SpellingPatternDef => !!d && spellingPatternSpace(d, grade).length >= MIN_PATTERN_WORDS);
  if (!usable.length) return null;
  // Shuffled, then tried in turn: a pattern that loses its examples to the rime rule hands over to the next.
  for (let i = usable.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [usable[i], usable[j]] = [usable[j], usable[i]]; }
  for (const def of usable) {
    const space = spellingPatternSpace(def, grade);
    const used = new Set<string>();
    const heard = new Set<string>();
    // Two spellings in one pattern (kn and wr): half the dictation from each, each tiered on its own.
    const dictation = def.gpcs.length > 1 && def.kind === 'silent-letter'
      ? def.gpcs.flatMap((g, i) => tierPick(space.filter((it) => it.key === g), tier, i === 0 ? Math.ceil(nDictation / 2) : Math.floor(nDictation / 2), rand, used, heard))
      : tierPick(space, tier, nDictation, rand, used, heard);
    if (dictation.length < nDictation) continue;
    let examples = tierPick(space, 'easy', 6, rand, used, heard);
    if (examples.length < 4) examples = tierPick(space, 'easy', 4, rand, used, heard);
    if (examples.length >= 4) return { def, dictation, examples };
  }
  return null;
}
