/**
 * Word spaces for di-word-reading (service/wordSpace): every printed word a mode may ask a K-1 reader to read
 * aloud, its difficulty computed from the word's structure.
 *
 * Measured before (2026-10-14, `qa/word-space-lab/2026-10-13/di-word-reading/before.txt`, 2 runs per tier): the
 * generator chose from a 38-word hand menu and the tier only moved where the levers start. Every mode gave the
 * same words at every tier (short a: cat map mat pan; review: and the red pig in all six runs). "s a t i p n"
 * served mat, cat and hat (m, c, h untaught). "CVC words and sight words" served four sight words and no CVC
 * word. "and" was labelled an irregular word the child must not sound out.
 *
 * Decodable words (cvc_reading, and the CVC part of read_word and word_reading_review) are phonics-blender's CVC
 * space (`blendSpace('cvc')`): the objective's letter scope, single-letter spellings, one short vowel. Reading
 * print adds two features to the blending ones: a word that reads as another word backwards (pot/top, tip/pit)
 * invites the read_backwards miss, and b or d invites a letter reversal (Treiman 2014 on b/d mirror confusions).
 *
 * Sight words come from the Dolch lists (1936, public domain): pre-primer, primer, first grade. A Dolch word is a
 * sight item at a grade only when it does NOT decode with the pairs that grade teaches: at K "see" and "make" are
 * sight words, at grade 1 they are ee and silent-e words and leave the space. "and", "big", "can" never enter
 * (they decode, so recalling them whole would teach the wrong thing). Features: list level (the order the lists
 * are taught), how many pairs break the code (one odd vowel in "was" vs a whole irregular word like "said"), a
 * known look-alike or reversal (was/saw, the/they; `SIGHT_LOOKALIKES`), a second syllable (funny, yellow), b or d,
 * and the word's known-by grade.
 * Length alone is not a feature. Key: the first two letters, so the/they/then do not share a session.
 */
import { WORDS, lexWord, knownByForGrade, type KnownBy, type LexWord } from './lexicon';
import { tierPick, tierPickFocus, type WordSpaceItem } from './pick';
import type { SupportTier } from '../generation/generationContext';
import { blendSpace } from './phonicsSpaces';
import { DIGRAPHS, R_CONTROLLED, SPLIT_DIGRAPHS, VOWEL_TEAMS, basicScope, hitsFocus, isInflected, type LetterScope } from './scope';
import { SIGHT_LOOKALIKES } from '../../primitives/visual-primitives/literacy/spokenReadingMisses';

/** The challenge fields a word supplies; the generator adds id, challengeType and supportTier. */
export interface WordReadingPayload {
  word: string;
  wordType: 'cvc' | 'sight';
  graphemes?: string[];
  emoji?: string;
  asrAliases: string[];
}

const famBeta = (k: KnownBy): number => (k === 'K' ? 0 : k === 'G1' ? 0.3 : 0.6);
const reversalLetters = (w: string) => /[bd]/.test(w);

/** Other library words with the same sounds (sun/son, red/read): passive ASR cross-checks, never the judge. */
let homophoneIndex: Map<string, string[]> | null = null;
const homophones = (x: LexWord): string[] => {
  if (!homophoneIndex) {
    homophoneIndex = new Map();
    for (const y of WORDS) homophoneIndex.set(y.phones.join(' '), [...(homophoneIndex.get(y.phones.join(' ')) ?? []), y.w]);
  }
  return homophoneIndex.get(x.phones.join(' '))?.filter((w) => w !== x.w) ?? [];
};

const CVC_CACHE = new Map<string, WordSpaceItem<WordReadingPayload>[]>();

/** Every decodable CVC word the scope allows at a grade, one letter per sound. */
export function cvcReadingSpace(grade: string, parsed: LetterScope | null): readonly WordSpaceItem<WordReadingPayload>[] {
  const base = blendSpace('cvc', grade, parsed);
  const cacheKey = `${grade}|${base.length}|${base.map((it) => it.words[0]).join(',')}`;
  if (!CVC_CACHE.has(cacheKey)) {
    const items: WordSpaceItem<WordReadingPayload>[] = [];
    for (const it of base) {
      const w = it.words[0];
      const x = lexWord(w);
      // The card's letters are the blend: one letter per pair, spelling the word exactly (no ck, no qu).
      if (!x?.gpcs || x.gpcs.length !== w.length || !x.gpcs.every((g, i) => g.split('/')[0] === w[i])) continue;
      const back = w.split('').reverse().join('');
      const reversible = back !== w && !!lexWord(back);
      const beta = it.beta + (reversible ? 0.3 : 0) + (reversalLetters(w) ? 0.2 : 0);
      items.push({
        beta: +beta.toFixed(2),
        structure: `${it.structure}${reversible ? ':rev' : ''}`,
        key: it.key,
        words: [w],
        payload: { word: w, wordType: 'cvc', graphemes: w.split(''), ...(it.payload.emoji ? { emoji: it.payload.emoji } : {}),
          asrAliases: [w, ...homophones(x)] },
      });
    }
    CVC_CACHE.set(cacheKey, items);
  }
  return CVC_CACHE.get(cacheKey)!;
}

