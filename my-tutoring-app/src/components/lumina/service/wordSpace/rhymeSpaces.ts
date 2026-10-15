/**
 * Word spaces for rhyme-studio (service/wordSpace): rhyme pairs, options and production targets from the
 * word library, with the answer computed from the phonemes.
 *
 * A rhyme is a shared rime by sound (`rimeOf`): cat/hat, bear/pear; never bow/cow. The component highlights
 * the target's spelled ending and the generator's gate checks spelling, so on this path a rhyming pair also
 * shares its spelled ending (cat/hat, not bear/hair), and a non-rhyming word neither sounds nor is spelled
 * like the target's ending. Both checks agree on every item.
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/rhyme-studio/before.txt`, K, 2 runs per tier):
 * every mode served cat/hat, pig, sun, dog at every tier; identification pictured its wrong cards with a
 * placeholder star (cap -> star).
 *
 * Difficulty features (logits; refit from first-try results). Rhyme research: a wrong word that shares the
 * target's first sound (cat/cap) is the signature confusion (alliteration for rhyme), then one that shares
 * the last sound (cat/pot, a near rhyme), then one that shares the vowel (cat/bag); an unrelated word is
 * easiest. Saying "yes, they rhyme" is easier than rejecting a near miss. A target with many familiar rhymes
 * (cat, 20+) is easier to produce a rhyme for than one with few (fox). Familiarity adds a little.
 */
import { isVowel, knownByForGrade, onsetOf, rimeOf, WORDS, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { isInflected } from './scope';
import { isSentinelSafeWord } from '../../primitives/visual-primitives/literacy/rhymeStudioScript';

export type RhymeSpaceMode = 'recognition' | 'identification' | 'production' | 'collection';
export type RhymePayload = Record<string, unknown>;

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const hash = (s: string): number => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };
const take = <T>(list: readonly T[], key: string): T | undefined => (list.length ? list[hash(key) % list.length] : undefined);
/** Words the generator's recognition rule keeps out (SP-7), plus words said two ways. */
const EXCLUDED = new Set(['one', 'two', 'four', 'eight', 'there', 'were', 'done', 'gone', 'come', 'some', 'love', 'have', 'give', 'live',
  'said', 'says', 'though', 'through', 'tough', 'cough', 'dough', 'bow', 'dove', 'wind', 'read', 'lead', 'tear', 'bass', 'close', 'row', 'sow']);

/** The spelled ending the component highlights: the word from its first vowel letter (cat -> at, night -> ight). */
export const spelledRime = (w: string): string => {
  const m = /^(qu|[^aeiouy]*)(.*)$/.exec(w);
  const rest = m?.[2] ?? w;
  return rest || w;
};
const lastPhone = (x: LexWord) => x.phones[x.phones.length - 1];
const vowelPhone = (x: LexWord) => x.phones.find(isVowel);

/** One-syllable, pictured, familiar words; the stimulus at K is the picture. */
function pool(grade: string): LexWord[] {
  const allowed = knownByForGrade(grade);
  return WORDS.filter((x) => allowed.has(x.knownBy) && x.emoji && x.gpcs && x.syllables === 1 && x.phones.length >= 2
    && !isInflected(x) && !EXCLUDED.has(x.w) && isSentinelSafeWord(x.w) && /^[a-z]+$/.test(x.w));
}
/** A rhyme on this path: same sound rime AND the same spelled ending as the target. */
export const rhymesWith = (t: LexWord, x: LexWord): boolean => x.w !== t.w && rimeOf(x) === rimeOf(t) && x.w.endsWith(spelledRime(t.w));
/** Clearly not a rhyme: neither the sound rime nor the spelled ending. */
const notRhyme = (t: LexWord, x: LexWord): boolean => x.w !== t.w && rimeOf(x) !== rimeOf(t) && !x.w.endsWith(spelledRime(t.w));
type Kind = 'onset' | 'coda' | 'vowel' | 'far';
const kindOf = (t: LexWord, x: LexWord): Kind => {
  const on = onsetOf(t);
  if (on.length && on.join(' ') === onsetOf(x).join(' ')) return 'onset';
  if (lastPhone(t) === lastPhone(x) && !isVowel(lastPhone(t))) return 'coda';
  if (vowelPhone(t) === vowelPhone(x)) return 'vowel';
  return 'far';
};
const KIND_BETA: Record<Kind, number> = { far: 0, vowel: 0.4, coda: 0.7, onset: 0.9 };

const base = (t: LexWord) => ({ targetWord: t.w, targetWordImage: t.emoji, targetWordEmoji: t.emoji, rhymeFamily: `-${spelledRime(t.w)}` });

