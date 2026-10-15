/**
 * Word spaces for sound-swap (service/wordSpace): every add, delete or change-one-sound pair two familiar
 * words allow, computed from their phonemes. The pair, the sound and its position come from code; the
 * generator derives the move fields from the phoneme arrays as it always has.
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/sound-swap/before.txt`, K, 2 runs per tier):
 * addition was at/an/it plus a first sound at every tier; deletion at medium returned no challenges (both
 * runs: the model's end-deletions were not in the 890-word list); hard deletion shipped "stop -> sop";
 * substitution moved position by tier but repeated cat, pig, sun, hop.
 *
 * Difficulty features (logits; refit from first-try results). Phoneme-manipulation research order: the
 * first sound < the last sound < a middle sound; a sound inside a consonant cluster (lip -> slip, stop ->
 * top) is the hardest to add or take away; deleting is harder than adding; a one-feature change (b/p,
 * m/n, e/i) is easy to mishear; stops are harder to hold than sounds you can stretch. Plural and past-tense
 * pairs (hat -> hats) are a morphology task and are left out.
 */
import { CONTINUANTS, NEAR_SOUND, NEAR_VOWEL, WORDS, isVowel, knownByForGrade, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { phonemeSlashes } from './phonicsSpaces';
import { isInflected } from './scope';

export type SwapOperation = 'addition' | 'deletion' | 'substitution';
export interface SwapPayload {
  operation: SwapOperation;
  originalWord: string; originalPhonemes: string[]; originalImage: string;
  resultWord: string; resultPhonemes: string[]; resultImage: string;
}

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const key = (ps: readonly string[]) => ps.join(' ');
/** Heteronyms, interjections, and function words whose library sound is the unstressed one (to = /tə/,
 *  and = /ənd/): said alone, a child hears another vowel, so a pair built on it is wrong (to -> tub). */
const HETERONYM_OR_NAME = new Set(['a', 'and', 'the', 'to', 'of', 'dove', 'bow', 'wind', 'live', 'read', 'lead', 'tear', 'bass', 'close', 'row', 'sow', 'does', 'wound', 'us', 'oh', 'ah', 'um', 'uh', 'eh', 'hm']);

/** One-syllable familiar words a grade may use, 2-5 sounds, no plural or past-tense forms. */
function pool(grade: string): LexWord[] {
  const allowed = knownByForGrade(grade);
  return WORDS.filter((x) => allowed.has(x.knownBy) && x.gpcs && x.syllables === 1 && x.phones.length >= 2 && x.phones.length <= 5
    && !isInflected(x) && !HETERONYM_OR_NAME.has(x.w) && /^[a-z]+$/.test(x.w));
}

const payload = (operation: SwapOperation, a: LexWord, b: LexWord): SwapPayload => ({
  operation,
  originalWord: a.w, originalPhonemes: phonemeSlashes(a), originalImage: a.emoji ?? '',
  resultWord: b.w, resultPhonemes: phonemeSlashes(b), resultImage: b.emoji ?? '',
});

/** Sound count per grade: K works in 2-3 sounds (at -> cat), grade 1 reaches 4 (lip -> slip), grade 2 5. */
const maxSounds = (grade: string) => (grade === 'K' ? 3 : grade === '1' ? 4 : 5);

function additionDeletion(op: 'addition' | 'deletion', grade: string): WordSpaceItem<SwapPayload>[] {
  const words = pool(grade);
  const byPhones = new Map(words.map((x) => [key(x.phones), x]));
  const items: WordSpaceItem<SwapPayload>[] = [];
  for (const longer of words) {
    const P = longer.phones;
    if (P.length < 3 || P.length > maxSounds(grade)) continue;
    for (const pos of ['beginning', 'end'] as const) {
      const shorter = byPhones.get(key(pos === 'beginning' ? P.slice(1) : P.slice(0, -1)));
      if (!shorter || shorter.w === longer.w) continue;
      const x = pos === 'beginning' ? P[0] : P[P.length - 1];
      // The sound lands next to a consonant: it makes or breaks a cluster (lip -> slip, car -> cart).
      const cluster = pos === 'beginning' ? !isVowel(P[1]) : !isVowel(P[P.length - 2]);
      if (grade === 'K' && cluster) continue; // K adds or removes a lone first or last sound (at -> cat)
      // A plural or past-tense ending (car -> cars, play -> played) is morphology, not a sound.
      if (pos === 'end' && ['s', 'es', 'd', 'ed'].some((e) => longer.w === shorter.w + e)) continue;
      const [from, to] = op === 'addition' ? [shorter, longer] : [longer, shorter];
      items.push({
        beta: +((op === 'deletion' ? 0.3 : 0) + (pos === 'end' ? 0.4 : 0) + (cluster ? 0.6 : 0)
          + (CONTINUANTS.has(x) ? 0 : 0.2) + famBeta(to) + 0.5 * famBeta(from)).toFixed(2),
        structure: `${pos}:${cluster ? 'cluster' : 'single'}`,
        key: x,
        words: [from.w, to.w],
        shown: [from.w],
        produces: to.w,
        payload: payload(op, from, to),
      });
    }
  }
  return items;
}

function substitution(grade: string): WordSpaceItem<SwapPayload>[] {
  const words = pool(grade).filter((x) => x.phones.length >= 3 && x.phones.length <= (grade === 'K' ? 3 : 4));
  const items: WordSpaceItem<SwapPayload>[] = [];
  for (const a of words) {
    for (const b of words) {
      if (a === b || a.phones.length !== b.phones.length) continue;
      const diff = a.phones.map((p, i) => (p !== b.phones[i] ? i : -1)).filter((i) => i >= 0);
      if (diff.length !== 1) continue;
      const i = diff[0];
      const old = a.phones[i]; const neu = b.phones[i];
      if (isVowel(old) !== isVowel(neu)) continue;
      const where = i === 0 ? 'beginning' : i === a.phones.length - 1 ? 'end' : 'middle';
      // The middle of a 4-sound word may be a cluster consonant (stop -> slop): hardest.
      const inCluster = where === 'middle' && !isVowel(old);
      const near = NEAR_SOUND[old] === neu || (NEAR_VOWEL[old] ?? []).includes(neu);
      items.push({
        beta: +({ beginning: 0.2, end: 0.6, middle: 1.0 }[where] + (inCluster ? 0.4 : 0) + (near ? 0.4 : 0)
          + (CONTINUANTS.has(neu) || isVowel(neu) ? 0 : 0.15) + famBeta(b) + 0.5 * famBeta(a)).toFixed(2),
        structure: `${where}:${near ? 'near' : 'far'}`,
        key: `${where}:${neu}`,
        words: [a.w, b.w],
        shown: [a.w],
        produces: b.w,
        payload: payload('substitution', a, b),
      });
    }
  }
  return items;
}

const CACHE = new Map<string, WordSpaceItem<SwapPayload>[]>();

/** Every item one operation allows at a grade ('K', '1', '2'). Built once per process. */
export function soundSwapSpace(op: SwapOperation, grade: string): readonly WordSpaceItem<SwapPayload>[] {
  const k = `${op}|${grade}`;
  if (!CACHE.has(k)) CACHE.set(k, op === 'substitution' ? substitution(grade) : additionDeletion(op, grade));
  return CACHE.get(k)!;
}
