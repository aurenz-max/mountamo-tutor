/**
 * Word spaces for word-flip (service/wordSpace): which base words a single-rule session flips, at the tier's
 * difficulty. The answer stays the generator's own rule (`deriveWordFlipAnswer`), passed in.
 *
 * The regular plurals (plural_s, plural_es, plural_y) take pictured countable nouns from the word library
 * (plus the rule's seed table), so a mass noun never gets a made-up plural (rices, milks). The closed tables
 * (irregulars, past_ed, past_irregular) keep their code-owned seeds and are tiered by structure.
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/word-flip/before.txt`, G1, 2 runs per tier): the
 * model drew a different handful each run, but the tier changed nothing (cloud, cat, dog, star, book at easy
 * and hard alike; box, fox, peach, bus, sandwich in every -es session).
 *
 * Difficulty features (logits; refit from first-try results). Morphology research (Berko's wug test and
 * after): a one-syllable base is easier to inflect than a longer one; a base ending in a consonant cluster
 * (desk -> desks) is harder to say with its ending; -es after ch/sh is heard more easily than after s/x
 * (buses, boxes blur into the base); for irregular plurals, an internal vowel change (foot -> feet) is learned
 * before an unrelated form (person -> people); for irregular pasts, a vowel change (run -> ran) before a
 * suppletive form (go -> went); -ed said as its own beat (painted) is the hardest regular past.
 */
import { lexWord, isVowel, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { nounPool } from './categorySpaces';

export type FlipType = 'plural_s' | 'plural_es' | 'plural_y' | 'irregulars' | 'past_ed' | 'past_irregular';
export interface FlipPayload { word: string; answer: string; emoji: string }

const COUNT_CATEGORIES: ReadonlySet<string> = new Set(['animal', 'vehicle', 'toy', 'clothing', 'body', 'home', 'tool', 'music', 'place']);
const ZERO_PLURAL: ReadonlySet<string> = new Set(['moose', 'deer', 'sheep', 'fish', 'jellyfish', 'shrimp', 'salmon', 'bison', 'squid', 'trout', 'buffalo', 'aircraft']);
const famBeta = (x: LexWord | undefined): number => (!x || x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const finalCluster = (x: LexWord | undefined): boolean =>
  !!x && x.phones.length >= 3 && !isVowel(x.phones[x.phones.length - 1]) && !isVowel(x.phones[x.phones.length - 2]);

/** Vowel-change irregulars (learned first) vs other forms. */
const VOWEL_CHANGE_PLURAL = new Set(['man', 'woman', 'foot', 'tooth', 'goose']);
const VOWEL_CHANGE_PAST = new Set(['run', 'sit', 'get', 'come', 'eat', 'give']);
const SUPPLETIVE_PAST = new Set(['go', 'do', 'have', 'say']);

export function flipSpace(
  type: FlipType,
  grade: string,
  answerOf: (type: FlipType, word: string) => string | null,
  seeds: ReadonlyArray<{ word: string; emoji: string }>,
): WordSpaceItem<FlipPayload>[] {
  const regular = type === 'plural_s' || type === 'plural_es' || type === 'plural_y';
  // A countable noun: its kind is one you count (animals, vehicles, toys). Food, drink, nature and weather hold
  // mass nouns (rice, milk, butter); their countable members (peach, cherry) come from the seed table only,
  // because a library plural is no evidence ("butters" is a verb).
  // Objects only (school and sport hold plus, multiply, tennis); not already plural in form (goggles,
  // sunglasses end in a /z/ sound); not a zero or irregular plural (moose, deer, sheep, fish).
  const countable = (x: LexWord) => COUNT_CATEGORIES.has(x.category) && !ZERO_PLURAL.has(x.w)
    && !(x.w.endsWith('s') && x.phones[x.phones.length - 1] === 'Z');
  const library = regular
    ? nounPool(grade).filter((x) => { const a = answerOf(type, x.w); return !!a && countable(x); }).map((x) => ({ word: x.w, emoji: x.emoji! }))
    : [];
  const bases = [...library, ...seeds.filter((s0) => !library.some((b) => b.word === s0.word))];
  return bases.flatMap((b) => {
    const answer = answerOf(type, b.word);
    if (!answer) return [];
    const x = lexWord(b.word);
    const syll = x?.syllables ?? 1;
    let beta = 0.3 * (syll - 1) + famBeta(x);
    let structure = `${syll}-syllable`;
    if (type === 'plural_s' && finalCluster(x)) { beta += 0.3; structure += ':cluster'; }
    if (type === 'plural_es') { const sib = /(s|x)$/.test(b.word); beta += sib ? 0.3 : 0; structure = `${sib ? 's-x' : 'ch-sh'}:${syll}`; }
    if (type === 'irregulars') { const v = VOWEL_CHANGE_PLURAL.has(b.word); beta += v ? 0 : 0.6; structure = v ? 'vowel-change' : 'other-form'; }
    if (type === 'past_irregular') {
      const kind = VOWEL_CHANGE_PAST.has(b.word) ? 'vowel-change' : SUPPLETIVE_PAST.has(b.word) ? 'new-word' : 'other';
      beta += { 'vowel-change': 0, other: 0.4, 'new-word': 0.8 }[kind]; structure = kind;
    }
    if (type === 'past_ed') {
      const own = /[td]$/.test(b.word); const voiced = !own && !!x && !['P', 'K', 'S', 'SH', 'CH', 'F', 'TH'].includes(x.phones[x.phones.length - 1]);
      beta += own ? 0.6 : voiced ? 0.2 : 0; structure = own ? 'ed-beat' : voiced ? 'd-sound' : 't-sound';
    }
    return [{ beta: +beta.toFixed(2), structure, key: structure, words: [b.word], payload: { word: b.word, answer, emoji: b.emoji } }];
  });
}