function recognitionItems(grade: string): WordSpaceItem<RhymePayload>[] {
  const words = pool(grade);
  const items: WordSpaceItem<RhymePayload>[] = [];
  for (const t of words) {
    const partners = words.filter((x) => rhymesWith(t, x));
    if (!partners.length) continue;
    const yes = take(partners, `${t.w}:y`)!;
    const others = words.filter((x) => notRhyme(t, x));
    const pairs: Array<{ c: LexWord | undefined; s: string; b: number; rhyme: boolean }> = [
      { c: yes, s: 'yes', b: -0.3 + (onsetOf(t).length > 1 || onsetOf(yes).length > 1 ? 0.2 : 0), rhyme: true },
      ...(['far', 'vowel', 'coda', 'onset'] as Kind[]).map((k) => ({ c: take(others.filter((x) => kindOf(t, x) === k), `${t.w}:${k}`), s: `no-${k}`, b: KIND_BETA[k], rhyme: false })),
    ];
    for (const { c, s, b, rhyme } of pairs) {
      if (!c || c.emoji === t.emoji) continue; // two words drawn the same (cot, bed) cannot be told apart
      items.push({
        beta: +(0.2 + b + famBeta(t) + 0.5 * famBeta(c)).toFixed(2),
        structure: s,
        key: rhyme ? 'yes' : 'no',
        words: [t.w, c.w],
        payload: { mode: 'recognition', ...base(t), comparisonWord: c.w, comparisonWordImage: c.emoji, comparisonWordEmoji: c.emoji, doesRhyme: rhyme },
      });
    }
  }
  return items;
}

function identificationItems(grade: string): WordSpaceItem<RhymePayload>[] {
  const words = pool(grade);
  const wrongCount = grade === 'K' ? 1 : 2; // K shows two pictures (the band's menu size); readers three
  const items: WordSpaceItem<RhymePayload>[] = [];
  for (const t of words) {
    const partners = words.filter((x) => rhymesWith(t, x));
    const answer = take(partners, `${t.w}:a`);
    if (!answer) continue;
    const others = words.filter((x) => notRhyme(t, x) && notRhyme(answer, x));
    const byKind = (k: Kind, salt: string | number) => take(others.filter((x) => kindOf(t, x) === k), `${t.w}:${salt}`);
    const variants: Array<{ s: string; d: Array<LexWord | undefined> }> = wrongCount === 1
      ? [{ s: 'far', d: [byKind('far', 1)] }, { s: 'vowel', d: [byKind('vowel', 1)] }, { s: 'coda', d: [byKind('coda', 1)] }, { s: 'onset', d: [byKind('onset', 1)] }]
      : [{ s: 'far', d: [byKind('far', 1), byKind('far', 2)] }, { s: 'vowel', d: [byKind('vowel', 1), byKind('far', 2)] },
        { s: 'onset+vowel', d: [byKind('onset', 1), byKind('vowel', 2)] }, { s: 'onset+coda', d: [byKind('onset', 1), byKind('coda', 2)] }];
    for (const { s, d } of variants) {
      if (d.some((x) => !x) || new Set(d.map((x) => x!.w)).size !== d.length) continue;
      // Every card shows a different picture (cot and bed are both a bed).
      if (new Set([t, answer, ...d].map((x) => x!.emoji)).size !== d.length + 2) continue;
      const wrong = d as LexWord[];
      const b = wrong.reduce((sum, x) => Math.max(sum, KIND_BETA[kindOf(t, x)]), 0) + 0.15 * wrong.filter((x) => kindOf(t, x) !== 'far').length;
      const cards = wrong.map((x) => ({ word: x.w, image: x.emoji!, isCorrect: false }));
      cards.splice(hash(t.w + s) % (cards.length + 1), 0, { word: answer.w, image: answer.emoji!, isCorrect: true });
      items.push({
        beta: +(0.3 + b + famBeta(t) + 0.5 * famBeta(answer)).toFixed(2),
        structure: s,
        key: spelledRime(t.w),
        words: [t.w, answer.w],
        shown: [t.w, ...cards.map((c) => c.word)],
        payload: { mode: 'identification', ...base(t), options: cards },
      });
    }
  }
  return items;
}

/** How many familiar words (any grade's list up to this one, pictured or not) share the target's sound rime. */
function rhymeCount(grade: string): (t: LexWord) => number {
  const allowed = knownByForGrade(grade);
  const counts = new Map<string, number>();
  for (const x of WORDS) if (allowed.has(x.knownBy) && x.syllables === 1 && !isInflected(x)) counts.set(rimeOf(x), (counts.get(rimeOf(x)) ?? 0) + 1);
  return (t) => (counts.get(rimeOf(t)) ?? 1) - 1;
}

function openItems(mode: 'production' | 'collection', grade: string): WordSpaceItem<RhymePayload>[] {
  const count = rhymeCount(grade);
  const min = mode === 'collection' ? 6 : 4;
  return pool(grade)
    .filter((t) => count(t) >= min && pool(grade).some((x) => rhymesWith(t, x)))
    .map((t) => {
      const n = count(t);
      return {
        beta: +((mode === 'collection' ? 2.6 : 2.2) - 0.5 * Math.log2(n) + (onsetOf(t).length > 1 ? 0.2 : 0) + famBeta(t)).toFixed(2),
        structure: `${n >= 12 ? 'many' : n >= 7 ? 'some' : 'few'}-rhymes`,
        key: rimeOf(t),
        words: [t.w],
        payload: { mode, ...base(t) },
      };
    });
}

const CACHE = new Map<string, WordSpaceItem<RhymePayload>[]>();

/** Every item one mode allows at a grade ('K', '1', '2'). Built once per process. */
export function rhymeSpace(mode: RhymeSpaceMode, grade: string): readonly WordSpaceItem<RhymePayload>[] {
  const k = `${mode}|${grade}`;
  if (!CACHE.has(k)) {
    CACHE.set(k, mode === 'recognition' ? recognitionItems(grade) : mode === 'identification' ? identificationItems(grade) : openItems(mode, grade));
  }
  return CACHE.get(k)!;
}
