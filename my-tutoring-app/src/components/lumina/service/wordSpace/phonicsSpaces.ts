/**
 * Word spaces for phonics-blender (service/wordSpace): every word a blending pattern allows inside a
 * lesson's letter scope, its tiles computed from the library's letter-to-sound alignment.
 *
 * The alignment IS the tile list: cat = c|a|t, ship = sh|i|p, cake = c|a_e|k (drawn c, a, k, e with the
 * silent e as its own tile, the convention the component and the model path share). No model chooses a
 * word or splits one into sounds on this path.
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/phonics-blender/before.txt`, 2 runs per tier):
 * every mode gave the same 4-5 words at every tier (cat dog sun bus pig; cake bike bone cute; ship chop thin
 * fish path; boy coin cow cloud house), and cute came with a rabbit picture.
 *
 * Difficulty features (beta priors, logits; refit from first-try results). Blending research order: sounds
 * you can stretch (m, s, f) blend more easily than stops (b, t, k), especially at the start; more sounds
 * is harder (3 < 4 < 5); a consonant cluster is harder than a single consonant, a final cluster harder than
 * an initial one; e and i are the short vowels children confuse most. Silent e: a_e and i_e are taught
 * first, u_e and e_e last; a soft c or g (face, page) adds a second rule. Digraphs: initial (ship) before
 * final (fish); th has two sounds; wh is rare. r-controlled: ar and or before the three spellings of /er/.
 * Diphthongs: ow/ou can also say /ō/ (snow), so ow and ou are harder than oi/oy. Familiarity adds a little.
 */
