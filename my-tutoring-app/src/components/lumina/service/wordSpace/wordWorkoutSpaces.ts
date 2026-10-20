/**
 * Word spaces for word-workout (service/wordSpace).
 *
 * real_vs_nonsense, picture_match and word_chains draw their words from the word library (decodable,
 * one-letter-per-sound CVC words a grade knows) and, for real_vs_nonsense, from `nonsense.json`, a build-time
 * list of CVC strings that are no word, name or homophone of one. read_inflected, read_compound and
 * choose_in_context keep their code tables (`wordWorkoutEarlyDecoding.ts`: each entry carries an authored
 * meaning line) and are tiered here by their structure. sentence_reading is prose: the model band.
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/word-workout/before.txt`, 2 runs per tier):
 * real_vs_nonsense was cat/zat, pig, dog, sun, bed at every tier and shipped "zed" (a real word) as nonsense;
 * picture_match was cat, sun, pen at every tier; word_chains was cat-cot-pot-pit at every tier and shipped
 * "pag" inside a chain of real words; the code-table modes gave the same entries at every tier.
 *
 * Difficulty features (logits; refit from first-try results). Decoding research: a nonsense word one
 * letter from a real word (cat/zat) needs the whole word read, more so when that letter is a near sound
 * (dog/tog); a far nonsense word is easier to reject. Picture match: a wrong picture whose word differs by one
 * letter (cat/hat, cat/cot) forces full decoding; the vowel is the hardest letter to read (e/i worst).
 * Chains: changing the first letter is easiest, the last next, the vowel hardest. Inflected endings: -s
 * < -ing < -ed (three sounds, and a syllable in "rested"). Context pairs: a pair differing in the first
 * letter is easiest, the last next, the vowel hardest.
 */
import { CONTINUANTS, NEAR_SOUND, lexWord, type LexWord } from './lexicon';
import { basicScope, decodableWords } from './scope';
import type { WordSpaceItem } from './pick';
import nonsenseData from './nonsense.json';
import { EARLY_CONTEXT_TRIALS, EARLY_EXTENDED_WORDS } from '../../primitives/visual-primitives/literacy/wordWorkoutEarlyDecoding';
import { isSayableWord } from '../../primitives/visual-primitives/literacy/wordWorkoutDomain';

export type WorkoutSpaceMode = 'real-vs-nonsense' | 'picture-match' | 'word-chains' | 'inflected-word' | 'compound-word' | 'context-discrimination';
export type WorkoutPayload = Record<string, unknown>;

const NONSENSE: readonly string[] = (nonsenseData as { words: string[] }).words;
const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const VOWEL_BETA: Readonly<Record<string, number>> = { a: 0, o: 0.1, u: 0.15, i: 0.25, e: 0.35 };
const hash = (s: string): number => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };
const take = <T>(list: readonly T[], key: string): T | undefined => (list.length ? list[hash(key) % list.length] : undefined);
const LETTER_SOUND: Readonly<Record<string, string>> = { b: 'B', c: 'K', d: 'D', f: 'F', g: 'G', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M',
  n: 'N', p: 'P', r: 'R', s: 'S', t: 'T', v: 'V', w: 'W', y: 'Y', z: 'Z' };

/** CVC words a grade knows, decodable with each letter's basic sound (not was, has, son), inside the vowel scope. */
export function cvcWords(grade: string, vowels: readonly string[], pictured: boolean): LexWord[] {
  return decodableWords(basicScope(['CVC']), { grade, needPicture: pictured })
    .filter((x) => /^[bcdfghjklmnprstvwyz][aeiou][bcdfgklmnprstvxz]$/.test(x.w) && x.phones.length === 3 && vowels.includes(x.w[1])
      && isSayableWord(x.w)); // never a verdict word (yes) the tutor's judge reads as an answer
}

