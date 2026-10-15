/**
 * Word spaces for syllable-clapper (service/wordSpace): which words a session uses, how many beats each
 * has (from its phonemes: one vowel sound per syllable), and how compounds split (cow + boy, from the
 * library's own words). The library has no hyphenation for other words, so their syllable SPLIT comes from
 * the model and is checked in code against the count (the generator's `splitWithModel`).
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/syllable-clapper/before.txt`, K, 2 runs per
 * tier): count_parts and blend_syllables lengthened words by tier but drew the same words every run (cat,
 * dog, apple; caterpillar, watermelon, alligator) and split some wrongly (um-bre-lla, cat-er-pil-lar);
 * delete_compound gave cupcake, bedroom, raincoat at every tier.
 *
 * Difficulty features (logits; refit from first-try results). Syllable-awareness order: 1 beat < a
 * two-word compound (its beats are words) < 2 beats < 3 < 4. Deleting the first word of a compound
 * (cowboy without cow) is easier than deleting the last (cowboy without boy). Familiarity adds a little.
 */
import { WORDS, isVowel, knownByForGrade, lexWord, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { isInflected } from './scope';
import {
  hasStableSyllableCount, isCompoundPartWord, isSayableSyllableWord,
} from '../../primitives/visual-primitives/literacy/syllableClapperScript';

export type SyllableSpaceTask = 'count_parts' | 'blend_syllables' | 'delete_compound';
export interface SyllablePayload {
  word: string;
  syllableCount: number;
  /** The split; null when the word is not a compound and the model must supply it. */
  syllables: string[] | null;
  imageDescription: string;
  removePart?: string;
  residue?: string;
}

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const beats = (x: LexWord) => x.phones.filter(isVowel).length;
/** Function words never make a compound part (forget is not for + get, today is not to + day). */
const NOT_A_PART = new Set(['for', 'to', 'be', 'no', 'may', 'its', 'what', 'when', 'on', 'up', 'a', 'an', 'the']);

/** cowboy -> [cow, boy]: two familiar words whose sounds make the word's sounds, both on the part list.
 *  These are WORD parts (water + melon); a beat split uses them only when each part is one beat. */
export function compoundParts(x: LexWord, grade: string): [string, string] | null {
  const allowed = knownByForGrade(grade);
  for (let i = 2; i <= x.w.length - 2; i++) {
    const a = lexWord(x.w.slice(0, i)); const b = lexWord(x.w.slice(i));
    if (!a || !b || !allowed.has(a.knownBy) || !allowed.has(b.knownBy)) continue;
    if (NOT_A_PART.has(a.w) || NOT_A_PART.has(b.w) || isInflected(a) || isInflected(b)) continue;
    if (!isCompoundPartWord(a.w) || !isCompoundPartWord(b.w)) continue;
    if ([...a.phones, ...b.phones].join(' ') === x.phones.join(' ')) return [a.w, b.w];
  }
  return null;
}

/** Familiar words a syllable task may say: one word, a single agreed beat count, no inflected forms. */
function pool(grade: string, maxBeats: number, pictured = true): LexWord[] {
  const allowed = knownByForGrade(grade);
  // Concrete words: a reviewed picture shows them (the prompt asked for picturable words; the library knows).
  return WORDS.filter((x) => allowed.has(x.knownBy) && (!pictured || !!x.emoji) && /^[a-z]+$/.test(x.w) && x.w.length >= 2 && beats(x) >= 1 && beats(x) <= maxBeats
    && !isInflected(x) && hasStableSyllableCount(x.w) && isSayableSyllableWord(x.w) && !glidedR(x));
}

/** A long vowel or glide before /er/ (tired, fire, flower, tower): one beat or two, by speaker. */
const glidedR = (x: LexWord): boolean => x.phones.some((p, i) => ['AY', 'AW', 'OY', 'EY', 'IY', 'UW', 'OW'].includes(p) && x.phones[i + 1] === 'ER');

const description = (x: LexWord) => x.emoji ?? `a picture of ${x.w}`;
const LENGTH_BETA = (n: number, compound: boolean) => (n === 1 ? 0 : n === 2 ? (compound ? 0.4 : 0.7) : n === 3 ? 1.2 : 1.7);

/** A beat split from the library: a compound of one-beat words (cow-boy), else null (the model splits it). */
function beatSplit(x: LexWord, grade: string): string[] | null {
  const parts = beats(x) > 1 ? compoundParts(x, grade) : null;
  return parts && parts.every((p) => beats(lexWord(p)!) === 1) ? parts : null;
}

function countItems(grade: string): WordSpaceItem<SyllablePayload>[] {
  return pool(grade, grade === 'K' ? 3 : 4).map((x) => {
    const n = beats(x); const parts = beatSplit(x, grade);
    return {
      beta: +(LENGTH_BETA(n, !!parts) + famBeta(x)).toFixed(2),
      structure: `${n}:${parts ? 'compound' : n === 1 ? 'one' : 'plain'}`,
      key: String(n), // the answer is the count: a session spreads it
      words: [x.w],
      payload: { word: x.w, syllableCount: n, syllables: n === 1 ? [x.w] : parts, imageDescription: description(x) },
    };
  });
}

function blendItems(grade: string): WordSpaceItem<SyllablePayload>[] {
  return pool(grade, grade === 'K' ? 3 : 4).filter((x) => beats(x) >= 2).map((x) => {
    const n = beats(x); const parts = beatSplit(x, grade);
    return {
      beta: +(LENGTH_BETA(n, !!parts) - 0.4 + famBeta(x)).toFixed(2),
      structure: `${n}:${parts ? 'compound' : 'plain'}`,
      key: String(n),
      words: [x.w],
      produces: x.w,
      payload: { word: x.w, syllableCount: n, syllables: parts, imageDescription: description(x) },
    };
  });
}

function deleteItems(grade: string): WordSpaceItem<SyllablePayload>[] {
  const items: WordSpaceItem<SyllablePayload>[] = [];
  // The word is said, never shown, and the parts are what the child handles: no picture needed here.
  for (const x of pool(grade, 4, false)) {
    const parts = beats(x) >= 2 ? compoundParts(x, grade) : null;
    if (!parts) continue;
    for (const drop of [0, 1] as const) {
      const residue = lexWord(parts[1 - drop])!;
      items.push({
        beta: +(0.3 + (drop === 1 ? 0.4 : 0) + famBeta(x) + 0.5 * famBeta(residue) + 0.2 * (beats(x) - 2)).toFixed(2),
        structure: drop === 0 ? 'drop-first' : 'drop-last',
        key: drop === 0 ? 'first' : 'last',
        words: [x.w],
        produces: residue.w,
        payload: {
          word: x.w, syllableCount: 2, syllables: parts, imageDescription: description(x),
          removePart: parts[drop], residue: residue.w,
        },
      });
    }
  }
  return items;
}

const CACHE = new Map<string, WordSpaceItem<SyllablePayload>[]>();

/** Every item one task allows at a grade ('K', '1', '2'). Built once per process. */
export function syllableSpace(task: SyllableSpaceTask, grade: string): readonly WordSpaceItem<SyllablePayload>[] {
  const k = `${task}|${grade}`;
  if (!CACHE.has(k)) CACHE.set(k, task === 'count_parts' ? countItems(grade) : task === 'blend_syllables' ? blendItems(grade) : deleteItems(grade));
  return CACHE.get(k)!;
}

/**
 * A model-supplied split is kept only when it spells the word, has exactly the word's beat count from its
 * phonemes, and every part is a chantable beat: it holds a vowel letter (or y), and it does not open on a
 * doubled consonant (um-bre-lla splits the ll; um-brel-la does not).
 */
export function splitIsValid(word: string, count: number, parts: readonly string[]): boolean {
  return parts.length === count && parts.join('').toLowerCase() === word.toLowerCase()
    && parts.every((p) => /^[a-z]+$/i.test(p) && /[aeiouy]/i.test(p) && !/^([b-df-hj-np-tv-z])\1/i.test(p));
}
