/**
 * Word spaces for phoneme-explorer's six modes (service/wordSpace).
 *
 * Each builder lists every item its mode allows at a grade, from the word library, with the answer and the
 * wrong cards computed here and a predicted beta from the item's structure. The generator picks by tier
 * (pick.ts) and ships the payload as a challenge; no model chooses a word, an answer or a distractor.
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/phoneme-explorer/before.txt`, K, 2 runs per tier):
 * easy, medium and hard gave the same items in every mode; cat/dog/sun/pig/pen in every mode; segment's
 * answer was "three" in 12 of 12 runs; ending gave the same 5 items every run; isolate shipped "/S/ -> Bus".
 *
 * Difficulty features (beta priors, logits; refit from first-try results). Phonological-awareness research
 * order: first sound < last sound < middle sound; sounds you can stretch (m, s, f) < stops (b, t, k); a
 * single consonant < a consonant cluster; a distractor that differs by one feature (b/p, m/n, e/i) is the
 * near confusion. Familiarity adds a little (a G1 word in a G1 lesson).
 */
import {
  CONTINUANTS, NEAR_SOUND, NEAR_VOWEL, SHORT_VOWEL_OF, WORDS, knownByForGrade, isVowel, onsetOf, rimeOf,
  soundLabel, soundSaid, type LexWord,
} from './lexicon';
import type { WordSpaceItem } from './pick';

export type PhonemeSpaceMode = 'isolate' | 'ending' | 'medial' | 'blend' | 'segment' | 'manipulate';
type Card = { word: string; emoji: string; correct: boolean };
export type PhonemeChallengePayload = Record<string, unknown>;

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const card = (x: LexWord, correct: boolean): Card => ({ word: x.w, emoji: x.emoji!, correct });
const hash = (s: string): number => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };
const take = <T>(list: readonly T[], key: string): T | undefined => (list.length ? list[hash(key) % list.length] : undefined);
/** Answer position rotates with the item, never always first. */
/** Every card in an item shows a different picture (cot and bed are both a bed). */
const distinctPictures = (words: Array<LexWord | undefined>): boolean => new Set(words.map((x) => x?.emoji)).size === words.length;
const placeAnswer = (answer: Card, wrong: Card[], key: string): Card[] => {
  const cards = [...wrong];
  cards.splice(hash(key) % (wrong.length + 1), 0, answer);
  return cards;
};

/** One-syllable pictured words a lesson at this grade may use. */
function pool(grade: string): LexWord[] {
  const allowed = knownByForGrade(grade);
  return WORDS.filter((x) => allowed.has(x.knownBy) && x.emoji && x.syllables === 1 && x.gpcs && x.phones.length >= 2 && x.phones.length <= 5);
}
/** A short-vowel CVC by sound and spelling (cat, dog, sun; not car, cake, book). */
const isShortCvc = (x: LexWord): boolean =>
  x.phones.length === 3 && !isVowel(x.phones[0]) && !!SHORT_VOWEL_OF[x.phones[1]] && !isVowel(x.phones[2]) && x.phones[2] !== 'R'
  && x.shape === 'CVC';