function realNonsense(grade: string, vowels: readonly string[]): WordSpaceItem<WorkoutPayload>[] {
  const items: WordSpaceItem<WorkoutPayload>[] = [];
  const fakes = NONSENSE.filter((s) => vowels.includes(s[1]));
  for (const real of cvcWords(grade, vowels, false)) {
    const r = real.w;
    // The judge hears the child: the pair must differ at the first letter (the component's ear gate).
    const onsetOnly = fakes.filter((s) => s[0] !== r[0] && s.slice(1) === r.slice(1));
    const near = onsetOnly.filter((s) => NEAR_SOUND[LETTER_SOUND[r[0]]] === LETTER_SOUND[s[0]]);
    const far = fakes.filter((s) => s[0] !== r[0] && s[1] !== r[1] && s[2] !== r[2]);
    const variants: Array<{ s: string; f: string | undefined; b: number }> = [
      { s: 'far', f: take(far, `${r}:f`), b: 0 },
      { s: 'one-letter', f: take(onsetOnly.filter((x) => !near.includes(x)), `${r}:o`), b: 0.5 },
      { s: 'near-sound', f: take(near, `${r}:n`), b: 0.9 },
    ];
    for (const { s, f, b } of variants) {
      if (!f) continue;
      items.push({
        beta: +(b + (VOWEL_BETA[r[1]] ?? 0) + (CONTINUANTS.has(real.phones[0]) ? 0 : 0.1) + famBeta(real)).toFixed(2),
        structure: s,
        key: r[1],
        words: [r, f],
        payload: { mode: 'real-vs-nonsense', realWord: r, nonsenseWord: f },
      });
    }
  }
  return items;
}

function pictureMatch(grade: string, vowels: readonly string[]): WordSpaceItem<WorkoutPayload>[] {
  const words = cvcWords(grade, vowels, true);
  const items: WordSpaceItem<WorkoutPayload>[] = [];
  const diffAt = (a: string, b: string) => [0, 1, 2].filter((i) => a[i] !== b[i]);
  for (const t of words) {
    const others = words.filter((x) => x.w !== t.w && x.emoji !== t.emoji);
    const oneOff = (pos: number) => others.filter((x) => { const d = diffAt(t.w, x.w); return d.length === 1 && d[0] === pos; });
    const far = others.filter((x) => diffAt(t.w, x.w).length === 3);
    const variants: Array<{ s: string; d: Array<LexWord | undefined>; b: number }> = [
      { s: 'far', d: [take(far, `${t.w}:1`), take(far, `${t.w}:2`)], b: 0 },
      { s: 'first-letter', d: [take(oneOff(0), `${t.w}:a`), take(far, `${t.w}:2`)], b: 0.4 },
      { s: 'last-letter', d: [take(oneOff(2), `${t.w}:c`), take(oneOff(0), `${t.w}:a`) ?? take(far, `${t.w}:3`)], b: 0.6 },
      { s: 'vowel', d: [take(oneOff(1), `${t.w}:v`), take(oneOff(0), `${t.w}:a`) ?? take(oneOff(2), `${t.w}:c`)], b: 0.9 },
    ];
    for (const { s, d, b } of variants) {
      if (d.some((x) => !x)) continue;
      const wrong = d as LexWord[];
      if (new Set([t, ...wrong].map((x) => x.emoji)).size !== 3 || new Set(wrong.map((x) => x.w)).size !== 2) continue;
      items.push({
        beta: +(b + (VOWEL_BETA[t.w[1]] ?? 0) + famBeta(t)).toFixed(2),
        structure: s,
        key: t.w[1],
        words: [t.w],
        shown: [t.w, ...wrong.map((x) => x.w)],
        payload: { mode: 'picture-match', targetWord: t.w, targetImage: t.emoji, distractorImages: wrong.map((x) => ({ word: x.w, image: x.emoji })) },
      });
    }
  }
  return items;
}

