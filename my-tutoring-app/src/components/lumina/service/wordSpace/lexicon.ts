/**
 * The word library (service/wordSpace): every word a K-2 literacy item may use, with its sounds.
 *
 * WHY THIS EXISTS (2026-10-13 lab, `qa/word-space-lab/2026-10-13/FINDINGS.md`). A literacy generator that
 * asks Gemini for "an easy beginning-sound word" gets the same few words at every tier, and a scope like
 * "s a t i p n" cannot be held by prompt: the model reaches for words that use those LETTERS but other
 * SOUNDS (is = s/z/, pain = ai). Here every word carries its phonemes (CMU Pronouncing Dictionary) and how
 * its letters map to them, so code can say exactly which words a scope allows and how hard an item is.
 *
 * Built by `scripts/word-space-lab/build-lexicon.mjs`; never edit lexicon.json by hand. Which words are in it
 * (known by grade, kid-safe, teachable, picture fits, category) are build-time ratings a person reviewed in
 * part (`scripts/word-space-lab/review-overrides.json`); nothing is rated at lesson time. Sources and
 * their notices: NOTICE in this folder.
 */
import 'server-only';
import data from './lexicon.json';

export type KnownBy = 'K' | 'G1' | 'G2';

export interface LexWord {
  w: string;
  /** CMU phonemes, stress removed ("K AE T"). */
  phones: string[];
  /** Grapheme/phoneme pairs in spelling order ("c/K", "a_e/EY"); null when the spelling is irregular. */
  gpcs: string[] | null;
  /** Sound shape: one C or V per pair ("CVC", "CCVC", "CVCe"). */
  shape: string | null;
  syllables: number;
  /** An emoji that shows the word to a five-year-old; null when none does. */
  emoji: string | null;
  knownBy: KnownBy;
  category: string;
  /** A person checked this word's ratings. */
  reviewed: boolean;
}

type RawWord = { w: string; p: string; g: string | null; s: string | null; y: number; e: string | null; k: KnownBy; c: string; v?: 1 };

/** "f/F o/AA x/K S" -> ["f/F", "o/AA", "x/K S"]: a pair that spells two sounds (x, qu, u = /y uː/, le)
 *  is stored space-joined, so a token with no "/" continues the pair before it. */
const splitGpcs = (g: string): string[] =>
  g.split(' ').reduce<string[]>((out, t) => (t.includes('/') || !out.length ? [...out, t] : [...out.slice(0, -1), `${out[out.length - 1]} ${t}`]), []);

export const WORDS: readonly LexWord[] = (data as unknown as { words: RawWord[] }).words.map((x) => ({
  w: x.w, phones: x.p.split(' '), gpcs: x.g ? splitGpcs(x.g) : null, shape: x.s, syllables: x.y, emoji: x.e,
  knownBy: x.k, category: x.c, reviewed: x.v === 1,
}));
const BY_WORD = new Map(WORDS.map((x) => [x.w, x]));
export const lexWord = (w: string): LexWord | undefined => BY_WORD.get(w.trim().toLowerCase());

/** Words a lesson at this grade may use: K uses K words; grade 1 adds G1; grade 2 adds G2. */
export const knownByForGrade = (grade: string): ReadonlySet<KnownBy> =>
  new Set<KnownBy>(grade === 'K' ? ['K'] : grade === '1' ? ['K', 'G1'] : ['K', 'G1', 'G2']);

