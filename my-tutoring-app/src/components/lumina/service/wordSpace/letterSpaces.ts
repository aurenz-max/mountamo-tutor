/**
 * Letter spaces (service/wordSpace): items whose target is a LETTER, for letter-sound-link (and any
 * letter-sound task). An item is a target letter and, where the task shows one, a wrong letter; its beta
 * comes from how the letter's name helps its sound and how near the wrong letter is.
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/letter-sound-link/before.txt`, K, 2 runs per
 * tier): the group's letters in the same order with the same wrong letters at every tier (s a t i p n; d/t,
 * m/n, e/i); the tier changed only the on-screen cues.
 *
 * Difficulty features (logits; refit from first-try results). Letter-sound research (Treiman's letter-name
 * effect): a letter whose NAME starts with its sound (b "bee", d, j, k, p, t, v, z) is learned first; one
 * whose name ends with it (f "ef", l, m, n, s, x) next; one whose name gives no cue (h "aitch", w, y), says
 * two sounds (c, g), or is a short vowel (the name says the long vowel) last. A wrong letter that looks alike
 * (b/d/p/q, n/h/u, m/n) or sounds alike (b/p, m/n, e/i, o/u) is harder to reject than an unrelated one.
 */
import { WORDS, knownByForGrade, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { BASIC_SOUND, isInflected } from './scope';

export type LetterMode = 'see-hear' | 'hear-see' | 'keyword-match';
export interface LetterPayload { targetLetter: string; distractor: string | null }

/** How much the letter's name gives away its sound. */
export const NAME_CUE_BETA: Readonly<Record<string, number>> = {
  b: 0, d: 0, j: 0, k: 0, p: 0, t: 0, v: 0, z: 0,
  f: 0.4, l: 0.4, m: 0.4, n: 0.4, s: 0.4, x: 0.5,
  r: 0.6, h: 0.8, w: 0.8, y: 0.8, c: 0.7, g: 0.7, qu: 0.7,
  a: 0.7, o: 0.7, u: 0.8, e: 0.9, i: 0.9,
};
const LOOK_ALIKE: ReadonlyArray<readonly string[]> = [['b', 'd', 'p', 'q'], ['n', 'h', 'u'], ['m', 'n', 'w'], ['f', 't'], ['i', 'l'], ['a', 'o']];
const SOUND_ALIKE: ReadonlyArray<readonly string[]> = [['b', 'p'], ['d', 't'], ['g', 'k'], ['g', 'c'], ['m', 'n'], ['f', 'v'], ['s', 'z'], ['e', 'i'], ['o', 'u'], ['a', 'e'], ['l', 'r'], ['w', 'r'], ['w', 'y'], ['j', 'g']];
const inPair = (sets: ReadonlyArray<readonly string[]>, a: string, b: string) => sets.some((s) => s.includes(a) && s.includes(b));

export type DistractorKind = 'far' | 'look' | 'sound' | 'both';
export const distractorKind = (target: string, wrong: string): DistractorKind => {
  const look = inPair(LOOK_ALIKE, target, wrong); const sound = inPair(SOUND_ALIKE, target, wrong);
  return look && sound ? 'both' : look ? 'look' : sound ? 'sound' : 'far';
};
const KIND_BETA: Record<DistractorKind, number> = { far: 0, look: 0.5, sound: 0.6, both: 0.9 };

/** Beta and structure of one (target, wrong letter) item; the generator re-stamps after its session gate. */
export function letterItemBeta(mode: LetterMode, target: string, wrong: string | null): { beta: number; structure: string } {
  const cue = NAME_CUE_BETA[target] ?? 0.6;
  const cueName = cue === 0 ? 'name-starts' : cue <= 0.5 ? 'name-ends' : 'no-cue';
  if (!wrong) return { beta: +(0.2 + cue).toFixed(2), structure: cueName };
  const kind = distractorKind(target, wrong);
  // keyword-match shows pictures, not letters: only the SOUND of the wrong picture's first letter competes.
  const near = mode === 'keyword-match' ? (kind === 'sound' || kind === 'both' ? 0.6 : 0) : KIND_BETA[kind];
  return { beta: +((mode === 'hear-see' ? 0.4 : 0.6) + cue + near).toFixed(2), structure: `${cueName}:${mode === 'keyword-match' && kind === 'look' ? 'far' : kind}` };
}

/**
 * Every item one mode allows inside a letter set. `targetable` is the mode's own rule (see-hear: a sound a
 * child can say alone; keyword-match: a keyword whose picture names it), `wrongable` the rule for the wrong
 * option (keyword-match: its picture too), and `sameSound` excludes a wrong letter that makes the target's
 * sound (c/k).
 */
export function letterSpace(
  mode: LetterMode,
  letters: readonly string[],
  targetable: (l: string) => boolean,
  wrongable: (l: string) => boolean,
  sameSound: (a: string, b: string) => boolean,
): WordSpaceItem<LetterPayload>[] {
  const items: WordSpaceItem<LetterPayload>[] = [];
  for (const t of letters.filter(targetable)) {
    if (mode === 'see-hear') {
      const { beta, structure } = letterItemBeta(mode, t, null);
      items.push({ beta, structure, key: structure, words: [t], payload: { targetLetter: t, distractor: null } });
      continue;
    }
    for (const w of letters.filter((l) => l !== t && wrongable(l) && !sameSound(t, l))) {
      const { beta, structure } = letterItemBeta(mode, t, w);
      items.push({ beta, structure, key: t, words: [t], shown: [t, w], payload: { targetLetter: t, distractor: w } });
    }
  }
  return items;
}

// ── Key words: a letter and a familiar word that starts with its basic sound ─────────────────

export interface KeyWordPayload { targetLetter: string; targetWord: string }
const NOUN_CATEGORIES: ReadonlySet<string> = new Set(['animal', 'food', 'drink', 'clothing', 'vehicle', 'body', 'home', 'toy', 'nature',
  'weather', 'tool', 'music', 'sport', 'school', 'place', 'person', 'shape']);

/**
 * Every (letter, key word) item for a sentence-spotter task: the word starts with the letter AND the
 * letter's basic sound (sun for s; never sheep, city or giraffe), is a familiar content word of one or two
 * syllables, and is not an inflected form. Beta: the letter-name cue, plus a little for a word the grade knows later, a longer
 * word, and c (a child may say "k" for the sound it hears).
 */
export function keyWordSpace(letters: readonly string[], grade: string, okWord: (w: string) => boolean): WordSpaceItem<KeyWordPayload>[] {
  const allowed = knownByForGrade(grade);
  const items: WordSpaceItem<KeyWordPayload>[] = [];
  const fam = (x: LexWord) => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
  for (const l of letters) {
    const unit = l === 'q' ? 'qu' : l;
    const first = (BASIC_SOUND[unit] ?? []).map((p) => `${unit}/${p}`);
    // Things, not actions or function words: the hidden letter starts a word the child can picture, and the
    // generator's fallback frames ("I can see the ___") need a noun.
    const words = WORDS.filter((x) => allowed.has(x.knownBy) && x.syllables <= 2 && !!x.gpcs && first.includes(x.gpcs[0])
      && NOUN_CATEGORIES.has(x.category) && /^[a-z]{2,7}$/.test(x.w) && !isInflected(x) && okWord(x.w));
    for (const x of words) {
      items.push({
        // A cluster start (trash, plant) blurs the first sound a little; two syllables add a little.
        beta: +((NAME_CUE_BETA[l] ?? 0.6) + fam(x) + (x.syllables > 1 ? 0.1 : 0) + (x.gpcs!.length > 1 && !/[aeiou]/.test(x.gpcs![1][0]) && x.gpcs![0].length < 5 ? 0.2 : 0)
          + (l === 'c' ? 0.3 : 0)).toFixed(2),
        structure: (NAME_CUE_BETA[l] ?? 0.6) === 0 ? 'name-starts' : (NAME_CUE_BETA[l] ?? 0.6) <= 0.5 ? 'name-ends' : 'no-cue',
        key: l,
        words: [`letter:${l}`, x.w],
        payload: { targetLetter: l, targetWord: x.w },
      });
    }
  }
  return items;
}