import { CONTINUANTS, isVowel, lexWord, onsetOf, soundLabel, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import {
  DIGRAPHS, R_CONTROLLED, SPLIT_DIGRAPHS, basicScope, decodableWords, hitsFocus, type LetterScope,
} from './scope';

export type BlendPattern = 'cvc' | 'cvce' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong';
export interface BlendTile { sound: string; letters: string }
export interface BlendWordPayload { targetWord: string; phonemes: BlendTile[]; emoji?: string; imageDescription?: string }

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const isStop = (p: string) => !isVowel(p) && !CONTINUANTS.has(p);

/** A vowel's sound as the walk says it (phonemeVoice): IPA short vowels, macron long vowels. */
const VOWEL_GLYPH: Readonly<Record<string, string>> = {
  AE: 'æ', EH: 'ɛ', IH: 'ɪ', AA: 'ɑ', AH: 'ʌ', EY: 'ā', IY: 'ē', AY: 'ī', OW: 'ō', UW: 'ū', UH: 'ʊ', AW: 'ow', OY: 'oy', ER: 'er',
};
const tileSound = (grapheme: string, phones: string[]): string => {
  const key = phones.join(' ');
  if (key === 'K S') return '/ks/';
  if (key === 'K W') return '/kw/';
  if (key === 'Y UW') return '/yoo/';
  if (key === 'AA R') return '/ar/';
  if (key === 'AO R') return '/or/';
  if (phones.length === 1 && phones[0] === 'AO') return grapheme === 'o' ? '/ɑ/' : '/aw/';
  return `/${phones.map((p) => VOWEL_GLYPH[p] ?? soundLabel(p)).join('')}/`;
};

/**
 * The word's sounds, one slash-notation string per phoneme, in the glyphs the tutor's voice can say
 * (phonemeVoice): consonants as ASCII ("/k/", "/sh/"), vowels as IPA or macrons ("/æ/", "/ā/").
 */
export function phonemeSlashes(x: LexWord): string[] {
  const out: string[] = [];
  for (const pair of x.gpcs ?? x.phones.map((p) => `?/${p}`)) {
    const [g, p] = pair.split('/');
    for (const ph of p.split(' ')) {
      out.push(ph === 'AO' ? (g === 'o' ? '/ɑ/' : '/ɔ/') : ph === 'ER' ? '/ɝ/' : `/${VOWEL_GLYPH[ph] ?? soundLabel(ph)}/`);
    }
  }
  return out;
}

/** The word's tiles from its alignment; a split digraph puts its silent e last (c, a, k, e). */
export function blendTiles(x: LexWord): BlendTile[] {
  const tiles: BlendTile[] = [];
  let split = false;
  for (const pair of x.gpcs ?? []) {
    const [g, p] = pair.split('/');
    const letters = g.endsWith('_e') ? g[0] : g;
    if (g.endsWith('_e')) split = true;
    tiles.push({ letters, sound: tileSound(letters, p.split(' ')) });
  }
  if (split) tiles.push({ letters: 'e', sound: '//' });
  return tiles;
}

/** Onset and coda consonant clusters by sound (frog: f r; nest: s t). */
const clusters = (x: LexWord) => {
  const v = x.phones.findIndex(isVowel);
  const coda = x.phones.slice(x.phones.length - [...x.phones].reverse().findIndex(isVowel));
  return { onset: onsetOf(x).length, coda: coda.length, vowelAt: v };
};
const vowelPhone = (x: LexWord) => x.phones.find(isVowel) ?? '';
const SHORT_VOWEL_BETA: Readonly<Record<string, number>> = { EH: 0.3, IH: 0.2, AH: 0.1 };
const gpcWith = (x: LexWord, set: readonly string[]) => x.gpcs?.find((g) => set.includes(g));

const DIGRAPH_FOCUS = [...DIGRAPHS, 'ph/F'];
const DIPHTHONGS = ['oi/OY', 'oy/OY', 'ou/AW', 'ow/AW'];
const SHORT = ['a/AE', 'e/EH', 'i/IH', 'o/AA', 'o/AO', 'u/AH'];

/**
 * The scope a pattern reads words from. The objective's scope narrows the CVC space (a letter group, one
 * short vowel, a word family); the other patterns take their own pairs on top of the basic sounds, since a
 * lesson on digraphs names the digraphs, not the letters.
 */
export function blendScope(pattern: BlendPattern, parsed: LetterScope | null): LetterScope {
  const basic = basicScope(['CVC']);
  const base: LetterScope = { ...basic, shapes: null, singleLetters: false, label: pattern };
  switch (pattern) {
    case 'cvc': {
      const usable = parsed && !parsed.onsetClusters && !parsed.codaClusters && !(parsed.focus && Array.from(parsed.focus).some((g) => !SHORT.includes(g) && !/^[a-z]\//.test(g) && g !== 'ck/K'));
      const s = usable ? parsed! : basic;
      return { ...s, shapes: ['CVC'], singleLetters: true, focusRule: s.focusRule, label: `cvc${usable ? ` (${parsed!.label})` : ''}` };
    }
    case 'cvce':
      return { ...base, known: new Set([...Array.from(basic.known), ...SPLIT_DIGRAPHS]), focus: new Set(SPLIT_DIGRAPHS), focusRule: 'every', shapes: ['CVCe', 'CCVCe'] };
    case 'blend': {
      const named = parsed?.onsetClusters || parsed?.codaClusters ? parsed : null;
      return { ...base, onsetClusters: named?.onsetClusters ?? null, codaClusters: named?.codaClusters ?? null, shapes: ['CCVC', 'CVCC', 'CCVCC', 'CCCVC', 'VCC'], label: `blend${named ? ` (${named.label})` : ''}` };
    }
    case 'digraph':
      // Short vowels only: a silent-e tile has no sound, so the tutor could not model the walk (chase, white).
      return { ...base, known: new Set([...Array.from(basic.known), ...DIGRAPH_FOCUS, 'ng/NG', 'tch/CH']), focus: new Set(DIGRAPH_FOCUS), focusRule: 'every' };
    case 'r-controlled':
      return { ...base, known: new Set([...Array.from(basic.known), ...DIGRAPHS, ...R_CONTROLLED, 'ng/NG']), focus: new Set(R_CONTROLLED), focusRule: 'every' };
    case 'diphthong':
      return { ...base, known: new Set([...Array.from(basic.known), ...DIGRAPHS, ...DIPHTHONGS, 'ng/NG']), focus: new Set(DIPHTHONGS), focusRule: 'every' };
  }
}

function itemFor(pattern: BlendPattern, x: LexWord): WordSpaceItem<BlendWordPayload> | null {
  if ((x.gpcs?.length ?? 0) < 2) return null; // "or", "a": nothing to blend
  const { onset, coda } = clusters(x);
  const v = vowelPhone(x);
  const stops = x.phones.filter(isStop).length;
  const startsStop = isStop(x.phones[0]);
  const extra = Math.max(0, x.phones.length - 3);
  let beta = famBeta(x);
  let structure = '';
  let key = '';
  switch (pattern) {
    case 'cvc': {
      if (x.phones.length !== 3 && !(x.phones.length === 4 && x.w.endsWith('x'))) return null;
      beta += 0.25 * stops + (startsStop ? 0.2 : 0) + (SHORT_VOWEL_BETA[v] ?? 0) + (x.w.endsWith('x') ? 0.3 : 0);
      key = x.gpcs![1].split('/')[0];
      structure = `${key}:${startsStop ? 'stop' : 'stretch'}`;
      break;
    }
    case 'cvce': {
      const pair = x.gpcs!.find((g) => g.includes('_e'))!;
      const soft = x.gpcs!.some((g) => g === 'c/S' || g === 'g/JH');
      beta += 0.5 + ({ 'a_e/EY': 0, 'i_e/AY': 0.1, 'o_e/OW': 0.2, 'u_e/UW': 0.4, 'u_e/Y UW': 0.4, 'e_e/IY': 0.5 }[pair] ?? 0.3)
        + 0.15 * stops + (onset > 1 ? 0.5 : 0) + (soft ? 0.4 : 0);
      key = pair.split('/')[0];
      structure = `${key}:${onset > 1 ? 'cluster' : soft ? 'soft' : 'single'}`;
      break;
    }
    case 'blend': {
      if (onset < 2 && coda < 2) return null;
      if (!SHORT.some((g) => x.gpcs!.includes(g))) return null;
      const where = onset > 1 && coda > 1 ? 'both' : onset > 1 ? 'start' : 'end';
      const sBlend = onset > 1 && x.phones[0] === 'S';
      beta += 0.6 + 0.6 * Math.max(0, x.phones.length - 4) + { start: 0, end: 0.3, both: 0.6 }[where]
        + (onset > 2 || coda > 2 ? 0.4 : 0) + (sBlend ? -0.2 : 0) + (SHORT_VOWEL_BETA[v] ?? 0);
      key = onset > 1 ? x.w.slice(0, 2) : x.w.slice(-2);
      structure = `${where}:${x.phones.length}`;
      break;
    }
    case 'digraph': {
      const dg = x.gpcs!.filter((g) => DIGRAPH_FOCUS.includes(g));
      const first = DIGRAPH_FOCUS.includes(x.gpcs![0]);
      const last = DIGRAPH_FOCUS.includes(x.gpcs![x.gpcs!.length - 1]);
      const where = first && last ? 'both' : first ? 'start' : last ? 'end' : 'middle';
      beta += 0.8 + { start: 0, end: 0.3, both: 0.5, middle: 0.3 }[where] + (dg.some((g) => g.startsWith('th')) ? 0.3 : 0)
        + (dg.some((g) => g.startsWith('wh') || g.startsWith('ph')) ? 0.2 : 0) + 0.3 * Math.max(0, x.phones.length - 3)
        + (onset > 1 || coda > 1 ? 0.4 : 0) + (SHORT_VOWEL_BETA[v] ?? 0);
      key = dg[0].split('/')[0];
      structure = `${where}:${onset > 1 || coda > 1 ? 'cluster' : 'single'}`;
      break;
    }
    case 'r-controlled': {
      const pair = gpcWith(x, R_CONTROLLED)!;
      beta += 1.2 + ({ 'ar/AA R': 0, 'or/AO R': 0.1 }[pair] ?? 0.4) + (onset > 1 || coda > 1 ? 0.4 : 0) + 0.3 * extra
        + (x.gpcs!.some((g) => DIGRAPHS.includes(g)) ? 0.2 : 0);
      key = pair.split('/')[0];
      structure = `${key === 'ar' || key === 'or' ? key : 'er-sound'}:${onset > 1 || coda > 1 ? 'cluster' : 'single'}`;
      break;
    }
    case 'diphthong': {
      const pair = gpcWith(x, DIPHTHONGS)!;
      const atEnd = x.gpcs![x.gpcs!.length - 1] === pair;
      beta += 1.2 + (atEnd ? 0 : 0.3) + (pair.startsWith('ow') || pair.startsWith('ou') ? 0.3 : 0) + (onset > 1 || coda > 1 ? 0.4 : 0) + 0.2 * extra;
      key = pair.split('/')[0];
      structure = `${key}:${atEnd ? 'end' : 'inside'}`;
      break;
    }
  }
  return {
    beta: +beta.toFixed(2),
    structure,
    key,
    words: [x.w],
    payload: { targetWord: x.w, phonemes: blendTiles(x), ...(x.emoji ? { emoji: x.emoji } : {}), imageDescription: x.w },
  };
}

const CACHE = new Map<string, WordSpaceItem<BlendWordPayload>[]>();

/**
 * Every word one pattern allows at a grade inside a scope. The emoji is the reward shown after the word is
 * credited, never before, so a word with no reviewed picture is still a reading item (it gets no reward picture).
 */
export function blendSpace(pattern: BlendPattern, grade: string, parsed: LetterScope | null): readonly WordSpaceItem<BlendWordPayload>[] {
  const scope = blendScope(pattern, parsed);
  const cacheKey = `${pattern}|${grade}|${scope.label}|${Array.from(scope.known).sort().join(',')}|${scope.family ?? ''}`;
  if (!CACHE.has(cacheKey)) {
    const items = decodableWords(scope, { grade }).map((x) => itemFor(pattern, x)).filter((it): it is WordSpaceItem<BlendWordPayload> => !!it);
    CACHE.set(cacheKey, items);
  }
  return CACHE.get(cacheKey)!;
}

/** A letter-group lesson's focus test: the word uses one of the new letter-sounds. */
export const blendFocus = (scope: LetterScope) => (it: WordSpaceItem<BlendWordPayload>): boolean => {
  const x = lexWord(it.words[0]);
  return !!x && hitsFocus(scope, x);
};