export const VOWEL_PHONES: ReadonlySet<string> = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
/** The short vowels as K-1 teaches them (o covers both /ɑ/ in hot and /ɔ/ in dog). */
export const SHORT_VOWEL_OF: Readonly<Record<string, string>> = { AE: 'a', EH: 'e', IH: 'i', AA: 'o', AO: 'o', AH: 'u' };
/** Sounds a child can stretch (/mmm/, /sss/): easier to isolate and blend than stops (/b/, /t/). */
export const CONTINUANTS: ReadonlySet<string> = new Set(['M', 'N', 'S', 'F', 'L', 'R', 'V', 'Z', 'SH', 'TH', 'DH', 'W', 'Y', 'HH', 'NG']);
/** Sounds that differ in one feature (voicing, or nasal place): the near confusions. */
export const NEAR_SOUND: Readonly<Record<string, string>> = {
  P: 'B', B: 'P', T: 'D', D: 'T', K: 'G', G: 'K', M: 'N', N: 'M', F: 'V', V: 'F', S: 'Z', Z: 'S', CH: 'JH', JH: 'CH', SH: 'CH',
};
/** Short vowels children confuse (e/i, o/u, a/e). */
export const NEAR_VOWEL: Readonly<Record<string, readonly string[]>> = {
  EH: ['IH', 'AE'], IH: ['EH'], AE: ['EH'], AA: ['AH'], AO: ['AH'], AH: ['AA', 'AO'],
};

export const isVowel = (p: string): boolean => VOWEL_PHONES.has(p);

/**
 * Sound shape by spelling unit: V for a vowel grapheme (a, ee, a_e, igh), C otherwise, "e" appended for a
 * split digraph. Recomputed here because the stored `shape` reads u_e = /y uː/ (cute) as a consonant.
 */
export const shapeOf = (x: LexWord): string | null => {
  if (!x.gpcs) return null;
  const units = x.gpcs.map((pair) => {
    const [g, p] = pair.split('/');
    const vowelSound = p.split(' ').some((ph) => VOWEL_PHONES.has(ph));
    return vowelSound && (/^[aeiou]/.test(g) || g.endsWith('_e') || g === 'y' || g === 'igh') ? 'V' : 'C';
  });
  return units.join('') + (x.gpcs.some((pair) => pair.split('/')[0].endsWith('_e')) ? 'e' : '');
};
export const onsetOf = (x: LexWord): string[] => { const i = x.phones.findIndex(isVowel); return i < 0 ? x.phones : x.phones.slice(0, i); };
export const rimeOf = (x: LexWord): string => { const i = x.phones.findIndex(isVowel); return i < 0 ? '' : x.phones.slice(i).join(' '); };

/**
 * A phoneme as the phoneme-explorer script and phonemeVoice say it: consonants as ASCII sound labels
 * ("k", "sh"), short vowels as the vowel letter (the script stretches it to "aaa"), other vowels as IPA
 * (phonemeVoice maps "eɪ" to "ay"). Never "c", "q" or "x", which name no single sound.
 */
const SOUND_LABEL: Readonly<Record<string, string>> = {
  B: 'b', CH: 'ch', D: 'd', DH: 'th', F: 'f', G: 'g', HH: 'h', JH: 'j', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ng', P: 'p',
  R: 'r', S: 's', SH: 'sh', T: 't', TH: 'th', V: 'v', W: 'w', Y: 'y', Z: 'z', ZH: 'zh',
  AE: 'a', EH: 'e', IH: 'i', AA: 'o', AO: 'o', AH: 'u',
  EY: 'eɪ', IY: 'iː', AY: 'aɪ', OW: 'oʊ', UW: 'uː', UH: 'ʊ', AW: 'aʊ', OY: 'ɔɪ', ER: 'ɝ',
};
export const soundLabel = (phone: string): string => SOUND_LABEL[phone] ?? phone.toLowerCase();

/** How a sound is said on its own in an isolate ask: stretched continuants, a light vowel after stops. */
const SOUND_SAID: Readonly<Record<string, string>> = {
  M: 'mmm', N: 'nnn', S: 'sss', F: 'fff', L: 'lll', R: 'rrr', V: 'vvv', Z: 'zzz', SH: 'shh', TH: 'thh', DH: 'thh', HH: 'hhh',
  W: 'wuh', Y: 'yuh', B: 'buh', D: 'duh', G: 'guh', K: 'kuh', P: 'puh', T: 'tuh', CH: 'chuh', JH: 'juh',
};
export const soundSaid = (phone: string): string | null => SOUND_SAID[phone] ?? null;