/** The Dolch lists (public domain). Words of one letter (a, I) are left out: the card asks for 2-6 letters. */
export const DOLCH: Readonly<Record<'preprimer' | 'primer' | 'first', readonly string[]>> = {
  preprimer: ['and', 'away', 'big', 'blue', 'can', 'come', 'down', 'find', 'for', 'funny', 'go', 'help', 'here', 'in', 'is', 'it',
    'jump', 'little', 'look', 'make', 'me', 'my', 'not', 'one', 'play', 'red', 'run', 'said', 'see', 'the', 'three', 'to', 'two',
    'up', 'we', 'where', 'yellow', 'you'],
  primer: ['all', 'am', 'are', 'at', 'ate', 'be', 'black', 'brown', 'but', 'came', 'did', 'do', 'eat', 'four', 'get', 'good',
    'have', 'he', 'into', 'like', 'must', 'new', 'no', 'now', 'on', 'our', 'out', 'please', 'pretty', 'ran', 'ride', 'saw', 'say',
    'she', 'so', 'soon', 'that', 'there', 'they', 'this', 'too', 'under', 'want', 'was', 'well', 'went', 'what', 'white', 'who',
    'will', 'with', 'yes'],
  first: ['after', 'again', 'an', 'any', 'as', 'ask', 'by', 'could', 'every', 'fly', 'from', 'give', 'going', 'had', 'has', 'her',
    'him', 'his', 'how', 'just', 'know', 'let', 'live', 'may', 'of', 'old', 'once', 'open', 'over', 'put', 'round', 'some', 'stop',
    'take', 'thank', 'them', 'then', 'think', 'walk', 'were', 'when'],
};
const LEVEL_BETA = { preprimer: 0, primer: 0.3, first: 0.6 } as const;
const LISTS_FOR_GRADE: Readonly<Record<string, ReadonlyArray<keyof typeof DOLCH>>> = { K: ['preprimer', 'primer'], 1: ['preprimer', 'primer', 'first'] };

/**
 * Dolch words the library does not hold, each irregular under any K-1 code (no pair of the spelling says its
 * usual sound in full): known-by K for the pre-primer and primer words, G1 for the first-grade ones. Absent
 * words that do decode (little, please, her) are left out rather than guessed.
 */
const ABSENT_IRREGULAR = new Set(['one', 'said', 'two', 'where', 'you', 'are', 'four', 'there', 'they', 'who', 'any', 'as', 'could',
  'of', 'once', 'some', 'were']);
/** Heteronyms: the card cannot say which word it is (live, read). */
const SKIP = new Set(['live', 'read']);
/**
 * CMU gives "and" its unstressed /ən/; its citation form is /ænd/, three letters with their short sounds. Read
 * from CMU it counted as irregular and the model menu taught it as a word never to sound out.
 */
const CITATION_GPCS: Readonly<Record<string, readonly string[]>> = { and: ['a/AE', 'n/N', 'd/D'] };
/** A word's letter-sound pairs as it is read in isolation (the citation form above where CMU reduces it). */
export const citationGpcs = (x: LexWord): readonly string[] | null => CITATION_GPCS[x.w] ?? x.gpcs;

const DOUBLED = ['nn/N', 'tt/T', 'pp/P', 'dd/D', 'rr/R', 'bb/B', 'gg/G', 'mm/M'];
/** The pairs a grade teaches: K the letter sounds, digraphs, doubles and ng; grade 1 adds silent e, the vowel
 *  teams, r-controlled vowels and the open-syllable long vowels (go, me, my, funny). */
const TAUGHT: Readonly<Record<string, ReadonlySet<string>>> = (() => {
  const k = [...Array.from(basicScope().known), ...DIGRAPHS, ...DOUBLED, 'ng/NG', 'n/NG'];
  return {
    K: new Set(k),
    1: new Set([...k, ...SPLIT_DIGRAPHS, ...VOWEL_TEAMS, ...R_CONTROLLED, 'e/IY', 'o/OW', 'y/AY', 'y/IY']),
  };
})();

/** How many of a word's pairs the grade's code does not cover; null when the word decodes. */
function irregularPairs(w: string, grade: string): number | null {
  const x = lexWord(w);
  if (!x) return ABSENT_IRREGULAR.has(w) ? 2 : null;
  if (isInflected(x)) return null;
  const gpcs = CITATION_GPCS[w] ?? x.gpcs;
  if (!gpcs) return 2; // CMU gives no letter-by-letter alignment (come, do, have): irregular as a whole
  const odd = gpcs.filter((g) => !TAUGHT[grade].has(g)).length;
  return odd > 0 ? odd : null;
}