/** Chains of four familiar words, each one letter from the last, no word twice. */
function wordChains(grade: string, vowels: readonly string[]): WordSpaceItem<WorkoutPayload>[] {
  const words = cvcWords(grade, vowels, false).map((x) => x.w);
  const set = new Set(words);
  const neighbors = (w: string) => words.filter((x) => x !== w && [0, 1, 2].filter((i) => x[i] !== w[i]).length === 1);
  const items: WordSpaceItem<WorkoutPayload>[] = [];
  const POS_BETA = [0, 0.4, 0.2];
  for (const start of words) {
    for (const salt of ['a', 'b', 'c']) {
      const chain = [start];
      while (chain.length < 4) {
        const last = chain[chain.length - 1];
        const lastPos = chain.length > 1 ? [0, 1, 2].find((i) => chain[chain.length - 2][i] !== last[i]) : -1;
        // Change a different letter each step (cat > hat > hot > hop), not the same slot twice.
        const next = take(neighbors(last).filter((x) => !chain.includes(x) && [0, 1, 2].find((i) => x[i] !== last[i]) !== lastPos), `${chain.join('')}:${salt}`);
        if (!next) break;
        chain.push(next);
      }
      if (chain.length < 4 || !chain.every((w) => set.has(w))) continue;
      const positions = chain.slice(1).map((w, i) => [0, 1, 2].find((j) => w[j] !== chain[i][j])!);
      const key = chain.join('>');
      if (items.some((it) => it.structure.startsWith(key))) continue;
      items.push({
        beta: +(positions.reduce((s, p) => s + POS_BETA[p], 0) + Math.max(...chain.map((w) => VOWEL_BETA[w[1]] ?? 0))
          + Math.max(...chain.map((w) => famBeta(lexWord(w)!)))).toFixed(2),
        structure: positions.map((p) => ['first', 'vowel', 'last'][p]).join('-'),
        key: start,
        words: chain,
        payload: { mode: 'word-chains', chain, changedPositions: positions },
      });
    }
  }
  return items;
}

/** The code-table modes, tiered by structure; the vowel scope still applies. */
function tableItems(mode: 'inflected-word' | 'compound-word' | 'context-discrimination', vowels: readonly string[]): WordSpaceItem<WorkoutPayload>[] {
  if (mode === 'context-discrimination') {
    return EARLY_CONTEXT_TRIALS
      .filter((t) => t.words.every((w) => Array.from(w).filter((c) => 'aeiou'.includes(c)).every((v) => vowels.includes(v))))
      .map((t) => {
        const [a, b] = t.words;
        const pos = [0, 1, 2].find((i) => a[i] !== b[i]) ?? 0;
        return {
          beta: [0, 0.8, 0.4][pos] + (VOWEL_BETA[a[1]] ?? 0),
          structure: ['first', 'vowel', 'last'][pos],
          words: [t.id, ...t.words],
          payload: { mode, contextTrialId: t.id },
        };
      });
  }
  const KIND_BETA: Record<string, number> = { 'ending-s': 0, 'ending-ing': 0.4, 'ending-ed': 0.8, compound: 0 };
  return EARLY_EXTENDED_WORDS
    .filter((e) => e.mode === mode && e.scopeVowels.every((v) => vowels.includes(v)))
    .map((e) => {
      // -ed said as its own beat (rested) is the hardest ending; a compound of longer parts is harder.
      const extra = e.kind === 'ending-ed' && e.decodingParts[e.decodingParts.length - 1] === 'ed' ? 0.3
        : e.kind === 'compound' ? 0.2 * Math.max(0, e.word.length - 6) : 0;
      return {
        beta: +(KIND_BETA[e.kind] + extra + Math.max(...e.scopeVowels.map((v) => VOWEL_BETA[v] ?? 0))).toFixed(2),
        structure: e.kind,
        words: [e.word],
        payload: { mode, targetWord: e.word },
      };
    });
}

const CACHE = new Map<string, WordSpaceItem<WorkoutPayload>[]>();

/** Every item one mode allows at a grade inside a vowel scope. Built once per process per scope. */
export function workoutSpace(mode: WorkoutSpaceMode, grade: string, vowels: readonly string[]): readonly WordSpaceItem<WorkoutPayload>[] {
  const k = `${mode}|${grade}|${[...vowels].sort().join('')}`;
  if (!CACHE.has(k)) {
    CACHE.set(k, mode === 'real-vs-nonsense' ? realNonsense(grade, vowels) : mode === 'picture-match' ? pictureMatch(grade, vowels)
      : mode === 'word-chains' ? wordChains(grade, vowels) : tableItems(mode, vowels));
  }
  return CACHE.get(k)!;
}

/** Test helper: is this string on the build-time nonsense list? */
export const isListedNonsense = (s: string): boolean => NONSENSE.includes(s);