const vowelLetter = (x: LexWord): string | null => {
  const pair = x.gpcs?.find((g) => /^[aeiou]\//.test(g));
  const letter = pair?.[0];
  return letter && SHORT_VOWEL_OF[x.phones[1]] === letter ? letter : null;
};

// ── isolate: which card starts with the sound ─────────────────────────────────────────────
function isolateItems(grade: string): WordSpaceItem<PhonemeChallengePayload>[] {
  const words = pool(grade).filter((x) => !isVowel(x.phones[0]) && soundSaid(x.phones[0]));
  const items: WordSpaceItem<PhonemeChallengePayload>[] = [];
  for (const answer of words) {
    const T = answer.phones[0];
    const grapheme = answer.gpcs![0].split('/')[0];
    if (grade === 'K' && onsetOf(answer).length > 1) continue; // K: a single first sound
    // The tile shows one letter or sh/ch/th, never a silent-letter spelling (kn, wr) or q/x.
    if (!/^([a-pr-wyz]|sh|ch|th)$/.test(grapheme)) continue;
    const sameStart = words.filter((x) => x !== answer && x.phones[0] === T && x.gpcs![0] === answer.gpcs![0] && onsetOf(x).length === 1);
    const example = take(sameStart, `${answer.w}:ex`);
    if (!example) continue;
    const others = words.filter((x) => x.phones[0] !== T && onsetOf(x).length === 1 && x.w !== example.w);
    const near = others.filter((x) => NEAR_SOUND[T] === x.phones[0]);
    const rhymeMate = others.filter((x) => rimeOf(x) === rimeOf(answer));
    const variants: Array<{ s: string; d: Array<LexWord | undefined>; b: number }> = [
      { s: 'far', d: [take(others, `${answer.w}:1`), take(others, `${answer.w}:2`), take(others, `${answer.w}:3`)], b: 0 },
      { s: 'rhyme', d: [take(rhymeMate, `${answer.w}:r`), take(others, `${answer.w}:2`), take(others, `${answer.w}:3`)], b: 0.3 },
      { s: 'near', d: [take(near, `${answer.w}:n`), take(rhymeMate, `${answer.w}:r`) ?? take(others, `${answer.w}:4`), take(others, `${answer.w}:3`)], b: 0.7 },
    ];
    for (const { s, d, b } of variants) {
      if (d.some((x) => !x)) continue;
      const wrong = d as LexWord[];
      // Three different wrong first sounds, none the target's, no word twice.
      if (new Set(wrong.map((x) => x.phones[0])).size < 3 || new Set([answer.w, example.w, ...wrong.map((x) => x.w)]).size < 5) continue;
      if (!distinctPictures([answer, example, ...wrong])) continue;
      const cont = CONTINUANTS.has(T);
      items.push({
        beta: b + (cont ? 0 : 0.3) + famBeta(answer),
        structure: `${s}:${cont ? 'stretch' : 'stop'}`,
        key: T,
        words: [answer.w, example.w],
        shown: [answer.w, example.w, ...wrong.map((x) => x.w)],
        payload: {
          phoneme: grapheme.toUpperCase(),
          phonemeSound: soundSaid(T)!,
          exampleWord: example.w,
          exampleEmoji: example.emoji,
          choices: placeAnswer(card(answer, true), wrong.map((x) => card(x, false)), answer.w + s),
        },
      });
    }
  }
  return items;
}

// ── ending: which heard word ends with the same sound ─────────────────────────────────────
function endingItems(grade: string): WordSpaceItem<PhonemeChallengePayload>[] {
  const cvc = pool(grade).filter(isShortCvc);
  const items: WordSpaceItem<PhonemeChallengePayload>[] = [];
  for (const target of cvc) {
    const F = target.phones[2];
    // The answer shares ONLY the last sound: not the first sound, not the rime (a rhyme answers by rhyme).
    const answers = cvc.filter((x) => x !== target && x.phones[2] === F && x.phones[0] !== target.phones[0] && x.phones[1] !== target.phones[1]);
    const answer = take(answers, `${target.w}:a`);
    if (!answer) continue;
    const others = cvc.filter((x) => x.phones[2] !== F && x !== target);
    // The closest wrong card shares the target's first two sounds (cap / cat): only the end tells them apart.
    const sameStart = others.filter((x) => x.phones[0] === target.phones[0] && x.phones[1] === target.phones[1]);
    const nearEnd = others.filter((x) => NEAR_SOUND[F] === x.phones[2]);
    const variants: Array<{ s: string; d: Array<LexWord | undefined>; b: number }> = [
      { s: 'far', d: [take(others, `${target.w}:1`), take(others, `${target.w}:2`), take(others, `${target.w}:3`)], b: 0 },
      { s: 'same-start', d: [take(sameStart, `${target.w}:s`), take(others, `${target.w}:2`), take(others, `${target.w}:3`)], b: 0.4 },
      { s: 'near-end', d: [take(nearEnd, `${target.w}:n`), take(sameStart, `${target.w}:s`) ?? take(others, `${target.w}:4`), take(others, `${target.w}:3`)], b: 0.8 },
    ];
    for (const { s, d, b } of variants) {
      if (d.some((x) => !x)) continue;
      const wrong = d as LexWord[];
      if (new Set(wrong.map((x) => x.w)).size < 3 || wrong.some((x) => x.w === answer.w)) continue;
      if (!distinctPictures([target, answer, ...wrong])) continue;
      const cont = CONTINUANTS.has(F);
      items.push({
        beta: 0.6 + b + (cont ? 0 : 0.3) + famBeta(target),
        structure: `${s}:${cont ? 'stretch' : 'stop'}`,
        key: F,
        words: [target.w, answer.w],
        shown: [target.w, answer.w, ...wrong.map((x) => x.w)],
        payload: {
          targetWord: target.w,
          targetEmoji: target.emoji,
          finalPhoneme: soundLabel(F),
          choices: placeAnswer(card(answer, true), wrong.map((x) => card(x, false)), target.w + s),
        },
      });
    }
  }
  return items;
}

// ── medial: which card has the same middle vowel ──────────────────────────────────────────
function medialItems(grade: string): WordSpaceItem<PhonemeChallengePayload>[] {
  const cvc = pool(grade).filter((x) => isShortCvc(x) && vowelLetter(x));
  const items: WordSpaceItem<PhonemeChallengePayload>[] = [];
  const vowelKey = (x: LexWord) => SHORT_VOWEL_OF[x.phones[1]];
  for (const target of cvc) {
    const v = vowelKey(target);
    // The answer rhymes with the target only when the wrong cards share that ending too (hat / hot / hut):
    // otherwise rhyme alone would find it.
    const sameVowel = cvc.filter((x) => x !== target && vowelKey(x) === v && x.phones[0] !== target.phones[0]);
    const rhymeAnswer = take(sameVowel.filter((x) => x.phones[2] === target.phones[2]), `${target.w}:ar`);
    const otherAnswer = take(sameVowel.filter((x) => x.phones[2] !== target.phones[2]), `${target.w}:ao`);
    const others = cvc.filter((x) => vowelKey(x) !== v);
    // Same frame, different vowel (hat / hot / hut): only the vowel tells them apart.
    const sameFrame = others.filter((x) => x.phones[2] === target.phones[2]);
    const nearVowel = others.filter((x) => (NEAR_VOWEL[target.phones[1]] ?? []).includes(x.phones[1]));
    const distinctVowels = (list: Array<LexWord | undefined>) => list.every(Boolean) && new Set(list.map((x) => vowelKey(x!))).size === list.length;
    const otherFrame = others.filter((x) => x.phones[2] !== target.phones[2]);
    /** Up to n words with n different vowels, the same choice for the same target every time. */
    const oneEachVowel = (list: LexWord[], n: number, salt: string): LexWord[] => {
      const byVowel = new Map<string, LexWord[]>();
      for (const x of list) byVowel.set(vowelKey(x), [...(byVowel.get(vowelKey(x)) ?? []), x]);
      return Array.from(byVowel.keys()).sort().slice(0, n).map((k) => take(byVowel.get(k)!, target.w + salt)!);
    };
    const frame3 = oneEachVowel(sameFrame, 3, ':f');
    const far3 = oneEachVowel(otherFrame, 3, ':o');
    const variants: Array<{ s: string; a?: LexWord; d: Array<LexWord | undefined>; b: number }> = [
      { s: 'far', a: otherAnswer, d: far3, b: 0 },
      { s: 'same-frame', a: rhymeAnswer, d: frame3, b: 0.4 },
      { s: 'near-vowel', a: otherAnswer, d: [take(nearVowel, `${target.w}:n`), ...far3.filter((x) => !nearVowel.includes(x) && vowelKey(x) !== vowelKey(take(nearVowel, `${target.w}:n`) ?? x)).slice(0, 1), take(sameFrame.filter((x) => !(NEAR_VOWEL[target.phones[1]] ?? []).includes(x.phones[1])), `${target.w}:f`)], b: 0.8 },
    ];
    for (const { s, a: answer, d, b } of variants) {
      if (!answer || d.length !== 3 || !distinctVowels(d)) continue;
      const wrong = d as LexWord[];
      if (new Set(wrong.map((x) => x.w)).size < 3 || !distinctPictures([target, answer, ...wrong])) continue;
      items.push({
        beta: 1.2 + b + ({ e: 0.3, i: 0.2, u: 0.1 }[v] ?? 0) + famBeta(target),
        structure: `${s}:${v}`,
        key: v,
        words: [target.w, answer.w],
        shown: [target.w, answer.w, ...wrong.map((x) => x.w)],
        payload: {
          targetWord: target.w,
          targetEmoji: target.emoji,
          vowel: v,
          choices: placeAnswer(card(answer, true), wrong.map((x) => card(x, false)), target.w + s),
        },
      });
    }
  }
  return items;
}

/** Sound count a grade's blend/segment items may have. K: CVC words (3), plus 2 and 4 for segment so the
 *  count is not always "three"; grade 1: 2-4; grade 2: 3-5. */
const soundRange = (mode: 'blend' | 'segment', grade: string): [number, number] =>
  grade === 'K' ? (mode === 'blend' ? [3, 3] : [2, 4]) : grade === '1' ? [2, 4] : [3, 5];

// ── blend: hear the sounds, say the word ──────────────────────────────────────────────────
function blendItems(grade: string): WordSpaceItem<PhonemeChallengePayload>[] {
  const [lo, hi] = soundRange('blend', grade);
  return pool(grade)
    .filter((x) => x.phones.length >= lo && x.phones.length <= hi && (grade !== 'K' || (isShortCvc(x) && vowelLetter(x))))
    .map((x) => {
      const stops = x.phones.filter((p) => !isVowel(p) && !CONTINUANTS.has(p)).length;
      const cluster = onsetOf(x).length > 1 || x.phones.slice(x.phones.findIndex(isVowel) + 1).length > 1;
      return {
        beta: 0.8 * (x.phones.length - 3) + 0.25 * stops + (cluster ? 0.3 : 0) + ({ EH: 0.2, IH: 0.2 }[x.phones[1]] ?? 0) + famBeta(x),
        structure: `${x.phones.length}:${CONTINUANTS.has(x.phones[0]) ? 'stretch' : 'stop'}`,
        words: [x.w],
        produces: x.w,
        payload: { phonemeSequence: x.phones.map(soundLabel), word: x.w, emoji: x.emoji },
      };
    });
}

// ── segment: hear the word, say how many sounds ───────────────────────────────────────────
function segmentItems(grade: string): WordSpaceItem<PhonemeChallengePayload>[] {
  const [lo, hi] = soundRange('segment', grade);
  return pool(grade)
    // No r after the vowel (jar, fire): teachers count "ar" as one sound or two, so the count is not one answer.
    .filter((x) => x.phones.length >= lo && x.phones.length <= hi && x.phones.filter(isVowel).length === 1
      && x.phones[x.phones.findIndex(isVowel) + 1] !== 'R' && !x.phones.includes('ER'))
    .map((x) => {
      // More sounds is harder; a word whose letters outnumber its sounds (duck, ship) tempts a reader to count letters.
      const lettersNotSounds = x.w.length !== x.phones.length;
      return {
        beta: 0.9 * (x.phones.length - 2) + (lettersNotSounds ? 0.3 : 0) + famBeta(x),
        structure: `${x.phones.length}:${lettersNotSounds ? 'spelling-differs' : 'one-letter-each'}`,
        words: [x.w],
        payload: { targetWord: x.w, targetEmoji: x.emoji, segments: x.phones.map(soundLabel) },
      };
    });
}

// ── manipulate: change one sound, say the new word ────────────────────────────────────────
function manipulateItems(grade: string): WordSpaceItem<PhonemeChallengePayload>[] {
  const words = pool(grade).filter((x) => x.phones.length === 3 || (grade !== 'K' && x.phones.length === 4));
  // K: change the first sound only. Grade 1 adds the last sound; grade 2 adds the middle vowel.
  const positions = grade === 'K' ? [0] : grade === '1' ? [0, -1] : [0, -1, 1];
  const items: WordSpaceItem<PhonemeChallengePayload>[] = [];
  for (const from of words) {
    for (const pos of positions) {
      const at = pos < 0 ? from.phones.length + pos : pos;
      const old = from.phones[at];
      if (pos === 1 ? !isVowel(old) : isVowel(old)) continue;
      for (const to of words) {
        if (to === from || to.phones.length !== from.phones.length) continue;
        if (to.phones.some((p, i) => (i === at ? p === old : p !== from.phones[i]))) continue;
        const neu = to.phones[at];
        if (pos !== 1 && isVowel(neu)) continue;
        const near = NEAR_SOUND[old] === neu || (pos === 1 && (NEAR_VOWEL[old] ?? []).includes(neu));
        const where = pos === 0 ? 'first' : pos === 1 ? 'middle' : 'last';
        const description = `Change the /${soundLabel(old)}/ in ${from.w} to /${soundLabel(neu)}/.`;
        if (new RegExp(`\\b${to.w}\\b`, 'i').test(description)) continue;
        items.push({
          // A stop is harder to hold and swap than a sound you can stretch; e/i words are the vowel confusion.
          beta: 0.6 + { first: 0, last: 0.4, middle: 0.8 }[where] + (near ? 0.5 : 0) + (CONTINUANTS.has(old) ? 0 : 0.2)
            + (CONTINUANTS.has(neu) ? 0 : 0.2) + ({ EH: 0.2, IH: 0.2 }[from.phones[1]] ?? 0) + famBeta(to),
          structure: `${where}:${near ? 'near' : 'far'}:${CONTINUANTS.has(neu) ? 'stretch' : 'stop'}`,
          words: [from.w, to.w],
          shown: [from.w],
          produces: to.w,
          payload: {
            originalWord: from.w, originalEmoji: from.emoji, operation: 'substitute',
            operationDescription: description, resultWord: to.w, resultEmoji: to.emoji,
          },
        });
      }
    }
  }
  return items;
}

const BUILDERS: Record<PhonemeSpaceMode, (grade: string) => WordSpaceItem<PhonemeChallengePayload>[]> = {
  isolate: isolateItems, ending: endingItems, medial: medialItems, blend: blendItems, segment: segmentItems, manipulate: manipulateItems,
};
const CACHE = new Map<string, WordSpaceItem<PhonemeChallengePayload>[]>();

/** Every item one mode allows at a grade ('K', '1', '2'). Built once per process. */
export function phonemeSpace(mode: PhonemeSpaceMode, grade: string): readonly WordSpaceItem<PhonemeChallengePayload>[] {
  const key = `${mode}|${grade}`;
  if (!CACHE.has(key)) CACHE.set(key, BUILDERS[mode](grade));
  return CACHE.get(key)!;
}