const lookAlike = (w: string) => !!SIGHT_LOOKALIKES[w]?.length || Object.values(SIGHT_LOOKALIKES).some((l) => l.includes(w))
  || ['was', 'saw', 'on', 'no'].includes(w);

const SIGHT_CACHE = new Map<string, WordSpaceItem<WordReadingPayload>[]>();

/** Every Dolch word of the grade's lists that the grade's code cannot decode. */
export function sightWordSpace(grade: string): readonly WordSpaceItem<WordReadingPayload>[] {
  if (!SIGHT_CACHE.has(grade)) {
    const allowed = knownByForGrade(grade);
    const items: WordSpaceItem<WordReadingPayload>[] = [];
    for (const level of LISTS_FOR_GRADE[grade] ?? []) for (const w of DOLCH[level]) {
      if (SKIP.has(w) || !/^[a-z]{2,6}$/.test(w)) continue;
      const odd = irregularPairs(w, grade);
      if (odd === null) continue;
      const x = lexWord(w);
      const knownBy: KnownBy = x?.knownBy ?? (level === 'first' ? 'G1' : 'K');
      if (!allowed.has(knownBy)) continue;
      const near = lookAlike(w);
      const extraSyllables = Math.max(0, (x?.syllables ?? (/[aeiouy][^aeiouy]+[aeiouy]/.test(w) && !/e$/.test(w) ? 2 : 1)) - 1);
      const beta = LEVEL_BETA[level] + 0.3 * (Math.min(odd, 2) - 1) + (near ? 0.3 : 0) + 0.4 * extraSyllables
        + (reversalLetters(w) ? 0.2 : 0) + famBeta(knownBy);
      items.push({
        beta: +beta.toFixed(2),
        structure: `${level}:${near ? 'near' : 'far'}`,
        key: w.slice(0, 2),
        words: [w],
        payload: { word: w, wordType: 'sight', asrAliases: [w, ...(x ? homophones(x) : [])] },
      });
    }
    SIGHT_CACHE.set(grade, items);
  }
  return SIGHT_CACHE.get(grade)!;
}

/** Grades the spaces serve (the catalog's K-1). */
export const WORD_READING_SPACE_GRADES: readonly string[] = ['K', '1'];

export type WordReadingMode = 'cvc_reading' | 'read_word' | 'sight_word' | 'word_reading_review';

/** Sight words in a mixed draw: one in four, at least one once there are two slots (the old menu's 3 + 1 mix). */
export const sightShare = (n: number): number => (n >= 2 ? Math.max(1, Math.floor(n / 4)) : 0);

/**
 * One mode's picks at a tier, sharing the session's `used` and `heard` sets. cvc_reading stays inside the
 * objective's letter scope (two thirds new letters for a letter-group lesson); sight_word reads the grade's sight
 * space; read_word mixes the scoped CVC words with sight words; word_reading_review is cumulative: one scoped
 * anchor, then CVC words from every short vowel (the key rotation spreads them) and sight words. Returns fewer
 * than `n` when a space runs short; the caller then sends that mode down the model path.
 */
export function drawWordReading(mode: WordReadingMode, n: number, grade: string, parsed: LetterScope | null, tier: SupportTier,
  rand: () => number, used: Set<string>, heard: Set<string>): WordSpaceItem<WordReadingPayload>[] {
  const scoped = cvcReadingSpace(grade, parsed);
  const cvc = (k: number, space = scoped) => (k <= 0 ? [] : space === scoped && parsed?.focusRule === 'most'
    ? tierPickFocus(space, (it) => !!lexWord(it.words[0]) && hitsFocus(parsed, lexWord(it.words[0])!), tier, k, rand, used, heard)
    : tierPick(space, tier, k, rand, used, heard));
  const sight = (k: number) => (k <= 0 ? [] : tierPick(sightWordSpace(grade), tier, k, rand, used, heard));
  if (mode === 'cvc_reading') return cvc(n);
  if (mode === 'sight_word') return sight(n);
  const s = sightShare(n);
  let words: WordSpaceItem<WordReadingPayload>[];
  if (mode === 'read_word') words = cvc(n - s);
  else {
    const anchor = parsed && n - s > 0 ? cvc(1) : [];
    words = [...anchor, ...cvc(n - s - anchor.length, cvcReadingSpace(grade, null))];
  }
  // Each sight word goes in at a random place among the decodable ones.
  for (const it of sight(s)) words.splice(Math.floor(rand() * (words.length + 1)), 0, it);
  return words;
}
